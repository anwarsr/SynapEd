/**
 * Serialisasi keadaan lab ke satu parameter query, dan kembali lagi.
 *
 * Modul NETRAL tanpa impor alias `@/` — dipakai komponen papan di browser,
 * Server Component yang membaca `searchParams`, dan skrip verifikasi tsx.
 *
 * Kenapa skema buatan sendiri, bukan JSON yang di-base64: tautan papan ditulis
 * di papan tulis, dibacakan di kelas, dan ditempel di grup pesan. JSON base64
 * untuk 24 elemen melewati 300 karakter tak terbaca yang rusak begitu ada
 * aplikasi chat memotong tautannya, sedangkan `1a~7,3,8,1~i:0:utama~~` masih
 * bisa diperiksa mata — dan diketik ulang kalau terpaksa.
 *
 * Bentuk umumnya SELALU 5 ruas dipisah `~`: kepala (1 digit versi + 1 huruf
 * lab) lalu empat ruas data yang artinya ditentukan lab-nya:
 *
 *   1a~7,3,12,-9~i:0:utama,j:2:kedua~1:3:sorot~2:pivot      ← array 1D
 *   1m~1,2,3;4,5,6~p:0:1:utama~0:0:0:2:sorot~1:1:pivot      ← array 2D (labUrlMatrix.ts)
 *   1c~2x2x3~0,1,…,11~p:1:0:2:utama~0:1:0:1:1:2:sorot       ← array 3D (labUrlCube.ts)
 *   1n~2x3x4~0,1,…,23~1x2x0~1:0:sorot                       ← array N-D (labUrlNd.ts)
 *
 * Untuk 1D: nilai dipisah koma ~ penunjuk nama:indeks:nada ~ rentang
 * dari:sampai:nada (inklusif) ~ catatan indeks:teks.
 *
 * Lab baru cukup mendapat huruf baru; versi skema tidak naik, jadi tautan
 * papan 1D yang sudah tersebar tetap terbuka.
 *
 * `nextId` SENGAJA tidak ikut diserialisasi. Ia keadaan turunan yang hanya
 * dipakai animasi, dan satu-satunya yang bisa dilakukan angka itu di dalam URL
 * adalah berbohong. Dekoder menghitungnya ulang dari jumlah elemen.
 */
import {
  arrayStateFromValues,
  assertArrayInvariants,
  type ArrayItem,
  type ArrayLabState,
} from "./arrayLab";
import {
  cleanLabText,
  isLabPointerTone,
  isLabTone,
  LAB_MAX_ITEMS,
  LAB_MAX_POINTERS,
  LAB_MAX_RANGES,
  LAB_NOTE_RE,
  LAB_POINTER_NAME_RE,
  LAB_VALUE_RE,
  type LabId,
  type LabPointer,
  type LabRange,
} from "./labTypes";
import { bagianInt, daftar, KARAKTER_TERLARANG_RE, LAB_MAX_URL_STATE } from "./labUrlBagian";
import { decodeCube, encodeCube } from "./labUrlCube";
import { decodeMatrix, encodeMatrix } from "./labUrlMatrix";
import { decodeNd, encodeNd } from "./labUrlNd";
import type { CubeLabState } from "./cubeLab";
import type { MatrixLabState } from "./matrixLab";
import type { NdLabState } from "./ndLab";

export { LAB_MAX_URL_STATE };

export const LAB_URL_PARAM = "s";

/** Dinaikkan hanya kalau arti ruas berubah; lab baru tidak menaikkannya. */
export const LAB_URL_VERSION = "1";

/** Keadaan satu lab beserta jenisnya — bentuk yang dibagikan lewat tautan. */
export type LabSnapshot =
  | { lab: "array1d"; state: ArrayLabState }
  | { lab: "array2d"; state: MatrixLabState }
  | { lab: "array3d"; state: CubeLabState }
  | { lab: "arrayNd"; state: NdLabState };

/** Satu huruf per lab. `Record<LabId, …>` membuat lab baru tanpa huruf jadi galat tipe. */
const HURUF_LAB: Record<LabId, string> = { array1d: "a", array2d: "m", array3d: "c", arrayNd: "n" };

/** Peta balik, diturunkan supaya huruf tidak ditulis dua kali di dua arah. */
const LAB_DARI_HURUF = new Map<string, LabId>(
  (Object.keys(HURUF_LAB) as LabId[]).map((id) => [HURUF_LAB[id], id]),
);

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Keadaan menjadi parameter, atau null kalau tidak bisa dijamin.
 *
 * Null berarti pemanggil menampilkan pesan ("papan terlalu besar untuk
 * dibagikan") — bukan memotong tautan diam-diam, yang akan menghasilkan tautan
 * yang kelihatan baik tapi memulihkan papan lain. Keadaan yang melanggar
 * invarian juga ditolak di sini, supaya setiap tautan yang pernah keluar dari
 * fungsi ini pasti bisa didekode kembali.
 */
export function encodeLabSnapshot(snap: LabSnapshot): string | null {
  let data: string[] | null;
  switch (snap.lab) {
    case "array1d":
      data = encodeArray1d(snap.state);
      break;
    case "array2d":
      data = encodeMatrix(snap.state);
      break;
    case "array3d":
      data = encodeCube(snap.state);
      break;
    case "arrayNd":
      data = encodeNd(snap.state);
      break;
  }
  if (data === null) return null;

  const hasil = [`${LAB_URL_VERSION}${HURUF_LAB[snap.lab]}`, ...data].join("~");
  if (hasil.length > LAB_MAX_URL_STATE) return null;
  if (KARAKTER_TERLARANG_RE.test(hasil)) return null;
  return hasil;
}

/**
 * Parameter menjadi keadaan, atau null.
 *
 * SEMUA-ATAU-TIDAK, dan tidak pernah melempar. Satu bagian yang tidak sah
 * membatalkan seluruh pemulihan, termasuk bagian yang sebenarnya baik.
 *
 * Alasannya pengajaran, bukan kerapian: papan yang setengah benar muncul di
 * tengah pelajaran tanpa memberi tanda apa pun. Papan kosong dengan pesan
 * "tautan tidak bisa dibaca" memakan sepuluh detik; papan yang diam-diam salah
 * memakan sisa jam pelajaran.
 */
export function decodeLabSnapshot(raw: unknown): LabSnapshot | null {
  if (typeof raw !== "string") return null;
  // Panjang diperiksa sebelum `split`, supaya parameter raksasa dari luar tidak
  // pernah membuat parser ini mengerjakan apa pun.
  if (raw.length > LAB_MAX_URL_STATE) return null;

  const ruas = raw.split("~");
  if (ruas.length !== 5) return null;

  const kepala = ruas[0];
  if (kepala.length !== 2 || kepala[0] !== LAB_URL_VERSION) return null;

  const lab = LAB_DARI_HURUF.get(kepala[1]);
  const data = ruas.slice(1);

  switch (lab) {
    case "array1d": {
      const state = decodeArray1d(data);
      return state === null ? null : { lab, state };
    }
    case "array2d": {
      const state = decodeMatrix(data);
      return state === null ? null : { lab, state };
    }
    case "array3d": {
      const state = decodeCube(data);
      return state === null ? null : { lab, state };
    }
    case "arrayNd": {
      const state = decodeNd(data);
      return state === null ? null : { lab, state };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Codec array 1D
// ---------------------------------------------------------------------------

function encodeArray1d(state: ArrayLabState): string[] | null {
  if (assertArrayInvariants(state) !== null) return null;

  const nilai = state.items.map((it) => it.value).join(",");
  const penunjuk = state.pointers.map((p) => `${p.name}:${p.index}:${p.tone}`).join(",");
  const rentang = state.ranges.map((r) => `${r.from}:${r.to}:${r.tone}`).join(",");
  const catatan = state.items
    .map((it, i) => (it.note === null ? null : `${i}:${it.note}`))
    .filter((s): s is string => s !== null)
    .join(",");

  return [nilai, penunjuk, rentang, catatan];
}

function decodeArray1d(ruas: readonly string[]): ArrayLabState | null {
  // ── Nilai elemen ────────────────────────────────────────────────────────
  const mentah = daftar(ruas[0]);
  if (mentah.length > LAB_MAX_ITEMS) return null;

  const nilai: string[] = [];
  for (const bagian of mentah) {
    // Dibersihkan dulu karena parameter sudah melewati pendekode query: `+`
    // berubah menjadi spasi, dan karakter kendali bisa terbawa dari tempelan.
    const v = cleanLabText(bagian);
    if (!LAB_VALUE_RE.test(v)) return null;
    nilai.push(v);
  }

  const dasar = arrayStateFromValues(nilai);
  // `arrayStateFromValues` sengaja pemaaf (melewati yang tidak sah). Di sini
  // kepemaafan itu tidak boleh berlaku: jumlah yang tidak sama berarti ada
  // yang dilewati tanpa kabar.
  if (dasar.items.length !== nilai.length) return null;

  const n = dasar.items.length;

  // ── Penunjuk ────────────────────────────────────────────────────────────
  const bagianPenunjuk = daftar(ruas[1]);
  if (bagianPenunjuk.length > LAB_MAX_POINTERS) return null;

  const pointers: LabPointer[] = [];
  const namaTerpakai = new Set<string>();

  for (const bagian of bagianPenunjuk) {
    const potong = bagian.split(":");
    if (potong.length !== 3) return null;

    const nama = cleanLabText(potong[0]);
    // Tidak di-huruf-kecilkan: pengoder hanya menghasilkan huruf kecil, dan
    // memperbaiki huruf besar diam-diam berarti dua tautan berbeda memulihkan
    // papan yang sama.
    if (!LAB_POINTER_NAME_RE.test(nama)) return null;
    if (namaTerpakai.has(nama)) return null;
    namaTerpakai.add(nama);

    // Jangkauan penunjuk 0..n, satu lebih panjang dari indeks elemen: `n`
    // adalah slot lepas sesudah elemen terakhir (lihat `LabPointer`).
    const index = bagianInt(potong[1], 0, n);
    if (index === null) return null;

    const tone = potong[2];
    if (!isLabPointerTone(tone)) return null;

    pointers.push({ name: nama, index, tone });
  }

  // ── Sorotan rentang ─────────────────────────────────────────────────────
  const bagianRentang = daftar(ruas[2]);
  if (bagianRentang.length > LAB_MAX_RANGES) return null;

  const ranges: LabRange[] = [];

  for (const bagian of bagianRentang) {
    const potong = bagian.split(":");
    if (potong.length !== 3) return null;

    // Indeks ELEMEN, jadi batasnya n-1. Pada papan kosong batas itu -1 dan
    // setiap rentang tertolak, persis seperti yang dituntut invarian.
    const from = bagianInt(potong[0], 0, n - 1);
    const to = bagianInt(potong[1], 0, n - 1);
    if (from === null || to === null || from > to) return null;

    const tone = potong[2];
    if (!isLabTone(tone)) return null;

    ranges.push({ from, to, tone });
  }

  // ── Catatan ─────────────────────────────────────────────────────────────
  const catatanPerIndeks = new Map<number, string>();

  for (const bagian of daftar(ruas[3])) {
    const potong = bagian.split(":");
    if (potong.length !== 2) return null;

    const indeks = bagianInt(potong[0], 0, n - 1);
    if (indeks === null) return null;
    // Dua catatan untuk satu sel adalah tautan yang saling bertentangan;
    // memilih salah satunya berarti menebak maksud penulisnya.
    if (catatanPerIndeks.has(indeks)) return null;

    const teks = cleanLabText(potong[1]);
    if (!LAB_NOTE_RE.test(teks)) return null;

    catatanPerIndeks.set(indeks, teks);
  }

  const items: ArrayItem[] = dasar.items.map((it, i) => {
    const note = catatanPerIndeks.get(i);
    return note === undefined ? it : { ...it, note };
  });

  const state: ArrayLabState = { items, pointers, ranges, nextId: dasar.nextId };

  // Penjaga terakhir: kalau pemeriksaan di atas pernah bocor, yang masuk papan
  // tetap keadaan yang sehat.
  return assertArrayInvariants(state) === null ? state : null;
}
