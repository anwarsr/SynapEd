/**
 * Menguji arsip pengumuman/tugas kelas: hanya pengelola yang bisa mengarsipkan,
 * postingan terarsip HILANG bagi siswa di setiap jalur (umpan, halaman tugas,
 * lampiran, balasan, pengumpulan), tetap terlihat di zona Arsip pengelola, dan
 * kembali normal setelah dipulihkan.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-class-archive.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  BASE,
  COOKIE,
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  probe,
  probeText,
  readEnv,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "arsip-pemilik");
  const siswa = await createTestUser("user", "arsip-siswa");
  const classId = `arsip-${Date.now().toString(36)}`;
  const waktu = new Date().toISOString();
  const kodeA = `RAHASIA-ARSIP-${randomUUID().slice(0, 8)}`;
  const kodeB = `TETAP-TAMPIL-${randomUUID().slice(0, 8)}`;

  await db.collection("classes").doc(classId).set({
    name: "Uji Arsip", description: "", ownerUid: owner.uid, joinCode: "UJIARSIP",
    memberCount: 1, postCount: 0, createdAt: waktu, updatedAt: waktu,
  });
  await db.collection("classMembers").doc(`${siswa.uid}_${classId}`).set({
    uid: siswa.uid, classId, role: "member", joinedAt: waktu,
  });

  try {
    const jalur = `/educator/classes/${classId}`;
    await probe(jalur, owner.cookie);
    const buatId = await actionId("educator/classes/[id]", "createPost");
    const tugasId = await actionId("educator/classes/[id]", "createAssignment");
    const arsipId = await actionId("educator/classes/[id]", "setPostArchived");
    const balasId = await actionId("educator/classes/[id]", "createReply");

    const berkas = `class-files/${owner.uid}/${classId}/arsip.pdf`;
    await bucket.file(berkas).save(Buffer.from("%PDF-1.4\n% arsip"), { contentType: "application/pdf" });

    await callAction(jalur, buatId, [classId, kodeA, [{ path: berkas, name: "arsip.pdf" }]], owner.cookie);
    await callAction(jalur, buatId, [classId, kodeB, []], owner.cookie);
    const besok = new Date(Date.now() + 86_400_000).toISOString();
    await callAction(jalur, tugasId, [classId, { title: "Tugas Terarsip", formats: ["text"], maxPoints: 100, dueAt: besok }], owner.cookie);

    const posts = (await db.collection("classes").doc(classId).collection("posts").get()).docs;
    const idA = posts.find((d) => d.data().body === kodeA)?.id ?? "";
    const idT = posts.find((d) => d.data().kind === "assignment")?.id ?? "";

    const halamanSiswa = () => probeText(`/kelas/${classId}`, siswa.cookie);
    const halamanPemilik = () => probeText(jalur, owner.cookie);
    const lampiran = (cookie: string) =>
      fetch(`${BASE}/api/classes/attachment?class=${classId}&post=${idA}&i=0`, { headers: { cookie: `${COOKIE}=${cookie}` } });

    console.log("Sebelum diarsipkan");
    let h = await halamanSiswa();
    check("siswa melihat kedua pengumuman", h.html.includes(kodeA) && h.html.includes(kodeB), "umpan normal");
    check("siswa bisa membuka halaman tugas", (await probe(`/kelas/${classId}/tugas/${idT}`, siswa.cookie)).status === 200, "200");
    check("siswa bisa mengunduh lampiran", (await lampiran(siswa.cookie)).status === 200, "200");

    console.log("\nMengarsipkan");
    const olehSiswa = await callAction(jalur, arsipId, [classId, idA, true], siswa.cookie);
    check("siswa tak bisa mengarsipkan", olehSiswa.includes("tidak berhak"), "penjaga pemilik");
    check("tak ada yang berubah", (await db.collection("classes").doc(classId).collection("posts").doc(idA).get()).data()?.archived !== true, "archived tetap");

    check("pemilik mengarsipkan pengumuman", (await callAction(jalur, arsipId, [classId, idA, true], owner.cookie)).includes("Dipindahkan ke arsip"), "ok");
    check("pemilik mengarsipkan tugas", (await callAction(jalur, arsipId, [classId, idT, true], owner.cookie)).includes("Dipindahkan ke arsip"), "ok");
    check("postingan tak ada → ditolak", (await callAction(jalur, arsipId, [classId, "tidak-ada", true], owner.cookie)).includes("tidak ditemukan"), "404 logis");

    console.log("\nKeterlihatan");
    h = await halamanSiswa();
    check("siswa tak lagi melihat yang terarsip", !h.html.includes(kodeA) && !h.html.includes("Tugas Terarsip"), "hilang dari umpan");
    check("siswa tetap melihat yang lain", h.html.includes(kodeB), "tak ikut hilang");
    check("halaman tugas terarsip 404 bagi siswa", (await probe(`/kelas/${classId}/tugas/${idT}`, siswa.cookie)).status === 404, "404");
    check("lampiran terarsip 404 bagi siswa", (await lampiran(siswa.cookie)).status === 404, "404");
    check("lampiran tetap bisa dibuka pemilik", (await lampiran(owner.cookie)).status === 200, "200");
    const balas = await callAction(jalur, balasId, [classId, idA, "halo"], siswa.cookie);
    check("siswa tak bisa membalas yang terarsip", balas.includes("tidak ditemukan"), "ditolak");

    const hp = await halamanPemilik();
    check("umpan utama pemilik hanya memuat yang belum diarsipkan", !hp.html.includes("Tugas Terarsip") && (hp.html.match(/Arsipkan<\/button>/g) ?? []).length === 1, "1 Arsipkan, tanpa tugas terarsip");
    check("pemilik punya tab Arsip", hp.html.includes("?tab=arsip"), "tab di sebelah kanan Tugas");
    const ha = await probeText(`${jalur}?tab=arsip`, owner.cookie);
    check("tab Arsip memuat keduanya + Pulihkan", ha.html.includes(kodeA) && ha.html.includes("Tugas Terarsip") && (ha.html.match(/Pulihkan<\/button>/g) ?? []).length === 2, "2 Pulihkan");
    check("siswa tak punya tab Arsip", !(await halamanSiswa()).html.includes("?tab=arsip"), "tab tersembunyi");
    const siswaArsip = await probeText(`/kelas/${classId}?tab=arsip`, siswa.cookie);
    check("siswa membuka ?tab=arsip tak melihat isinya", !siswaArsip.html.includes(kodeA) && !siswaArsip.html.includes("Pulihkan</button>"), "jatuh ke Pengumuman");

    console.log("\nMemulihkan");
    check("pemilik memulihkan", (await callAction(jalur, arsipId, [classId, idA, false], owner.cookie)).includes("Dipulihkan"), "ok");
    h = await halamanSiswa();
    check("siswa melihatnya lagi", h.html.includes(kodeA), "kembali");
    check("lampiran bisa diunduh lagi", (await lampiran(siswa.cookie)).status === 200, "200");
  } finally {
    await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
    await db.collection("classMembers").doc(`${siswa.uid}_${classId}`).delete().catch(() => undefined);
    await bucket.deleteFiles({ prefix: `class-files/${owner.uid}/` }).catch(() => undefined);
    await auth.deleteUsers([owner.uid, siswa.uid]).catch(() => undefined);
    console.log("\nakun, kelas & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
