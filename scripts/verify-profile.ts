/**
 * Menguji halaman profil, penyuntingannya, dan pemisahan dengan pengaturan.
 *
 * Yang paling keras diuji: `updateMyProfile` TIDAK menerima uid dari
 * pemanggil. Kalau ia menerimanya, satu panggilan POST langsung cukup untuk
 * menulis ulang profil orang lain — dan begitu profil dibuka untuk umum nanti,
 * karangan itu tampil atas nama mereka.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-profile.ts [baseUrl]
 */
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
const EDIT_ROUTE = "profil/edit";

const BIO = "Mahasiswa Teknik Biomedik yang mendalami pemrosesan sinyal EEG.";

const JUDUL_TAYANG = "Kursus Uji Profil Tayang";
const JUDUL_RAHASIA = "Kursus Uji Profil Masih Draft";

function courseDoc(slug: string, judul: string, ownerUid: string, visibility: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: judul,
    shortDesc: "Dibuat oleh verify-profile, akan dihapus.",
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
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Educator",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    visibility,
    sections: [
      {
        title: "Bagian Awal",
        position: 0,
        lessons: [
          { slug: "satu", title: "Satu", type: "reading", duration: "5 Menit", position: 0 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Educator",
    createdAt: now,
  };
}

const PENDIDIKAN = [
  {
    id: "a",
    institution: "Universitas Sebelas Maret",
    level: "S1",
    major: "Teknik Biomedik",
    startYear: 2019,
    endYear: 2023,
  },
  {
    id: "b",
    institution: "SMA Negeri 1 Surakarta",
    level: "SMA / SMK",
    major: "IPA",
    startYear: 2016,
    endYear: 2019,
  },
];

async function profilDi(uid: string) {
  return (await db.collection("users").doc(uid).get()).data() ?? {};
}

async function run(pemilik: TestUser, lain: TestUser, educator: TestUser) {
  const slugTayang = `verify-profil-tayang-${educator.uid.slice(0, 6)}`;
  const slugRahasia = `verify-profil-draft-${educator.uid.slice(0, 6)}`;

  await db.collection("courses").doc(slugTayang).set(courseDoc(slugTayang, JUDUL_TAYANG, educator.uid, "public"));
  await db.collection("courses").doc(slugRahasia).set(courseDoc(slugRahasia, JUDUL_RAHASIA, educator.uid, "private"));

  try {
    await probe("/profil/edit", pemilik.cookie);
    const simpanId = await actionId(EDIT_ROUTE, "updateMyProfile");
    const path = "/profil/edit";

    // ── Penjaga sesi ───────────────────────────────────────────────
    {
      const anon = await callAction(path, simpanId, [{ bio: "x", education: [], skills: [] }]);
      check("anonim tidak bisa menyimpan profil", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      const halaman = await probe("/profil");
      check(
        "anonim dialihkan dari halaman profil",
        halaman.status >= 300 && halaman.status < 400 && (halaman.location ?? "").includes("/login"),
        `${halaman.status} ${halaman.location ?? ""}`,
      );
    }

    // ── Menyimpan profil sendiri ───────────────────────────────────
    {
      const out = await callAction(
        path,
        simpanId,
        [{ bio: BIO, education: PENDIDIKAN, skills: ["EEG", "Python", "EEG"] }],
        pemilik.cookie,
      );
      check("profil tersimpan", out.includes("tersimpan"), "pesan hasil");

      const d = await profilDi(pemilik.uid);
      check("bio tersimpan", d.bio === BIO, `bio="${String(d.bio).slice(0, 30)}…"`);
      check(
        "dua entri pendidikan tersimpan",
        Array.isArray(d.education) && d.education.length === 2,
        `${(d.education as unknown[])?.length} entri`,
      );
      check(
        "keahlian duplikat dibuang",
        Array.isArray(d.skills) && d.skills.length === 2,
        JSON.stringify(d.skills),
      );
    }

    // ── uid TIDAK bisa dititipkan dari browser ─────────────────────
    {
      // Argumen kedua sengaja diisi uid orang lain. Kalau action-nya
      // mempedulikannya, profil `lain` akan tertimpa.
      await callAction(
        path,
        simpanId,
        [{ bio: "DISUSUPI", education: [], skills: [] }, lain.uid],
        pemilik.cookie,
      );

      const korban = await profilDi(lain.uid);
      check(
        "profil orang lain TIDAK bisa ditulis lewat argumen tambahan",
        korban.bio === undefined || korban.bio === "",
        `bio korban: "${String(korban.bio ?? "")}"`,
      );

      const sendiri = await profilDi(pemilik.uid);
      check(
        "yang tertulis tetap profil pemanggilnya",
        sendiri.bio === "DISUSUPI",
        "uid diambil dari session cookie",
      );

      // Dikembalikan supaya pemeriksaan tampilan di bawah masuk akal.
      await callAction(
        path,
        simpanId,
        [{ bio: BIO, education: PENDIDIKAN, skills: ["EEG", "Python"] }],
        pemilik.cookie,
      );
    }

    // ── Pembersihan masukan ────────────────────────────────────────
    {
      await callAction(
        path,
        simpanId,
        [
          {
            bio: "  dipangkas  ",
            education: [
              { id: "kosong", institution: "   ", level: "S1", major: "x" },
              { id: "aneh", institution: "Kampus", level: "Hogwarts", major: "", startYear: 2020, endYear: 1990 },
            ],
            skills: ["  ", "Valid"],
          },
        ],
        pemilik.cookie,
      );

      const d = await profilDi(pemilik.uid);
      const edu = (d.education ?? []) as { level: string; institution: string; endYear: number | null }[];

      check("bio dipangkas spasinya", d.bio === "dipangkas", `"${d.bio}"`);
      check("entri tanpa nama institusi dibuang", edu.length === 1, `${edu.length} entri`);
      check("jenjang di luar daftar jatuh ke Lainnya", edu[0]?.level === "Lainnya", `level=${edu[0]?.level}`);
      check(
        "tahun selesai lebih awal dari mulai dianggap masih berjalan",
        edu[0]?.endYear === null,
        `endYear=${edu[0]?.endYear}`,
      );
      check(
        "keahlian kosong dibuang",
        Array.isArray(d.skills) && d.skills.length === 1 && d.skills[0] === "Valid",
        JSON.stringify(d.skills),
      );

      await callAction(
        path,
        simpanId,
        [{ bio: BIO, education: PENDIDIKAN, skills: ["EEG", "Python"] }],
        pemilik.cookie,
      );
    }

    // ── Halaman profil menampilkannya ──────────────────────────────
    {
      const p = await probeText("/profil", pemilik.cookie);

      check("halaman profil terbuka", p.status === 200, `HTTP ${p.status}`);
      check("bio tampil", p.html.includes("pemrosesan sinyal EEG"), "ProfileHeader");
      check("riwayat pendidikan tampil", p.html.includes("Universitas Sebelas Maret"), "EducationList");
      check("keahlian tampil", p.html.includes("Python"), "tag keahlian");
      check("tombol Edit Profil ada di halaman", p.html.includes("Edit Profil"), "sesuai permintaan");
      check("tautan ke Pengaturan ada", p.html.includes("/pengaturan"), "pemisahan halaman");

      // Pengaturan akun TIDAK boleh ikut nongkrong di halaman profil.
      check(
        "hapus akun tidak lagi ada di halaman profil",
        !p.html.includes("Hapus Akun"),
        "pindah ke /pengaturan",
      );
    }

    // ── Halaman pengaturan ─────────────────────────────────────────
    {
      const s = await probeText("/pengaturan", pemilik.cookie);
      check("halaman pengaturan terbuka", s.status === 200, `HTTP ${s.status}`);
      check("berisi pengaturan akun", s.html.includes("Pengaturan"), "judul");

      const anon = await probe("/pengaturan");
      check(
        "anonim dialihkan dari pengaturan",
        anon.status >= 300 && anon.status < 400,
        `${anon.status} ${anon.location ?? ""}`,
      );
    }

    // ── Alamat lama tetap hidup ────────────────────────────────────
    {
      const lama = await probe("/dashboard", pemilik.cookie);
      check(
        "/dashboard dialihkan ke /profil, bukan 404",
        lama.status >= 300 && lama.status < 400 && (lama.location ?? "").includes("/profil"),
        `${lama.status} ${lama.location ?? ""}`,
      );
    }

    // ── Profil publik ──────────────────────────────────────────────
    {
      // Terbuka tanpa masuk: ini kartu nama educator, dan calon peserta harus
      // bisa memeriksanya sebelum membeli.
      const anon = await probeText(`/profil/${pemilik.uid}`);
      check("profil publik terbuka tanpa masuk", anon.status === 200, `HTTP ${anon.status}`);
      check("bio tampil di profil publik", anon.html.includes("pemrosesan sinyal EEG"), "ProfileHeader");

      // Yang pribadi TIDAK ikut. Kalau tiga ini bocor, halaman profil berubah
      // jadi panen alamat untuk spam.
      check(
        "email TIDAK tampil di profil publik",
        !anon.html.includes(pemilik.email),
        "alamat kontak pribadi",
      );
      check(
        "tombol Edit Profil tidak muncul untuk pengunjung",
        !anon.html.includes("Edit Profil"),
        "hanya pemiliknya yang menyunting",
      );
      check(
        "kursus yang DIIKUTI tidak tampil ke publik",
        !anon.html.includes("Kursus yang Diikuti"),
        "apa yang dipelajari seseorang itu pribadi",
      );

      const hantu = await probe("/profil/uid-yang-tidak-pernah-ada");
      check("uid tak dikenal -> 404", hantu.status === 404, `HTTP ${hantu.status}`);

      // ── Kursus educator: yang tayang muncul, yang tersembunyi tidak ──
      //
      // Pemeriksaan ini yang sebenarnya menjaga draft. Tanpa menyebut judul
      // kursus tersembunyinya, "tidak bocor" hanya bisa dibuktikan dengan
      // ketiadaan judul bagian — dan itu tetap lolos walau seluruh draft
      // ikut terpajang.
      const publik = await probeText(`/profil/${educator.uid}`);
      check(
        "kursus yang tayang muncul di profil educator",
        publik.html.includes(JUDUL_TAYANG),
        "OwnedCourses",
      );
      check(
        "kursus TERSEMBUNYI tidak bocor ke profil publik",
        !publik.html.includes(JUDUL_RAHASIA),
        publik.html.includes(JUDUL_RAHASIA) ? "draft terpajang" : "disaring di publicProfile",
      );
      check(
        "penanda Tersembunyi tidak ikut terbawa",
        !publik.html.includes("Tersembunyi"),
        "penyaringan di lapisan data, bukan di JSX",
      );

      // Pemilik yang membuka alamat publiknya sendiri diantar ke versi penuh.
      const sendiri = await probe(`/profil/${pemilik.uid}`, pemilik.cookie);
      check(
        "pemilik dialihkan ke /profil saat membuka alamat publiknya sendiri",
        sendiri.status >= 300 && sendiri.status < 400 && (sendiri.location ?? "").endsWith("/profil"),
        `${sendiri.status} ${sendiri.location ?? ""}`,
      );
    }
    // ── Nama educator di katalog: terlihat dan bisa diklik ─────────
    //
    // Inilah permintaan yang memicu profil publik. Kalau tautannya hilang,
    // halaman profil tetap ada tapi tidak ada yang bisa menemukannya.
    {
      const katalog = await probeText("/courses");
      check(
        "nama educator di katalog menautkan ke profilnya",
        katalog.html.includes(`/profil/${educator.uid}`),
        "CourseAuthor sebagai tautan",
      );

      const detail = await probeText(`/courses/${slugTayang}`);
      check(
        "nama educator di halaman detail juga menautkan ke profilnya",
        detail.html.includes(`/profil/${educator.uid}`),
        "panel harga",
      );
    }
  } finally {
    for (const u of [pemilik, lain, educator]) {
      await db.collection("users").doc(u.uid).delete().catch(() => undefined);
    }
    for (const s of [slugTayang, slugRahasia]) {
      await db.collection("courses").doc(s).delete().catch(() => undefined);
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const pemilik = await createTestUser("user", "profil-pemilik");
  const lain = await createTestUser("user", "profil-lain");
  const educator = await createTestUser("educator", "profil-educator");

  console.log(`pemilik  : ${pemilik.email}`);
  console.log(`lain     : ${lain.email}`);
  console.log(`educator : ${educator.email}\n`);

  try {
    await run(pemilik, lain, educator);
  } finally {
    await auth.deleteUsers([pemilik.uid, lain.uid, educator.uid]);
    console.log("\nakun uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
