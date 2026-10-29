/**
 * Menguji bahwa nama yang diubah admin ikut tampil di daftar pengajuan educator
 * dan pengajuan kursus (dulu daftar itu memajang SALINAN nama dari saat mengajukan).
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-admin-nama.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe, probeText } from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const admin = await createTestUser("admin", "nama-admin");
  const pemohon = await createTestUser("user", "nama-pemohon");
  const educator = await createTestUser("educator", "nama-educator");
  const waktu = new Date().toISOString();
  const lama = `NamaLamaPemohon${Date.now().toString(36)}`;
  const lamaEdu = `NamaLamaEducator${Date.now().toString(36)}`;
  const baru = `NamaBaruPemohon${Date.now().toString(36)}`;
  const baruEdu = `NamaBaruEducator${Date.now().toString(36)}`;
  const reqId = `uji-nama-${Date.now().toString(36)}`;

  await db.collection("educatorApplications").doc(pemohon.uid).set({
    name: lama, email: pemohon.email, photoURL: null, status: "pending", createdAt: waktu,
    decidedAt: null, decidedByUid: null, decidedByName: null,
  });
  await db.collection("courseChangeRequests").doc(reqId).set({
    courseSlug: "uji-nama", courseTitle: "Kursus Uji Nama", type: "edit", reason: "uji",
    requestedByUid: educator.uid, requestedByName: lamaEdu, status: "pending",
    before: null, after: null, createdAt: waktu, decidedAt: null, decidedByUid: null, decidedByName: null, decisionNote: null,
  });

  try {
    await probe(`/admin/users/${pemohon.uid}`, admin.cookie);
    const ubahId = await actionId("admin/users/[uid]", "setUserName");

    const sebelum = await probeText("/admin/notifications", admin.cookie);
    check("sebelum diubah: daftar memuat nama (live = nama akun uji)", sebelum.html.includes("Uji nama-pemohon") && !sebelum.html.includes(lama), "nama dari Auth, bukan salinan lama");

    const res = await callAction(`/admin/users/${pemohon.uid}`, ubahId, [pemohon.uid, baru], admin.cookie);
    check("admin mengubah nama pemohon", res.includes("Nama") || res.includes("ok") || !res.includes("Hanya admin"), "aksi diterima");
    const resEdu = await callAction(`/admin/users/${pemohon.uid}`, ubahId, [educator.uid, baruEdu], admin.cookie);
    check("admin mengubah nama educator", !resEdu.includes("Hanya admin"), "aksi diterima");

    const daftar = await probeText("/admin/notifications", admin.cookie);
    check("daftar pengajuan educator memuat nama BARU", daftar.html.includes(baru), baru);
    check("daftar pengajuan educator tak lagi memuat nama lama", !daftar.html.includes(lama), lama);

    const detail = await probeText(`/admin/notifications/${pemohon.uid}`, admin.cookie);
    check("halaman detail pengajuan memuat nama BARU", detail.html.includes(baru) && !detail.html.includes(lama), "detail");

    const kursus = await probeText("/admin/course-requests", admin.cookie);
    check("pengajuan kursus memuat nama educator BARU", kursus.html.includes(baruEdu) && !kursus.html.includes(lamaEdu), baruEdu);

    // Akun terhapus: salinan dipertahankan (daftar tidak boleh mati).
    await auth.deleteUser(pemohon.uid);
    const sesudahHapus = await probeText("/admin/notifications", admin.cookie);
    check("akun terhapus: daftar tetap terbuka & memakai salinan", sesudahHapus.status === 200 && sesudahHapus.html.includes(lama), "salinan lama");
  } finally {
    await db.collection("educatorApplications").doc(pemohon.uid).delete().catch(() => undefined);
    await db.collection("courseChangeRequests").doc(reqId).delete().catch(() => undefined);
    await auth.deleteUsers([admin.uid, pemohon.uid, educator.uid]).catch(() => undefined);
    console.log("\nakun & dokumen uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
