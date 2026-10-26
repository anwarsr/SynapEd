/**
 * Menguji objek 3D pada pengumuman kelas: aturan keterangan (murni), lalu dari
 * ujung ke ujung lewat dev server — penerbitan, penolakan berkas/keterangan
 * yang tidak sah, penyaji berkas, edit, dan pembersihan.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-model3d.ts [baseUrl]
 */
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
  readEnv,
} from "./testSupport";
import { targetLabel } from "./project";
import {
  MAX_ANOTASI,
  toModel3D,
  validasiAnotasi,
} from "../frontend/src/lib/model3dRules";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));

/** GLB minimal yang sah: dua kubus (dua komponen) dengan normal per sisi. */
export function buatGlb(): Buffer {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const sisi: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  sisi.forEach(([n, u, v], f) => {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) pos.push((n[k] + u[k] * a + v[k] * b) * 0.5);
      nor.push(...n);
    }
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });

  const bPos = Buffer.from(new Float32Array(pos).buffer);
  const bNor = Buffer.from(new Float32Array(nor).buffer);
  const bIdx = Buffer.from(new Uint16Array(idx).buffer);
  const isi = Buffer.concat([bPos, bNor, bIdx]);

  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: "Badan", mesh: 0, translation: [-0.8, 0, 0] },
      { name: "Kepala", mesh: 1, translation: [0.8, 0, 0], scale: [0.6, 0.6, 0.6] },
    ],
    meshes: [
      { name: "Badan", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] },
      { name: "Kepala", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 1 }] },
    ],
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.2, 0.5, 0.9, 1], metallicFactor: 0.2, roughnessFactor: 0.6 } },
      { pbrMetallicRoughness: { baseColorFactor: [0.9, 0.6, 0.2, 1], metallicFactor: 0.2, roughnessFactor: 0.6 } },
    ],
    buffers: [{ byteLength: isi.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: bPos.length, target: 34962 },
      { buffer: 0, byteOffset: bPos.length, byteLength: bNor.length, target: 34962 },
      { buffer: 0, byteOffset: bPos.length + bNor.length, byteLength: bIdx.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1] },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };

  let j = Buffer.from(JSON.stringify(json));
  while (j.length % 4) j = Buffer.concat([j, Buffer.from(" ")]);
  const b = Buffer.concat([isi, Buffer.alloc((4 - (isi.length % 4)) % 4)]);
  const total = 12 + 8 + j.length + 8 + b.length;

  const kepala = Buffer.alloc(12);
  kepala.write("glTF", 0, "latin1");
  kepala.writeUInt32LE(2, 4);
  kepala.writeUInt32LE(total, 8);
  const cj = Buffer.alloc(8);
  cj.writeUInt32LE(j.length, 0);
  cj.write("JSON", 4, "latin1");
  const cb = Buffer.alloc(8);
  cb.writeUInt32LE(b.length, 0);
  cb.write("BIN\0", 4, "latin1");
  return Buffer.concat([kepala, cj, j, cb, b]);
}

const MIME = "model/gltf-binary";
const anotasi = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: "Badan utama",
  text: "Penjelasan bagian ini.",
  mesh: 0,
  meshName: "Badan",
  point: [0.1, 0.2, 0.3],
  ...extra,
});

function aturanMurni() {
  console.log("Aturan keterangan (murni)");
  const ok = validasiAnotasi([anotasi("a1"), anotasi("b2", { title: "  Kepala  ", mesh: 1 })]);
  check("keterangan sah diterima & judul dirapikan", ok.ok && ok.value[1].title === "Kepala", "trim");

  check("tanpa judul ditolak", !validasiAnotasi([anotasi("a1", { title: "   " })]).ok, "judul wajib");
  check("pengenal ganda ditolak", !validasiAnotasi([anotasi("a1"), anotasi("a1")]).ok, "unik");
  check("pengenal ngawur ditolak", !validasiAnotasi([anotasi("A B!")]).ok, "pola id");
  check("koordinat bukan angka ditolak", !validasiAnotasi([anotasi("a1", { point: [0, "x", 0] })]).ok, "tipe");
  check("koordinat raksasa ditolak", !validasiAnotasi([anotasi("a1", { point: [0, 1e9, 0] })]).ok, "batas");
  check("koordinat kurang dari 3 ditolak", !validasiAnotasi([anotasi("a1", { point: [0, 0] })]).ok, "panjang");

  const banyak = Array.from({ length: MAX_ANOTASI + 1 }, (_, i) => anotasi(`k${i}`));
  check("lebih dari batas ditolak", !validasiAnotasi(banyak).ok, `maks ${MAX_ANOTASI}`);

  const panjang = validasiAnotasi([anotasi("a1", { text: "x".repeat(2000) })]);
  check("teks dipangkas ke batas", panjang.ok && panjang.value[0].text.length === 400, "400 karakter");

  check("dokumen lama tanpa judul dapat judul dari nama", toModel3D({ file: { path: "x", name: "mesin_diesel.glb" }, annotations: [] })?.title === "mesin diesel", "normaliser");
  check("model tanpa berkas dibaca null", toModel3D({ annotations: [] }) === null, "normaliser");
  check(
    "dokumen keterangan rusak tak merobohkan model",
    toModel3D({ file: { path: "x", name: "a.glb" }, annotations: "rusak" })?.annotations.length === 0,
    "nilai bawaan",
  );
}

async function ujiLayanan() {
  const owner = await createTestUser("educator", "m3d-pemilik");
  const luar = await createTestUser("user", "m3d-luar");
  const lain = await createTestUser("educator", "m3d-lain");

  const classId = `m3d-${Date.now().toString(36)}`;
  const waktu = new Date().toISOString();
  await db.collection("classes").doc(classId).set({
    name: "Uji Objek 3D", description: "", ownerUid: owner.uid, joinCode: "UJIMODEL",
    memberCount: 0, postCount: 0, createdAt: waktu, updatedAt: waktu,
  });

  const folder = `class-files/${owner.uid}/${classId}`;
  const glb = buatGlb();
  const simpan = (path: string, isi: Buffer, mime: string) => bucket.file(path).save(isi, { contentType: mime });
  const ada = async (path: string) => (await bucket.file(path).exists())[0];

  try {
    const jalur = `/educator/classes/${classId}`;
    await probe(jalur, owner.cookie);
    const buatId = await actionId("educator/classes/[id]", "createPost");
    const hapusId = await actionId("educator/classes/[id]", "deletePost");
    await probe(`${jalur}/tugas/x`, owner.cookie);
    const editId = await actionId("educator/classes/[id]/tugas/[postId]", "editPost");

    const model = (path: string, name = "mesin.glb", ann: unknown[] = [anotasi("a1")]) => ({ file: { path, name }, annotations: ann });
    const kirim = (m: unknown, cookie = owner.cookie) => callAction(jalur, buatId, [classId, "", [], m], cookie);

    console.log("\nPenerbitan");
    await simpan(`${folder}/ok.glb`, glb, MIME);
    const sukses = await kirim(model(`${folder}/ok.glb`, "mesin.glb", [anotasi("a1"), anotasi("b2", { mesh: 1, meshName: "Kepala" })]));
    check("pengumuman hanya-objek-3D diterbitkan", sukses.includes("Postingan terkirim"), "tanpa teks pun sah");

    const posts = await db.collection("classes").doc(classId).collection("posts").get();
    const postId = posts.docs[0]?.id ?? "";
    const tersimpan = posts.docs[0]?.data().model3d;
    check("berkas & keterangan tercatat", tersimpan?.file?.size === glb.length && tersimpan?.annotations?.length === 2, `${tersimpan?.file?.size} byte`);
    check("tanpa judul → judul dari nama berkas", tersimpan?.title === "mesin", String(tersimpan?.title));
    check("MIME tercatat dari Storage", tersimpan?.file?.mime === MIME, String(tersimpan?.file?.mime));

    const olehLuar = await kirim(model(`${folder}/ok.glb`), luar.cookie);
    check("bukan pemilik tidak bisa menerbitkan", olehLuar.includes("Hanya pemilik"), "penjaga pemilik");

    await simpan(`${folder}/palsu.glb`, Buffer.from("ini bukan glb sama sekali, hanya teks biasa"), MIME);
    check("isi bukan GLB ditolak walau namanya .glb", (await kirim(model(`${folder}/palsu.glb`))).includes("bukan GLB"), "magic byte");

    await simpan(`${folder}/zip.glb`, glb, "text/plain");
    check("MIME salah ditolak", (await kirim(model(`${folder}/zip.glb`))).includes("Format berkas tidak diterima"), "MIME dibaca ulang");

    await simpan(`${folder}/zipok.glb`, glb, "application/zip");
    const lewatZip = await kirim(model(`${folder}/zipok.glb`, "zipok.glb", [anotasi("z1")]));
    check("GLB diunggah ber-MIME ZIP (jalur browser) diterima & dicatat sebagai GLB", lewatZip.includes("Postingan terkirim"), "tak butuh rules baru");
    check("satu komponen dua keterangan ditolak", (await kirim(model(`${folder}/ok.glb`, "m.glb", [anotasi("g1"), anotasi("g2")]))).includes("hanya boleh punya satu"), "mesh ganda");

    await simpan(`${folder}/model.txt`, glb, MIME);
    check("ekstensi bukan .glb ditolak", (await kirim(model(`${folder}/model.txt`, "model.txt"))).includes("harus berkas .glb"), "nama berkas");

    await simpan(`class-files/${lain.uid}/${classId}/orang.glb`, glb, MIME);
    check("berkas milik orang lain ditolak", (await kirim(model(`class-files/${lain.uid}/${classId}/orang.glb`))).includes("Berkas tidak sah"), "awalan folder");
    check("path ber-.. ditolak", (await kirim(model(`${folder}/../${lain.uid}/x.glb`))).includes("Berkas tidak sah"), "traversal");
    check("berkas belum terunggah ditolak", (await kirim(model(`${folder}/tidak-ada.glb`))).includes("belum terunggah"), "tidak ada di Storage");

    check("keterangan tanpa judul ditolak", (await kirim(model(`${folder}/ok.glb`, "m.glb", [anotasi("a1", { title: "" })]))).includes("wajib diberi judul"), "validasi server");
    check("kelewat batas keterangan ditolak", (await kirim(model(`${folder}/ok.glb`, "m.glb", Array.from({ length: 31 }, (_, i) => anotasi(`z${i}`))))).includes("Maksimal"), "30");

    const jumlah = (await db.collection("classes").doc(classId).collection("posts").get()).size;
    check("penolakan tidak meninggalkan postingan", jumlah === 2, `${jumlah} postingan`);

    console.log("\nPenyaji berkas");
    const url = `${BASE}/api/classes/model?class=${classId}&post=${postId}`;
    const ambil = (cookie?: string) => fetch(url, { headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {} });

    const rPemilik = await ambil(owner.cookie);
    const badan = Buffer.from(await rPemilik.arrayBuffer());
    check("pemilik menerima GLB utuh", rPemilik.status === 200 && badan.equals(glb), `${rPemilik.status}, ${badan.length} byte`);
    check("jenis konten & nosniff", rPemilik.headers.get("content-type") === MIME && rPemilik.headers.get("x-content-type-options") === "nosniff", String(rPemilik.headers.get("content-type")));
    check("bukan anggota → 404", (await ambil(luar.cookie)).status === 404, "tak membocorkan kelas");
    check("tanpa masuk → 401", (await ambil()).status === 401, "wajib sesi");

    await db.collection("classMembers").doc(`${luar.uid}_${classId}`).set({ uid: luar.uid, classId, role: "member", joinedAt: waktu });
    check("anggota kelas bisa melihat", (await ambil(luar.cookie)).status === 200, "keanggotaan");

    console.log("\nEdit");
    const ubah = (m: unknown, body = "") => callAction(`${jalur}/tugas/x`, editId, [classId, postId, { body, keepAttachments: [], attachments: [], ...(m === undefined ? {} : { model3d: m }) }], owner.cookie);
    const baca = async () => (await db.collection("classes").doc(classId).collection("posts").doc(postId).get()).data()?.model3d;

    check("edit keterangan saja mempertahankan berkas", (await ubah({ annotations: [anotasi("c3", { title: "Baru" })] })).includes("Pengumuman diperbarui"), "tanpa file");
    let m = await baca();
    check("keterangan berganti, berkas sama", m?.annotations?.length === 1 && m.annotations[0].title === "Baru" && m.file.path === `${folder}/ok.glb`, m?.annotations?.[0]?.title);

    check("judul bisa diubah & dirapikan", (await ubah({ title: "  Anatomi\nMesin  ", annotations: [anotasi("c3")] })).includes("diperbarui") && (await baca())?.title === "Anatomi Mesin", String((await baca())?.title));
    await ubah({ title: "x".repeat(300), annotations: [anotasi("c3")] });
    check("judul dipangkas ke 80 karakter", (await baca())?.title?.length === 80, String((await baca())?.title?.length));
    await ubah({ title: "   ", annotations: [anotasi("c3")] });
    check("judul kosong → cadangan dari nama berkas", (await baca())?.title === "mesin", String((await baca())?.title));

    check("tanpa field model3d = tidak diubah", (await ubah(undefined)).includes("Pengumuman diperbarui") && (await baca())?.annotations?.length === 1, "undefined");

    await simpan(`${folder}/baru.glb`, glb, MIME);
    await ubah({ file: { path: `${folder}/baru.glb`, name: "baru.glb" }, annotations: [anotasi("d4")] });
    m = await baca();
    check("berkas diganti & yang lama dibuang", m?.file?.path === `${folder}/baru.glb` && !(await ada(`${folder}/ok.glb`)), "ok.glb terhapus");

    check("membuang objek dari pengumuman kosong ditolak", (await ubah(null)).includes("tidak boleh kosong"), "bukan penerbitan kosong");
    check("berkas tetap ada setelah penolakan", (await baca()) != null && (await ada(`${folder}/baru.glb`)), "tak berubah");

    await ubah(null, "Sekarang hanya teks.");
    check("model dibuang + berkas terhapus", (await baca()) == null && !(await ada(`${folder}/baru.glb`)), "null");

    console.log("\nPembersihan");
    await simpan(`${folder}/hapus.glb`, glb, MIME);
    await kirim(model(`${folder}/hapus.glb`));
    const lagi = (await db.collection("classes").doc(classId).collection("posts").get()).docs.find((d) => d.data().model3d?.file?.path === `${folder}/hapus.glb`);
    const hapus = await callAction(jalur, hapusId, [classId, lagi?.id ?? ""], owner.cookie);
    check("hapus postingan menghapus berkas model", hapus.includes("Postingan dihapus") && !(await ada(`${folder}/hapus.glb`)), "tak ada yatim");
  } finally {
    await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
    await db.collection("classMembers").doc(`${luar.uid}_${classId}`).delete().catch(() => undefined);
    await bucket.deleteFiles({ prefix: `class-files/${owner.uid}/` }).catch(() => undefined);
    await bucket.deleteFiles({ prefix: `class-files/${lain.uid}/` }).catch(() => undefined);
    await auth.deleteUsers([owner.uid, luar.uid, lain.uid]).catch(() => undefined);
    console.log("\nakun, kelas & berkas uji dihapus.");
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  aturanMurni();
  await ujiLayanan();
  finish();
}

if (process.argv[1]?.includes("verify-model3d")) {
  main().catch((e: unknown) => {
    console.error("\nGAGAL:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
