/**
 * Menguji alur "menjadi educator" dari ujung ke ujung terhadap server yang
 * sedang berjalan.
 *
 * Pengajuan dan keputusannya dijalankan lewat Server Action yang sesungguhnya —
 * dipanggil dengan POST + header Next-Action, persis seperti yang dilakukan
 * browser saat tombolnya ditekan. Jadi yang teruji adalah kode produksinya,
 * bukan tiruan alurnya.
 *
 * Butuh dev server berjalan (npm run dev), karena ID action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-educator.ts [baseUrl]
 */
import { execFileSync } from "node:child_process";
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
  freshCookie,
  probe,
  probeText,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const APPLICATIONS = "educatorApplications";

async function statusOf(uid: string) {
  return (await db.collection(APPLICATIONS).doc(uid).get()).data()?.status ?? null;
}

async function roleOf(uid: string) {
  return (await auth.getUser(uid)).customClaims?.role ?? "user";
}

async function run(admin: TestUser, applicant: TestUser, rejected: TestUser) {
  // Halaman harus sudah terkompilasi sebelum ID action bisa dibaca dari
  // manifest — di mode dev Next mengompilasi rute saat pertama diminta.
  // Rute detail dipanggil dengan uid yang belum punya pengajuan; jawabannya
  // 404, tapi modulnya tetap dimuat dan itulah yang dibutuhkan.
  await probe("/educator", applicant.cookie);
  await probe("/admin/notifications", admin.cookie);
  await probe(`/admin/notifications/${applicant.uid}`, admin.cookie);

  const applyId = await actionId("educator", "applyAsEducator");
  const decideId = await actionId("admin/notifications/[uid]", "decideApplication");

  // ── Sebelum mengajukan ────────────────────────────────────────────
  {
    const page = await probeText("/educator", applicant.cookie);
    check(
      "/educator menawarkan tombol pengajuan",
      page.status === 200 && page.html.includes("Ajukan Sekarang"),
      String(page.status),
    );

    const anon = await probe("/educator");
    check(
      "/educator anonim -> /login",
      anon.status >= 300 && anon.status < 400 && (anon.location ?? "").includes("/login"),
      `${anon.status} ${anon.location ?? ""}`,
    );
  }

  // ── Mengajukan ────────────────────────────────────────────────────
  {
    const out = await callAction("/educator", applyId, [], applicant.cookie);
    check("pengajuan terkirim", out.includes("Pengajuan terkirim"), "pesan dari server action");
    check("dokumen berstatus pending", (await statusOf(applicant.uid)) === "pending", "Firestore");

    const again = await callAction("/educator", applyId, [], applicant.cookie);
    check(
      "mengajukan dua kali ditolak",
      again.includes("sudah masuk dan sedang ditinjau"),
      "pengajuan ganda",
    );

    const byAdmin = await callAction("/educator", applyId, [], admin.cookie);
    check(
      "admin tidak bisa mengajukan",
      byAdmin.includes("Hanya pengguna biasa"),
      "penjaga role di server action",
    );

    const anon = await callAction("/educator", applyId, []);
    check("anonim tidak bisa mengajukan", anon.includes("Hanya pengguna biasa"), "tanpa cookie");
  }

  // ── Pengajuan terlihat di mana-mana ───────────────────────────────
  {
    const page = await probeText("/educator", applicant.cookie);
    check("/educator menampilkan status menunggu", page.html.includes("sedang ditinjau"), "pelamar");

    const dash = await probeText("/profil", applicant.cookie);
    check("/profil menampilkan status menunggu", dash.html.includes("Menunggu"), "pelamar");

    const list = await probeText("/admin", admin.cookie);
    check(
      "daftar akun menandai pelamar",
      list.html.includes("Mengajukan") && list.html.includes(applicant.email),
      "penanda di /admin",
    );

    const notif = await probeText("/admin/notifications", admin.cookie);
    check(
      "notifikasi memuat pengajuan",
      notif.status === 200 && notif.html.includes(applicant.email),
      String(notif.status),
    );

    const detail = await probeText(`/admin/notifications/${applicant.uid}`, admin.cookie);
    check(
      "detail pengajuan bisa dibuka",
      detail.status === 200 && detail.html.includes("Keputusan"),
      String(detail.status),
    );
    check(
      "konfirmasi memakai dialog sendiri, bukan window.confirm",
      detail.html.includes("dialog-panel") && detail.html.includes("Jadikan educator?"),
      "elemen <dialog> ikut dirender di server",
    );

    const onUser = await probeText(`/admin/users/${applicant.uid}`, admin.cookie);
    check(
      "detail akun menawarkan keputusan",
      onUser.html.includes("Pengajuan menjadi educator"),
      "tombol putusan di halaman akun",
    );
  }

  // ── Penjagaan halaman notifikasi ──────────────────────────────────
  {
    const asUser = await probe("/admin/notifications", applicant.cookie);
    check(
      "/admin/notifications sebagai user -> /profil",
      asUser.status >= 300 && asUser.status < 400 && (asUser.location ?? "").includes("/profil"),
      `${asUser.status} ${asUser.location ?? ""}`,
    );

    const anon = await probe("/admin/notifications");
    check(
      "/admin/notifications anonim -> /login",
      anon.status >= 300 && anon.status < 400 && (anon.location ?? "").includes("/login"),
      `${anon.status} ${anon.location ?? ""}`,
    );
  }

  // ── Keputusan: yang paling penting, siapa yang boleh memutuskan ───
  {
    const path = `/admin/notifications/${applicant.uid}`;

    const bySelf = await callAction(path, decideId, [applicant.uid, "accept"], applicant.cookie);
    check(
      "pelamar tidak bisa menerima dirinya sendiri",
      bySelf.includes("Hanya admin"),
      "penjaga di server action",
    );
    check(
      "role pelamar tidak berubah setelah percobaan itu",
      (await roleOf(applicant.uid)) === "user",
      "claim tetap user",
    );

    const anon = await callAction(path, decideId, [applicant.uid, "accept"]);
    check("anonim tidak bisa memutuskan", anon.includes("Hanya admin"), "tanpa cookie");

    const accepted = await callAction(path, decideId, [applicant.uid, "accept"], admin.cookie);
    check("admin menerima pengajuan", accepted.includes("Pengajuan diterima"), "pesan hasil");
    check("role menjadi educator", (await roleOf(applicant.uid)) === "educator", "custom claim");
    check("dokumen berstatus accepted", (await statusOf(applicant.uid)) === "accepted", "Firestore");

    const twice = await callAction(path, decideId, [applicant.uid, "reject"], admin.cookie);
    check(
      "pengajuan yang sudah diputuskan tidak bisa diputuskan lagi",
      twice.includes("sudah diputuskan"),
      "keputusan bersifat final",
    );
  }

  // ── Educator setelah masuk ulang ──────────────────────────────────
  {
    // Menerima mencabut refresh token, jadi cookie lama memang harus mati —
    // itu bagian dari desainnya, bukan efek samping.
    const stale = await probe("/profil", applicant.cookie);
    check(
      "sesi lama pelamar dicabut setelah role berubah",
      stale.status >= 300 && stale.status < 400 && (stale.location ?? "").includes("/login"),
      `${stale.status} ${stale.location ?? ""}`,
    );

    const cookie = await freshCookie(applicant.email, applicant.password);

    const page = await probeText("/educator", cookie);
    check(
      "/educator mengakui akun educator",
      page.html.includes("Anda sudah menjadi educator"),
      "setelah masuk ulang",
    );

    const dash = await probeText("/profil", cookie);
    check("/profil menampilkan Akun Educator", dash.html.includes("Akun Educator"), "profil");
    check(
      "navbar tidak lagi menawarkan Jadi Educator",
      !dash.html.includes("Jadi Educator"),
      "tombol hanya untuk pengguna biasa",
    );

    const list = await probeText("/admin", admin.cookie);
    check("daftar akun menampilkan role Educator", list.html.includes("Educator"), "/admin");
  }

  // ── Jalur penolakan ───────────────────────────────────────────────
  {
    await callAction("/educator", applyId, [], rejected.cookie);
    const path = `/admin/notifications/${rejected.uid}`;

    const out = await callAction(path, decideId, [rejected.uid, "reject"], admin.cookie);
    check("admin menolak pengajuan", out.includes("Pengajuan ditolak"), "pesan hasil");
    check("dokumen berstatus rejected", (await statusOf(rejected.uid)) === "rejected", "Firestore");
    check("role tetap user setelah ditolak", (await roleOf(rejected.uid)) === "user", "claim");

    const page = await probeText("/educator", rejected.cookie);
    check(
      "pelamar yang ditolak boleh mengajukan lagi",
      page.html.includes("Ajukan Kembali"),
      "/educator",
    );

    const again = await callAction("/educator", applyId, [], rejected.cookie);
    check("pengajuan ulang diterima sistem", again.includes("Pengajuan terkirim"), "pesan hasil");
    check("kembali berstatus pending", (await statusOf(rejected.uid)) === "pending", "Firestore");
  }

  // ── Educator tidak bisa diturunkan ────────────────────────────────
  {
    let blocked = false;
    let message = "";
    try {
      execFileSync("npx", ["tsx", "scripts/set-role.ts", applicant.email, "user"], {
        cwd: `${__dirname}/..`,
        encoding: "utf8",
        shell: process.platform === "win32",
      });
    } catch (e) {
      blocked = true;
      message = String((e as { stdout?: string; stderr?: string }).stdout ?? "").trim();
    }

    check(
      "set-role menolak menurunkan educator ke user",
      blocked && (await roleOf(applicant.uid)) === "educator",
      message.split("\n").pop() ?? "keluar dengan kode galat",
    );
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const admin = await createTestUser("admin");
  const applicant = await createTestUser("user", "pelamar");
  const rejected = await createTestUser("user", "ditolak");

  console.log(`admin    : ${admin.email}`);
  console.log(`pelamar  : ${applicant.email}`);
  console.log(`ditolak  : ${rejected.email}\n`);

  try {
    await run(admin, applicant, rejected);
  } finally {
    await auth.deleteUsers([admin.uid, applicant.uid, rejected.uid]);
    await Promise.all(
      [admin.uid, applicant.uid, rejected.uid].map((uid) =>
        db.collection(APPLICATIONS).doc(uid).delete().catch(() => undefined),
      ),
    );
    console.log("\nakun & pengajuan uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
