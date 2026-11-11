/**
 * Menguji objek 3D pada pelajaran kursus: `normalizeSections` hanya menerima berkas GLB di
 * `class-files/{uid}/course-3d/` milik pemilik/penyimpan, hanya untuk Modul/Bacaan & Video, memvalidasi keterangan, dan
 * membuang objek dari tipe lain. Murni (tanpa server), tetapi modul kurikulum bertanda `server-only`, jadi dijalankan dengan
 *
 *   npx tsx --tsconfig frontend/tsconfig.json --conditions=react-server scripts/verify-kursus-3d.ts
 */
import { check, finish } from "./checks";
import { normalizeSections } from "../frontend/src/lib/curriculum";
import { attachmentPaths, courseFilePaths } from "../frontend/src/lib/storageCleanup";
import { hrefModelKursus } from "../frontend/src/lib/model3dRules";

const ann = (over: Record<string, unknown> = {}) => ({ id: "a1", title: "Katup", text: "Mengatur aliran", mesh: 1, meshName: "katup", point: [0, 0, 0], ...over });
const mk = (path: string, type: "reading" | "video" | "assignment" = "reading", annotations: unknown[] = [ann()], name = "mesin.glb") => [
  { title: "Bagian", lessons: [{ title: "Pelajaran", type, duration: "10 menit", videoUrl: "https://youtu.be/abcdefghijk", model3d: { file: { name, path, size: 1234 }, title: "", annotations } }] },
];

const sah = normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.glb"), ["u1"]);
check("objek 3D sah diterima", sah.ok, sah.ok ? "ok" : sah.error);
const m = sah.ok ? sah.sections[0].lessons[0].model3d : undefined;
check("judul kosong -> dari nama berkas, MIME dibakukan, keterangan tersimpan", !!m && m.title === "mesin" && m.file.mime === "model/gltf-binary" && m.annotations.length === 1, JSON.stringify(m?.title));
check("berlaku juga untuk Video", normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.glb", "video"), ["u1"]).ok, "video");

const asing = normalizeSections(mk("class-files/u2/course-3d/1-a-mesin.glb"), ["u1"]);
check("berkas milik uid lain ditolak", !asing.ok, asing.ok ? "lolos!" : asing.error);
const admin = normalizeSections(mk("class-files/admin1/course-3d/1-a-mesin.glb"), ["u1", "admin1"]);
check("berkas milik admin penyimpan diterima (admin menyunting kursus educator)", admin.ok, admin.ok ? "ok" : admin.error);
check("folder kelas biasa (bukan course-3d) ditolak", !normalizeSections(mk("class-files/u1/kelas1/1-a-mesin.glb"), ["u1"]).ok, "ditolak");
check("path menyusup (..) ditolak", !normalizeSections(mk("class-files/u1/course-3d/../x/1-mesin.glb"), ["u1"]).ok, "ditolak");
check("bukan .glb ditolak", !normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.pdf", "reading", [ann()], "mesin.pdf"), ["u1"]).ok, "ditolak");
check("keterangan tanpa judul ditolak", !normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.glb", "reading", [ann({ title: "" })]), ["u1"]).ok, "ditolak");
check("dua keterangan pada satu komponen ditolak", !normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.glb", "reading", [ann(), ann({ id: "a2" })]), ["u1"]).ok, "ditolak");
const tugas = normalizeSections(mk("class-files/u1/course-3d/1-a-mesin.glb", "assignment"), ["u1"]);
check("penugasan: objek 3D dibuang diam-diam", tugas.ok && tugas.sections[0].lessons[0].model3d === undefined, "dibuang");

if (sah.ok) {
  const semua = attachmentPaths(sah.sections);
  check("path model ikut daftar berkas kursus (supaya dibersihkan saat diganti/dihapus)", semua.includes("class-files/u1/course-3d/1-a-mesin.glb"), semua.join());
  check("courseFilePaths memuat model tetapi tak menyeret folder kelas lain", courseFilePaths({ sections: sah.sections }).length === 1 && courseFilePaths({ sections: [{ title: "x", position: 0, lessons: [{ slug: "l", title: "l", type: "reading", duration: "-", position: 0, model3d: { title: "t", annotations: [], file: { name: "a.glb", path: "class-files/u1/kelas1/a.glb", size: 1, mime: "model/gltf-binary" } } }] }] }).length === 0, "ok");
}
check("tautan penyaji memakai slug kursus & pelajaran", hrefModelKursus("kursus-a", "bab 1", "v1") === "/api/courses/kursus-a/model?lesson=bab%201&v=v1", hrefModelKursus("kursus-a", "bab 1", "v1"));
finish();
