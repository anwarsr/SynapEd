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

async function run(pemilik: TestUser, lain: TestUser) {
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
  } finally {
    for (const u of [pemilik, lain]) {
      await db.collection("users").doc(u.uid).delete().catch(() => undefined);
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const pemilik = await createTestUser("user", "profil-pemilik");
  const lain = await createTestUser("user", "profil-lain");

  console.log(`pemilik : ${pemilik.email}`);
  console.log(`lain    : ${lain.email}\n`);

  try {
    await run(pemilik, lain);
  } finally {
    await auth.deleteUsers([pemilik.uid, lain.uid]);
    console.log("\nakun uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
