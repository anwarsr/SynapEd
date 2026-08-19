/**
 * Menguji mesin kuis (Fase 5) dari ujung ke ujung terhadap server yang
 * sedang berjalan: kepemilikan editor soal, validasi saveQuiz, penilaian
 * submitQuiz (skor, percobaan, penjelasan yang ditunda), dan — yang paling
 * penting — bahwa `correctOptionId` TIDAK PERNAH muncul di payload yang
 * dikirim ke peserta (halaman belajar maupun hasil submitQuiz), padahal
 * field itu memang ada di dokumen mentah yang dibaca educator lewat
 * loadQuizForEditor.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-quiz.ts [baseUrl]
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
const EDIT_ROUTE = "educator/courses/[slug]/edit";
const LEARN_ROUTE = "courses/[slug]/learn/[[...lesson]]";

// Field yang TIDAK BOLEH pernah muncul di payload yang sampai ke peserta —
// itulah yang membuat penilaian di server tidak bisa dicurangi dengan
// membaca Network tab.
const SECRET_FIELD = "correctOptionId";

function courseDoc(slug: string, ownerUid: string, ownerName: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Kuis",
    shortDesc: "Dibuat oleh verify-quiz, akan dihapus.",
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
          { slug: "materi-awal", title: "Materi Awal", type: "reading", duration: "5 menit", position: 0 },
          { slug: "kuis-satu", title: "Kuis Satu", type: "quiz", duration: "10 menit", position: 1 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName,
    createdAt: now,
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
    courseTitle: "Kursus Uji Kuis",
    courseIcon: "reading",
    courseTint: "bg-blue-50",
    courseLevel: "Pemula",
    courseLevelColor: "green",
    lessonsTotal: 2,
  };
}

const quizInput = {
  passingScore: 100,
  maxAttempts: 3,
  questions: [
    {
      id: "q-mtk",
      prompt: "2 + 2 = ?",
      options: [
        { id: "opt-mtk-salah", text: "3" },
        { id: "opt-mtk-benar", text: "4" },
      ],
      correctOptionId: "opt-mtk-benar",
      explanation: "Penjelasan-rahasia-matematika: dua tambah dua sama dengan empat.",
      points: 50,
    },
    {
      id: "q-ibukota",
      prompt: "Ibu kota Indonesia?",
      options: [
        { id: "opt-ibukota-benar", text: "Jakarta" },
        { id: "opt-ibukota-salah", text: "Bandung" },
      ],
      correctOptionId: "opt-ibukota-benar",
      explanation: "Penjelasan-rahasia-ibukota: Jakarta adalah ibu kota Indonesia.",
      points: 50,
    },
  ],
};

const explanations = quizInput.questions.map((q) => q.explanation);

async function run(owner: TestUser, otherOwner: TestUser, student: TestUser, otherStudent: TestUser) {
  const slug = `verify-kuis-${randomUUID().slice(0, 8)}`;
  const enrollId = `${student.uid}_${slug}`;

  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid, "Uji Pemilik Kuis"));
  await db.collection("enrollments").doc(enrollId).set(enrollmentDoc(student.uid, slug));

  const leakedIn: string[] = [];
  function noLeak(label: string, text: string) {
    check(`${label} — tidak memuat field "${SECRET_FIELD}"`, !text.includes(SECRET_FIELD), "anti-bocor");
    if (text.includes(SECRET_FIELD)) leakedIn.push(label);
  }

  try {
    // Kompilasi rute dulu supaya manifest action-nya ada.
    await probe(`/educator/courses/${slug}/edit`, owner.cookie);
    await probe(`/courses/${slug}/learn/kuis-satu`, student.cookie);

    const loadId = await actionId(EDIT_ROUTE, "loadQuizForEditor");
    const saveId = await actionId(EDIT_ROUTE, "saveQuiz");
    const submitId = await actionId(LEARN_ROUTE, "submitQuiz");

    // ── Kepemilikan editor soal ─────────────────────────────────────
    {
      const path = `/educator/courses/${slug}/edit`;

      const byOther = await callAction(path, loadId, [slug, "kuis-satu"], otherOwner.cookie);
      check("educator lain tidak bisa memuat editor soal", byOther.includes("tidak berhak"), "requireOwnedCourse");

      const saveByOther = await callAction(path, saveId, [slug, "kuis-satu", quizInput], otherOwner.cookie);
      check("educator lain tidak bisa menyimpan soal", saveByOther.includes("tidak berhak"), "requireOwnedCourse");
    }

    // ── Validasi saveQuiz ────────────────────────────────────────────
    {
      const path = `/educator/courses/${slug}/edit`;

      const wrongLessonType = await callAction(
        path,
        saveId,
        [slug, "materi-awal", quizInput],
        owner.cookie,
      );
      check(
        "menyimpan soal ke pelajaran bukan-kuis ditolak",
        wrongLessonType.includes("bukan bertipe kuis"),
        "validasi tipe pelajaran",
      );

      const missingLesson = await callAction(
        path,
        saveId,
        [slug, "pelajaran-tidak-ada", quizInput],
        owner.cookie,
      );
      check("menyimpan soal ke pelajaran yang tidak ada ditolak", missingLesson.includes("tidak ditemukan"), "validasi slug");

      const noQuestions = await callAction(
        path,
        saveId,
        [slug, "kuis-satu", { ...quizInput, questions: [] }],
        owner.cookie,
      );
      check("kuis tanpa soal ditolak", noQuestions.includes("minimal punya satu soal"), "validasi jumlah soal");

      const badCorrectId = await callAction(
        path,
        saveId,
        [
          slug,
          "kuis-satu",
          {
            ...quizInput,
            questions: [{ ...quizInput.questions[0], correctOptionId: "id-yang-tidak-ada" }],
          },
        ],
        owner.cookie,
      );
      check(
        "correctOptionId yang tidak cocok pilihan mana pun ditolak",
        badCorrectId.includes("Jawaban benar belum dipilih"),
        "validasi jawaban benar",
      );

      const ok = await callAction(path, saveId, [slug, "kuis-satu", quizInput], owner.cookie);
      check("pemilik berhasil menyimpan soal kuis", ok.includes("tersimpan"), "pesan hasil");

      const raw = await db.collection("courses").doc(slug).collection("quizzes").doc("kuis-satu").get();
      check("dokumen kuis tersimpan di subcollection", raw.exists, "Firestore");
      check(
        "correctOptionId TERSIMPAN di dokumen mentah (untuk penilaian), bukan diam-diam dibuang",
        raw.data()?.questions?.[0]?.correctOptionId === "opt-mtk-benar",
        "loadQuizForEditor/submitQuiz butuh ini di server",
      );
    }

    // ── Halaman belajar: soal tampil, jawaban benar TIDAK bocor ──────
    {
      const page = await probeText(`/courses/${slug}/learn/kuis-satu`, student.cookie);
      check("halaman belajar merender soal kuis", page.html.includes("2 + 2 = ?"), "prompt tampil");
      check("halaman belajar merender semua pilihan", page.html.includes("Jakarta") && page.html.includes("Bandung"), "opsi tampil");
      noLeak("halaman belajar (pelajaran kuis)", page.html);
    }

    // ── Penilaian submitQuiz ──────────────────────────────────────────
    {
      const path = `/courses/${slug}/learn/kuis-satu`;

      const anon = await callAction(path, submitId, [slug, "kuis-satu", {}]);
      check("anonim tidak bisa mengirim jawaban", anon.includes("Silakan masuk"), "penjaga di server action");

      const notEnrolled = await callAction(path, submitId, [slug, "kuis-satu", {}], otherStudent.cookie);
      check(
        "peserta yang belum terdaftar tidak bisa mengirim jawaban",
        notEnrolled.includes("belum terdaftar"),
        "penjaga enrollment aktif",
      );

      // Percobaan 1: semua salah -> belum lulus, penjelasan BELUM dibuka
      // (masih ada sisa percobaan), correctOptionId tetap tidak boleh bocor.
      const attempt1 = await callAction(
        path,
        submitId,
        [slug, "kuis-satu", { "q-mtk": "opt-mtk-salah", "q-ibukota": "opt-ibukota-salah" }],
        student.cookie,
      );
      check("percobaan 1 (semua salah) diproses", attempt1.includes('"passed":false'), attempt1.slice(0, 200));
      check("percobaan 1 skor 0", attempt1.includes('"score":0'), attempt1.slice(0, 200));
      for (const exp of explanations) {
        check(`percobaan 1 — penjelasan "${exp.slice(0, 20)}…" BELUM dibuka`, !attempt1.includes(exp), "masih ada sisa percobaan");
      }
      noLeak("submitQuiz percobaan 1", attempt1);

      const enrollAfter1 = (await db.collection("enrollments").doc(enrollId).get()).data();
      check("skor terbaik tercatat 0 setelah percobaan 1", enrollAfter1?.quizScores?.["kuis-satu"] === 0, String(enrollAfter1?.quizScores));
      check(
        "pelajaran BELUM masuk completedLessons setelah gagal",
        !(enrollAfter1?.completedLessons ?? []).includes("kuis-satu"),
        JSON.stringify(enrollAfter1?.completedLessons),
      );

      // Percobaan 2: semua benar -> lulus, penjelasan dibuka karena lulus.
      const attempt2 = await callAction(
        path,
        submitId,
        [slug, "kuis-satu", { "q-mtk": "opt-mtk-benar", "q-ibukota": "opt-ibukota-benar" }],
        student.cookie,
      );
      check("percobaan 2 (semua benar) lulus", attempt2.includes('"passed":true'), attempt2.slice(0, 200));
      check("percobaan 2 skor 100", attempt2.includes('"score":100'), attempt2.slice(0, 200));
      for (const exp of explanations) {
        check(`percobaan 2 — penjelasan "${exp.slice(0, 20)}…" dibuka setelah lulus`, attempt2.includes(exp), "sudah lulus");
      }
      noLeak("submitQuiz percobaan 2", attempt2);

      const enrollAfter2 = (await db.collection("enrollments").doc(enrollId).get()).data();
      check("skor terbaik naik jadi 100 setelah lulus", enrollAfter2?.quizScores?.["kuis-satu"] === 100, String(enrollAfter2?.quizScores));
      check(
        "pelajaran masuk completedLessons setelah lulus",
        (enrollAfter2?.completedLessons ?? []).includes("kuis-satu"),
        JSON.stringify(enrollAfter2?.completedLessons),
      );
      check(
        "sertifikat BELUM terbit — materi-awal belum ditandai selesai",
        enrollAfter2?.certificateId == null,
        "issueCertificateIfComplete menghitung irisan kurikulum penuh",
      );

      // Percobaan 3: gagal lagi setelah lulus -> skor terbaik TETAP 100,
      // status lulus tidak dicabut, tapi ini percobaan terakhir (maxAttempts
      // 3) jadi penjelasan tetap terbuka (attemptsLeft === 0).
      const attempt3 = await callAction(
        path,
        submitId,
        [slug, "kuis-satu", { "q-mtk": "opt-mtk-salah", "q-ibukota": "opt-ibukota-salah" }],
        student.cookie,
      );
      check("percobaan 3 (gagal lagi) tetap diproses", attempt3.includes('"passed":false'), attempt3.slice(0, 200));
      check("percobaan 3 attemptsLeft habis", attempt3.includes('"attemptsLeft":0'), attempt3.slice(0, 200));
      noLeak("submitQuiz percobaan 3", attempt3);

      const enrollAfter3 = (await db.collection("enrollments").doc(enrollId).get()).data();
      check(
        "skor terbaik TIDAK turun setelah percobaan gagal berikutnya",
        enrollAfter3?.quizScores?.["kuis-satu"] === 100,
        String(enrollAfter3?.quizScores),
      );
      check(
        "status lulus tidak dicabut oleh percobaan gagal berikutnya",
        (enrollAfter3?.completedLessons ?? []).includes("kuis-satu"),
        JSON.stringify(enrollAfter3?.completedLessons),
      );

      // Percobaan 4: percobaan sudah habis (maxAttempts 3 tercapai).
      const attempt4 = await callAction(
        path,
        submitId,
        [slug, "kuis-satu", { "q-mtk": "opt-mtk-benar", "q-ibukota": "opt-ibukota-benar" }],
        student.cookie,
      );
      check("percobaan ke-4 ditolak — sudah habis", attempt4.includes("sudah habis"), attempt4.slice(0, 200));

      const attemptDocs = await db
        .collection("enrollments")
        .doc(enrollId)
        .collection("quizAttempts")
        .where("lessonSlug", "==", "kuis-satu")
        .get();
      check("hanya 3 percobaan tercatat (percobaan ke-4 tidak menulis apa pun)", attemptDocs.size === 3, `${attemptDocs.size} dokumen`);
    }

    check(
      "TIDAK ADA satu pun payload publik yang membocorkan correctOptionId",
      leakedIn.length === 0,
      leakedIn.length === 0 ? "0 hasil, seperti yang diharapkan" : `bocor di: ${leakedIn.join(", ")}`,
    );
  } finally {
    await db.recursiveDelete(db.collection("courses").doc(slug)).catch(() => undefined);
    await db.recursiveDelete(db.collection("enrollments").doc(enrollId)).catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "kuis-pemilik");
  const otherOwner = await createTestUser("educator", "kuis-lain");
  const student = await createTestUser("user", "kuis-peserta");
  const otherStudent = await createTestUser("user", "kuis-bukan-peserta");

  console.log(`pemilik        : ${owner.email}`);
  console.log(`educator lain  : ${otherOwner.email}`);
  console.log(`peserta        : ${student.email}`);
  console.log(`bukan peserta  : ${otherStudent.email}\n`);

  try {
    await run(owner, otherOwner, student, otherStudent);
  } finally {
    await auth.deleteUsers([owner.uid, otherOwner.uid, student.uid, otherStudent.uid]);
    console.log("\nakun, kursus & pendaftaran uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
