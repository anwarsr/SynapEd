/**
 * Menguji fitur Kelas dari ujung ke ujung.
 *
 * Yang paling penting di sini bukan "fiturnya jalan", melainkan empat hal yang
 * TIDAK BOLEH terjadi:
 *
 *   - bukan anggota bisa membaca isi kelas
 *   - anggota biasa bisa memposting seolah-olah ia pengajarnya
 *   - satu peserta bisa menghapus balasan peserta lain
 *   - kode undangan bocor ke halaman yang dibuka anggota biasa
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-classroom.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import {
  BASE,
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  probe,
  probeText,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);

const KELAS_ROUTE = "educator/classes";
const KELAS_DETAIL_ROUTE = "educator/classes/[id]";
const SISWA_ROUTE = "kelas";
const SISWA_DETAIL_ROUTE = "kelas/[id]";

const POST_BODY = "Selamat datang di kelas ini. Materi pertama menyusul besok.";
const BALASAN_SISWA = "Terima kasih, Pak. Saya sudah siap.";

async function classIdOf(ownerUid: string): Promise<string> {
  const snap = await db.collection("classes").where("ownerUid", "==", ownerUid).get();
  return snap.docs[0]?.id ?? "";
}

async function joinCodeOf(classId: string): Promise<string> {
  const d = (await db.collection("classes").doc(classId).get()).data();
  return String(d?.joinCode ?? "");
}

async function run(
  owner: TestUser,
  educator2: TestUser,
  siswa: TestUser,
  siswa2: TestUser,
  luar: TestUser,
  admin: TestUser,
) {
  let classId = "";

  try {
    // Manifest action baru ditulis setelah rutenya dikompilasi, dan di mode dev
    // Next mengompilasi rute saat pertama diminta.
    await probe("/educator/classes", owner.cookie);
    await probe("/kelas", siswa.cookie);

    const buatId = await actionId(KELAS_ROUTE, "createClass");
    const gabungId = await actionId(SISWA_ROUTE, "joinClass");

    // ── Membuat kelas ─────────────────────────────────────────────
    {
      const anon = await callAction("/educator/classes", buatId, ["Kelas Uji", ""]);
      check("anonim tidak bisa membuat kelas", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      const olehSiswa = await callAction(
        "/educator/classes", buatId, ["Kelas Uji", ""], siswa.cookie,
      );
      check(
        "pengguna biasa tidak bisa membuat kelas",
        olehSiswa.includes("Hanya educator"),
        "penjaga role",
      );

      const pendek = await callAction("/educator/classes", buatId, ["ab", ""], owner.cookie);
      check("nama kelas terlalu pendek ditolak", pendek.includes("minimal 3 karakter"), "validasi");

      const ok = await callAction(
        "/educator/classes", buatId, ["Kelas Uji Otomatis", "Dibuat verify-classroom."], owner.cookie,
      );
      check("educator berhasil membuat kelas", ok.includes("berhasil dibuat"), "pesan hasil");

      classId = await classIdOf(owner.uid);
      check("dokumen kelas tersimpan", classId !== "", `id=${classId}`);

      const d = (await db.collection("classes").doc(classId).get()).data();
      check("pemiliknya tercatat", d?.ownerUid === owner.uid, String(d?.ownerUid));
      check("anggota dimulai dari nol", d?.memberCount === 0, `memberCount=${d?.memberCount}`);

      // Firestore MENGHILANGKAN dokumen tanpa field yang dipakai orderBy.
      // createdAt yang kosong berarti kelasnya lenyap dari daftar tanpa galat.
      check(
        "createdAt terisi string ISO",
        typeof d?.createdAt === "string" && d.createdAt !== "",
        String(d?.createdAt),
      );
    }

    const kode = await joinCodeOf(classId);

    // ── Kode undangan ─────────────────────────────────────────────
    {
      check("kode undangan sepanjang 8 karakter", kode.length === 8, `"${kode}"`);
      check(
        "kode tidak memuat huruf yang mudah tertukar",
        !/[ILOU]/.test(kode),
        "alfabet Crockford tanpa I, L, O, U",
      );
    }

    // ── Bergabung ─────────────────────────────────────────────────
    {
      const anon = await callAction("/kelas", gabungId, [kode]);
      check("anonim tidak bisa bergabung", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      const salah = await callAction("/kelas", gabungId, ["ZZZZZZZZ"], siswa.cookie);
      check("kode ngawur ditolak", salah.includes("tidak ditemukan"), "pesan generik");

      const anggotaSetelahSalah = await db
        .collection("classMembers")
        .where("classId", "==", classId)
        .get();
      check(
        "kode salah tidak membuat keanggotaan",
        anggotaSetelahSalah.empty,
        `${anggotaSetelahSalah.size} dokumen`,
      );

      const pemilik = await callAction("/kelas", gabungId, [kode], owner.cookie);
      check("pemilik tidak bisa bergabung ke kelasnya sendiri", pemilik.includes("kelas Anda sendiri"), "penjaga");

      // Diketik dengan huruf kecil dan disisipi tanda pisah — penormalan harus
      // menerimanya, sebab orang menyalin kode dari pesan yang bentuknya bebas.
      const berantakan = `${kode.slice(0, 4).toLowerCase()}-${kode.slice(4).toLowerCase()}`;
      const ok = await callAction("/kelas", gabungId, [berantakan], siswa.cookie);
      check("kode berhuruf kecil dan bertanda pisah tetap diterima", ok.includes("Berhasil bergabung"), berantakan);

      const mRef = db.collection("classMembers").doc(`${siswa.uid}_${classId}`);
      check("ID keanggotaan deterministik", (await mRef.get()).exists, `${siswa.uid}_${classId}`);

      const d = (await db.collection("classes").doc(classId).get()).data();
      check("memberCount naik jadi 1", d?.memberCount === 1, `memberCount=${d?.memberCount}`);

      // Bergabung dua kali tidak boleh menghitung orang yang sama dua kali.
      await callAction("/kelas", gabungId, [kode], siswa.cookie);
      const d2 = (await db.collection("classes").doc(classId).get()).data();
      check("bergabung dua kali tidak menggandakan hitungan", d2?.memberCount === 1, `memberCount=${d2?.memberCount}`);

      await callAction("/kelas", gabungId, [kode], siswa2.cookie);
      const d3 = (await db.collection("classes").doc(classId).get()).data();
      check("peserta kedua bergabung", d3?.memberCount === 2, `memberCount=${d3?.memberCount}`);
    }

    await probe(`/educator/classes/${classId}`, owner.cookie);
    await probe(`/kelas/${classId}`, siswa.cookie);

    const postId = await actionId(KELAS_DETAIL_ROUTE, "createPost");
    const balasId = await actionId(SISWA_DETAIL_ROUTE, "createReply");
    const hapusBalasanId = await actionId(SISWA_DETAIL_ROUTE, "deleteReply");
    const hapusPostId = await actionId(KELAS_DETAIL_ROUTE, "deletePost");
    const gantiKodeId = await actionId(KELAS_DETAIL_ROUTE, "regenerateJoinCode");
    const hapusKelasId = await actionId(KELAS_DETAIL_ROUTE, "deleteClass");

    const jalurPemilik = `/educator/classes/${classId}`;
    const jalurSiswa = `/kelas/${classId}`;

    // ── Memposting ────────────────────────────────────────────────
    let idPost = "";
    {
      const olehAnggota = await callAction(jalurPemilik, postId, [classId, "Halo semua"], siswa.cookie);
      check(
        "anggota biasa TIDAK bisa memposting",
        olehAnggota.includes("Hanya pemilik kelas"),
        "kalau lolos, siapa pun bisa menulis atas nama pengajarnya",
      );

      const olehEducatorLain = await callAction(
        jalurPemilik, postId, [classId, "Halo semua"], educator2.cookie,
      );
      check("educator lain tidak bisa memposting di kelas orang", olehEducatorLain.includes("Hanya pemilik kelas"), "penjaga kepemilikan");

      const kosong = await callAction(jalurPemilik, postId, [classId, "   "], owner.cookie);
      check("postingan kosong ditolak", kosong.includes("tidak boleh kosong"), "validasi isi");

      const belumAda = await db.collection("classes").doc(classId).collection("posts").get();
      check("belum ada postingan yang tertulis", belumAda.empty, `${belumAda.size} dokumen`);

      const ok = await callAction(jalurPemilik, postId, [classId, POST_BODY], owner.cookie);
      check("pemilik berhasil memposting", ok.includes("terkirim"), "pesan hasil");

      const snap = await db.collection("classes").doc(classId).collection("posts").get();
      idPost = snap.docs[0]?.id ?? "";
      check("dokumen postingan tersimpan", idPost !== "", `${snap.size} dokumen`);

      const p = snap.docs[0]?.data();
      check(
        "createdAt postingan terisi",
        typeof p?.createdAt === "string" && p.createdAt !== "",
        String(p?.createdAt),
      );

      const d = (await db.collection("classes").doc(classId).get()).data();
      check("postCount naik", d?.postCount === 1, `postCount=${d?.postCount}`);
    }

    // ── Membaca: inti keamanannya ─────────────────────────────────
    {
      const anon = await probe(jalurSiswa);
      check("anonim dialihkan ke login", anon.status === 307 || anon.status === 302, `HTTP ${anon.status}`);

      const bukanAnggota = await probeText(jalurSiswa, luar.cookie);
      check("bukan anggota mendapat 404", bukanAnggota.status === 404, `HTTP ${bukanAnggota.status}`);
      check(
        "halaman untuk bukan anggota tidak memuat isi postingan",
        !bukanAnggota.html.includes(POST_BODY),
        "isi kelas tidak bocor lewat halaman 404",
      );

      const anggota = await probeText(jalurSiswa, siswa.cookie);
      check("anggota bisa membuka kelas", anggota.status === 200, `HTTP ${anggota.status}`);
      check("anggota melihat isi postingan", anggota.html.includes(POST_BODY), "umpan terisi");

      // Kode undangan adalah kunci untuk mengajak orang lain masuk.
      check(
        "kode undangan TIDAK muncul di halaman anggota",
        !anggota.html.includes(kode),
        `mencari "${kode}"`,
      );

      const halamanPemilik = await probeText(jalurPemilik, owner.cookie);
      check("pemilik melihat kode undangannya", halamanPemilik.html.includes(kode), "panel kode");
    }

    // ── Membalas ──────────────────────────────────────────────────
    let idBalasan = "";
    {
      const olehLuar = await callAction(
        jalurSiswa, balasId, [classId, idPost, "Numpang lewat"], luar.cookie,
      );
      check("bukan anggota tidak bisa membalas", olehLuar.includes("bukan anggota"), "penjaga keanggotaan");

      const belumAda = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idPost)
        .collection("replies").get();
      check("balasan dari bukan anggota tidak tertulis", belumAda.empty, `${belumAda.size} dokumen`);

      const ok = await callAction(jalurSiswa, balasId, [classId, idPost, BALASAN_SISWA], siswa.cookie);
      check("anggota berhasil membalas", ok.includes("terkirim"), "pesan hasil");

      const snap = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idPost)
        .collection("replies").get();
      idBalasan = snap.docs[0]?.id ?? "";
      check("dokumen balasan tersimpan", idBalasan !== "", `${snap.size} dokumen`);

      const p = (await db.collection("classes").doc(classId).collection("posts").doc(idPost).get()).data();
      check("replyCount naik", p?.replyCount === 1, `replyCount=${p?.replyCount}`);
    }

    // ── Menghapus balasan ─────────────────────────────────────────
    {
      const olehSiswaLain = await callAction(
        jalurSiswa, hapusBalasanId, [classId, idPost, idBalasan], siswa2.cookie,
      );
      check(
        "peserta lain TIDAK bisa menghapus balasan orang",
        olehSiswaLain.includes("balasan Anda sendiri"),
        "kalau lolos, satu orang bisa membungkam percakapan",
      );

      const masihAda = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idPost)
        .collection("replies").doc(idBalasan).get();
      check("balasannya masih ada", masihAda.exists, "penolakan itu nyata, bukan hanya pesan");

      const olehPemilik = await callAction(
        jalurSiswa, hapusBalasanId, [classId, idPost, idBalasan], owner.cookie,
      );
      check("pemilik kelas boleh memoderasi balasan", olehPemilik.includes("dihapus"), "moderasi");

      const sudahHilang = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idPost)
        .collection("replies").doc(idBalasan).get();
      check("balasannya benar-benar hilang", !sudahHilang.exists, "terhapus");
    }

    // ── Menghapus postingan ───────────────────────────────────────
    {
      const olehAnggota = await callAction(jalurPemilik, hapusPostId, [classId, idPost], siswa.cookie);
      check("anggota tidak bisa menghapus postingan", olehAnggota.includes("tidak berhak"), "penjaga");

      // Balasan baru supaya bisa dibuktikan ikut terhapus bersama postingannya.
      await callAction(jalurSiswa, balasId, [classId, idPost, "Balasan kedua"], siswa2.cookie);

      const ok = await callAction(jalurPemilik, hapusPostId, [classId, idPost], owner.cookie);
      check("pemilik menghapus postingan", ok.includes("dihapus"), "pesan hasil");

      const sisaBalasan = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idPost)
        .collection("replies").get();
      check(
        "balasannya ikut terhapus, tidak tertinggal yatim",
        sisaBalasan.empty,
        `${sisaBalasan.size} dokumen tersisa`,
      );
    }

    // ── Mengganti kode undangan ───────────────────────────────────
    {
      const olehEducatorLain = await callAction(jalurPemilik, gantiKodeId, [classId], educator2.cookie);
      check("educator lain tidak bisa mengganti kode", olehEducatorLain.includes("tidak berhak"), "penjaga");

      const ok = await callAction(jalurPemilik, gantiKodeId, [classId], owner.cookie);
      check("pemilik mengganti kode undangan", ok.includes("tidak berlaku lagi"), "pesan hasil");

      const kodeBaru = await joinCodeOf(classId);
      check("kodenya benar-benar berubah", kodeBaru !== kode, `${kode} -> ${kodeBaru}`);

      const kodeLama = await callAction("/kelas", gabungId, [kode], luar.cookie);
      check("kode lama tidak berlaku lagi", kodeLama.includes("tidak ditemukan"), "pendaftaran tertutup");
    }

    // ── Penjaga halaman ───────────────────────────────────────────
    {
      const olehSiswa = await probe("/educator/classes", siswa.cookie);
      check(
        "pengguna biasa dialihkan dari panel educator",
        olehSiswa.status === 307 || olehSiswa.status === 302,
        `HTTP ${olehSiswa.status}`,
      );

      const educatorLain = await probe(jalurPemilik, educator2.cookie);
      check("educator lain mendapat 404 di kelas orang", educatorLain.status === 404, `HTTP ${educatorLain.status}`);

      // requireEducator memeriksa `role !== "educator"`, jadi ia mengalihkan
      // ADMIN juga. Pemeriksaan ini memerah begitu ada yang "merapikan"
      // penjaganya jadi requireEducator.
      const olehAdmin = await probe(jalurPemilik, admin.cookie);
      check(
        "ADMIN bisa membuka halaman kelas orang",
        olehAdmin.status === 200,
        `HTTP ${olehAdmin.status} — jebakan requireEducator`,
      );

      const adminDaftar = await probeText("/admin/classes", admin.cookie);
      check("panel admin memuat kelasnya", adminDaftar.html.includes("Kelas Uji Otomatis"), "daftar kelas");
      check(
        "panel admin TIDAK menampilkan kode undangan",
        !adminDaftar.html.includes(await joinCodeOf(classId)),
        "satu layar tidak boleh membocorkan kunci setiap kelas",
      );
    }

    // ── Menghapus kelas ───────────────────────────────────────────
    {
      // Postingan BARU dibuat lebih dulu, dan ini bukan kerapian.
      //
      // Postingan sebelumnya sudah dihapus di blok di atas, jadi tanpa ini
      // subcollection-nya memang sudah kosong sebelum kelasnya dihapus — dan
      // pemeriksaan 'ikut tersapu' di bawah akan lulus bahkan kalau
      // recursiveDelete diganti .delete() biasa. Terbukti: probe yang
      // mengembalikan bug itu tidak memerah sama sekali.
      await callAction(jalurPemilik, postId, [classId, "Postingan terakhir"], owner.cookie);

      const segar = await db.collection("classes").doc(classId).collection("posts").get();
      const idSegar = segar.docs[0]?.id ?? "";
      check("ada postingan segar sebelum kelas dihapus", idSegar !== "", `${segar.size} dokumen`);

      await callAction(jalurSiswa, balasId, [classId, idSegar, "Balasan terakhir"], siswa.cookie);

      const balasanSegar = await db
        .collection("classes").doc(classId)
        .collection("posts").doc(idSegar)
        .collection("replies").get();
      check("ada balasan segar sebelum kelas dihapus", !balasanSegar.empty, `${balasanSegar.size} dokumen`);

      const ok = await callAction(jalurPemilik, hapusKelasId, [classId], owner.cookie);
      check("pemilik menghapus kelas", ok.includes("dihapus"), "pesan hasil");

      const kelasHilang = await db.collection("classes").doc(classId).get();
      check("dokumen kelas hilang", !kelasHilang.exists, "terhapus");

      const posts = await db.collection("classes").doc(classId).collection("posts").get();
      check("subcollection postingan ikut tersapu", posts.empty, `${posts.size} tersisa`);

      // Keanggotaan hidup di koleksi TERPISAH — recursiveDelete tidak
      // menjangkaunya, dan yang tertinggal tidak terlihat di antarmuka mana pun.
      const anggota = await db.collection("classMembers").where("classId", "==", classId).get();
      check(
        "keanggotaan ikut terhapus",
        anggota.empty,
        `${anggota.size} tersisa — hanya pemeriksaan ini yang bisa menangkapnya`,
      );

      classId = "";
    }
  } finally {
    if (classId) {
      await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
      const sisa = await db.collection("classMembers").where("classId", "==", classId).get();
      await Promise.all(sisa.docs.map((d) => d.ref.delete().catch(() => undefined)));
    }

    // Kelas apa pun yang tertinggal dari jalannya suite ini.
    for (const u of [owner.uid, educator2.uid]) {
      const punya = await db.collection("classes").where("ownerUid", "==", u).get();
      for (const d of punya.docs) {
        await db.recursiveDelete(d.ref).catch(() => undefined);
        const m = await db.collection("classMembers").where("classId", "==", d.id).get();
        await Promise.all(m.docs.map((x) => x.ref.delete().catch(() => undefined)));
      }
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "kelas-pemilik");
  const educator2 = await createTestUser("educator", "kelas-educator2");
  const siswa = await createTestUser("user", "kelas-siswa");
  const siswa2 = await createTestUser("user", "kelas-siswa2");
  const luar = await createTestUser("user", "kelas-luar");
  const admin = await createTestUser("admin", "kelas-admin");

  try {
    await run(owner, educator2, siswa, siswa2, luar, admin);
  } finally {
    await auth
      .deleteUsers([owner.uid, educator2.uid, siswa.uid, siswa2.uid, luar.uid, admin.uid])
      .catch(() => undefined);
    console.log("\nakun & kelas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
