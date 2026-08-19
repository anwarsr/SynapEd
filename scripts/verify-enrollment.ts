/**
 * Menguji pendaftaran kursus dan gerbang aksesnya dari ujung ke ujung
 * terhadap server yang sedang berjalan.
 *
 * Pendaftarannya dijalankan lewat Server Action yang sesungguhnya — dipanggil
 * dengan POST + header Next-Action, persis seperti yang dilakukan browser saat
 * tombolnya ditekan. Jadi yang teruji adalah kode produksinya, bukan tiruan
 * alurnya.
 *
 * Invarian terpenting yang dijaga di sini: pengguna yang sudah masuk tetapi
 * belum mendaftar TIDAK boleh membuka pelajaran berbayar — sebelum ada
 * enrollment, halaman belajar hanya memeriksa login, sehingga siapa pun yang
 * punya akun bisa membuka kursus mana pun.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-enrollment.ts [baseUrl]
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
const ENROLLMENTS = "enrollments";

const freeSlug = `verify-gratis-${randomUUID().slice(0, 8)}`;
const paidSlug = `verify-berbayar-${randomUUID().slice(0, 8)}`;

/**
 * Kursus uji dibuat tanpa field `order`.
 *
 * `listCourses` mengurutkan dengan orderBy('order') dan Firestore mengabaikan
 * dokumen yang tidak punya field itu — jadi kursus uji ini tidak pernah muncul
 * di katalog publik, tetapi tetap terbaca lewat getCourse() berdasarkan ID.
 */
function courseDoc(slug: string, price: number) {
  return {
    slug,
    title: `Kursus Uji ${price > 0 ? "Berbayar" : "Gratis"}`,
    shortDesc: "Dibuat oleh verify-enrollment, akan dihapus.",
    longDesc: "Dibuat oleh verify-enrollment, akan dihapus.",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 jam",
    rating: 0,
    reviews: 0,
    price,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: null,
    instructorName: "Uji",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    sections: [
      {
        title: "Bagian Uji",
        position: 0,
        lessons: [
          {
            slug: "pratinjau",
            title: "Pelajaran Pratinjau",
            type: "reading",
            duration: "5 menit",
            position: 0,
          },
          {
            slug: "terkunci",
            title: "Pelajaran Terkunci",
            type: "reading",
            duration: "5 menit",
            position: 1,
          },
        ],
      },
    ],
  };
}

async function enrolledStudentsOf(slug: string): Promise<number> {
  const doc = await db.collection("courses").doc(slug).get();
  return (doc.data()?.enrolledStudents as number | undefined) ?? 0;
}

async function enrollmentExists(uid: string, slug: string): Promise<boolean> {
  return (await db.collection(ENROLLMENTS).doc(`${uid}_${slug}`).get()).exists;
}

function isRedirectTo(r: { status: number; location: string | null }, needle: string): boolean {
  return r.status >= 300 && r.status < 400 && (r.location ?? "").includes(needle);
}

async function run(student: TestUser, other: TestUser) {
  // Halaman harus sudah terkompilasi sebelum ID action bisa dibaca dari
  // manifest — di mode dev Next mengompilasi rute saat pertama diminta.
  await probe(`/courses/${freeSlug}`, student.cookie);
  const enrollId = await actionId("courses/[slug]", "enrollFree");

  // ── Sebelum mendaftar: gerbangnya ─────────────────────────────────
  {
    const anon = await probe(`/courses/${freeSlug}/learn`);
    check(
      "halaman belajar anonim -> /login",
      isRedirectTo(anon, "/login"),
      `${anon.status} ${anon.location ?? ""}`,
    );

    const locked = await probe(`/courses/${freeSlug}/learn/terkunci`, student.cookie);
    check(
      "sudah masuk tapi belum mendaftar -> dialihkan dari pelajaran terkunci",
      isRedirectTo(locked, `/courses/${freeSlug}`),
      `${locked.status} ${locked.location ?? ""}`,
    );

    const preview = await probe(`/courses/${freeSlug}/learn/pratinjau`, student.cookie);
    check(
      "pelajaran yang dulu bisa dipratinjau kini IKUT terkunci",
      isRedirectTo(preview, `/courses/${freeSlug}`),
      `${preview.status} ${preview.location ?? ""}`,
    );

    const detail = await probeText(`/courses/${freeSlug}`, student.cookie);
    check(
      "halaman kursus menawarkan tombol daftar",
      detail.status === 200 && detail.html.includes("Daftar Kursus Ini"),
      String(detail.status),
    );

    const dash = await probeText("/dashboard", student.cookie);
    check(
      "dashboard menyatakan belum mengikuti kursus",
      dash.html.includes("Belum mengikuti kursus"),
      "keadaan kosong",
    );
  }

  // ── Penjaga di dalam server action ────────────────────────────────
  {
    const anon = await callAction(`/courses/${freeSlug}`, enrollId, [freeSlug]);
    check(
      "anonim tidak bisa mendaftar",
      anon.includes("Silakan masuk"),
      "penjaga di server action, bukan di tombol",
    );

    const paid = await callAction(`/courses/${paidSlug}`, enrollId, [paidSlug], student.cookie);
    check(
      "kursus berbayar tidak bisa didaftar gratis",
      paid.includes("berbayar"),
      "harga dibaca dari dokumen kursus, bukan dari klien",
    );
    check(
      "tidak ada enrollment yang tertulis untuk kursus berbayar",
      !(await enrollmentExists(student.uid, paidSlug)),
      "Firestore",
    );

    const missing = await callAction(
      `/courses/${freeSlug}`,
      enrollId,
      ["kursus-yang-tidak-ada"],
      student.cookie,
    );
    check("slug asal-asalan ditolak", missing.includes("tidak ditemukan"), "penjaga slug");
  }

  // ── Mendaftar ─────────────────────────────────────────────────────
  {
    const out = await callAction(`/courses/${freeSlug}`, enrollId, [freeSlug], student.cookie);
    check("pendaftaran berhasil", out.includes("Berhasil terdaftar"), "pesan dari server action");
    check("dokumen enrollment tertulis", await enrollmentExists(student.uid, freeSlug), "Firestore");
    check("jumlah peserta naik jadi 1", (await enrolledStudentsOf(freeSlug)) === 1, "enrolledStudents");

    const again = await callAction(`/courses/${freeSlug}`, enrollId, [freeSlug], student.cookie);
    check("mendaftar dua kali tidak menggandakan", again.includes("sudah terdaftar"), "idempoten");
    check(
      "jumlah peserta tetap 1 setelah pendaftaran ulang",
      (await enrolledStudentsOf(freeSlug)) === 1,
      "transaksi menjaga hitungannya",
    );
  }

  // ── Setelah mendaftar ─────────────────────────────────────────────
  {
    const locked = await probe(`/courses/${freeSlug}/learn/terkunci`, student.cookie);
    check(
      "peserta bisa membuka pelajaran yang tadinya terkunci",
      locked.status === 200,
      `status ${locked.status}`,
    );

    const detail = await probeText(`/courses/${freeSlug}`, student.cookie);
    check(
      "halaman kursus berubah jadi Lanjutkan Belajar",
      detail.html.includes("Lanjutkan Belajar"),
      "tombol menyesuaikan status pendaftaran",
    );

    const dash = await probeText("/dashboard", student.cookie);
    check(
      "kursus muncul di Kursus Saya",
      dash.html.includes("Kursus Saya") && dash.html.includes("Kursus Uji Gratis"),
      "dashboard",
    );
    check("kemajuan dimulai dari 0%", dash.html.includes("0%"), "belum ada pelajaran diselesaikan");
  }

  // ── Menandai pelajaran selesai ─────────────────────────────────────
  {
    const markId = await actionId("courses/[slug]/learn/[[...lesson]]", "markLessonComplete");

    const anon = await callAction(`/courses/${freeSlug}/learn/pratinjau`, markId, [freeSlug, "pratinjau"]);
    check("anonim tidak bisa menandai selesai", anon.includes("Silakan masuk"), "penjaga di server action");

    const notEnrolled = await callAction(
      `/courses/${freeSlug}/learn/pratinjau`,
      markId,
      [freeSlug, "pratinjau"],
      other.cookie,
    );
    check(
      "pengguna yang belum terdaftar tidak bisa menandai selesai",
      notEnrolled.includes("belum terdaftar"),
      "penjaga enrollment aktif, bukan hanya tombolnya disembunyikan",
    );

    const bogus = await callAction(
      `/courses/${freeSlug}/learn/pratinjau`,
      markId,
      [freeSlug, "pelajaran-asal-asalan"],
      student.cookie,
    );
    check("slug pelajaran asal-asalan ditolak", bogus.includes("tidak ditemukan"), "penjaga slug pelajaran");

    const first = await callAction(
      `/courses/${freeSlug}/learn/pratinjau`,
      markId,
      [freeSlug, "pratinjau"],
      student.cookie,
    );
    check("pelajaran pertama ditandai selesai", first.includes("ditandai selesai"), "pesan hasil");

    const half = await probeText("/dashboard", student.cookie);
    check("dashboard menunjukkan 50% setelah satu dari dua pelajaran", half.html.includes("50%"), "progressFromSnapshot");

    // arrayUnion idempoten — menandai ulang tidak menggandakan progres.
    await callAction(`/courses/${freeSlug}/learn/pratinjau`, markId, [freeSlug, "pratinjau"], student.cookie);
    const stillHalf = await probeText("/dashboard", student.cookie);
    check("menandai ulang pelajaran yang sama tidak mengubah progres", stillHalf.html.includes("50%"), "idempoten");

    const second = await callAction(
      `/courses/${freeSlug}/learn/terkunci`,
      markId,
      [freeSlug, "terkunci"],
      student.cookie,
    );
    check("pelajaran kedua ditandai selesai", second.includes("ditandai selesai"), "pesan hasil");

    const full = await probeText("/dashboard", student.cookie);
    check("dashboard menunjukkan 100% setelah semua pelajaran", full.html.includes("100%"), "progressFromSnapshot");
  }

  // ── Pendaftaran satu orang tidak membuka pintu untuk orang lain ───
  {
    const locked = await probe(`/courses/${freeSlug}/learn/terkunci`, other.cookie);
    check(
      "pengguna lain tetap tertutup",
      isRedirectTo(locked, `/courses/${freeSlug}`),
      `${locked.status} ${locked.location ?? ""}`,
    );

    const dash = await probeText("/dashboard", other.cookie);
    check(
      "dashboard pengguna lain tetap kosong",
      dash.html.includes("Belum mengikuti kursus"),
      "enrollment tidak bocor antar akun",
    );
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  await db.collection("courses").doc(freeSlug).set(courseDoc(freeSlug, 0));
  await db.collection("courses").doc(paidSlug).set(courseDoc(paidSlug, 500000));

  const student = await createTestUser("user", "peserta");
  const other = await createTestUser("user", "lain");

  console.log(`peserta       : ${student.email}`);
  console.log(`pengguna lain : ${other.email}`);
  console.log(`kursus gratis : ${freeSlug}`);
  console.log(`kursus bayar  : ${paidSlug}\n`);

  try {
    await run(student, other);
  } finally {
    await auth.deleteUsers([student.uid, other.uid]);
    await Promise.all([
      db.collection("courses").doc(freeSlug).delete(),
      db.collection("courses").doc(paidSlug).delete(),
      ...[student.uid, other.uid].flatMap((uid) =>
        [freeSlug, paidSlug].map((slug) =>
          db.collection(ENROLLMENTS).doc(`${uid}_${slug}`).delete().catch(() => undefined),
        ),
      ),
    ]);
    console.log("\nakun, kursus & pendaftaran uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
