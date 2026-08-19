/**
 * Menguji pembakuan durasi: aturan konversinya sendiri, DAN penegakannya di
 * server.
 *
 * Bagian kedua yang paling penting. Form kini memakai angka + dropdown, tetapi
 * Server Action bisa dipanggil lewat POST langsung tanpa menyentuh form sama
 * sekali — dan kalau server menerima apa saja, satu panggilan mentah cukup
 * untuk mengembalikan "Tugas" dan "1 Tahun" ke basis data, membatalkan seluruh
 * hasil scripts/convert-durations.ts.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-duration.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { canonicalDuration } from "../frontend/src/lib/duration";
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
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const EDIT_ROUTE = "educator/courses/[slug]/edit";

function courseDoc(slug: string, ownerUid: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Durasi",
    shortDesc: "Dibuat oleh verify-duration, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Tahun",
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
        lessons: [
          { slug: "pelajaran-satu", title: "Pelajaran Satu", type: "reading", duration: "Bacaan", position: 0 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    createdAt: now,
  };
}

/** ── Bagian 1: aturan konversinya sendiri ──────────────────────────
 *
 * Tanpa server dan tanpa Firestore. Di sinilah setiap bentuk yang benar-benar
 * ada di basis data dicantumkan satu per satu, supaya kalau ada yang berubah
 * artinya, yang gagal adalah baris yang menyebutkan nilainya — bukan sebuah
 * pemeriksaan umum yang tidak memberi tahu apa-apa.
 */
function ujiTabelKonversi() {
  const kasus: [string, "course" | "lesson", string, string][] = [
    // [masukan, lingkup, harapan, kenapa]
    ["1 Tahun", "course", "12 Bulan", "Tahun tidak ditawarkan — dihitung ulang, bukan dibuang"],
    ["10 Hari", "course", "10 Hari", "satuan tersedia — dibiarkan persis, tanpa pembulatan"],
    ["12", "course", "12 Jam", "tanpa satuan — angka dipercaya, satuan diisi bawaan"],
    ["90 Menit", "course", "2 Jam", "lebih kecil dari Jam — 60x, bukan ditukar labelnya saja"],
    ["30 Menit", "course", "1 Jam", "di bawah satuan terkecil — dibulatkan ke 1, tidak pernah ke 0"],
    ["1 minggu", "course", "1 Minggu", "huruf kecil tetap terbaca"],
    ["Tugas", "course", "", "bukan durasi — dikosongkan, bukan dikarang jadi angka"],
    ["—", "course", "", "penanda kosong yang dipakai server"],
    ["", "course", "", "memang belum diisi"],
    ["0 Jam", "course", "", "nol bukan durasi"],

    ["30 Menit", "lesson", "30 Menit", "satuan tersedia"],
    ["1 Jam", "lesson", "1 Jam", "batas atas satuan pelajaran"],
    ["90 detik", "lesson", "90 Detik", "Detik memang ditawarkan untuk pelajaran"],
    ["2 Hari", "lesson", "48 Jam", "Hari tidak ditawarkan — dinaikkan ke Jam, bukan jadi 2 Menit"],
    ["Bacaan", "lesson", "", "jenis pelajaran, bukan durasi"],
    ["Video", "lesson", "", "jenis pelajaran, bukan durasi"],
  ];

  for (const [masukan, scope, harapan, kenapa] of kasus) {
    const hasil = canonicalDuration(masukan, scope);
    check(
      `${scope}: "${masukan}" -> "${harapan || "(kosong)"}"`,
      hasil === harapan,
      hasil === harapan ? kenapa : `dapat "${hasil}"`,
    );
  }
}

/** ── Bagian 2: server menolak teks bebas walau form dilewati ───────── */
async function ujiServer(owner: TestUser, admin: TestUser) {
  const slug = `verify-durasi-${randomUUID().slice(0, 8)}`;
  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid));

  try {
    // Kompilasi rutenya dulu supaya manifest action-nya ada.
    await probe(`/educator/courses/${slug}/edit`, admin.cookie);

    const path = `/educator/courses/${slug}/edit`;
    const metaId = await actionId(EDIT_ROUTE, "updateCourseMeta");
    const curriculumId = await actionId(EDIT_ROUTE, "saveCurriculum");
    const requestId = await actionId(EDIT_ROUTE, "requestCourseEdit");

    const meta = {
      title: "Kursus Uji Durasi",
      shortDesc: "Deskripsi singkat yang cukup panjang.",
      longDesc: "x",
      level: "Pemula",
      category: "neuroscience",
      price: 0,
      whatYouLearn: [],
      requirements: [],
    };

    const bacaDurasi = async () =>
      (await db.collection("courses").doc(slug).get()).data()?.duration as string;

    // ── updateCourseMeta (admin) ──────────────────────────────────
    {
      await callAction(path, metaId, [slug, { ...meta, duration: "1 Tahun" }], admin.cookie);
      const d = await bacaDurasi();
      check(
        'POST langsung "1 Tahun" tersimpan sebagai "12 Bulan"',
        d === "12 Bulan",
        `Firestore: "${d}"`,
      );

      await callAction(path, metaId, [slug, { ...meta, duration: "Tugas" }], admin.cookie);
      const kosong = await bacaDurasi();
      check(
        'POST langsung "Tugas" tersimpan sebagai "—", bukan apa adanya',
        kosong === "—",
        `Firestore: "${kosong}"`,
      );

      await callAction(path, metaId, [slug, { ...meta, duration: "90 menit" }], admin.cookie);
      const kecil = await bacaDurasi();
      check(
        'POST langsung "90 menit" tersimpan sebagai "2 Jam", bukan "90 Jam"',
        kecil === "2 Jam",
        `Firestore: "${kecil}"`,
      );
    }

    // ── saveCurriculum (admin) ────────────────────────────────────
    {
      await callAction(
        path,
        curriculumId,
        [
          slug,
          [
            {
              title: "Bagian Awal",
              lessons: [
                { slug: "pelajaran-satu", title: "Satu", type: "reading", duration: "Video" },
                { title: "Dua", type: "reading", duration: "2 jam" },
                { title: "Tiga", type: "reading", duration: "2 Hari" },
              ],
            },
          ],
        ],
        admin.cookie,
      );

      const sections = (await db.collection("courses").doc(slug).get()).data()?.sections as {
        lessons: { duration: string }[];
      }[];
      const durasi = sections?.[0]?.lessons?.map((l) => l.duration) ?? [];

      check('pelajaran: "Video" -> "—"', durasi[0] === "—", `dapat "${durasi[0]}"`);
      check('pelajaran: "2 jam" -> "2 Jam"', durasi[1] === "2 Jam", `dapat "${durasi[1]}"`);
      check('pelajaran: "2 Hari" -> "48 Jam", bukan "2 Menit"', durasi[2] === "48 Jam", `dapat "${durasi[2]}"`);
    }

    // ── requestCourseEdit (educator) ──────────────────────────────
    //
    // Jalur pengajuan menulis snapshot `after` yang nanti disalin apa adanya
    // ke kursus saat admin menyetujui. Kalau yang ini lolos tanpa dibakukan,
    // satu persetujuan cukup untuk mengembalikan "1 Tahun" ke katalog.
    {
      const out = await callAction(
        path,
        requestId,
        [
          slug,
          {
            ...meta,
            duration: "1 Tahun",
            thumbnail: undefined,
            sections: [
              {
                title: "Bagian Awal",
                lessons: [{ title: "Satu", type: "reading", duration: "Bacaan" }],
              },
            ],
          },
          "Menguji pembakuan durasi lewat jalur pengajuan.",
        ],
        owner.cookie,
      );

      const snap = await db
        .collection("courseChangeRequests")
        .where("courseSlug", "==", slug)
        .get();
      const after = snap.docs[0]?.data()?.after as
        | { duration: string; sections: { lessons: { duration: string }[] }[] }
        | undefined;

      check("pengajuan sunting terbuat", snap.size === 1, out.slice(0, 0) || `${snap.size} dokumen`);
      check(
        'pengajuan: after.duration "1 Tahun" -> "12 Bulan"',
        after?.duration === "12 Bulan",
        `dapat "${after?.duration}"`,
      );
      check(
        'pengajuan: after pelajaran "Bacaan" -> "—"',
        after?.sections?.[0]?.lessons?.[0]?.duration === "—",
        `dapat "${after?.sections?.[0]?.lessons?.[0]?.duration}"`,
      );

      for (const d of snap.docs) await d.ref.delete();
    }

    // ── createCourse (educator) ───────────────────────────────────
    //
    // Jalur pembuatan kursus punya penanganan durasinya sendiri, terpisah dari
    // updateCourseMeta. Kalau tidak diuji, satu-satunya berkas yang bisa
    // melenceng tanpa ketahuan justru berkas tempat setiap kursus baru lahir.
    {
      const baru = `Kursus Baru Uji Durasi ${randomUUID().slice(0, 6)}`;
      await probe("/educator/courses/new", owner.cookie);
      const createId = await actionId("educator/courses/new", "createCourse");

      await callAction(
        "/educator/courses/new",
        createId,
        [
          {
            title: baru,
            shortDesc: "Deskripsi singkat yang cukup panjang.",
            longDesc: "x",
            level: "Pemula",
            category: "neuroscience",
            duration: "1 Tahun",
            price: 0,
            thumbnail: null,
            sections: [
              {
                title: "Bagian Awal",
                lessons: [{ title: "Satu", type: "reading", duration: "Tugas" }],
              },
            ],
          },
        ],
        owner.cookie,
      );

      const dibuat = await db.collection("courses").where("title", "==", baru).get();
      const data = dibuat.docs[0]?.data() as
        | { duration: string; sections: { lessons: { duration: string }[] }[] }
        | undefined;

      check("kursus baru terbuat", dibuat.size === 1, `${dibuat.size} dokumen`);
      check(
        'createCourse: "1 Tahun" -> "12 Bulan"',
        data?.duration === "12 Bulan",
        `dapat "${data?.duration}"`,
      );
      check(
        'createCourse: pelajaran "Tugas" -> "—"',
        data?.sections?.[0]?.lessons?.[0]?.duration === "—",
        `dapat "${data?.sections?.[0]?.lessons?.[0]?.duration}"`,
      );

      for (const d of dibuat.docs) await d.ref.delete();
    }
  } finally {
    await db.collection("courses").doc(slug).delete().catch(() => undefined);
    const sisa = await db.collection("courseChangeRequests").where("courseSlug", "==", slug).get();
    for (const d of sisa.docs) await d.ref.delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  console.log("── Aturan konversi ──");
  ujiTabelKonversi();

  const owner = await createTestUser("educator", "durasi-pemilik");
  const admin = await createTestUser("admin", "durasi-admin");

  console.log(`\npemilik : ${owner.email}`);
  console.log(`admin   : ${admin.email}\n`);
  console.log("── Penegakan di server ──");

  try {
    await ujiServer(owner, admin);
  } finally {
    await auth.deleteUsers([owner.uid, admin.uid]);
    console.log("\nakun & kursus uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
