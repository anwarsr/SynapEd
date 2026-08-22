/**
 * Menguji ulasan kursus dari ujung ke ujung.
 *
 * Yang paling penting di sini satu: hanya peserta yang BENAR-BENAR
 * menyelesaikan kursusnya yang bisa menulis. Karena itu peserta ujinya
 * menempuh jalur asli — mendaftar lewat enrollFree, lalu menandai setiap
 * pelajaran selesai lewat markLessonComplete — bukan disuntik langsung ke
 * Firestore dengan status "completed". Kalau disuntik, yang teruji hanya satu
 * perbandingan string, bukan rantai yang sebenarnya dipakai orang.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-review.ts [baseUrl]
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
const COURSE_ROUTE = "courses/[slug]";
const LESSONS = ["satu", "dua"];

function courseDoc(slug: string, ownerUid: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: `Kursus Uji Ulasan ${slug.slice(-6)}`,
    shortDesc: "Dibuat oleh verify-review, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Jam",
    rating: 0,
    reviews: 0,
    price: 0,
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
        lessons: LESSONS.map((s, i) => ({
          slug: s,
          title: `Pelajaran ${s}`,
          type: "reading",
          duration: "5 Menit",
          position: i,
        })),
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    createdAt: now,
  };
}

interface Ringkasan {
  rating: number;
  reviews: number;
  ratingSum: number;
}

async function ringkasanKursus(slug: string): Promise<Ringkasan> {
  const d = (await db.collection("courses").doc(slug).get()).data() ?? {};
  return {
    rating: typeof d.rating === "number" ? d.rating : -1,
    reviews: typeof d.reviews === "number" ? d.reviews : -1,
    ratingSum: typeof d.ratingSum === "number" ? d.ratingSum : -1,
  };
}

async function run(owner: TestUser, siswa: TestUser, lain: TestUser, admin: TestUser) {
  const slug = `verify-ulasan-${randomUUID().slice(0, 8)}`;
  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid));

  try {
    await probe(`/courses/${slug}`, siswa.cookie);

    const path = `/courses/${slug}`;
    const kirimId = await actionId(COURSE_ROUTE, "submitReview");
    const hapusSendiriId = await actionId(COURSE_ROUTE, "deleteMyReview");
    const daftarId = await actionId(COURSE_ROUTE, "enrollFree");

    const ULASAN = "Materinya runtut dan contohnya banyak, sangat membantu.";

    // ── Belum jadi peserta sama sekali ─────────────────────────────
    {
      const anon = await callAction(path, kirimId, [slug, 5, ULASAN]);
      check("anonim tidak bisa menulis ulasan", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      const bukanPeserta = await callAction(path, kirimId, [slug, 5, ULASAN], lain.cookie);
      check(
        "yang belum mendaftar tidak bisa menulis ulasan",
        bukanPeserta.includes("Hanya peserta"),
        "penjaga enrollment",
      );

      // Educator pemilik membuka kursusnya lewat hak milik, bukan enrollment —
      // jadi ia pun tidak bisa memberi bintang pada kursusnya sendiri.
      const pemilik = await callAction(path, kirimId, [slug, 5, ULASAN], owner.cookie);
      check(
        "educator tidak bisa mengulas kursusnya sendiri",
        pemilik.includes("Hanya peserta"),
        "tidak punya enrollment",
      );

      const kosong = await db.collection("reviews").where("courseSlug", "==", slug).get();
      check("tidak ada ulasan yang tertulis", kosong.empty, `${kosong.size} dokumen`);
    }

    // ── Sudah mendaftar tapi belum selesai ─────────────────────────
    {
      const out = await callAction(path, daftarId, [slug], siswa.cookie);
      check("peserta mendaftar kursus", out.includes("berhasil") || out.includes("terdaftar"), "enrollFree");

      const belum = await callAction(path, kirimId, [slug, 5, ULASAN], siswa.cookie);
      check(
        "peserta yang belum selesai ditolak",
        belum.includes("Selesaikan dulu"),
        "inilah penjaga yang membuat ulasan berarti",
      );

      const halaman = await probeText(`/courses/${slug}`, siswa.cookie);
      check(
        "formulir ulasan belum ditawarkan ke peserta yang belum selesai",
        !halaman.html.includes("Bagaimana kursus ini menurut Anda"),
        "yang terlihat ikut sejalan dengan penjaganya",
      );

      const r = await ringkasanKursus(slug);
      check("ringkasan bintang belum tersentuh", r.reviews === 0, `reviews=${r.reviews}`);
    }

    // ── Menyelesaikan seluruh pelajaran, lalu mengulas ─────────────
    {
      await probe(`/courses/${slug}/learn/${LESSONS[0]}`, siswa.cookie);
      const selesaiId = await actionId("courses/[slug]/learn/[[...lesson]]", "markLessonComplete");
      for (const l of LESSONS) {
        await callAction(`/courses/${slug}/learn/${l}`, selesaiId, [slug, l], siswa.cookie);
      }

      const e = (
        await db.collection("enrollments").doc(`${siswa.uid}_${slug}`).get()
      ).data();
      check(
        "enrollment menjadi selesai lewat jalur asli",
        e?.status === "completed",
        `status: ${e?.status}`,
      );

      const halaman = await probeText(`/courses/${slug}`, siswa.cookie);
      check(
        "formulir ulasan muncul setelah kursusnya selesai",
        halaman.html.includes("Bagaimana kursus ini menurut Anda"),
        "peserta punya jalan menulis, bukan cuma server yang mengizinkan",
      );

      // Validasi masukan diuji SETELAH syarat utamanya terpenuhi, supaya yang
      // menolak benar-benar validasinya — bukan penjaga "belum selesai" yang
      // kebetulan menghadang lebih dulu.
      const nol = await callAction(path, kirimId, [slug, 0, ULASAN], siswa.cookie);
      check("bintang 0 ditolak", nol.includes("antara 1 sampai 5"), "batas bawah");

      const enam = await callAction(path, kirimId, [slug, 6, ULASAN], siswa.cookie);
      check("bintang 6 ditolak", enam.includes("antara 1 sampai 5"), "batas atas");

      const pendek = await callAction(path, kirimId, [slug, 5, "bagus"], siswa.cookie);
      check("ulasan terlalu pendek ditolak", pendek.includes("minimal 10 karakter"), "validasi isi");

      const ok = await callAction(path, kirimId, [slug, 5, ULASAN], siswa.cookie);
      check("peserta yang sudah selesai berhasil mengulas", ok.includes("tersimpan"), "pesan hasil");

      const doc = (await db.collection("reviews").doc(`${siswa.uid}_${slug}`).get()).data();
      check("dokumen ulasan tertulis", Boolean(doc), "Firestore");
      check("bintang tersimpan", doc?.rating === 5, `rating=${doc?.rating}`);
      check("isi ulasan tersimpan", doc?.comment === ULASAN, "comment");
      check(
        "judul kursus ikut disalin ke ulasan",
        typeof doc?.courseTitle === "string" && doc.courseTitle.length > 0,
        `courseTitle="${doc?.courseTitle}"`,
      );

      const r = await ringkasanKursus(slug);
      check(
        "ringkasan bintang kursus ikut diperbarui",
        r.reviews === 1 && r.rating === 5 && r.ratingSum === 5,
        JSON.stringify(r),
      );
    }

    // ── Menulis ulang: menimpa, bukan menggandakan ─────────────────
    {
      const out = await callAction(path, kirimId, [slug, 3, "Ternyata sebagian materinya sudah usang."], siswa.cookie);
      check("ulasan kedua dari orang yang sama memperbarui", out.includes("diperbarui"), "pesan hasil");

      const semua = await db.collection("reviews").where("courseSlug", "==", slug).get();
      check("tetap satu dokumen ulasan", semua.size === 1, `${semua.size} dokumen`);

      const r = await ringkasanKursus(slug);
      check(
        "rata-rata mengikuti nilai BARU, bukan menjumlah keduanya",
        r.reviews === 1 && r.rating === 3 && r.ratingSum === 3,
        JSON.stringify(r),
      );
    }

    // ── Tampil di halaman detail, tapi bintang 3 tidak di beranda ──
    {
      const detail = await probeText(`/courses/${slug}`);
      check(
        "ulasan bintang 3 tetap tampil utuh di halaman detail kursus",
        detail.html.includes("sebagian materinya sudah usang"),
        "yang menimbang berhak melihat semuanya",
      );

      const beranda = await probeText("/");
      check(
        "ulasan bintang 3 TIDAK dibawa ke etalase beranda",
        !beranda.html.includes("sebagian materinya sudah usang"),
        "penyaringan bintang 4 ke atas",
      );

      // Dinaikkan lagi ke bintang 5 — sekarang harus ikut tampil di beranda.
      await callAction(path, kirimId, [slug, 5, ULASAN], siswa.cookie);
      const beranda2 = await probeText("/");
      check(
        "ulasan bintang 5 muncul di beranda",
        beranda2.html.includes("Materinya runtut"),
        "etalase mengambil dari ulasan nyata",
      );
    }

    // ── Penghapusan ────────────────────────────────────────────────
    {
      const bukanAdmin = await callAction(
        "/admin/reviews",
        await hapusAdminId(admin),
        [`${siswa.uid}_${slug}`],
        lain.cookie,
      );
      check("bukan admin tidak bisa menghapus ulasan orang", bukanAdmin.includes("Hanya admin"), "penjaga peran");

      const masih = (await db.collection("reviews").doc(`${siswa.uid}_${slug}`).get()).exists;
      check("ulasannya belum terhapus", masih, "Firestore");

      const olehAdmin = await callAction(
        "/admin/reviews",
        await hapusAdminId(admin),
        [`${siswa.uid}_${slug}`],
        admin.cookie,
      );
      check("admin menghapus ulasan", olehAdmin.includes("dihapus"), "pesan hasil");

      const hilang = !(await db.collection("reviews").doc(`${siswa.uid}_${slug}`).get()).exists;
      check("dokumennya benar-benar hilang", hilang, "Firestore");

      const r = await ringkasanKursus(slug);
      check(
        "ringkasan bintang kembali ke nol setelah dihapus",
        r.reviews === 0 && r.rating === 0 && r.ratingSum === 0,
        JSON.stringify(r),
      );
    }

    // ── Ulasan ikut terbuang saat kursusnya dihapus ────────────────
    {
      await callAction(path, kirimId, [slug, 5, ULASAN], siswa.cookie);
      const ada = (await db.collection("reviews").doc(`${siswa.uid}_${slug}`).get()).exists;
      check("ulasan ditulis ulang untuk menguji penghapusan kursus", ada, "persiapan");

      await probe(`/educator/courses/${slug}/edit`, admin.cookie);
      const hapusKursusId = await actionId("educator/courses/[slug]/edit", "deleteCourse");
      await callAction(`/educator/courses/${slug}/edit`, hapusKursusId, [slug], admin.cookie);

      const sisa = await db.collection("reviews").where("courseSlug", "==", slug).get();
      check(
        "ulasan ikut terbuang bersama kursusnya",
        sisa.empty,
        sisa.empty ? "tidak jadi yatim" : `${sisa.size} tersisa menunjuk kursus yang sudah 404`,
      );
    }

    // Sengaja tidak dipakai lagi; hanya supaya deleteMyReview ikut tersentuh.
    void hapusSendiriId;
  } finally {
    await db.collection("courses").doc(slug).delete().catch(() => undefined);
    for (const c of ["reviews", "enrollments"]) {
      const s = await db.collection(c).where("courseSlug", "==", slug).get();
      for (const d of s.docs) await d.ref.delete().catch(() => undefined);
    }
  }
}

/** ID action penghapusan di panel admin — rutenya dikompilasi sekali dulu. */
let adminHapusId: string | null = null;
async function hapusAdminId(admin: TestUser): Promise<string> {
  if (!adminHapusId) {
    await probe("/admin/reviews", admin.cookie);
    adminHapusId = await actionId("admin/reviews", "deleteReview");
  }
  return adminHapusId;
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "ulasan-pemilik");
  const siswa = await createTestUser("user", "ulasan-siswa");
  const lain = await createTestUser("user", "ulasan-lain");
  const admin = await createTestUser("admin", "ulasan-admin");

  console.log(`pemilik : ${owner.email}`);
  console.log(`siswa   : ${siswa.email}`);
  console.log(`lain    : ${lain.email}`);
  console.log(`admin   : ${admin.email}\n`);

  try {
    await run(owner, siswa, lain, admin);
  } finally {
    await auth.deleteUsers([owner.uid, siswa.uid, lain.uid, admin.uid]);
    console.log("\nakun & kursus uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
