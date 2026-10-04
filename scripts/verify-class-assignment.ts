/**
 * Menguji tugas kelas dari ujung ke ujung: postingan berlampiran, tugas
 * dengan format/tenggat, pengumpulan siswa, pembatalan, penilaian, penyaji
 * berkas, dan pembersihan.
 *
 * Yang paling penting bukan "fiturnya jalan", melainkan yang TIDAK BOLEH:
 *
 *   - siswa mengumpulkan setelah tenggat pada tugas yang menolak terlambat
 *   - siswa menautkan berkas milik orang lain, atau format yang tidak diminta
 *   - siswa membaca berkas jawaban teman lewat route penyaji
 *   - nilai hilang karena siswa membatalkan pengiriman yang sudah dinilai
 *   - pengumpulan & berkas tertinggal yatim setelah tugas/kelas dihapus
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-class-assignment.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  BASE,
  COOKIE,
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  probe,
  probeText,
  readEnv,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";
import {
  galatBerkas,
  inputWibKeIso,
  isoKeInputWib,
  masihDibuka,
  mimeUntukFormat,
  statusTugas,
  validasiNilai,
  validasiPengaturan,
  type PengaturanTugas,
} from "../frontend/src/lib/classAssignmentRules";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));

const PDF = Buffer.from("%PDF-1.4\n% verify-class-assignment\n");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const RAHASIA_SISWA2 = `jawaban-rahasia-${randomUUID().slice(0, 8)}`;

async function simpan(path: string, contentType: string, isi: Buffer = PDF) {
  await bucket.file(path).save(isi, { contentType });
}

async function ada(path: string): Promise<boolean> {
  const [e] = await bucket.file(path).exists();
  return e;
}

/** ID postingan terbaru dengan judul tertentu. */
async function postIdBerjudul(classId: string, title: string): Promise<string> {
  const snap = await db.collection("classes").doc(classId).collection("posts").where("title", "==", title).get();
  return snap.docs[0]?.id ?? "";
}

function subRef(classId: string, postId: string, uid: string) {
  return db.collection("classSubmissions").doc(`${classId}_${postId}_${uid}`);
}

async function unduh(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {},
  });
  return res;
}

// ── Aturan murni ────────────────────────────────────────────────────────

function aturanMurni() {
  const MB = 1024 * 1024;
  check("berkas .exe ditolak", galatBerkas({ name: "a.exe", size: 10 }, null) !== null, "daftar tertutup");
  check("PDF berhuruf besar diterima", galatBerkas({ name: "Tugas.PDF", size: 10 }, ["pdfImage"]) === null, ".PDF");
  check(
    "DOCX ditolak bila tugas hanya meminta PDF & gambar",
    galatBerkas({ name: "a.docx", size: 10 }, ["pdfImage"]) !== null,
    "format per tugas",
  );
  check("berkas tepat 20 MB ditolak (batas eksklusif)", galatBerkas({ name: "a.zip", size: 20 * MB }, ["zip"]) !== null, "sejalan rules");
  check("berkas kosong ditolak", galatBerkas({ name: "a.png", size: 0 }, null) !== null, "0 byte");
  check("tugas teks saja tidak menerima MIME apa pun", mimeUntukFormat(["text"]).length === 0, "teks");

  const iso = inputWibKeIso("2026-10-05T23:59");
  check("23.59 WIB = 16.59 UTC", iso === "2026-10-05T16:59:00.000Z", String(iso));
  check("WIB bolak-balik", isoKeInputWib(iso) === "2026-10-05T23:59", isoKeInputWib(iso));
  check("input WIB rusak → null", inputWibKeIso("2026-10-05") === null, "tanpa jam");

  const saat = Date.parse("2026-10-05T12:00:00Z");
  const tutup: PengaturanTugas = { formats: ["text"], dueAt: "2026-10-05T11:00:00.000Z", acceptLate: false, maxPoints: 100 };
  const longgar: PengaturanTugas = { ...tutup, acceptLate: true };
  check("lewat tenggat & menolak terlambat → ditutup", !masihDibuka(tutup, saat), "masihDibuka");
  check("lewat tenggat & menerima terlambat → dibuka", masihDibuka(longgar, saat), "masihDibuka");
  check("belum kirim setelah tenggat → terlewat", statusTugas(null, tutup, saat) === "terlewat", "status");
  check("kiriman terlambat → terlambat", statusTugas({ status: "submitted", late: true }, longgar, saat) === "terlambat", "status");
  check("dinilai mengalahkan terlambat", statusTugas({ status: "graded", late: true }, longgar, saat) === "dinilai", "status");

  check("tanpa format ditolak", !validasiPengaturan({ formats: [], maxPoints: 100 }, saat, true).ok, "formats");
  check(
    "tenggat lampau ditolak saat membuat",
    !validasiPengaturan({ formats: ["text"], maxPoints: 100, dueAt: "2026-10-05T11:00:00Z" }, saat, true).ok,
    "wajibMasaDepan",
  );
  check(
    "tenggat lampau BOLEH saat mengubah",
    validasiPengaturan({ formats: ["text"], maxPoints: 100, dueAt: "2026-10-05T11:00:00Z" }, saat, false).ok,
    "menutup lebih awal",
  );
  const tanpaTenggat = validasiPengaturan({ formats: ["text"], maxPoints: 100, acceptLate: true }, saat, true);
  check("acceptLate dipaksa false tanpa tenggat", tanpaTenggat.ok && !tanpaTenggat.value.acceptLate, "normalisasi");
  check(
    "nilai maksimal 0 / 1,5 / 1001 ditolak",
    [0, 1.5, 1001].every((n) => !validasiPengaturan({ formats: ["text"], maxPoints: n }, saat, true).ok),
    "maxPoints",
  );
  check(
    "nilai 1,5 / -1 / 101 ditolak; 100 diterima",
    validasiNilai(1.5, 100) === null && validasiNilai(-1, 100) === null && validasiNilai(101, 100) === null && validasiNilai(100, 100) === 100,
    "validasiNilai",
  );
}

// ── Ujung ke ujung ──────────────────────────────────────────────────────

async function run(owner: TestUser, siswa: TestUser, siswa2: TestUser, luar: TestUser, admin: TestUser) {
  const classId = `uji-tugas-${randomUUID().slice(0, 8)}`;
  const waktu = new Date().toISOString();

  // Kelas & keanggotaan ditulis langsung: yang diuji di sini tugasnya, alur
  // membuat & bergabung sudah dijaga verify-classroom.
  await db.collection("classes").doc(classId).set({
    name: "Kelas Uji Tugas",
    description: "",
    ownerUid: owner.uid,
    joinCode: "UJITUGAS",
    memberCount: 2,
    postCount: 0,
    createdAt: waktu,
    updatedAt: waktu,
  });
  for (const s of [siswa, siswa2]) {
    await db.collection("classMembers").doc(`${s.uid}_${classId}`).set({
      uid: s.uid,
      classId,
      role: "member",
      joinedAt: waktu,
    });
  }

  let kelasAda = true;
  try {
    const jalurPemilik = `/educator/classes/${classId}`;
    await probe(jalurPemilik, owner.cookie);
    await probe(`/kelas/${classId}`, siswa.cookie);

    const tugasId = await actionId("educator/classes/[id]", "createAssignment");
    const postId = await actionId("educator/classes/[id]", "createPost");
    const hapusPostId = await actionId("educator/classes/[id]", "deletePost");
    const hapusKelasId = await actionId("educator/classes/[id]", "deleteClass");

    const besok = new Date(Date.now() + 24 * 3600_000).toISOString();
    const folderPemilik = `class-files/${owner.uid}/${classId}`;
    const lampiran = `${folderPemilik}/draf/soal.pdf`;
    await simpan(lampiran, "application/pdf");
    await simpan(`${folderPemilik}/draf/virus.txt`, "text/plain");
    await simpan(`class-files/${siswa.uid}/${classId}/draf/palsu.pdf`, "application/pdf");

    // ── Membuat tugas ─────────────────────────────────────────────
    {
      const olehSiswa = await callAction(jalurPemilik, tugasId, [classId, { title: "Tugas X", formats: ["text"], maxPoints: 100 }], siswa.cookie);
      check("siswa tidak bisa membuat tugas", olehSiswa.includes("Hanya pemilik kelas"), "penjaga pemilik");

      const tanpaFormat = await callAction(jalurPemilik, tugasId, [classId, { title: "Tugas X", formats: [], maxPoints: 100 }], owner.cookie);
      check("tugas tanpa format ditolak", tanpaFormat.includes("minimal satu format"), "validasi server");

      const lampau = await callAction(
        jalurPemilik, tugasId,
        [classId, { title: "Tugas X", formats: ["text"], maxPoints: 100, dueAt: "2020-01-01T00:00:00Z" }],
        owner.cookie,
      );
      check("tenggat lampau ditolak", lampau.includes("masa depan"), "validasi server");

      const curian = await callAction(
        jalurPemilik, tugasId,
        [classId, { title: "Tugas X", formats: ["text"], maxPoints: 100, attachments: [{ path: `class-files/${siswa.uid}/${classId}/draf/palsu.pdf`, name: "x.pdf" }] }],
        owner.cookie,
      );
      check("lampiran dari folder orang lain ditolak", curian.includes("Berkas tidak sah"), "awalan path");

      const txt = await callAction(
        jalurPemilik, tugasId,
        [classId, { title: "Tugas X", formats: ["text"], maxPoints: 100, attachments: [{ path: `${folderPemilik}/draf/virus.txt`, name: "a.pdf" }] }],
        owner.cookie,
      );
      check("lampiran bertipe di luar daftar ditolak (MIME dibaca dari Storage)", txt.includes("Format berkas tidak diterima"), "nama .pdf palsu");

      const ok = await callAction(
        jalurPemilik, tugasId,
        [classId, {
          title: "Tugas PDF",
          body: "Kerjakan soal terlampir.",
          formats: ["pdfImage"],
          dueAt: besok,
          acceptLate: false,
          maxPoints: 100,
          attachments: [{ path: lampiran, name: "soal.pdf", size: 999_999_999 }],
        }],
        owner.cookie,
      );
      check("pemilik menerbitkan tugas berlampiran", ok.includes("Tugas diterbitkan"), "pesan hasil");

      await callAction(jalurPemilik, tugasId, [classId, { title: "Tugas Teks Tutup", formats: ["text"], dueAt: besok, maxPoints: 50 }], owner.cookie);
      await callAction(jalurPemilik, tugasId, [classId, { title: "Tugas Teks Longgar", formats: ["text"], dueAt: besok, acceptLate: true, maxPoints: 10 }], owner.cookie);

      const pengumuman = await callAction(jalurPemilik, postId, [classId, "", [{ path: lampiran, name: "soal.pdf" }]], owner.cookie);
      check("pengumuman boleh hanya berisi lampiran", pengumuman.includes("terkirim"), "tanpa teks");
    }

    const A = await postIdBerjudul(classId, "Tugas PDF");
    const B = await postIdBerjudul(classId, "Tugas Teks Tutup");
    const C = await postIdBerjudul(classId, "Tugas Teks Longgar");
    check("ketiga tugas tersimpan", Boolean(A && B && C), `${A} ${B} ${C}`);

    {
      const d = (await db.collection("classes").doc(classId).collection("posts").doc(A).get()).data();
      check("jenis tersimpan sebagai assignment", d?.kind === "assignment", String(d?.kind));
      check("ukuran lampiran dibaca server, bukan dari browser", d?.attachments?.[0]?.size === PDF.length, String(d?.attachments?.[0]?.size));
      check("tenggat tersimpan", d?.assignment?.dueAt === besok, String(d?.assignment?.dueAt));
      const k = (await db.collection("classes").doc(classId).get()).data();
      check("postCount ikut naik", k?.postCount === 4, `postCount=${k?.postCount}`);
    }

    // ── Penyaji lampiran pengajar ─────────────────────────────────
    {
      const url = `/api/classes/attachment?class=${classId}&post=${A}&i=0`;
      check("anonim tidak bisa mengunduh lampiran", (await unduh(url)).status === 401, "401");
      check("bukan anggota mendapat 404", (await unduh(url, luar.cookie)).status === 404, "404");
      const r = await unduh(url, siswa.cookie);
      check("anggota mengunduh lampiran", r.status === 200, `HTTP ${r.status}`);
      check("lampiran disajikan sebagai unduhan", (r.headers.get("content-disposition") ?? "").startsWith("attachment"), String(r.headers.get("content-disposition")));
      check("nosniff terpasang", r.headers.get("x-content-type-options") === "nosniff", "header");
    }

    // Halaman tugas dibuka dulu supaya manifest action-nya ditulis.
    await probe(`/kelas/${classId}/tugas/${A}`, siswa.cookie);
    await probe(`/educator/classes/${classId}/tugas/${A}`, owner.cookie);
    const kirimId = await actionId("kelas/[id]/tugas/[postId]", "submitClassAssignment");
    const batalId = await actionId("kelas/[id]/tugas/[postId]", "unsubmitClassAssignment");
    const nilaiId = await actionId("educator/classes/[id]/tugas/[postId]", "gradeClassSubmission");
    const aturId = await actionId("educator/classes/[id]/tugas/[postId]", "updateAssignment");

    const jalurA = `/kelas/${classId}/tugas/${A}`;
    const folderA = (uid: string) => `class-submissions/${uid}/${classId}/${A}`;
    const jawabanSiswa = `${folderA(siswa.uid)}/jawaban.pdf`;
    await simpan(jawabanSiswa, "application/pdf");
    await simpan(`${folderA(siswa.uid)}/jawaban.docx`, DOCX_MIME);
    await simpan(`${folderA(siswa2.uid)}/punya-teman.pdf`, "application/pdf");
    await simpan(`class-submissions/${siswa.uid}/${classId}/${B}/salah-tugas.pdf`, "application/pdf");

    // ── Mengumpulkan ──────────────────────────────────────────────
    {
      const kirim = (cookie: string, input: unknown) => callAction(jalurA, kirimId, [classId, A, input], cookie);

      check("bukan anggota tidak bisa mengumpulkan", (await kirim(luar.cookie, { text: "x" })).includes("bukan anggota"), "penjaga");
      check("pemilik kelas tidak mengumpulkan", (await kirim(owner.cookie, { text: "x" })).includes("Hanya peserta"), "isMember");
      check("teks ditolak pada tugas berkas-saja", (await kirim(siswa.cookie, { text: "jawaban" })).includes("tidak menerima jawaban teks"), "format");
      check(
        "DOCX ditolak pada tugas PDF & gambar",
        (await kirim(siswa.cookie, { files: [{ path: `${folderA(siswa.uid)}/jawaban.docx`, name: "a.docx" }] })).includes("Format berkas tidak diterima"),
        "MIME per tugas",
      );
      check(
        "berkas milik teman ditolak",
        (await kirim(siswa.cookie, { files: [{ path: `${folderA(siswa2.uid)}/punya-teman.pdf`, name: "a.pdf" }] })).includes("Berkas tidak sah"),
        "uid dari sesi",
      );
      check(
        "berkas dari folder tugas lain ditolak",
        (await kirim(siswa.cookie, { files: [{ path: `class-submissions/${siswa.uid}/${classId}/${B}/salah-tugas.pdf`, name: "a.pdf" }] })).includes("Berkas tidak sah"),
        "postId di awalan",
      );
      check(
        "path dengan .. ditolak",
        (await kirim(siswa.cookie, { files: [{ path: `${folderA(siswa.uid)}/../${A}/jawaban.pdf`, name: "a.pdf" }] })).includes("Berkas tidak sah"),
        "traversal",
      );
      check("pengiriman kosong ditolak", (await kirim(siswa.cookie, {})).includes("Tulis jawaban atau lampirkan"), "kosong");
      check("belum ada dokumen dari semua penolakan itu", !(await subRef(classId, A, siswa.uid).get()).exists, "penolakan nyata");

      const ok = await kirim(siswa.cookie, { files: [{ path: jawabanSiswa, name: "jawaban.pdf" }] });
      check("siswa mengumpulkan PDF", ok.includes("Tugas terkumpul"), "pesan hasil");

      const d = (await subRef(classId, A, siswa.uid).get()).data();
      check("ID pengumpulan deterministik", d !== undefined, `${classId}_${A}_${siswa.uid}`);
      check("tepat waktu → late false", d?.late === false, String(d?.late));
      check("status submitted", d?.status === "submitted", String(d?.status));

      const lagi = await kirim(siswa.cookie, { files: [{ path: jawabanSiswa, name: "jawaban.pdf" }] });
      check("mengirim dua kali ditolak (batalkan dulu)", lagi.includes("Batalkan pengiriman dulu"), "satu pengiriman");
    }

    // ── Penyaji berkas jawaban ────────────────────────────────────
    {
      const url = `/api/classes/submission?id=${encodeURIComponent(`${classId}_${A}_${siswa.uid}`)}&i=0`;
      check("siswa lain TIDAK bisa mengunduh jawaban teman", (await unduh(url, siswa2.cookie)).status === 403, "403");
      check("anonim ditolak", (await unduh(url)).status === 401, "401");
      check("pengirimnya sendiri bisa mengunduh", (await unduh(url, siswa.cookie)).status === 200, "200");
      check("pemilik kelas bisa mengunduh", (await unduh(url, owner.cookie)).status === 200, "200");
      check("admin bisa mengunduh", (await unduh(url, admin.cookie)).status === 200, "200");
    }

    // ── Batal & kirim ulang ───────────────────────────────────────
    {
      const berkas2 = `${folderA(siswa2.uid)}/punya-teman.pdf`;
      await callAction(jalurA, kirimId, [classId, A, { files: [{ path: berkas2, name: "a.pdf" }] }], siswa2.cookie);
      check("siswa kedua mengumpulkan", (await subRef(classId, A, siswa2.uid).get()).exists, "dokumen");

      const batal = await callAction(jalurA, batalId, [classId, A], siswa2.cookie);
      check("membatalkan sebelum dinilai berhasil", batal.includes("dibatalkan"), "pesan hasil");
      check("dokumen pengirimannya hilang", !(await subRef(classId, A, siswa2.uid).get()).exists, "terhapus");
      check("berkasnya ikut dihapus dari Storage", !(await ada(berkas2)), berkas2);
    }

    // ── Menilai ───────────────────────────────────────────────────
    {
      const jalurNilai = `/educator/classes/${classId}/tugas/${A}`;
      const nilai = (cookie: string, uid: string, g: unknown) => callAction(jalurNilai, nilaiId, [classId, A, uid, g, "Bagus."], cookie);

      check("siswa tidak bisa menilai", (await nilai(siswa.cookie, siswa.uid, 100)).includes("tidak berhak"), "penjaga");
      check("nilai di atas maksimal ditolak", (await nilai(owner.cookie, siswa.uid, 101)).includes("bilangan bulat 0–100"), "validasi");
      check("nilai pecahan ditolak", (await nilai(owner.cookie, siswa.uid, 87.5)).includes("bilangan bulat"), "validasi");
      check("menilai yang belum mengumpulkan ditolak", (await nilai(owner.cookie, siswa2.uid, 80)).includes("belum mengumpulkan"), "tanpa dokumen");
      check("dokumen hantu tidak tercipta", !(await subRef(classId, A, siswa2.uid).get()).exists, "transaksi");

      check("pemilik menilai", (await nilai(owner.cookie, siswa.uid, 88)).includes("Nilai disimpan"), "pesan hasil");
      const d = (await subRef(classId, A, siswa.uid).get()).data();
      check("nilai & komentar tersimpan", d?.status === "graded" && d?.grade === 88 && d?.feedback === "Bagus.", JSON.stringify([d?.status, d?.grade]));

      const batal = await callAction(jalurA, batalId, [classId, A], siswa.cookie);
      check("membatalkan yang sudah dinilai DITOLAK", batal.includes("sudah dinilai"), "nilai tidak boleh hilang");
      check("dokumen bernilai masih utuh", (await subRef(classId, A, siswa.uid).get()).data()?.grade === 88, "utuh");

      const halamanSiswa = await probeText(jalurA, siswa.cookie);
      check("siswa melihat nilainya", halamanSiswa.html.includes("88") && halamanSiswa.html.includes("Bagus."), "panel Tugas Anda");
    }

    // ── Tenggat ───────────────────────────────────────────────────
    {
      const lalu = new Date(Date.now() - 3600_000).toISOString();
      const aturB = await callAction(`/educator/classes/${classId}/tugas/${B}`, aturId, [classId, B, { dueAt: lalu, acceptLate: false }], siswa.cookie);
      check("siswa tidak bisa mengubah tenggat", aturB.includes("tidak berhak"), "penjaga");

      await callAction(`/educator/classes/${classId}/tugas/${B}`, aturId, [classId, B, { dueAt: lalu, acceptLate: false }], owner.cookie);
      await callAction(`/educator/classes/${classId}/tugas/${C}`, aturId, [classId, C, { dueAt: lalu, acceptLate: true }], owner.cookie);

      const dB = (await db.collection("classes").doc(classId).collection("posts").doc(B).get()).data();
      check("tenggat diubah ke masa lalu (menutup pengumpulan)", dB?.assignment?.dueAt === lalu, String(dB?.assignment?.dueAt));
      check("format tidak ikut berubah saat mengatur tenggat", JSON.stringify(dB?.assignment?.formats) === '["text"]', JSON.stringify(dB?.assignment?.formats));

      const tutup = await callAction(`/kelas/${classId}/tugas/${B}`, kirimId, [classId, B, { text: "telat" }], siswa.cookie);
      check("lewat tenggat & menolak terlambat → DITOLAK", tutup.includes("Tenggat sudah lewat"), "jam server");
      check("tidak ada dokumen tertulis", !(await subRef(classId, B, siswa.uid).get()).exists, "penolakan nyata");

      const longgar = await callAction(`/kelas/${classId}/tugas/${C}`, kirimId, [classId, C, { text: RAHASIA_SISWA2 }], siswa2.cookie);
      check("lewat tenggat & menerima terlambat → diterima", longgar.includes("terlambat"), "pesan hasil");
      check("ditandai late", (await subRef(classId, C, siswa2.uid).get()).data()?.late === true, "late");
    }

    // ── Kerahasiaan halaman ───────────────────────────────────────
    {
      const halamanSiswa = await probeText(`/kelas/${classId}/tugas/${C}`, siswa.cookie);
      check("halaman siswa TIDAK memuat jawaban teman", !halamanSiswa.html.includes(RAHASIA_SISWA2), "hanya milik sendiri");

      const halamanPemilik = await probeText(`/educator/classes/${classId}/tugas/${C}`, owner.cookie);
      check("halaman pengajar memuat jawaban siswa", halamanPemilik.html.includes(RAHASIA_SISWA2), "daftar pengumpulan");

      const alih = await probe(`/kelas/${classId}/tugas/${C}`, owner.cookie);
      check("pemilik di halaman siswa dialihkan ke halaman pengelola", alih.status === 307 && (alih.location ?? "").includes("/educator/classes/"), `HTTP ${alih.status}`);

      const luarnya = await probe(`/kelas/${classId}/tugas/${C}`, luar.cookie);
      check("bukan anggota mendapat 404 di halaman tugas", luarnya.status === 404, `HTTP ${luarnya.status}`);

      const tabTugas = await probeText(`/kelas/${classId}?tab=tugas`, siswa.cookie);
      check("tab Tugas memuat ketiga tugas", ["Tugas PDF", "Tugas Teks Tutup", "Tugas Teks Longgar"].every((t) => tabTugas.html.includes(t)), "daftar");
    }

    // ── Menghapus tugas ───────────────────────────────────────────
    {
      // Kiriman segar yang belum dinilai, supaya terbukti ikut tersapu.
      const segar = `${folderA(siswa2.uid)}/segar.pdf`;
      await simpan(segar, "application/pdf");
      await callAction(jalurA, kirimId, [classId, A, { files: [{ path: segar, name: "segar.pdf" }] }], siswa2.cookie);
      check("ada kiriman segar sebelum tugas dihapus", (await subRef(classId, A, siswa2.uid).get()).exists, "dokumen");

      const ok = await callAction(jalurPemilik, hapusPostId, [classId, A], owner.cookie);
      check("pemilik menghapus tugas", ok.includes("dihapus"), "pesan hasil");

      const sisa = await db.collection("classSubmissions").where("postId", "==", A).get();
      check("pengumpulannya ikut terhapus", sisa.empty, `${sisa.size} tersisa`);
      check("berkas jawaban ikut terhapus", !(await ada(jawabanSiswa)) && !(await ada(segar)), "Storage");
      check("lampiran pengajarnya ikut terhapus", !(await ada(lampiran)), lampiran);
    }

    // ── Menghapus kelas ───────────────────────────────────────────
    {
      const lamp2 = `${folderPemilik}/draf/lagi.pdf`;
      await simpan(lamp2, "application/pdf");
      await callAction(jalurPemilik, postId, [classId, "Terakhir", [{ path: lamp2, name: "lagi.pdf" }]], owner.cookie);

      const ok = await callAction(jalurPemilik, hapusKelasId, [classId], owner.cookie);
      check("pemilik menghapus kelas", ok.includes("dihapus"), "pesan hasil");
      kelasAda = false;

      const sisa = await db.collection("classSubmissions").where("classId", "==", classId).get();
      check("seluruh pengumpulan kelas ikut terhapus", sisa.empty, `${sisa.size} tersisa`);
      check("lampiran postingan ikut terhapus", !(await ada(lamp2)), lamp2);
    }
  } finally {
    if (kelasAda) await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
    const m = await db.collection("classMembers").where("classId", "==", classId).get();
    await Promise.all(m.docs.map((d) => d.ref.delete().catch(() => undefined)));
    const s = await db.collection("classSubmissions").where("classId", "==", classId).get();
    await Promise.all(s.docs.map((d) => d.ref.delete().catch(() => undefined)));
    for (const u of [owner.uid, siswa.uid, siswa2.uid]) {
      await bucket.deleteFiles({ prefix: `class-files/${u}/${classId}/` }).catch(() => undefined);
      await bucket.deleteFiles({ prefix: `class-submissions/${u}/${classId}/` }).catch(() => undefined);
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  aturanMurni();

  const owner = await createTestUser("educator", "tugas-pemilik");
  const siswa = await createTestUser("user", "tugas-siswa");
  const siswa2 = await createTestUser("user", "tugas-siswa2");
  const luar = await createTestUser("user", "tugas-luar");
  const admin = await createTestUser("admin", "tugas-admin");

  try {
    await run(owner, siswa, siswa2, luar, admin);
  } finally {
    await auth.deleteUsers([owner.uid, siswa.uid, siswa2.uid, luar.uid, admin.uid]).catch(() => undefined);
    console.log("\nakun, kelas & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
