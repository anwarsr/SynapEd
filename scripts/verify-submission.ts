/**
 * Menguji pengumpulan tugas, penilaian educator, dan gerbang sertifikat.
 *
 * Yang paling keras diuji di sini bukan "apakah bisa mengumpulkan", melainkan
 * apa yang TIDAK boleh terjadi:
 *
 *   - peserta menilai tugasnya sendiri
 *   - sertifikat terbit sebelum tugasnya dinilai
 *   - sertifikat terbit padahal nilainya di bawah batas kelulusan
 *   - berkas tugas terbaca orang yang tidak berhak
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-submission.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
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
  readEnv,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));

const LEARN_ROUTE = "courses/[slug]/learn/[[...lesson]]";
const STUDENTS_ROUTE = "educator/courses/[slug]/students";
const COURSE_ROUTE = "courses/[slug]";

const BATAS = 70;
const BERKAS = Buffer.from("jawaban tugas uji\n");

/**
 * Satu bacaan, satu penugasan, satu kuis.
 *
 * Kuisnya ada dengan alasan tersendiri: gerbang sertifikat mengecualikan
 * pelajaran kuis yang sudah punya SKOR (kuis bersoal menilai dirinya sendiri).
 * Tanpa kuis di sini, pengecualian itu bisa melebar diam-diam jadi "semua
 * pelajaran kuis dilewati" tanpa ada satu pemeriksaan pun yang memerah.
 */
function courseDoc(slug: string, ownerUid: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: `Kursus Uji Tugas ${slug.slice(-6)}`,
    shortDesc: "Dibuat oleh verify-submission, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Jam",
    rating: 0,
    reviews: 0,
    ratingSum: 0,
    price: 0,
    passingGrade: BATAS,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Pemilik",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    visibility: "public",
    sections: [
      {
        title: "Bagian Awal",
        position: 0,
        lessons: [
          { slug: "bacaan", title: "Bacaan", type: "reading", duration: "5 Menit", position: 0 },
          { slug: "tugas", title: "Tugas Akhir", type: "assignment", duration: "30 Menit", position: 1 },
          { slug: "kuis", title: "Kuis Akhir", type: "quiz", duration: "10 Menit", position: 2 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    createdAt: now,
  };
}

async function enrollmentOf(uid: string, slug: string) {
  return (await db.collection("enrollments").doc(`${uid}_${slug}`).get()).data();
}

async function run(owner: TestUser, siswa: TestUser, lain: TestUser) {
  const slug = `verify-tugas-${randomUUID().slice(0, 8)}`;
  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid));

  const idTugas = `${siswa.uid}_${slug}_tugas`;
  const pathSiswa = `submissions/${siswa.uid}/${slug}/tugas-uji.txt`;
  const pathLain = `submissions/${lain.uid}/${slug}/tugas-uji.txt`;
  const idKuis = `${siswa.uid}_${slug}_kuis`;
  const pathKuis = `submissions/${siswa.uid}/${slug}/kuis-uji.txt`;

  await bucket.file(pathSiswa).save(BERKAS, { contentType: "text/plain" });
  await bucket.file(pathLain).save(BERKAS, { contentType: "text/plain" });
  await bucket.file(pathKuis).save(BERKAS, { contentType: "text/plain" });

  try {
    await probe(`/courses/${slug}`, siswa.cookie);
    await probe(`/courses/${slug}/learn/bacaan`, siswa.cookie);
    await probe(`/educator/courses/${slug}/students`, owner.cookie);

    const kirimId = await actionId(LEARN_ROUTE, "submitAssignment");
    const nilaiId = await actionId(STUDENTS_ROUTE, "gradeSubmission");
    const daftarId = await actionId(COURSE_ROUTE, "enrollFree");
    const selesaiId = await actionId(LEARN_ROUTE, "markLessonComplete");

    const learnPath = `/courses/${slug}/learn/tugas`;

    // ── Penjaga sebelum mendaftar ──────────────────────────────────
    {
      const anon = await callAction(learnPath, kirimId, [slug, "tugas", pathSiswa, "uji.txt", 18]);
      check("anonim tidak bisa mengumpulkan tugas", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      const belumDaftar = await callAction(
        learnPath, kirimId, [slug, "tugas", pathLain, "uji.txt", 18], lain.cookie,
      );
      check(
        "yang belum mendaftar tidak bisa mengumpulkan",
        belumDaftar.includes("belum terdaftar"),
        "penjaga enrollment",
      );
    }

    await callAction(`/courses/${slug}`, daftarId, [slug], siswa.cookie);

    // ── Penjaga jenis pelajaran & kepemilikan berkas ───────────────
    {
      const salahTipe = await callAction(
        learnPath, kirimId, [slug, "bacaan", pathSiswa, "uji.txt", 18], siswa.cookie,
      );
      check(
        "pelajaran bacaan menolak pengumpulan tugas",
        salahTipe.includes("tidak menerima pengumpulan"),
        "hanya penugasan & kuis",
      );

      const berkasOrangLain = await callAction(
        learnPath, kirimId, [slug, "tugas", pathLain, "uji.txt", 18], siswa.cookie,
      );
      check(
        "berkas di folder orang lain ditolak",
        berkasOrangLain.includes("tidak sah"),
        "awalan path diperiksa di server",
      );
    }

    // ── Mengumpulkan ──────────────────────────────────────────────
    {
      const ok = await callAction(
        learnPath, kirimId, [slug, "tugas", pathSiswa, "jawaban.txt", 18], siswa.cookie,
      );
      check("peserta berhasil mengumpulkan tugas", ok.includes("terkumpul"), "pesan hasil");

      const d = (await db.collection("submissions").doc(idTugas).get()).data();
      check("dokumen pengumpulan tertulis", Boolean(d), "Firestore");
      check("statusnya menunggu dinilai", d?.status === "submitted", `status=${d?.status}`);
      check("belum ada nilai", d?.grade === null, `grade=${d?.grade}`);

      const e = await enrollmentOf(siswa.uid, slug);
      check(
        "mengumpulkan sekaligus menandai pelajarannya selesai",
        (e?.completedLessons as string[])?.includes("tugas"),
        "satu tindakan, bukan dua",
      );
    }

    // ── Berkas tidak bocor ────────────────────────────────────────
    {
      const url = `/api/submissions/file?id=${encodeURIComponent(idTugas)}`;

      const anon = await probe(url);
      check("anonim tidak bisa mengunduh berkas tugas", anon.status === 401, `HTTP ${anon.status}`);

      const pihakKetiga = await probe(url, lain.cookie);
      check("peserta lain ditolak", pihakKetiga.status === 403, `HTTP ${pihakKetiga.status}`);

      const pemilikTugas = await probe(url, siswa.cookie);
      check("pengumpulnya sendiri boleh mengunduh", pemilikTugas.status === 200, `HTTP ${pemilikTugas.status}`);

      const educator = await probe(url, owner.cookie);
      check("educator pemilik kursus boleh mengunduh", educator.status === 200, `HTTP ${educator.status}`);
      check(
        "berkas dipaksa diunduh, tidak dirender browser",
        (educator.res.headers.get("content-disposition") ?? "").startsWith("attachment"),
        "jenis berkasnya bebas — merendernya berarti mengizinkan eksekusi di domain ini",
      );
    }

    // ── Sertifikat tertahan selama belum dinilai ──────────────────
    {
      await callAction(
        `/courses/${slug}/learn/bacaan`, selesaiId, [slug, "bacaan"], siswa.cookie,
      );

      const e = await enrollmentOf(siswa.uid, slug);
      check(
        "seluruh pelajaran sudah selesai",
        (e?.completedLessons as string[])?.length === 2,
        `${(e?.completedLessons as string[])?.length} pelajaran`,
      );
      check(
        "SERTIFIKAT TERTAHAN karena tugasnya belum dinilai",
        !e?.certificateId,
        "inilah inti fitur ini",
      );
    }

    // ── Hanya educator yang boleh menilai ─────────────────────────
    {
      const olehSiswa = await callAction("/educator/courses/x/students", nilaiId, [idTugas, 100, ""], siswa.cookie);
      check(
        "peserta tidak bisa menilai tugasnya sendiri",
        olehSiswa.includes("tidak berhak"),
        "kalau lolos, siapa pun bisa memberi 100 lalu menarik sertifikat",
      );

      const olehLain = await callAction("/educator/courses/x/students", nilaiId, [idTugas, 100, ""], lain.cookie);
      check("orang lain tidak bisa menilai", olehLain.includes("tidak berhak"), "penjaga kepemilikan kursus");

      const d = (await db.collection("submissions").doc(idTugas).get()).data();
      check("statusnya belum berubah", d?.status === "submitted", `status=${d?.status}`);
    }

    // ── Nilai di luar rentang ─────────────────────────────────────
    {
      const path = `/educator/courses/${slug}/students`;
      for (const angka of [-1, 101]) {
        const out = await callAction(path, nilaiId, [idTugas, angka, ""], owner.cookie);
        check(`nilai ${angka} ditolak`, out.includes("antara 0 sampai 100"), "batas nilai");
      }
    }

    // ── Nilai di bawah batas: sertifikat TETAP tertahan ───────────
    {
      const path = `/educator/courses/${slug}/students`;
      const out = await callAction(path, nilaiId, [idTugas, 50, "Perbaiki bagian analisisnya."], owner.cookie);
      check("educator memberi nilai 50", out.includes("50"), "pesan hasil");

      const d = (await db.collection("submissions").doc(idTugas).get()).data();
      check("statusnya menjadi dinilai", d?.status === "graded", `status=${d?.status}`);
      check("catatan educator tersimpan", d?.feedback === "Perbaiki bagian analisisnya.", "feedback");

      const e = await enrollmentOf(siswa.uid, slug);
      check(
        `SERTIFIKAT TETAP TERTAHAN karena 50 di bawah ${BATAS}`,
        !e?.certificateId,
        "dinilai saja tidak cukup — harus lulus",
      );
    }

    // ── Mengumpulkan ulang menghapus nilai lama ───────────────────
    {
      const ulang = `submissions/${siswa.uid}/${slug}/tugas-perbaikan.txt`;
      await bucket.file(ulang).save(BERKAS, { contentType: "text/plain" });

      const out = await callAction(
        learnPath, kirimId, [slug, "tugas", ulang, "perbaikan.txt", 18], siswa.cookie,
      );
      check("peserta mengumpulkan ulang", out.includes("diganti"), "pesan hasil");

      const semua = await db.collection("submissions").where("uid", "==", siswa.uid).get();
      check("tetap satu dokumen pengumpulan", semua.size === 1, `${semua.size} dokumen`);

      const d = (await db.collection("submissions").doc(idTugas).get()).data();
      check("nilai lama DIHAPUS saat mengumpulkan ulang", d?.grade === null, `grade=${d?.grade}`);
      check("statusnya kembali menunggu dinilai", d?.status === "submitted", `status=${d?.status}`);

      const [lamaMasihAda] = await bucket.file(pathSiswa).exists();
      check(
        "berkas lama ikut dibuang dari Storage",
        !lamaMasihAda,
        lamaMasihAda ? "menumpuk tanpa ada yang merujuk" : "dibersihkan",
      );
    }

    // ── Kuis yang belum dinilai tetap menahan sertifikat ──────────
    //
    // Penugasannya lulus dan SELURUH pelajaran sudah selesai di sini, jadi
    // satu-satunya yang tersisa adalah kuisnya. Kalau pengecualian kuis
    // melebar jadi "lewati semua pelajaran kuis", pemeriksaan inilah yang
    // memerah lebih dulu.
    {
      // Kuisnya dikumpulkan LEBIH DULU, baru penugasannya dinilai.
      //
      // Urutan ini bukan selera: sertifikat baru dicoba terbitkan saat ada
      // penilaian. Kalau kuisnya dikumpulkan belakangan, yang menahan
      // sertifikat adalah pelajaran yang belum selesai — dan pemeriksaan di
      // bawah lulus tanpa pernah menyentuh gerbang penilaian kuis sama
      // sekali.
      const kirim = await callAction(
        `/courses/${slug}/learn/kuis`, kirimId, [slug, "kuis", pathKuis, "kuis.txt", 18], siswa.cookie,
      );
      check("peserta mengumpulkan kuis", kirim.includes("terkumpul"), "kuis diperlakukan seperti penugasan");

      const semua = await enrollmentOf(siswa.uid, slug);
      check(
        "seluruh pelajaran sudah selesai sebelum gerbangnya diuji",
        ["bacaan", "tugas", "kuis"].every((l) =>
          ((semua?.completedLessons as string[]) ?? []).includes(l),
        ),
        "supaya yang menahan hanya nilainya",
      );

      const path = `/educator/courses/${slug}/students`;
      await callAction(path, nilaiId, [idTugas, 85, "Bagus."], owner.cookie);

      const e = await enrollmentOf(siswa.uid, slug);
      check(
        "sertifikat tertahan selama KUIS belum dinilai",
        !e?.certificateId,
        `certificateId=${e?.certificateId}` ,
      );
    }

    // ── Semuanya dinilai dan lulus: sertifikat TERBIT ─────────────
    {
      const path = `/educator/courses/${slug}/students`;
      await callAction(path, nilaiId, [idKuis, 80, "Lulus."], owner.cookie);

      const e = await enrollmentOf(siswa.uid, slug);
      check(
        "sertifikat TERBIT setelah tugas DAN kuis lulus dinilai",
        Boolean(e?.certificateId),
        `certificateId=${e?.certificateId}`,
      );
      check("enrollment ditandai selesai", e?.status === "completed", `status=${e?.status}`);
    }

    // ── Halaman peserta untuk educator ────────────────────────────
    {
      const halaman = await probeText(`/educator/courses/${slug}/students`, owner.cookie);
      check("halaman peserta terbuka untuk pemiliknya", halaman.status === 200, `HTTP ${halaman.status}`);
      check("peserta tampil di daftar", halaman.html.includes("Tugas Akhir"), "pengumpulannya terdaftar");
      check("nilainya tampil", halaman.html.includes("85"), "Nilai 85");

      const olehLain = await probe(`/educator/courses/${slug}/students`, lain.cookie);
      check(
        "bukan pemilik kursus tidak bisa membuka daftar peserta",
        olehLain.status === 404 || (olehLain.status >= 300 && olehLain.status < 400),
        `HTTP ${olehLain.status}`,
      );
    }
  } finally {
    await db.collection("courses").doc(slug).delete().catch(() => undefined);
    for (const c of ["enrollments", "submissions"]) {
      const snap = await db.collection(c).where("courseSlug", "==", slug).get();
      for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
    }
    for (const uid of [siswa.uid, lain.uid]) {
      await bucket.deleteFiles({ prefix: `submissions/${uid}/` }).catch(() => undefined);
    }
    const cert = await db.collection("certificates").where("courseSlug", "==", slug).get();
    for (const d of cert.docs) await d.ref.delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "tugas-pemilik");
  const siswa = await createTestUser("user", "tugas-siswa");
  const lain = await createTestUser("user", "tugas-lain");

  console.log(`pemilik : ${owner.email}`);
  console.log(`siswa   : ${siswa.email}`);
  console.log(`lain    : ${lain.email}\n`);

  try {
    await run(owner, siswa, lain);
  } finally {
    await auth.deleteUsers([owner.uid, siswa.uid, lain.uid]);
    console.log("\nakun, kursus & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
