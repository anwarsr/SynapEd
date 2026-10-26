"use server";
import { revalidatePath } from "next/cache";
import { AVATARS, CLASS_FILES } from "@/lib/storagePaths";
import { deleteObjects } from "@/lib/storageCleanup";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess, requireOwnedClass } from "@/lib/classGuards";
import { normalizeInviteCode } from "@/lib/inviteCode";
import { hapusPercobaanKelas } from "@/lib/classQuizzes";
import type { Model3D } from "@/lib/model3dRules";
import {
  berkasAiKelas,
  bersihkanKelas,
  bersihkanPost,
  getPengaturanAi,
  listPostSubmissions,
  periksaBerkas,
  periksaModel3D,
} from "@/lib/classAssignments";
import {
  MAX_ASSIGNMENT_TITLE,
  MAX_FILES_PER_POST,
  MIME_KELAS,
  validasiPengaturan,
} from "@/lib/classAssignmentRules";
import {
  CLASS_MEMBERS,
  MAX_CLASS_DESC,
  MAX_CLASS_NAME,
  MAX_POST_BODY,
  MAX_REPLY_BODY,
  classRef,
  findClassByJoinCode,
  freshJoinCode,
  getMembership,
  getPost,
  listOwnedClasses,
  getReply,
  listPosts,
  memberRef,
  postsRef,
  repliesRef,
} from "@/lib/classes";

export type ClassResult = { ok: true; message: string } | { ok: false; error: string };
export type JoinResult =
  | { ok: true; message: string; classId: string }
  | { ok: false; error: string };

/**
 * Seluruh mutasi kelas.
 *
 * Tiga penjaga menopang gunanya fitur ini, dan ketiganya diperiksa DI SINI —
 * bukan dengan menyembunyikan tombolnya, sebab Server Action bisa dipanggil
 * lewat POST langsung tanpa pernah membuka halamannya:
 *
 * 1. Yang MEMPOSTING hanya pemilik kelas. Kalau longgar, anggota mana pun bisa
 *    menulis pengumuman yang tampak berasal dari pengajarnya.
 * 2. Yang MEMBACA dan MEMBALAS hanya anggota. Kalau longgar, kelas menjadi
 *    forum publik yang isinya bisa dibaca siapa saja yang menebak alamatnya.
 * 3. Yang MENGHAPUS balasan hanya penulisnya, pemilik kelas, atau admin. Kalau
 *    longgar, satu anggota bisa membungkam seluruh percakapan.
 */

function clean(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function now(): string {
  return new Date().toISOString();
}

/** Kelas maksimal per educator. Menahan pembuatan massal, bukan pemakaian wajar. */
const MAX_CLASSES_PER_OWNER = 50;

// ── Pembatas percobaan kode undangan ────────────────────────────────────
//
// Kode undangan adalah kunci pembawa: siapa pun yang menebaknya menjadi
// anggota dan bisa membaca seluruh isi kelas. 32^8 memang besar, tetapi tanpa
// pembatas laju sama sekali, menebak adalah pekerjaan mesin yang gratis dan
// tidak berisiko — dan tidak ada satu pun jejak yang tertinggal.
//
// KETERBATASAN YANG DISADARI: sama persis dengan chatRateLimit — state ini
// hidup di memori satu proses Node, jadi banyak instance berarti banyak batas
// yang berdiri sendiri. Cukup untuk sekarang; ganti dengan penyimpanan bersama
// kalau situs ini dijalankan multi-instance.
//
// Sengaja TIDAK memakai ulang checkChatRateLimit: jendela dan ambangnya
// berbeda, dan menyatukannya berarti mengubah ambang obrolan setiap kali
// ambang kelas disesuaikan.
const JOIN_WINDOW_MS = 60_000;
const JOIN_MAX_ATTEMPTS = 10;

const joinBuckets = new Map<string, { count: number; resetAt: number }>();

function tooManyJoinAttempts(uid: string): boolean {
  const saat = Date.now();
  const bucket = joinBuckets.get(uid);

  if (!bucket || bucket.resetAt <= saat) {
    joinBuckets.set(uid, { count: 1, resetAt: saat + JOIN_WINDOW_MS });
    return false;
  }

  if (bucket.count >= JOIN_MAX_ATTEMPTS) return true;

  bucket.count++;
  return false;
}

// ── Foto profil kelas ───────────────────────────────────────────────────

/**
 * URL foto kelas yang sah: Storage proyek ini + path `avatars/{uid-SESI}/class-<hex>.jpg`.
 * Tanpa pemeriksaan ini, tindakan ini bisa dipakai menautkan gambar sembarang
 * (atau milik orang lain) ke sebuah kelas. Mengembalikan null bila tak sah.
 */
function fotoKelasSah(raw: unknown, uid: string): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 900 ||
    !raw.startsWith("https://firebasestorage.googleapis.com/v0/b/")
  ) {
    return null;
  }
  const m = raw.match(/\/o\/([^?]+)/);
  if (!m) return null;
  let path: string;
  try {
    path = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return new RegExp("^" + AVATARS + "/" + uid + "/class-[a-f0-9]{8,32}\\.jpg$").test(path) ? raw : null;
}

/** Path objek dari URL foto kelas lama (untuk dibuang); null bila bukan foto kelas. */
function pathFotoKelas(url: string | null | undefined): string | null {
  const m = url?.match(/\/o\/([^?]+)/);
  if (!m) return null;
  try {
    const path = decodeURIComponent(m[1]);
    return new RegExp("^" + AVATARS + "/[^/]+/class-[a-f0-9]{8,32}\\.jpg$").test(path) ? path : null;
  } catch {
    return null;
  }
}

// ── Kelas ───────────────────────────────────────────────────────────────

export async function createClass(
  nameRaw: string,
  descRaw: string,
  imageRaw?: string | null,
  bannerRaw?: string | null,
): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (user.role !== "educator" && user.role !== "admin") {
    return { ok: false, error: "Hanya educator atau admin yang dapat membuat kelas." };
  }

  const name = clean(nameRaw, MAX_CLASS_NAME);
  if (name.length < 3) return { ok: false, error: "Nama kelas minimal 3 karakter." };

  // Memakai ulang kueri yang memang sudah ada untuk halaman daftar kelas.
  const milik = await listOwnedClasses(user.uid);
  if (milik.length >= MAX_CLASSES_PER_OWNER) {
    return {
      ok: false,
      error: `Anda sudah punya ${MAX_CLASSES_PER_OWNER} kelas. Hapus salah satunya dulu.`,
    };
  }

  const description = clean(descRaw, MAX_CLASS_DESC);
  const imageURL = imageRaw ? fotoKelasSah(imageRaw, user.uid) : null;
  if (imageRaw && !imageURL) return { ok: false, error: "Foto kelas tidak valid." };
  // Banner memakai penjaga path yang SAMA dengan foto kelas (folder avatars/{uid-SESI}/class-<hex>.jpg).
  const bannerURL = bannerRaw ? fotoKelasSah(bannerRaw, user.uid) : null;
  if (bannerRaw && !bannerURL) return { ok: false, error: "Banner kelas tidak valid." };
  const waktu = now();

  const ref = adminDb().collection("classes").doc();
  await ref.set({
    name,
    description,
    ownerUid: user.uid,
    imageURL,
    bannerURL,
    joinCode: await freshJoinCode(),
    memberCount: 0,
    postCount: 0,
    createdAt: waktu,
    updatedAt: waktu,
  });

  revalidatePath("/educator/classes");
  revalidatePath("/admin/classes");
  return { ok: true, message: "Kelas berhasil dibuat." };
}

/** `imageRaw`/`bannerRaw`: undefined = tak diubah, null = dihapus, string = gambar baru. */
export async function updateClass(
  classId: string,
  nameRaw: string,
  descRaw: string,
  imageRaw?: string | null,
  bannerRaw?: string | null,
): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengubah kelas ini." };

  const name = clean(nameRaw, MAX_CLASS_NAME);
  if (name.length < 3) return { ok: false, error: "Nama kelas minimal 3 karakter." };

  const patch: Record<string, unknown> = {
    name,
    description: clean(descRaw, MAX_CLASS_DESC),
    updatedAt: now(),
  };

  if (imageRaw !== undefined) {
    const baru = imageRaw === null ? null : fotoKelasSah(imageRaw, user.uid);
    if (imageRaw !== null && !baru) return { ok: false, error: "Foto kelas tidak valid." };
    patch.imageURL = baru;
    // Foto lama dibuang (upaya terbaik) agar tak menumpuk di Storage.
    const lama = pathFotoKelas(kelas.imageURL);
    if (lama && kelas.imageURL !== baru) void deleteObjects([lama]).catch(() => 0);
  }

  if (bannerRaw !== undefined) {
    const baru = bannerRaw === null ? null : fotoKelasSah(bannerRaw, user.uid);
    if (bannerRaw !== null && !baru) return { ok: false, error: "Banner kelas tidak valid." };
    patch.bannerURL = baru;
    const lama = pathFotoKelas(kelas.bannerURL);
    if (lama && kelas.bannerURL !== baru) void deleteObjects([lama]).catch(() => 0);
  }

  await classRef(classId).update(patch);

  revalidatePath("/educator/classes");
  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  return { ok: true, message: "Kelas diperbarui." };
}

/**
 * Mengganti kode undangan.
 *
 * Sekaligus satu-satunya cara menutup kelas dari pendaftar baru: kode lama
 * langsung tidak berlaku, sementara anggota yang sudah masuk tidak terusik.
 */
export async function regenerateJoinCode(classId: string): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengubah kelas ini." };

  await classRef(classId).update({ joinCode: await freshJoinCode(), updatedAt: now() });

  revalidatePath(`/educator/classes/${classId}`);
  return { ok: true, message: "Kode undangan diganti. Kode lama tidak berlaku lagi." };
}

export async function deleteClass(classId: string): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak menghapus kelas ini." };

  const db = adminDb();

  // Dibaca SEBELUM dihapus: lampiran tiap postingan hanya tercatat di sana.
  const [posts, berkasAi] = await Promise.all([listPosts(classId), berkasAiKelas(classId)]);

  // recursiveDelete, bukan .delete() biasa: postingan dan balasan hidup sebagai
  // subcollection, dan .delete() hanya menghapus dokumen induknya sambil
  // meninggalkan keduanya yatim — dokumen yang tidak bisa dicapai lewat
  // antarmuka mana pun. Alasan yang sama sudah ditulis di deleteCourse.
  await db.recursiveDelete(classRef(classId));

  // Keanggotaan hidup di koleksi TERPISAH, jadi recursiveDelete tidak
  // menjangkaunya. Yang tertinggal akan menunjuk kelas yang sudah tidak ada.
  const anggota = await db.collection(CLASS_MEMBERS).where("classId", "==", classId).get();
  await Promise.all(anggota.docs.map((d) => d.ref.delete().catch(() => undefined)));

  // Pengumpulan tugas juga koleksi terpisah, dan berkas di Storage tidak
  // pernah ikut terhapus bersama dokumen apa pun.
  await bersihkanKelas(classId, posts, berkasAi);

  // Percobaan quiz juga koleksi terpisah (subkoleksi quiz-nya sendiri sudah ikut recursiveDelete).
  await hapusPercobaanKelas(classId);

  // Foto & banner kelas di Storage tidak ikut terhapus bersama dokumennya (upaya terbaik).
  const gambar = [pathFotoKelas(kelas.imageURL), pathFotoKelas(kelas.bannerURL)].filter((x): x is string => x !== null);
  if (gambar.length > 0) void deleteObjects(gambar).catch(() => 0);

  revalidatePath("/educator/classes");
  revalidatePath("/admin/classes");
  revalidatePath("/kelas");
  revalidatePath("/profil");
  return { ok: true, message: "Kelas dihapus." };
}

// ── Keanggotaan ─────────────────────────────────────────────────────────

export async function joinClass(codeRaw: string): Promise<JoinResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  if (tooManyJoinAttempts(user.uid)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." };
  }

  const code = normalizeInviteCode(codeRaw);
  const kelas = code ? await findClassByJoinCode(code) : null;

  // Pesan yang SAMA untuk kode ngawur dan kode yang tidak cocok. Membedakannya
  // memberi penebak sinyal bahwa sebuah kode "hampir benar", dan itu mengubah
  // tebakan buta menjadi pencarian terarah.
  if (!kelas) return { ok: false, error: "Kode kelas tidak ditemukan." };

  if (kelas.ownerUid === user.uid) {
    return { ok: false, error: "Ini kelas Anda sendiri." };
  }

  const sudah = await getMembership(user.uid, kelas.id);
  if (sudah) {
    return { ok: true, message: "Anda sudah menjadi anggota kelas ini.", classId: kelas.id };
  }

  // Transaksi: memeriksa lalu menulis dalam satu langkah, supaya dua klik
  // beruntun tidak menaikkan memberCount dua kali untuk satu orang.
  await adminDb().runTransaction(async (tx) => {
    const mRef = memberRef(user.uid, kelas.id);
    const mSnap = await tx.get(mRef);
    if (mSnap.exists) return;

    tx.set(mRef, {
      uid: user.uid,
      classId: kelas.id,
      role: "member",
      joinedAt: now(),
    });
    tx.update(classRef(kelas.id), { memberCount: FieldValue.increment(1) });
  });

  revalidatePath("/kelas");
  revalidatePath("/profil");
  revalidatePath(`/educator/classes/${kelas.id}/members`);
  return { ok: true, message: `Berhasil bergabung ke ${kelas.name}.`, classId: kelas.id };
}

/**
 * Pengajar/admin mengeluarkan seorang siswa dari kelas.
 *
 * Hanya pemilik kelas atau admin; uid siswa dari argumen HANYA dipakai sebagai
 * sasaran dan wajib berupa anggota kelas ini (pemilik tidak punya dokumen
 * keanggotaan, jadi tak bisa "dikeluarkan"). Yang dihapus hanya keanggotaan:
 * jawaban tugas & quiz miliknya tetap tersimpan sebagai catatan pengajar.
 * Ia bisa bergabung lagi lewat kode undangan selama kodenya belum diganti.
 */
export async function removeClassMember(classId: string, studentUid: string): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengelola anggota kelas ini." };

  if (typeof studentUid !== "string" || !studentUid) return { ok: false, error: "Anggota tidak sah." };

  const dihapus = await adminDb().runTransaction(async (tx) => {
    const mRef = memberRef(studentUid, classId);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) return false;
    tx.delete(mRef);
    tx.update(classRef(classId), { memberCount: FieldValue.increment(-1) });
    return true;
  });
  if (!dihapus) return { ok: false, error: "Siswa itu bukan anggota kelas ini." };

  revalidatePath("/kelas");
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/educator/classes/${classId}/members`);
  return { ok: true, message: "Siswa dikeluarkan dari kelas." };
}

export async function leaveClass(classId: string): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const anggota = await getMembership(user.uid, classId);
  if (!anggota) return { ok: false, error: "Anda bukan anggota kelas ini." };

  await adminDb().runTransaction(async (tx) => {
    const mRef = memberRef(user.uid, classId);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) return;

    tx.delete(mRef);
    tx.update(classRef(classId), { memberCount: FieldValue.increment(-1) });
  });

  revalidatePath("/kelas");
  revalidatePath("/profil");
  revalidatePath(`/educator/classes/${classId}/members`);
  return { ok: true, message: "Anda keluar dari kelas." };
}

// ── Postingan ───────────────────────────────────────────────────────────

/** Menulis satu postingan dan menaikkan postCount dalam satu transaksi. */
async function tulisPost(classId: string, data: Record<string, unknown>): Promise<void> {
  const waktu = now();
  await adminDb().runTransaction(async (tx) => {
    tx.set(postsRef(classId).doc(), { ...data, replyCount: 0, createdAt: waktu, updatedAt: waktu });
    tx.update(classRef(classId), { postCount: FieldValue.increment(1) });
  });

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
}

/**
 * Pengumuman, boleh berlampiran.
 *
 * `lampiranRaw` berisi `{path, name}` hasil unggahan browser ke
 * `class-files/{uid}/{classId}/…`; periksaBerkas membaca ukuran & jenisnya
 * ulang dari Storage. Pengumuman boleh hanya berkas tanpa teks.
 */
export async function createPost(
  classId: string,
  bodyRaw: string,
  lampiranRaw?: unknown,
  model3dRaw?: unknown,
): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  // Penjaga inti: HANYA pemilik. Anggota biasa tidak memposting di tahap ini.
  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Hanya pemilik kelas yang dapat memposting." };

  const body = clean(bodyRaw, MAX_POST_BODY);

  const lampiran = await periksaBerkas(
    lampiranRaw,
    `${CLASS_FILES}/${user.uid}/${classId}/`,
    MIME_KELAS,
    MAX_FILES_PER_POST,
  );
  if (!lampiran.ok) return { ok: false, error: lampiran.error };

  // Objek 3D: berkasnya wajib ada di folder milik pengirim untuk kelas ini.
  let model3d: Model3D | null = null;
  if (model3dRaw !== undefined && model3dRaw !== null) {
    const m = await periksaModel3D(model3dRaw, `${CLASS_FILES}/${user.uid}/${classId}/`, null);
    if (!m.ok) return { ok: false, error: m.error };
    model3d = m.value;
  }

  if (!body && lampiran.files.length === 0 && !model3d) {
    return { ok: false, error: "Isi postingan tidak boleh kosong." };
  }

  await tulisPost(classId, {
    classId,
    authorUid: user.uid,
    kind: "announcement",
    title: "",
    body,
    attachments: lampiran.files,
    model3d,
    assignment: null,
  });

  return { ok: true, message: "Postingan terkirim." };
}

/**
 * Tugas: judul, instruksi, lampiran, format yang diterima, tenggat (opsional),
 * dan apakah pengumpulan setelah tenggat masih diterima.
 *
 * Masukan diterima sebagai satu objek `unknown` dan diperiksa satu per satu —
 * action ini endpoint publik, bentuk argumennya tidak bisa diandalkan.
 */
export async function createAssignment(classId: string, input: unknown): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Hanya pemilik kelas yang dapat memposting." };

  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const title = clean(r.title, MAX_ASSIGNMENT_TITLE);
  if (title.length < 3) return { ok: false, error: "Judul tugas minimal 3 karakter." };

  const pengaturan = validasiPengaturan(r, Date.now(), true);
  if (!pengaturan.ok) return { ok: false, error: pengaturan.error };

  const lampiran = await periksaBerkas(
    r.attachments,
    `${CLASS_FILES}/${user.uid}/${classId}/`,
    MIME_KELAS,
    MAX_FILES_PER_POST,
  );
  if (!lampiran.ok) return { ok: false, error: lampiran.error };

  await tulisPost(classId, {
    classId,
    authorUid: user.uid,
    kind: "assignment",
    title,
    body: clean(r.body, MAX_POST_BODY),
    attachments: lampiran.files,
    assignment: pengaturan.value,
  });

  return { ok: true, message: "Tugas diterbitkan." };
}

/**
 * Menyunting postingan yang sudah terbit — pengumuman maupun tugas.
 *
 * Masukannya bentuk UTUH (bukan tambalan): formulir edit selalu mengirim
 * semua isian, jadi validasinya bisa persis sama dengan saat membuat, dan
 * tidak ada kombinasi setengah-tersimpan.
 *
 * Lampiran: `keepAttachments` = path lampiran LAMA yang dipertahankan,
 * dicocokkan dengan daftar tersimpan (bukan dipercaya dari browser);
 * `attachments` = unggahan baru, lewat periksaBerkas seperti saat membuat.
 * Lampiran yang dibuang dihapus dari Storage SETELAH tersimpan.
 *
 * Yang sengaja dijaga untuk tugas:
 *  - nilai maksimal tidak boleh di bawah nilai yang SUDAH diberikan — nilai
 *    85/100 tidak boleh diam-diam menjadi 85/50;
 *  - tenggat boleh dimundurkan ke masa lalu (menutup pengumpulan lebih awal);
 *    status "terlambat" kiriman lama tidak dihitung ulang.
 *  - jenis postingan tidak bisa diganti (pengumuman ↔ tugas).
 */
export async function editPost(classId: string, postId: string, input: unknown): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengubah postingan ini." };

  const post = await getPost(classId, postId);
  if (!post) return { ok: false, error: "Postingan tidak ditemukan." };

  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const body = clean(r.body, MAX_POST_BODY);

  const keep = new Set(
    Array.isArray(r.keepAttachments) ? r.keepAttachments.filter((x): x is string => typeof x === "string") : [],
  );
  const dipertahankan = post.attachments.filter((a) => keep.has(a.path));

  const baru = await periksaBerkas(
    r.attachments,
    `${CLASS_FILES}/${user.uid}/${classId}/`,
    MIME_KELAS,
    MAX_FILES_PER_POST,
  );
  if (!baru.ok) return { ok: false, error: baru.error };

  const attachments = [...dipertahankan, ...baru.files.filter((f) => !keep.has(f.path))];
  if (attachments.length > MAX_FILES_PER_POST) {
    return { ok: false, error: `Maksimal ${MAX_FILES_PER_POST} lampiran.` };
  }

  let perubahan: Record<string, unknown>;
  let berkasModelDibuang: string[] = [];
  if (post.kind === "assignment") {
    const title = clean(r.title, MAX_ASSIGNMENT_TITLE);
    if (title.length < 3) return { ok: false, error: "Judul tugas minimal 3 karakter." };

    const pengaturan = validasiPengaturan(r, Date.now(), false);
    if (!pengaturan.ok) return { ok: false, error: pengaturan.error };

    const tertinggi = Math.max(
      0,
      ...(await listPostSubmissions(classId, postId)).map((s) => (s.status === "graded" && s.grade !== null ? s.grade : 0)),
    );
    if (pengaturan.value.maxPoints < tertinggi) {
      return {
        ok: false,
        error: `Nilai maksimal tidak bisa di bawah ${tertinggi} — sudah ada siswa yang mendapat nilai itu. Ubah nilainya dulu.`,
      };
    }

    perubahan = { title, body, attachments, assignment: pengaturan.value };
  } else {
    // `model3d`: tidak dikirim = tak diubah, null = dibuang, objek = model/keterangan baru.
    let model3d = post.model3d;
    if (r.model3d === null) {
      model3d = null;
    } else if (r.model3d !== undefined) {
      const m = await periksaModel3D(r.model3d, `${CLASS_FILES}/${user.uid}/${classId}/`, post.model3d);
      if (!m.ok) return { ok: false, error: m.error };
      model3d = m.value;
    }

    if (!body && attachments.length === 0 && !model3d) return { ok: false, error: "Isi postingan tidak boleh kosong." };
    perubahan = { body, attachments, model3d };
    berkasModelDibuang = post.model3d && post.model3d.file.path !== model3d?.file.path ? [post.model3d.file.path] : [];
  }

  await postsRef(classId).doc(postId).update({ ...perubahan, updatedAt: now() });

  const tetap = new Set(attachments.map((a) => a.path));
  await deleteObjects([...post.attachments.map((a) => a.path).filter((x) => !tetap.has(x)), ...berkasModelDibuang]).catch(() => 0);

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/educator/classes/${classId}/tugas/${postId}`);
  revalidatePath(`/kelas/${classId}/tugas/${postId}`);
  return { ok: true, message: post.kind === "assignment" ? "Tugas diperbarui." : "Pengumuman diperbarui." };
}

/**
 * Mengarsipkan / memulihkan postingan (pengumuman maupun tugas).
 *
 * Hanya pemilik/admin. Data tidak dihapus: balasan, lampiran, dan pengumpulan
 * tugas tetap ada. Yang berubah hanya keterlihatannya bagi siswa (lihat
 * `archived` di classTypes).
 */
export async function setPostArchived(classId: string, postId: string, archived: boolean): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengubah postingan ini." };

  const post = await getPost(classId, postId);
  if (!post) return { ok: false, error: "Postingan tidak ditemukan." };

  // Disimpan sebagai boolean eksplisit + stempel; `updatedAt` TIDAK disentuh supaya
  // penanda "diedit" tak muncul hanya karena diarsipkan.
  await postsRef(classId).doc(postId).update(
    archived ? { archived: true, archivedAt: now() } : { archived: false, archivedAt: null },
  );

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/kelas/${classId}/tugas/${postId}`);
  return { ok: true, message: archived ? "Dipindahkan ke arsip." : "Dipulihkan dari arsip." };
}

export async function deletePost(classId: string, postId: string): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak menghapus postingan ini." };

  const post = await getPost(classId, postId);
  if (!post) return { ok: false, error: "Postingan tidak ditemukan." };

  // Berkas konteks AI hanya tercatat di dokumen ini — dibaca sebelum hilang.
  const ai = await getPengaturanAi(classId, postId);

  // recursiveDelete supaya balasannya ikut terhapus, bukan tertinggal yatim.
  await adminDb().recursiveDelete(postsRef(classId).doc(postId));
  await classRef(classId).update({ postCount: FieldValue.increment(-1) });

  // Lampiran, berkas AI, dan pengumpulan tugasnya tidak berada di bawah dokumen postingan.
  await bersihkanPost(classId, post, ai.files.map((f) => f.path));

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  return { ok: true, message: "Postingan dihapus." };
}

// ── Balasan ─────────────────────────────────────────────────────────────

export async function createReply(
  classId: string,
  postId: string,
  bodyRaw: string,
): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const akses = await requireClassAccess(user, classId);
  if (!akses) return { ok: false, error: "Anda bukan anggota kelas ini." };

  const post = await getPost(classId, postId);
  // Postingan terarsip tak ada bagi siswa: tak bisa dibalas.
  if (!post || (post.archived && !akses.isOwner)) return { ok: false, error: "Postingan tidak ditemukan." };

  const body = clean(bodyRaw, MAX_REPLY_BODY);
  if (!body) return { ok: false, error: "Balasan tidak boleh kosong." };

  await adminDb().runTransaction(async (tx) => {
    tx.set(repliesRef(classId, postId).doc(), {
      postId,
      classId,
      authorUid: user.uid,
      body,
      createdAt: now(),
    });
    tx.update(postsRef(classId).doc(postId), { replyCount: FieldValue.increment(1) });
  });

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  return { ok: true, message: "Balasan terkirim." };
}

export async function deleteReply(
  classId: string,
  postId: string,
  replyId: string,
): Promise<ClassResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const akses = await requireClassAccess(user, classId);
  if (!akses) return { ok: false, error: "Anda bukan anggota kelas ini." };

  const reply = await getReply(classId, postId, replyId);
  if (!reply) return { ok: false, error: "Balasan tidak ditemukan." };

  // Penulisnya sendiri, pemilik kelas, atau admin. Tanpa syarat pertama satu
  // anggota bisa menghapus balasan anggota lain dan membungkam percakapan.
  if (reply.authorUid !== user.uid && !akses.isOwner) {
    return { ok: false, error: "Anda hanya dapat menghapus balasan Anda sendiri." };
  }

  await adminDb().runTransaction(async (tx) => {
    tx.delete(repliesRef(classId, postId).doc(replyId));
    tx.update(postsRef(classId).doc(postId), { replyCount: FieldValue.increment(-1) });
  });

  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/kelas/${classId}`);
  return { ok: true, message: "Balasan dihapus." };
}
