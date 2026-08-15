/**
 * Menguji penerbitan sertifikat (Fase 6) dari ujung ke ujung terhadap server
 * yang sedang berjalan: sertifikat baru terbit begitu SEMUA pelajaran di
 * kurikulum (termasuk kuis) tercatat selesai, penerbitannya idempoten (tidak
 * ada dokumen ganda kalau pelajaran terakhir "diselesaikan ulang"), halaman
 * verifikasi publik (/verify/{id}) bisa dibuka tanpa login, dan halaman cetak
 * di dashboard (/dashboard/certificates/{id}) hanya bisa dibuka pemiliknya
 * (atau admin) — bukan siapa pun yang menebak ID.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-certificate.ts [baseUrl]
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
const LEARN_ROUTE = "courses/[slug]/learn/[[...lesson]]";

// SYN- + 10 karakter Crockford base32 (tanpa I, L, O, U) — lihat lib/certificates.ts.
const CERT_ID_RE = /^SYN-[0-9A-HJKMNPQRSTVWXYZ]{10}$/;

function courseDoc(slug: string, ownerUid: string, ownerName: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Sertifikat",
    shortDesc: "Dibuat oleh verify-certificate, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 jam",
    rating: 0,
    reviews: 0,
    price: 0,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: ownerName,
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    sections: [
      {
        title: "Bagian Uji",
        position: 0,
        lessons: [
          { slug: "materi-satu", title: "Materi Satu", type: "reading", duration: "5 menit", free: true, position: 0 },
          { slug: "kuis-akhir", title: "Kuis Akhir", type: "quiz", duration: "10 menit", free: false, position: 1 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName,
    createdAt: now,
  };
}

function quizDoc(slug: string) {
  return {
    courseSlug: slug,
    lessonSlug: "kuis-akhir",
    passingScore: 100,
    maxAttempts: 5,
    questions: [
      {
        id: "q1",
        prompt: "1 + 1 = ?",
        options: [
          { id: "salah", text: "3" },
          { id: "benar", text: "2" },
        ],
        correctOptionId: "benar",
        explanation: "Satu tambah satu sama dengan dua.",
        points: 100,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function enrollmentDoc(uid: string, slug: string) {
  const now = new Date().toISOString();
  return {
    uid,
    courseSlug: slug,
    status: "active",
    source: "free",
    orderId: null,
    pricePaid: 0,
    currency: "IDR",
    enrolledAt: now,
    expiresAt: null,
    completedLessons: [],
    quizScores: {},
    lastLessonSlug: null,
    lastAccessedAt: now,
    completedAt: null,
    certificateId: null,
    courseTitle: "Kursus Uji Sertifikat",
    courseIcon: "reading",
    courseTint: "bg-blue-50",
    courseLevel: "Pemula",
    courseLevelColor: "green",
    lessonsTotal: 2,
  };
}

function isRedirectTo(r: { status: number; location: string | null }, needle: string): boolean {
  return r.status >= 300 && r.status < 400 && (r.location ?? "").includes(needle);
}

async function run(owner: TestUser, student: TestUser, otherStudent: TestUser, admin: TestUser) {
  const slug = `verify-sertifikat-${randomUUID().slice(0, 8)}`;
  const enrollId = `${student.uid}_${slug}`;

  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid, "Uji Pemilik Sertifikat"));
  await db.collection("courses").doc(slug).collection("quizzes").doc("kuis-akhir").set(quizDoc(slug));
  await db.collection("enrollments").doc(enrollId).set(enrollmentDoc(student.uid, slug));

  let certificateId: string | undefined;

  try {
    // Kompilasi rute dulu supaya manifest action-nya ada.
    await probe(`/courses/${slug}/learn/materi-satu`, student.cookie);
    const markId = await actionId(LEARN_ROUTE, "markLessonComplete");
    const submitId = await actionId(LEARN_ROUTE, "submitQuiz");

    // ── Pelajaran pertama selesai — sertifikat BELUM terbit ──────────
    {
      const path = `/courses/${slug}/learn/materi-satu`;
      const out = await callAction(path, markId, [slug, "materi-satu"], student.cookie);
      check("pelajaran pertama ditandai selesai", out.includes("ditandai selesai"), out.slice(0, 200));

      const enrollment = (await db.collection("enrollments").doc(enrollId).get()).data();
      check(
        "sertifikat belum terbit — baru 1 dari 2 pelajaran selesai",
        enrollment?.certificateId == null,
        String(enrollment?.certificateId),
      );
    }

    // ── Kuis terakhir lulus — sertifikat harus terbit ────────────────
    {
      const path = `/courses/${slug}/learn/kuis-akhir`;
      const out = await callAction(path, submitId, [slug, "kuis-akhir", { q1: "benar" }], student.cookie);
      check("kuis terakhir lulus", out.includes('"passed":true'), out.slice(0, 200));

      const enrollment = (await db.collection("enrollments").doc(enrollId).get()).data();
      certificateId = enrollment?.certificateId as string | undefined;
      check("sertifikat terbit setelah semua pelajaran selesai", typeof certificateId === "string", String(certificateId));
      check(
        "ID sertifikat berbentuk SYN- + 10 karakter Crockford base32",
        !!certificateId && CERT_ID_RE.test(certificateId),
        String(certificateId),
      );
      check(
        "status enrollment berubah jadi completed",
        enrollment?.status === "completed",
        String(enrollment?.status),
      );
    }

    if (!certificateId) throw new Error("certificateId tidak pernah terisi — pengujian lanjutan tidak bisa jalan");
    const certId = certificateId;

    // ── Isi dokumen sertifikat ────────────────────────────────────────
    {
      const cert = (await db.collection("certificates").doc(certId).get()).data();
      check("holderName cocok nama akun peserta", cert?.holderName === "Uji sertifikat-peserta", String(cert?.holderName));
      check("courseSlug cocok", cert?.courseSlug === slug, String(cert?.courseSlug));
      check("courseTitle cocok judul kursus", cert?.courseTitle === "Kursus Uji Sertifikat", String(cert?.courseTitle));
      check("instructorName cocok pemilik kursus", cert?.instructorName === "Uji Pemilik Sertifikat", String(cert?.instructorName));
      check("lessonsTotal sesuai jumlah pelajaran", cert?.lessonsTotal === 2, String(cert?.lessonsTotal));
      check("revokedAt null saat terbit", cert?.revokedAt === null, String(cert?.revokedAt));
      check("issuedAt terisi tanggal ISO", typeof cert?.issuedAt === "string" && !Number.isNaN(Date.parse(cert.issuedAt)), String(cert?.issuedAt));
    }

    // ── Idempoten: mengulang aksi yang sudah selesai tidak menerbitkan lagi ──
    {
      const before = (await db.collection("certificates").doc(certId).get()).data();

      await callAction(`/courses/${slug}/learn/materi-satu`, markId, [slug, "materi-satu"], student.cookie);
      await callAction(`/courses/${slug}/learn/kuis-akhir`, submitId, [slug, "kuis-akhir", { q1: "benar" }], student.cookie);

      const enrollment = (await db.collection("enrollments").doc(enrollId).get()).data();
      check(
        "certificateId TIDAK berubah setelah pelajaran diselesaikan ulang",
        enrollment?.certificateId === certId,
        `${enrollment?.certificateId} vs ${certId}`,
      );

      const after = (await db.collection("certificates").doc(certId).get()).data();
      check(
        "issuedAt TIDAK berubah — bukan diterbitkan ulang",
        after?.issuedAt === before?.issuedAt,
        `${after?.issuedAt} vs ${before?.issuedAt}`,
      );

      const dup = await db.collection("certificates").where("uid", "==", student.uid).where("courseSlug", "==", slug).get();
      check("hanya ada SATU dokumen sertifikat untuk peserta+kursus ini", dup.size === 1, `${dup.size} dokumen`);
    }

    // ── Halaman verifikasi publik — tanpa login ──────────────────────
    {
      const page = await probeText(`/verify/${certId}`);
      check("halaman verifikasi bisa dibuka tanpa login", page.status === 200, `status ${page.status}`);
      check("menampilkan status sah", page.html.includes("sah dan diterbitkan"), "banner status");
      check("menampilkan nama peserta", page.html.includes("Uji sertifikat-peserta"), "holderName tampil");
      check("menampilkan judul kursus", page.html.includes("Kursus Uji Sertifikat"), "courseTitle tampil");
      check("menampilkan nama instruktur", page.html.includes("Uji Pemilik Sertifikat"), "instructorName tampil");
      check("menampilkan nomor sertifikat", page.html.includes(certId), "certificate id tampil");

      const bogus = await probeText(`/verify/SYN-0000000000`);
      check("ID sertifikat asal-asalan -> pesan tidak ditemukan", bogus.html.includes("tidak ditemukan"), "keadaan kosong");
      check("halaman ID asal-asalan tetap status 200 (bukan 404 generik)", bogus.status === 200, `status ${bogus.status}`);
    }

    // ── Halaman cetak di dashboard — hanya pemilik/admin ─────────────
    {
      const printPath = `/dashboard/certificates/${certId}`;

      const anon = await probe(printPath);
      check("anonim -> /login", isRedirectTo(anon, "/login"), `${anon.status} ${anon.location ?? ""}`);

      const bystander = await probe(printPath, otherStudent.cookie);
      check("peserta lain tidak bisa membuka sertifikat orang lain", bystander.status === 404, `status ${bystander.status}`);

      const ownerPage = await probeText(printPath, student.cookie);
      check(
        "pemilik sertifikat bisa membuka halaman cetak",
        ownerPage.status === 200 && ownerPage.html.includes("Cetak / Simpan sebagai PDF"),
        `status ${ownerPage.status}`,
      );

      const adminPage = await probe(printPath, admin.cookie);
      check("admin juga bisa membuka (bukan hanya pemilik)", adminPage.status === 200, `status ${adminPage.status}`);
    }

    // ── Tautan di dashboard utama ──────────────────────────────────
    {
      const dash = await probeText("/dashboard", student.cookie);
      check(
        "dashboard menampilkan tautan Lihat Sertifikat",
        dash.html.includes("Lihat Sertifikat") && dash.html.includes(`/dashboard/certificates/${certId}`),
        "tautan sertifikat",
      );
    }
  } finally {
    await db.recursiveDelete(db.collection("courses").doc(slug)).catch(() => undefined);
    await db.recursiveDelete(db.collection("enrollments").doc(enrollId)).catch(() => undefined);
    if (certificateId) {
      await db.collection("certificates").doc(certificateId).delete().catch(() => undefined);
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "sertifikat-pemilik");
  const student = await createTestUser("user", "sertifikat-peserta");
  const otherStudent = await createTestUser("user", "sertifikat-bukan-peserta");
  const admin = await createTestUser("admin", "sertifikat-admin");

  console.log(`pemilik        : ${owner.email}`);
  console.log(`peserta        : ${student.email}`);
  console.log(`bukan peserta  : ${otherStudent.email}`);
  console.log(`admin          : ${admin.email}\n`);

  try {
    await run(owner, student, otherStudent, admin);
  } finally {
    await auth.deleteUsers([owner.uid, student.uid, otherStudent.uid, admin.uid]);
    console.log("\nakun, kursus & sertifikat uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
