/**
 * Menguji editor kurikulum (Fase 4) dari ujung ke ujung terhadap server yang
 * sedang berjalan: kepemilikan, updateCourseMeta, saveCurriculum, dan bahwa
 * deleteCourse benar-benar menghapus subcollection (recursiveDelete),
 * bukan cuma dokumen induknya.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-curriculum.ts [baseUrl]
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

function courseDoc(slug: string, ownerUid: string, ownerName: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Kurikulum",
    shortDesc: "Dibuat oleh verify-curriculum, akan dihapus.",
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
        title: "Bagian Awal",
        position: 0,
        lessons: [
          { slug: "pelajaran-satu", title: "Pelajaran Satu", type: "reading", duration: "10 menit", free: true, position: 0 },
          { slug: "pelajaran-dua", title: "Pelajaran Dua", type: "reading", duration: "10 menit", free: false, position: 1 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName,
    createdAt: now,
  };
}

function isRedirectTo(r: { status: number; location: string | null }, needle: string): boolean {
  return r.status >= 300 && r.status < 400 && (r.location ?? "").includes(needle);
}

async function run(owner: TestUser, other: TestUser, admin: TestUser) {
  const slug = `verify-kurikulum-${randomUUID().slice(0, 8)}`;
  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid, "Uji Pemilik"));

  try {
    // Kompilasi rute dulu supaya manifest action-nya ada.
    await probe(`/educator/courses/${slug}/edit`, owner.cookie);

    // ── Kepemilikan halaman sunting ────────────────────────────────
    {
      const anon = await probe(`/educator/courses/${slug}/edit`);
      check("anonim -> /login", isRedirectTo(anon, "/login"), `${anon.status} ${anon.location ?? ""}`);

      const bystander = await probe(`/educator/courses/${slug}/edit`, other.cookie);
      check("educator lain -> 404 (bukan kursusnya)", bystander.status === 404, `status ${bystander.status}`);

      const ownerPage = await probeText(`/educator/courses/${slug}/edit`, owner.cookie);
      check(
        "pemilik bisa membuka halaman sunting",
        ownerPage.status === 200 && ownerPage.html.includes("Panel Educator"),
        `status ${ownerPage.status}`,
      );

      const adminPage = await probe(`/educator/courses/${slug}/edit`, admin.cookie);
      check("admin juga bisa membuka (bukan hanya pemilik)", adminPage.status === 200, `status ${adminPage.status}`);
    }

    const metaId = await actionId(EDIT_ROUTE, "updateCourseMeta");
    const curriculumId = await actionId(EDIT_ROUTE, "saveCurriculum");

    // ── updateCourseMeta ────────────────────────────────────────────
    {
      const path = `/educator/courses/${slug}/edit`;
      const validInput = {
        title: "Kursus Uji Kurikulum (Disunting)",
        shortDesc: "Deskripsi singkat baru yang cukup panjang.",
        longDesc: "Deskripsi lengkap baru.",
        level: "Menengah",
        category: "eeg",
        icon: "wave",
        duration: "2 jam",
        price: 150000,
        whatYouLearn: ["Poin satu", "Poin dua"],
        requirements: ["Laptop"],
      };

      const byOther = await callAction(path, metaId, [slug, validInput], other.cookie);
      check(
        "educator lain tidak bisa mengubah info kursus orang lain",
        byOther.includes("tidak berhak"),
        "penjaga requireOwnedCourse di server action",
      );

      const tooShort = await callAction(
        path,
        metaId,
        [slug, { ...validInput, title: "ab" }],
        owner.cookie,
      );
      check("judul terlalu pendek ditolak", tooShort.includes("minimal 4 karakter"), "validasi judul");

      const ok = await callAction(path, metaId, [slug, validInput], owner.cookie);
      check("pemilik berhasil mengubah info kursus", ok.includes("tersimpan"), "pesan hasil");

      const doc = await db.collection("courses").doc(slug).get();
      const data = doc.data();
      check("judul baru tersimpan di Firestore", data?.title === validInput.title, String(data?.title));
      check("harga baru tersimpan", data?.price === 150000, String(data?.price));
      check(
        "levelColor ikut disesuaikan dari LEVELS (bukan cuma level mentah)",
        data?.levelColor === "yellow",
        String(data?.levelColor),
      );
      check(
        "whatYouLearn tersimpan sebagai array bersih",
        Array.isArray(data?.whatYouLearn) && data.whatYouLearn.length === 2,
        JSON.stringify(data?.whatYouLearn),
      );
    }

    // ── saveCurriculum ──────────────────────────────────────────────
    {
      const path = `/educator/courses/${slug}/edit`;

      // Ambil slug pelajaran yang sudah ada supaya bisa dipertahankan —
      // persis seperti yang dilakukan CurriculumEditor di browser.
      const before = (await db.collection("courses").doc(slug).get()).data();
      const existingSlug = before?.sections?.[0]?.lessons?.[0]?.slug as string;

      const validCurriculum = [
        {
          title: "Bagian Awal (Disunting)",
          lessons: [
            { slug: existingSlug, title: "Pelajaran Satu (Disunting)", type: "reading", duration: "15 menit", free: true },
            { title: "Pelajaran Baru", type: "reading", duration: "5 menit", free: false },
          ],
        },
        {
          title: "Bagian Kedua",
          lessons: [{ title: "Pelajaran di Bagian Kedua", type: "video", duration: "8 menit", free: false, videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
        },
      ];

      const byOther = await callAction(path, curriculumId, [slug, validCurriculum], other.cookie);
      check(
        "educator lain tidak bisa menyunting kurikulum orang lain",
        byOther.includes("tidak berhak"),
        "penjaga requireOwnedCourse",
      );

      const badVideo = await callAction(
        path,
        curriculumId,
        [
          slug,
          [{ title: "Bagian", lessons: [{ title: "Video Rusak", type: "video", duration: "1 menit", free: true, videoUrl: "bukan-url-youtube" }] }],
        ],
        owner.cookie,
      );
      check("tautan video tidak dikenali ditolak", badVideo.includes("tidak dikenali"), "validasi videoUrl");

      const emptySection = await callAction(
        path,
        curriculumId,
        [slug, [{ title: "Bagian Kosong", lessons: [] }]],
        owner.cookie,
      );
      check("bagian tanpa pelajaran ditolak", emptySection.includes("belum punya pelajaran"), "validasi minimal 1 pelajaran");

      const ok = await callAction(path, curriculumId, [slug, validCurriculum], owner.cookie);
      check("pemilik berhasil menyimpan kurikulum", ok.includes("tersimpan"), "pesan hasil");

      const after = (await db.collection("courses").doc(slug).get()).data();
      const sections = after?.sections as { title: string; lessons: { slug: string; title: string; position: number }[] }[];

      check("jumlah bagian bertambah jadi 2", sections?.length === 2, String(sections?.length));
      check(
        "total pelajaran jadi 3",
        sections?.reduce((n, s) => n + s.lessons.length, 0) === 3,
        String(sections?.reduce((n, s) => n + s.lessons.length, 0)),
      );
      check(
        "slug pelajaran lama DIPERTAHANKAN — bukan diturunkan ulang dari judul baru",
        sections?.[0]?.lessons?.[0]?.slug === existingSlug,
        `${sections?.[0]?.lessons?.[0]?.slug} vs ${existingSlug}`,
      );
      check(
        "pelajaran baru dapat slug baru dari server",
        typeof sections?.[0]?.lessons?.[1]?.slug === "string" && sections[0].lessons[1].slug.length > 0,
        String(sections?.[0]?.lessons?.[1]?.slug),
      );
      check(
        "position dinormalisasi 0-based dari indeks array",
        sections?.[0]?.lessons?.[0]?.position === 0 && sections?.[0]?.lessons?.[1]?.position === 1,
        JSON.stringify(sections?.[0]?.lessons?.map((l) => l.position)),
      );

      // Halaman publik dan halaman belajar ikut menampilkan hasil sunting.
      const detail = await probeText(`/courses/${slug}`, owner.cookie);
      check(
        "halaman detail publik menampilkan judul & harga baru",
        detail.html.includes("Kursus Uji Kurikulum (Disunting)"),
        "revalidatePath bekerja",
      );
    }

    // ── deleteCourse benar-benar recursiveDelete ───────────────────
    {
      // Simulasikan subcollection yang akan ditambahkan Fase 5 (kuis) —
      // ini persis skenario yang tadinya ditinggalkan yatim oleh .delete()
      // biasa.
      await db.collection("courses").doc(slug).collection("quizzes").doc("contoh").set({ soal: [] });

      const deleteId = await actionId("educator/courses", "deleteCourse");
      const out = await callAction("/educator/courses", deleteId, [slug], owner.cookie);
      check("kursus berhasil dihapus", out.includes("dihapus"), "pesan hasil");

      const courseGone = !(await db.collection("courses").doc(slug).get()).exists;
      check("dokumen kursus hilang", courseGone, "Firestore");

      const quizGone = !(await db.collection("courses").doc(slug).collection("quizzes").doc("contoh").get()).exists;
      check(
        "subcollection quizzes IKUT terhapus — recursiveDelete, bukan .delete() biasa",
        quizGone,
        "dulu ini akan tertinggal yatim",
      );
    }
  } finally {
    await db.collection("courses").doc(slug).delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "kurikulum-pemilik");
  const other = await createTestUser("educator", "kurikulum-lain");
  const admin = await createTestUser("admin", "kurikulum-admin");

  console.log(`pemilik : ${owner.email}`);
  console.log(`lain    : ${other.email}`);
  console.log(`admin   : ${admin.email}\n`);

  try {
    await run(owner, other, admin);
  } finally {
    await auth.deleteUsers([owner.uid, other.uid, admin.uid]);
    console.log("\nakun & kursus uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
