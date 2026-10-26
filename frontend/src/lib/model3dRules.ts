/**
 * Aturan objek 3D pada pengumuman kelas: batas, bentuk data, dan validasi.
 *
 * Modul NETRAL — tanpa `server-only`, tanpa `use client`, tanpa impor `@/`:
 * editor di browser memakainya untuk batas isian, Server Action memeriksa
 * ULANG semuanya, skrip verifikasi mengimpornya lewat path relatif.
 *
 * Format yang diterima HANYA `.glb` (glTF biner, satu berkas utuh berisi
 * geometri + tekstur). `.gltf` bercabang banyak berkas dan tak bisa diunggah
 * sebagai satu lampiran.
 */

export const MIME_MODEL3D = "model/gltf-binary";
/**
 * MIME yang dipakai browser saat mengunggah GLB: ZIP, karena storage.rules yang
 * sudah ter-deploy mengizinkannya (rules tidak ikut deploy otomatis). Server
 * menerima keduanya dan selalu memeriksa isi berkasnya.
 */
export const MIME_UNGGAH_MODEL3D = "application/zip";
export const EKSTENSI_MODEL3D = ".glb";

export const MAX_ANOTASI = 30;
export const MAX_JUDUL_ANOTASI = 60;
export const MAX_JUDUL_MODEL = 80;
export const MAX_TEKS_ANOTASI = 400;
/** Batas koordinat yang masuk akal; menolak NaN/Infinity dan angka ngawur. */
const MAX_KOORDINAT = 100_000;
const MAX_INDEKS_MESH = 10_000;

/** Satu keterangan yang menempel pada satu titik di permukaan sebuah komponen. */
export interface Anotasi3D {
  /** Pengenal pendek unik dalam satu model, dibuat editor. */
  id: string;
  title: string;
  text: string;
  /** Urutan komponen (mesh) menurut penelusuran scene — untuk menyorot komponennya. */
  mesh: number;
  /** Nama komponen di berkas, hanya untuk ditampilkan ke pengajar. */
  meshName: string;
  /** Titik tempel dalam koordinat scene glTF (sebelum penskalaan tampilan). */
  point: [number, number, number];
}

/** Berkas model yang tercatat — bentuknya sama dengan `KelasBerkas`. */
export interface BerkasModel3D {
  name: string;
  path: string;
  size: number;
  mime: string;
}

export interface Model3D {
  file: BerkasModel3D;
  /** Judul di gerbang objek 3D (yang diklik murid untuk membukanya). Tak pernah kosong. */
  title: string;
  annotations: Anotasi3D[];
}

export type Hasil3D<T> = { ok: true; value: T } | { ok: false; error: string };

export function adalahNamaGlb(name: string): boolean {
  return name.toLowerCase().endsWith(EKSTENSI_MODEL3D);
}

/** Galat untuk satu berkas pilihan, atau null. Batas ukuran sama dengan lampiran lain (< 20 MB). */
export function galatBerkasModel(file: { name: string; size: number }, maksByte: number): string | null {
  if (!adalahNamaGlb(file.name)) return `"${file.name}" bukan berkas .glb. Ekspor model Anda sebagai GLB.`;
  if (file.size <= 0) return `"${file.name}" kosong.`;
  if (file.size >= maksByte) return `"${file.name}" melebihi 20 MB.`;
  return null;
}

/** "mesin_diesel-v2.glb" → "mesin diesel-v2": judul awal/cadangan dari nama berkas. */
export function judulDariNama(name: string): string {
  const polos = name.replace(/\.glb$/i, "").replace(/[_]+/g, " ").trim();
  return (polos || "Objek 3D").slice(0, MAX_JUDUL_MODEL);
}

/** Judul kiriman browser; kosong → cadangan dari nama berkas, jadi gerbang selalu punya judul. */
export function validasiJudulModel(raw: unknown, namaBerkas: string): string {
  const t = typeof raw === "string" ? raw.replace(/[\r\n]+/g, " ").trim().slice(0, MAX_JUDUL_MODEL) : "";
  return t || judulDariNama(namaBerkas);
}

function angka(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= MAX_KOORDINAT ? x : null;
}

function teks(raw: unknown, maks: number): string {
  return typeof raw === "string" ? raw.replace(/\r/g, "").trim().slice(0, maks) : "";
}

/**
 * Memeriksa daftar keterangan kiriman browser.
 *
 * Judul wajib (keterangan tanpa judul tak punya apa-apa untuk dibaca di
 * hologram); isi boleh kosong. Pengenal ganda ditolak, bukan ditimpa diam-diam.
 */
export function validasiAnotasi(raw: unknown): Hasil3D<Anotasi3D[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Daftar keterangan tidak sah." };
  if (raw.length > MAX_ANOTASI) return { ok: false, error: `Maksimal ${MAX_ANOTASI} keterangan per objek.` };

  const out: Anotasi3D[] = [];
  const ids = new Set<string>();

  for (const item of raw) {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const id = typeof r.id === "string" && /^[a-z0-9]{1,16}$/.test(r.id) ? r.id : "";
    if (!id || ids.has(id)) return { ok: false, error: "Keterangan objek 3D tidak sah." };
    ids.add(id);

    const title = teks(r.title, MAX_JUDUL_ANOTASI);
    if (!title) return { ok: false, error: "Setiap keterangan wajib diberi judul." };

    const p = Array.isArray(r.point) ? r.point : [];
    const x = angka(p[0]);
    const y = angka(p[1]);
    const z = angka(p[2]);
    if (p.length !== 3 || x === null || y === null || z === null) {
      return { ok: false, error: "Posisi keterangan tidak sah." };
    }

    const mesh = typeof r.mesh === "number" && Number.isInteger(r.mesh) && r.mesh >= 0 && r.mesh <= MAX_INDEKS_MESH ? r.mesh : -1;

    out.push({
      id,
      title,
      text: teks(r.text, MAX_TEKS_ANOTASI),
      mesh,
      meshName: teks(r.meshName, 120),
      point: [x, y, z],
    });
  }

  return { ok: true, value: out };
}

/** Normaliser saat MEMBACA Firestore: nilai bawaan, bukan `as Model3D`. */
export function toModel3D(raw: unknown): Model3D | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const f = r.file && typeof r.file === "object" ? (r.file as Record<string, unknown>) : null;
  if (!f || typeof f.path !== "string" || !f.path) return null;

  const ann = validasiAnotasi(r.annotations);
  const nama = typeof f.name === "string" && f.name ? f.name : "model.glb";
  return {
    title: validasiJudulModel(r.title, nama),
    file: {
      name: nama,
      path: f.path,
      size: typeof f.size === "number" && f.size > 0 ? f.size : 0,
      mime: typeof f.mime === "string" ? f.mime : MIME_MODEL3D,
    },
    // Dokumen rusak: model tetap tampil, hanya tanpa keterangan.
    annotations: ann.ok ? ann.value : [],
  };
}

/** Tautan penyaji berkas model (diperiksa keanggotaannya di server). */
export function hrefModel3D(classId: string, postId: string, versi = ""): string {
  // `v` memutus cache peramban saat pengajar mengganti berkasnya.
  return `/api/classes/model?class=${encodeURIComponent(classId)}&post=${encodeURIComponent(postId)}&v=${encodeURIComponent(versi)}`;
}

/** Mesh (≥0) yang punya lebih dari satu keterangan - ditolak saat MENULIS, tak dihitung saat membaca data lama. */
export function adaMeshGanda(daftar: readonly Anotasi3D[]): boolean {
  const lihat = new Set<number>();
  for (const a of daftar) {
    if (a.mesh < 0) continue;
    if (lihat.has(a.mesh)) return true;
    lihat.add(a.mesh);
  }
  return false;
}

/** Pengenal keterangan baru yang tidak bentrok dengan yang sudah ada. */
export function idAnotasiBaru(ada: readonly string[]): string {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8);
    if (id && !ada.includes(id)) return id;
  }
}
