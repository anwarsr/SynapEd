"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess, requireOwnedClass } from "@/lib/classGuards";
import { deleteObjects } from "@/lib/storageCleanup";
import { pathGambar, urlGambarSah } from "@/lib/gambarKelas";
import {
  getPercobaan,
  getPercobaanSiswa,
  getQuiz,
  hapusPercobaanQuiz,
  listPercobaan,
  listQuizzes,
  peringatanRef,
  percobaanRef,
  quizzesRef,
  selesaikanBilaPerlu,
} from "@/lib/classQuizzes";
import { listClassMembers } from "@/lib/classes";
import { getUserCards } from "@/lib/userCards";
import { formatWib } from "@/lib/classAssignmentRules";
import {
  MAX_QUIZ_PER_KELAS,
  MAX_TAMBAH_MENIT,
  TOLERANSI_DETIK,
  sisaJedaPeringatan,
  toPeringatan,
  sudahDibuka,
  bersihkanJawaban,
  batasWaktuMs,
  harusSelesai,
  idPercobaan,
  strukturSama,
  urutanUntukSiswa,
  validasiNamaKelompok,
  validasiNilaiEsai,
  validasiQuiz,
  validasiSkorRubrik,
  rubrikStrukturSama,
  rubrikAktif,
  bersihkanNamaAnggota,
  gabungAnggota,
  batasAnggota,
  nilaiIndividu,
  percobaanUntuk,
  sudahIkut,
  type AnggotaKelompok,
  type PercobaanQuiz,
  type Quiz,
} from "@/lib/classQuizRules";

export type QuizResult = { ok: true; message: string; quizId?: string } | { ok: false; error: string };

/**
 * Seluruh mutasi quiz kelas. Setiap export berkas ini endpoint publik: tiap
 * fungsi memeriksa sesi & peran sendiri, uid SELALU dari sesi, dan semua angka
 * (poin, batas waktu, nilai) dihitung/diperiksa ulang di server.
 *
 *  - Membuat/mengubah/menutup/menilai/menambah waktu: pemilik kelas atau admin.
 *  - Mulai/menyimpan/mengumpulkan: HANYA anggota (pengajar tidak mengerjakan).
 */

const now = () => new Date().toISOString();

function segarkan(classId: string, quizId?: string) {
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/educator/classes/${classId}`);
  if (quizId) {
    revalidatePath(`/kelas/${classId}/quiz/${quizId}`);
    revalidatePath(`/educator/classes/${classId}/quiz/${quizId}`);
  }
}

/**
 * Membuka kembali percobaan yang tadinya ditutup paksa (waktu habis / quiz
 * ditutup) bila sekarang batasnya sudah longgar - dipakai setelah pengajar
 * menambah waktu atau membuka kembali quiz. Percobaan yang esainya sudah
 * dinilai tidak dibuka lagi (nilainya sudah berjalan).
 */
async function bukaKembali(quiz: Quiz, daftar: readonly PercobaanQuiz[]): Promise<void> {
  const sekarang = Date.now();
  await Promise.all(
    daftar.map(async (p) => {
      if (!p.submittedAt || p.finalizedBy === "siswa" || p.finalizedBy === null) return;
      if (Object.keys(p.essayScores).length > 0 || Object.keys(p.rubricScores ?? {}).length > 0) return;
      if (harusSelesai(quiz, { ...p, submittedAt: null }, sekarang)) return;
      await percobaanRef(p.id).update({ submittedAt: null, finalizedBy: null });
    }),
  );
}

// ── Pengajar ────────────────────────────────────────────────────────────

/**
 * Menyimpan quiz (baru bila `quizId` null). `terbitkan` = true menerbitkan
 * (pemeriksaan penuh, total tepat 100), false = simpan sebagai draf.
 *
 * Setelah ada yang mengerjakan, soal terkunci (teks, pilihan, kunci, urutan);
 * yang boleh berubah hanya poin, judul, deskripsi, dan setelan. Nilai siswa
 * dihitung ulang otomatis dari poin baru (lihat hitungNilai).
 */
export async function saveQuiz(classId: string, quizId: string | null, input: unknown, terbitkan: boolean): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengelola quiz di kelas ini." };

  const isi = validasiQuiz(input, terbitkan === true);
  if (!isi.ok) return { ok: false, error: isi.error };

  const waktu = now();

  // Banner: tak dikirim = tak diubah, null = dibuang, string = gambar baru (path wajib milik uid SESI).
  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  let banner: string | null | undefined = undefined;
  if (r.bannerURL === null) banner = null;
  else if (r.bannerURL !== undefined) {
    banner = urlGambarSah(r.bannerURL, user.uid);
    if (!banner) return { ok: false, error: "Banner quiz tidak valid." };
  }

  if (quizId) {
    const lama = await getQuiz(classId, quizId);
    if (!lama) return { ok: false, error: "Quiz tidak ditemukan." };

    const percobaan = await listPercobaan(classId, quizId);
    if (percobaan.length > 0) {
      if (!strukturSama(lama.questions, isi.value.questions)) {
        return {
          ok: false,
          error: "Soal tidak bisa diubah karena sudah ada yang mengerjakan. Poin, judul, dan setelan masih bisa diubah.",
        };
      }
      if (lama.published && !terbitkan) {
        return { ok: false, error: "Quiz yang sudah dikerjakan tidak bisa dijadikan draf. Gunakan Tutup quiz." };
      }
      // Percobaan yang sudah ada tak punya nama kelompok (atau tak seharusnya): mode tak boleh berganti.
      if ((lama.settings.kelompok === true) !== (isi.value.settings.kelompok === true)) {
        return { ok: false, error: "Jenis quiz (individu/kelompok) tidak bisa diubah karena sudah ada yang mengerjakan." };
      }
      // Skor rubrik tersimpan per poin penilaian: poin tak boleh bertambah/berkurang setelah ada yang mengerjakan.
      if (!rubrikStrukturSama(lama.rubric, isi.value.rubric)) {
        return { ok: false, error: "Poin penilaian rubrik tidak bisa ditambah atau dihapus karena sudah ada yang mengerjakan. Judul, teks, dan bobotnya masih bisa diubah." };
      }
    }

    await quizzesRef(classId)
      .doc(quizId)
      .update({ ...isi.value, ...(banner !== undefined ? { bannerURL: banner } : {}), published: terbitkan === true, updatedAt: waktu });
    // Banner lama dibuang (upaya terbaik) setelah yang baru tersimpan.
    const lamaBanner = pathGambar(lama.bannerURL);
    if (banner !== undefined && lamaBanner && lama.bannerURL !== banner) void deleteObjects([lamaBanner]).catch(() => 0);
    segarkan(classId, quizId);
    return { ok: true, message: terbitkan ? "Quiz diterbitkan." : "Draf quiz disimpan.", quizId };
  }

  if ((await listQuizzes(classId)).length >= MAX_QUIZ_PER_KELAS) {
    return { ok: false, error: `Satu kelas maksimal ${MAX_QUIZ_PER_KELAS} quiz.` };
  }

  const ref = quizzesRef(classId).doc();
  await ref.set({
    ...isi.value,
    bannerURL: banner ?? null,
    classId,
    authorUid: user.uid,
    published: terbitkan === true,
    closed: false,
    extraMin: 0,
    createdAt: waktu,
    updatedAt: waktu,
  });
  segarkan(classId);
  return { ok: true, message: terbitkan ? "Quiz diterbitkan." : "Draf quiz disimpan.", quizId: ref.id };
}

export async function deleteQuiz(classId: string, quizId: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak menghapus quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };

  // Percobaan hidup di koleksi terpisah: dihapus lebih dulu, baru quiznya.
  await hapusPercobaanQuiz(classId, quizId);
  await quizzesRef(classId).doc(quizId).delete();
  const banner = pathGambar(quiz.bannerURL);
  if (banner) void deleteObjects([banner]).catch(() => 0);
  segarkan(classId, quizId);
  return { ok: true, message: "Quiz dihapus." };
}

/** Menutup quiz (tak ada yang bisa mulai/mengumpulkan; kunci terbuka bagi siswa) atau membukanya kembali. */
export async function setQuizClosed(classId: string, quizId: string, closed: boolean): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };

  await quizzesRef(classId).doc(quizId).update({ closed: closed === true, updatedAt: now() });

  if (closed !== true) await bukaKembali({ ...quiz, closed: false }, await listPercobaan(classId, quizId));
  segarkan(classId, quizId);
  return { ok: true, message: closed ? "Quiz ditutup." : "Quiz dibuka kembali." };
}

/**
 * Menambah waktu: `uid` null = SEMUA siswa, selain itu satu siswa. Siswa yang
 * waktunya sudah habis dibuka kembali bila waktu barunya masih tersisa.
 */
export async function addQuizTime(classId: string, quizId: string, menit: unknown, uid: string | null): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const m = typeof menit === "number" ? menit : Number(menit);
  if (!Number.isInteger(m) || m < 1 || m > MAX_TAMBAH_MENIT) {
    return { ok: false, error: `Tambahan waktu harus 1-${MAX_TAMBAH_MENIT} menit.` };
  }

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };
  if (quiz.settings.durationMin === null) return { ok: false, error: "Quiz ini tanpa batas waktu." };
  if (quiz.closed) return { ok: false, error: "Quiz sedang ditutup. Buka kembali dulu." };

  if (uid) {
    const p = await getPercobaan(classId, quizId, uid);
    if (!p) return { ok: false, error: "Siswa itu belum memulai quiz." };
    await percobaanRef(p.id).update({ extraSec: p.extraSec + m * 60 });
    await bukaKembali(quiz, [{ ...p, extraSec: p.extraSec + m * 60 }]);
  } else {
    const baru = { ...quiz, extraMin: quiz.extraMin + m };
    await quizzesRef(classId).doc(quizId).update({ extraMin: baru.extraMin, updatedAt: now() });
    await bukaKembali(baru, await listPercobaan(classId, quizId));
  }

  segarkan(classId, quizId);
  return { ok: true, message: uid ? `Waktu siswa ditambah ${m} menit.` : `Waktu semua siswa ditambah ${m} menit.` };
}

/** Poin esai seorang siswa. Hanya untuk percobaan yang sudah dikumpulkan/ditutup. */
export async function gradeQuizEssay(classId: string, quizId: string, studentUid: string, scores: unknown): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak menilai quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };

  const awal = await getPercobaanSiswa(classId, quizId, studentUid);
  if (!awal) return { ok: false, error: "Siswa itu belum mengerjakan quiz." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now());
  if (!p.submittedAt) return { ok: false, error: "Siswa itu masih mengerjakan. Nilai setelah dikumpulkan." };

  const nilai = validasiNilaiEsai(quiz, scores);
  if (!nilai) return { ok: false, error: "Poin esai tidak sah (bilangan bulat 0 sampai poin soalnya)." };

  await percobaanRef(p.id).update({ essayScores: { ...p.essayScores, ...nilai } });
  segarkan(classId, quizId);
  return { ok: true, message: "Nilai esai disimpan." };
}

/**
 * Skor rubrik SATU anggota kelompok: id poin penilaian → 1..4. `studentUid` = siapa saja di kelompok itu (pemilik percobaan
 * atau anggota), `memberKey` = kunci anggota yang dinilai. Hanya pemilik kelas/admin, hanya percobaan yang sudah
 * dikumpulkan. Tiap anggota dinilai sendiri-sendiri (NILAI INDIVIDU), terpisah dari nilai kelompok.
 */
export async function gradeQuizRubric(classId: string, quizId: string, studentUid: string, memberKey: string, scores: unknown): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak menilai quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };
  if (!rubrikAktif(quiz.rubric)) return { ok: false, error: "Quiz ini tidak memakai rubrik penilaian." };

  const awal = await getPercobaanSiswa(classId, quizId, studentUid);
  if (!awal) return { ok: false, error: "Siswa itu belum mengerjakan quiz." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now());
  if (!p.submittedAt) return { ok: false, error: "Siswa itu masih mengerjakan. Nilai setelah dikumpulkan." };

  // Anggota yang dinilai WAJIB anggota kelompok itu (kunci dicocokkan dengan daftar tersimpan, bukan kiriman browser).
  const sah = nilaiIndividu(quiz, p).some((a) => a.key === memberKey);
  if (!sah) return { ok: false, error: "Anggota itu bukan bagian dari kelompok ini." };

  const skor = validasiSkorRubrik(quiz.rubric, scores);
  if (!skor) return { ok: false, error: "Skor rubrik tidak sah (bilangan bulat 1 sampai 4 untuk poin penilaian yang ada)." };

  await percobaanRef(p.id).update({ rubricScores: { ...(p.rubricScores ?? {}), [memberKey]: { ...(p.rubricScores?.[memberKey] ?? {}), ...skor } } });
  segarkan(classId, quizId);
  return { ok: true, message: "Skor rubrik disimpan." };
}

/** Menghapus percobaan seorang siswa supaya ia bisa mengulang dari awal. */
export async function resetQuizAttempt(classId: string, quizId: string, studentUid: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const p = await getPercobaanSiswa(classId, quizId, studentUid);
  if (!p) return { ok: false, error: "Siswa itu belum mengerjakan quiz." };
  await percobaanRef(p.id).delete();
  segarkan(classId, quizId);
  return { ok: true, message: "Percobaan siswa dihapus. Ia bisa mengulang." };
}

// ── Siswa ───────────────────────────────────────────────────────────────

/** Quiz yang BOLEH dikerjakan pembaca ini, atau pesan galat. */
async function siapkanSiswa(classId: string, quizId: string) {
  const user = await getCurrentUser();
  if (!user) return { galat: "Silakan masuk terlebih dahulu.", user: null, quiz: null } as const;

  const akses = await requireClassAccess(user, classId);
  if (!akses?.isMember) return { galat: "Hanya peserta kelas yang mengerjakan quiz.", user: null, quiz: null } as const;

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { galat: "Quiz tidak ditemukan.", user: null, quiz: null } as const;
  return { galat: null, user, quiz } as const;
}

/**
 * Siswa menekan Mulai. Quiz KELOMPOK mewajibkan nama kelompok (dicek ULANG di server - kolom di
 * browser bisa dilewati); quiz individu mengabaikannya. Nama dicatat di percobaan siswa itu.
 */
export async function startQuiz(classId: string, quizId: string, namaKelompok?: unknown, anggota?: unknown): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;

  if (quiz.closed) return { ok: false, error: "Quiz ini sudah ditutup." };
  // Jam server yang berwenang: mengubah jam perangkat tak membuka quiz lebih awal.
  if (!sudahDibuka(quiz, Date.now())) {
    return { ok: false, error: `Quiz ini baru dibuka pada ${formatWib(quiz.opensAt)}.` };
  }
  if (quiz.questions.length === 0) return { ok: false, error: "Quiz ini belum punya soal." };

  let groupName: string | null = null;
  let members: AnggotaKelompok[] = [];
  if (quiz.settings.kelompok === true) {
    const nama = validasiNamaKelompok(namaKelompok);
    if (!nama.ok) return { ok: false, error: nama.error };
    groupName = nama.value;

    const a = anggota && typeof anggota === "object" ? (anggota as Record<string, unknown>) : {};
    const lain: AnggotaKelompok[] = [];

    // Dipilih dari anggota kelas: uid WAJIB anggota kelas ini (bukan pengajar, bukan diri sendiri); NAMA dibaca dari
    // Auth di server, bukan dari kiriman browser.
    const uids = Array.isArray(a.uids) ? Array.from(new Set(a.uids.filter((x): x is string => typeof x === "string"))) : [];
    if (uids.length > 0) {
      const sah = new Set((await listClassMembers(classId)).filter((m) => m.role === "member").map((m) => m.uid));
      const kartu = await getUserCards(uids.filter((u) => u !== user.uid));
      for (const uid of uids) {
        if (uid === user.uid) continue;
        if (!sah.has(uid)) return { ok: false, error: "Ada anggota yang dipilih bukan peserta kelas ini." };
        lain.push({ uid, name: kartu.get(uid)?.name ?? "Peserta" });
      }
    }
    // Diketik sendiri: nama 2-40 karakter, tanpa uid.
    const ketik = Array.isArray(a.names) ? a.names : [];
    for (const raw of ketik) {
      const n = bersihkanNamaAnggota(raw);
      if (!n) return { ok: false, error: "Nama anggota harus 2-40 karakter." };
      lain.push({ uid: null, name: n });
    }

    const gabung = gabungAnggota({ uid: user.uid, name: user.name }, lain, batasAnggota(quiz.settings));
    if (!gabung.ok) return { ok: false, error: gabung.error };
    members = gabung.value;

    // Satu orang hanya boleh di SATU kelompok per quiz: pembuat tak boleh sudah tergabung, anggota pilihannya pun tidak.
    const ada = await listPercobaan(classId, quizId);
    if (percobaanUntuk(ada, user.uid)) return { ok: false, error: "Anda sudah tergabung di sebuah kelompok untuk quiz ini." };
    for (const m of members) {
      if (m.uid && m.uid !== user.uid && percobaanUntuk(ada, m.uid)) return { ok: false, error: `${m.name} sudah tergabung di kelompok lain.` };
    }
  }

  const id = idPercobaan(classId, quizId, user.uid);
  try {
    // create(): gagal bila sudah ada, jadi klik ganda tak mengulang waktu mulai.
    await percobaanRef(id).create({
      classId,
      quizId,
      uid: user.uid,
      startedAt: now(),
      submittedAt: null,
      finalizedBy: null,
      answers: {},
      order: urutanUntukSiswa(quiz, user.uid),
      extraSec: 0,
      essayScores: {},
      groupName,
      ...(quiz.settings.kelompok === true ? { members, rubricScores: {}, joined: [] } : {}),
    });
  } catch (e) {
    if ((e as { code?: number }).code !== 6) throw e;
  }

  segarkan(classId, quizId);
  return { ok: true, message: "Quiz dimulai." };
}

/**
 * Anggota kelompok yang BARU diundang menekan "Ikuti Quiz": masuk ke percobaan kelompoknya (satu dokumen bersama).
 * Hanya yang namanya tercatat sebagai anggota (uid) yang bisa ikut, dan hanya selagi belum dikumpulkan.
 */
export async function ikutiQuiz(classId: string, quizId: string): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;
  if (quiz.settings.kelompok !== true) return { ok: false, error: "Quiz ini dikerjakan sendiri-sendiri." };

  const awal = await getPercobaanSiswa(classId, quizId, user.uid);
  if (!awal || !(awal.members ?? []).some((m) => m.uid === user.uid)) return { ok: false, error: "Anda belum diajak ke kelompok mana pun untuk quiz ini." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now());
  if (p.submittedAt) return { ok: false, error: "Kelompok Anda sudah mengumpulkan quiz ini." };
  if (sudahIkut(p, user.uid)) return { ok: true, message: "Anda sudah ikut." };

  await percobaanRef(p.id).update({ joined: FieldValue.arrayUnion(user.uid) });
  segarkan(classId, quizId);
  return { ok: true, message: `Anda bergabung ke kelompok ${p.groupName ?? ""}.`.trim() };
}

export interface HasilSinkron {
  ok: true;
  answers: Record<string, string>;
  joined: string[];
  /** Kelompok/siswa sudah mengumpulkan (atau waktu habis): pengerja harus memuat ulang. */
  selesai: boolean;
}

/**
 * Menyimpan jawaban sementara dan mengembalikan keadaan TERKINI (dipakai berkala oleh pengerja; quiz kelompok memakainya
 * sebagai "realtime" lewat polling karena klien tak boleh membaca Firestore). `ubah` = HANYA soal yang diubah pembaca ini:
 * ditulis per soal (`answers.<id>`) supaya ketikan anggota lain di soal berbeda tidak tertimpa. Mengirim `ubah` kosong =
 * hanya membaca. Setelah waktu habis kiriman diabaikan - jawaban terakhir yang TERSIMPAN yang dinilai.
 */
export async function sinkronJawaban(classId: string, quizId: string, ubah: unknown): Promise<HasilSinkron | { ok: false; error: string }> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;

  const awal = await getPercobaanSiswa(classId, quizId, user.uid);
  if (!awal) return { ok: false, error: "Mulai quiz dulu." };
  if (!sudahIkut(awal, user.uid)) return { ok: false, error: "Tekan \"Ikuti Quiz\" dulu untuk bergabung ke kelompok." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now() - TOLERANSI_DETIK * 1000);
  if (p.submittedAt) return { ok: true, answers: p.answers, joined: [p.uid, ...(p.joined ?? [])], selesai: true };

  const bersih = bersihkanJawaban(quiz, ubah);
  const kunci = Object.keys(bersih);
  if (kunci.length > 0) {
    const bidang: Record<string, string> = {};
    for (const k of kunci) bidang[`answers.${k}`] = bersih[k];
    await percobaanRef(p.id).update(bidang);
  }
  const segar = kunci.length > 0 ? await getPercobaanSiswa(classId, quizId, user.uid) : p;
  return { ok: true, answers: segar?.answers ?? p.answers, joined: [p.uid, ...(segar?.joined ?? p.joined ?? [])], selesai: false };
}

/**
 * Menyimpan jawaban sementara (quiz individu). Setelah waktu habis kiriman diabaikan - jawaban terakhir
 * yang TERSIMPAN yang dinilai. Quiz kelompok memakai `sinkronJawaban`.
 */
export async function saveQuizAnswers(classId: string, quizId: string, answers: unknown): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;
  if (quiz.settings.kelompok === true) return { ok: false, error: "Quiz kelompok disimpan lewat sinkronisasi." };

  const awal = await getPercobaan(classId, quizId, user.uid);
  if (!awal) return { ok: false, error: "Mulai quiz dulu." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now() - TOLERANSI_DETIK * 1000);
  if (p.submittedAt) return { ok: false, error: "Waktu habis atau quiz sudah dikumpulkan." };

  await percobaanRef(p.id).update({ answers: bersihkanJawaban(quiz, answers) });
  return { ok: true, message: "Tersimpan." };
}

/**
 * Mengumpulkan quiz. Kiriman yang tiba dalam toleransi singkat setelah batas
 * waktu masih dihitung (waktu pengumpulan dijepit ke batasnya); lebih lambat
 * dari itu, yang dinilai hanya jawaban yang sudah tersimpan. Quiz kelompok: anggota mana pun yang sudah ikut
 * boleh mengumpulkan untuk seluruh kelompok; jawaban kiriman hanya mengisi soal yang masih kosong di server
 * (tidak menimpa ketikan teman).
 */
export async function submitQuiz(classId: string, quizId: string, answers: unknown): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;
  const kelompok = quiz.settings.kelompok === true;

  const awal = await getPercobaanSiswa(classId, quizId, user.uid);
  if (!awal) return { ok: false, error: "Mulai quiz dulu." };
  if (!sudahIkut(awal, user.uid)) return { ok: false, error: "Tekan \"Ikuti Quiz\" dulu untuk bergabung ke kelompok." };

  const sekarang = Date.now();
  const bersih = bersihkanJawaban(quiz, answers);

  const hasil = await adminDb().runTransaction(async (tx) => {
    const ref = percobaanRef(awal.id);
    const snap = await tx.get(ref);
    if (!snap.exists) return "tidak-ada" as const;
    const data = snap.data() ?? {};
    if (typeof data.submittedAt === "string" && data.submittedAt) return "sudah" as const;

    const batas = batasWaktuMs(quiz, { startedAt: String(data.startedAt ?? ""), extraSec: Number(data.extraSec ?? 0) });
    const terlambat = batas !== null && sekarang > batas + TOLERANSI_DETIK * 1000;
    if (terlambat || quiz.closed) {
      tx.update(ref, { submittedAt: new Date(batas !== null && terlambat ? batas : sekarang).toISOString(), finalizedBy: terlambat ? "waktu" : "ditutup" });
      return "habis" as const;
    }

    const pada = batas !== null ? Math.min(sekarang, batas) : sekarang;
    let akhir = bersih;
    if (kelompok) {
      const tersimpan = peta(data.answers);
      akhir = { ...bersih };
      for (const [k, v] of Object.entries(tersimpan)) if (v.trim() !== "") akhir[k] = v;
    }
    tx.update(ref, { answers: akhir, submittedAt: new Date(pada).toISOString(), finalizedBy: "siswa" });
    return "ok" as const;
  });

  segarkan(classId, quizId);
  if (hasil === "ok") return { ok: true, message: "Quiz dikumpulkan." };
  if (hasil === "sudah") return { ok: false, error: "Quiz ini sudah dikumpulkan." };
  if (hasil === "habis") return { ok: false, error: "Waktu habis. Jawaban terakhir yang tersimpan sudah dikumpulkan otomatis." };
  return { ok: false, error: "Mulai quiz dulu." };
}

function peta(raw: unknown): Record<string, string> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * "Peringatkan murid": menyimpan peringatan untuk siswa yang BELUM memulai quiz.
 * Siswa mengambilnya lewat /api/classes/quiz-alert (poll) dan layarnya ditutupi
 * peringatan + alarm 2 detik. Hanya pengelola; sasaran dihitung SERVER saat ini
 * (anggota tanpa percobaan), dan ada jeda antar kiriman supaya tak jadi teror.
 */
export async function warnQuizStudents(classId: string, quizId: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };
  if (quiz.closed) return { ok: false, error: "Quiz sudah ditutup." };
  const sekarang = Date.now();
  if (!sudahDibuka(quiz, sekarang)) return { ok: false, error: "Quiz belum dibuka. Peringatan bisa dikirim setelah jadwal mulai." };

  const ref = peringatanRef(classId).doc(quizId);
  const lama = await ref.get();
  const sisa = sisaJedaPeringatan(lama.exists ? toPeringatan(quizId, lama.data() ?? {}) : null, sekarang);
  if (sisa > 0) return { ok: false, error: `Tunggu ${sisa} detik sebelum memperingatkan lagi.` };

  const sudah = new Set((await listPercobaan(classId, quizId)).flatMap((p) => [p.uid, ...(p.members ?? []).map((m) => m.uid ?? "")]));
  const sasaran = (await listClassMembers(classId)).map((m) => m.uid).filter((uid) => !sudah.has(uid));
  if (sasaran.length === 0) return { ok: false, error: "Semua siswa sudah memulai quiz ini." };

  await ref.set({ at: new Date(sekarang).toISOString(), uids: sasaran, byUid: user.uid });
  return { ok: true, message: `Peringatan dikirim ke ${sasaran.length} siswa.` };
}
