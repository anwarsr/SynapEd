/**
 * Mesin lab array: satu operasi masuk, deretan langkah animasi keluar.
 *
 * Modul NETRAL tanpa impor alias `@/` — papan di browser, komponen kontrol,
 * dan skrip verifikasi yang dijalankan tsx memakai fungsi yang SAMA. Logikanya
 * tidak boleh ada duanya: aturan "indeks 3 di luar jangkauan" yang ditulis
 * ulang di komponen pasti suatu hari berbeda dari yang di sini, dan yang
 * kebingungan adalah muridnya.
 *
 * Dua janji yang dipegang seluruh berkas ini:
 *
 * 1. `applyArrayOp` TIDAK PERNAH melempar untuk masukan pengguna. Papan ini
 *    dipakai orang yang sedang belajar; salah tulis indeks adalah bagian dari
 *    belajar, bukan galat program. Satu-satunya `throw` ada di cabang `never`
 *    switch, yang hanya tercapai kalau ada `kind` baru yang lupa ditangani.
 * 2. Semua fungsi murni dan tidak memutasi argumennya. Riwayat undo menyimpan
 *    snapshot keadaan apa adanya, jadi satu `items.push()` di tempat yang salah
 *    akan mengubah masa lalu — bug yang nyaris mustahil dilacak dari layar.
 */
import {
  LAB_MAX_STEPS_URUT,
  cleanLabText,
  isLabPointerTone,
  isLabTone,
  LAB_MAX_ITEMS,
  LAB_MAX_ITEM_CHARS,
  LAB_MAX_NOTE_CHARS,
  LAB_MAX_POINTERS,
  LAB_MAX_RANGES,
  LAB_MAX_STEPS,
  LAB_NOTE_RE,
  LAB_POINTER_NAME_RE,
  LAB_STEP_HOLD_MS,
  LAB_VALUE_RE,
  type LabOpResult,
  type LabPointer,
  type LabPointerTone,
  type LabRange,
  type LabStep,
  type LabTone,
} from "./labTypes";
import { mulberry32 } from "./labRandom";
import { galatTerlaluPanjang, isArahUrut, langkahUrut, type ArahUrut, type KindUrut } from "./labSort";

/**
 * Satu sel array.
 *
 * `id` BUKAN indeks: ia pencacah monoton yang menempel pada sel sepanjang
 * hidupnya. Animasi FLIP di papan mencocokkan sel antar-langkah lewat id ini,
 * jadi sel yang bergeser karena `shift` harus membawa id lamanya — kalau id
 * ikut bergeser, layar memperlihatkan semua sel "berkedip lahir baru" alih-alih
 * meluncur ke kiri, padahal justru pergeseran itulah pelajarannya.
 */
export interface ArrayItem {
  id: number;
  value: string;
  note: string | null;
}

export interface ArrayLabState {
  items: ArrayItem[];
  pointers: LabPointer[];
  ranges: LabRange[];
  /** Id berikutnya yang akan dibagikan. Naik terus, tidak pernah dipakai ulang. */
  nextId: number;
}

export type ArrayStep = LabStep<ArrayLabState>;
export type ArrayOpResult = LabOpResult<ArrayLabState>;

/**
 * Nilai acak terbesar yang masih muat di satu sel.
 *
 * Diturunkan dari `LAB_MAX_ITEM_CHARS` supaya batas panjang teks dan batas
 * angka tidak bisa berselisih: melebarkan sel otomatis menaikkan batas ini.
 */
export const LAB_MAX_RANDOM_VALUE = Math.pow(10, LAB_MAX_ITEM_CHARS) - 1;

/**
 * Operasi yang bisa dijalankan di lab array.
 *
 * Nama field berbahasa Indonesia karena katalog membangun form langsung dari
 * nama ini, dan label berbahasa Inggris di tengah form berbahasa Indonesia
 * selalu berakhir menjadi dua kosakata untuk satu hal yang sama.
 */
export type ArrayOp =
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "acak"; panjang: number; maks: number; benih: number }
  | { kind: "kosongkan" }
  | { kind: "push"; nilai: string }
  | { kind: "pop" }
  | { kind: "unshift"; nilai: string }
  | { kind: "shift" }
  | { kind: "bacaIndeks"; indeks: number }
  | { kind: "setIndeks"; indeks: number; nilai: string }
  | { kind: "sisip"; indeks: number; nilai: string }
  | { kind: "hapus"; indeks: number }
  | { kind: "tukar"; a: number; b: number }
  | { kind: "balik" }
  | { kind: "slice"; dari: number; sampai: number }
  | { kind: "setPenunjuk"; nama: string; indeks: number; tone: LabPointerTone }
  | { kind: "geserPenunjuk"; nama: string; delta: number }
  | { kind: "hapusPenunjuk"; nama: string }
  | { kind: "sorotRentang"; dari: number; sampai: number; tone: LabTone }
  | { kind: "hapusSorotan" }
  | { kind: "catat"; indeks: number; catatan: string }
  | { kind: KindUrut; arah: ArahUrut };

export function emptyArrayState(): ArrayLabState {
  return { items: [], pointers: [], ranges: [], nextId: 1 };
}

/**
 * Keadaan awal dari daftar nilai.
 *
 * SENGAJA pemaaf: nilai yang tidak sah dilewati dan kelebihan elemen dipotong,
 * bukan ditolak. Ini hanya jaring pengaman — kedua pemanggilnya memvalidasi
 * lebih dulu: pemulih tautan (`decodeLabSnapshot`) menolak SELURUH tautan
 * yang memuat satu nilai rusak, dan operasi `isiDariTeks` memberi pesan yang
 * jelas, bukan elemen yang hilang tanpa kabar.
 */
export function arrayStateFromValues(values: readonly string[]): ArrayLabState {
  const items: ArrayItem[] = [];
  let nextId = 1;

  for (const raw of values) {
    if (items.length >= LAB_MAX_ITEMS) break;
    const value = cleanLabText(raw);
    if (!LAB_VALUE_RE.test(value)) continue;
    items.push({ id: nextId, value, note: null });
    nextId += 1;
  }

  return { items, pointers: [], ranges: [], nextId };
}

/**
 * Merapikan penanda terhadap panjang array sekarang.
 *
 * Pembagian tugas yang perlu diketahui sebelum mengubah berkas ini: PERGESERAN
 * penanda dikerjakan operasinya masing-masing (hanya `hapus` yang tahu elemen
 * mana yang baru lenyap), sedangkan fungsi ini penjaga terakhir yang dijalankan
 * di akhir SETIAP langkah. Ia sendiri tidak bisa menggeser apa pun karena ia
 * hanya menerima keadaan akhir, tanpa riwayat apa yang terjadi padanya.
 *
 * Penunjuk di-clamp (dipaksa masuk jangkauan) karena penunjuk yang hilang
 * terasa seperti papan yang rusak; rentang justru DIBUANG seluruhnya begitu
 * salah satu ujungnya di luar array. Rentang yang dipotong jadi lebih pendek
 * adalah jawaban setengah benar — murid melihat sorotan "2 sampai 4" yang
 * diam-diam berubah arti lalu menyangka dirinya yang salah membaca.
 */
export function settleMarkers(state: ArrayLabState): ArrayLabState {
  const n = state.items.length;

  const pointers = state.pointers.map((p) => {
    const index = Number.isInteger(p.index) ? Math.min(Math.max(p.index, 0), n) : 0;
    return index === p.index ? p : { ...p, index };
  });

  const ranges = state.ranges.filter(
    (r) =>
      Number.isInteger(r.from) &&
      Number.isInteger(r.to) &&
      r.from >= 0 &&
      r.from <= r.to &&
      r.to <= n - 1,
  );

  return { items: state.items, pointers, ranges, nextId: state.nextId };
}

/**
 * Memeriksa keadaan terhadap seluruh invarian lab.
 *
 * Mengembalikan KALIMAT masalah pertama, bukan boolean, supaya pesannya bisa
 * langsung masuk log skrip uji dan keputusan pemulih tautan. Dipakai di
 * perbatasan — hasil dekode URL dan hasil setiap operasi di skrip uji — jadi
 * di jalur normal ia seharusnya selalu `null`.
 */
export function assertArrayInvariants(state: ArrayLabState): string | null {
  const n = state.items.length;

  if (n > LAB_MAX_ITEMS) return `Jumlah elemen ${n} melebihi batas ${LAB_MAX_ITEMS}.`;
  if (state.pointers.length > LAB_MAX_POINTERS) {
    return `Jumlah penunjuk ${state.pointers.length} melebihi batas ${LAB_MAX_POINTERS}.`;
  }
  if (state.ranges.length > LAB_MAX_RANGES) {
    return `Jumlah sorotan ${state.ranges.length} melebihi batas ${LAB_MAX_RANGES}.`;
  }

  if (!Number.isInteger(state.nextId) || state.nextId < 1) {
    return `Pencacah id (${state.nextId}) harus bilangan bulat minimal 1.`;
  }

  const idTerpakai = new Set<number>();
  let idTerbesar = 0;

  for (let i = 0; i < n; i += 1) {
    const item = state.items[i];
    if (!LAB_VALUE_RE.test(item.value)) {
      return `Nilai elemen di indeks ${i} tidak sah: "${item.value}".`;
    }
    if (item.note !== null && !LAB_NOTE_RE.test(item.note)) {
      return `Catatan di indeks ${i} tidak sah: "${item.note}".`;
    }
    if (!Number.isInteger(item.id) || item.id < 1) {
      return `Id elemen di indeks ${i} (${item.id}) harus bilangan bulat minimal 1.`;
    }
    if (idTerpakai.has(item.id)) return `Ada dua elemen dengan id ${item.id}.`;
    idTerpakai.add(item.id);
    if (item.id > idTerbesar) idTerbesar = item.id;
  }

  if (state.nextId <= idTerbesar) {
    return `Pencacah id (${state.nextId}) tidak lebih besar dari id terbesar (${idTerbesar}).`;
  }

  const namaTerpakai = new Set<string>();
  for (const p of state.pointers) {
    if (!LAB_POINTER_NAME_RE.test(p.name)) return `Nama penunjuk tidak sah: "${p.name}".`;
    if (namaTerpakai.has(p.name)) return `Ada dua penunjuk bernama "${p.name}".`;
    namaTerpakai.add(p.name);
    if (!isLabPointerTone(p.tone)) return `Nada penunjuk "${p.name}" tidak dikenal.`;
    if (!Number.isInteger(p.index) || p.index < 0 || p.index > n) {
      return `Penunjuk "${p.name}" berada di indeks ${p.index}, di luar 0 sampai ${n}.`;
    }
  }

  for (const r of state.ranges) {
    if (!isLabTone(r.tone)) return "Ada sorotan dengan nada yang tidak dikenal.";
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to)) {
      return "Ada sorotan dengan batas yang bukan bilangan bulat.";
    }
    if (r.from < 0 || r.from > r.to || r.to > n - 1) {
      return `Sorotan ${r.from} sampai ${r.to} di luar jangkauan elemen 0 sampai ${n - 1}.`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Penolong internal
// ---------------------------------------------------------------------------

function gagal(error: string): ArrayOpResult {
  return { ok: false, error };
}

/**
 * Membungkus satu langkah animasi.
 *
 * `settleMarkers` dipasang di SINI, bukan hanya di langkah terakhir: setiap
 * langkah dirender utuh di papan, jadi frame tengah dengan penunjuk di luar
 * jangkauan akan terlihat sebagai papan rusak selama sepersekian detik.
 * Fungsinya idempoten, jadi langkah terakhir ikut terjamin rapi.
 */
function langkah(
  state: ArrayLabState,
  narasi: string,
  fokus: number[] = [],
  tahanMs: number = LAB_STEP_HOLD_MS,
): ArrayStep {
  return { state: settleMarkers(state), narasi, fokus, tahanMs };
}

function berhasil(steps: ArrayStep[]): ArrayOpResult {
  // Langkah TERAKHIR adalah keadaan yang masuk riwayat undo, jadi yang
  // dipangkas saat kelebihan adalah frame tengah — ujungnya tidak boleh hilang.
  if (steps.length > LAB_MAX_STEPS) {
    return { ok: true, steps: [...steps.slice(0, LAB_MAX_STEPS - 1), steps[steps.length - 1]] };
  }
  return { ok: true, steps };
}

/** Nilai elemen yang sudah bersih, atau null bila tidak sah. */
function nilaiBersih(raw: string): string | null {
  const value = cleanLabText(raw);
  return LAB_VALUE_RE.test(value) ? value : null;
}

const GALAT_NILAI = `Nilai elemen harus 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`;

const GALAT_CATATAN = `Catatan harus paling banyak ${LAB_MAX_NOTE_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`;

const GALAT_NAMA_PENUNJUK =
  "Nama penunjuk harus 1 sampai 6 karakter, dimulai huruf kecil, dan hanya berisi huruf kecil atau angka.";

function galatPenuh(): string {
  return `Array sudah berisi ${LAB_MAX_ITEMS} elemen, batas maksimal lab ini.`;
}

/** Pesan untuk indeks ELEMEN (0..n-1), atau null bila indeksnya sah. */
function galatIndeksElemen(state: ArrayLabState, indeks: number, sebutan: string): string | null {
  const n = state.items.length;
  if (n === 0) return "Array masih kosong, belum ada elemen di indeks mana pun.";
  if (!Number.isInteger(indeks) || indeks < 0 || indeks > n - 1) {
    return `${sebutan} ${indeks} di luar jangkauan; elemen yang ada hanya indeks 0 sampai ${n - 1}.`;
  }
  return null;
}

/**
 * Pesan untuk indeks PENUNJUK (0..n), atau null bila sah.
 *
 * Jangkauannya satu lebih panjang dari indeks elemen dengan sengaja: nilai `n`
 * adalah slot lepas sesudah elemen terakhir. Di situlah `i` berhenti ketika
 * `i < n` berakhir, dan melarangnya menghapus setengah pelajaran tentang loop.
 */
function galatIndeksPenunjuk(state: ArrayLabState, indeks: number): string | null {
  const n = state.items.length;
  if (!Number.isInteger(indeks) || indeks < 0 || indeks > n) {
    const catatanLepas = n > 0 ? ` (${n} berarti posisi lepas sesudah elemen terakhir)` : "";
    return `Indeks ${indeks} di luar jangkauan penunjuk; pilih 0 sampai ${n}${catatanLepas}.`;
  }
  return null;
}

/** Potongan daftar nilai untuk narasi, dipendekkan supaya kalimatnya tetap terbaca. */
function daftarSingkat(items: readonly ArrayItem[]): string {
  const PRATINJAU = 6;
  const nilai = items.map((it) => it.value);
  if (nilai.length === 0) return "kosong";
  if (nilai.length <= PRATINJAU) return nilai.join(", ");
  return `${nilai.slice(0, PRATINJAU).join(", ")}, dan ${nilai.length - PRATINJAU} elemen lainnya`;
}

/**
 * Menambah satu sorotan.
 *
 * Rentang dengan batas yang sama DITIMPA alih-alih ditumpuk, supaya menyorot
 * ulang petak yang sama tidak menghabiskan jatah `LAB_MAX_RANGES`.
 */
function tambahRentang(ranges: readonly LabRange[], r: LabRange): LabRange[] {
  const i = ranges.findIndex((x) => x.from === r.from && x.to === r.to);
  if (i >= 0) return ranges.map((x, k) => (k === i ? r : x));
  return [...ranges, r].slice(-LAB_MAX_RANGES);
}

/** Keadaan dengan sorotan tambahan, tanpa menyentuh elemen. */
function denganSorotan(state: ArrayLabState, r: LabRange): ArrayLabState {
  return { ...state, ranges: tambahRentang(state.ranges, r) };
}

/**
 * Keadaan sesudah SATU elemen di `indeks` dihapus.
 *
 * Rentang yang memuat elemen itu dibuang seluruhnya — alasannya ada di
 * `settleMarkers`. Penunjuk yang tepat berada di `indeks` dibiarkan di tempat
 * karena sesudah penghapusan ia menunjuk elemen penerusnya, yang persis
 * perilaku iterator sungguhan.
 */
function hapusElemen(state: ArrayLabState, indeks: number): ArrayLabState {
  const items = state.items.filter((_, i) => i !== indeks);
  const pointers = state.pointers.map((p) => (p.index > indeks ? { ...p, index: p.index - 1 } : p));

  const ranges: LabRange[] = [];
  for (const r of state.ranges) {
    if (indeks < r.from) ranges.push({ ...r, from: r.from - 1, to: r.to - 1 });
    else if (indeks > r.to) ranges.push(r);
  }

  return { items, pointers, ranges, nextId: state.nextId };
}

/** Keadaan sesudah satu elemen baru disisipkan di `indeks` (0..n, `n` berarti di akhir). */
function sisipElemen(state: ArrayLabState, indeks: number, value: string): ArrayLabState {
  const baru: ArrayItem = { id: state.nextId, value, note: null };
  const items = [...state.items.slice(0, indeks), baru, ...state.items.slice(indeks)];
  const pointers = state.pointers.map((p) => (p.index >= indeks ? { ...p, index: p.index + 1 } : p));

  const ranges: LabRange[] = [];
  for (const r of state.ranges) {
    if (indeks <= r.from) ranges.push({ ...r, from: r.from + 1, to: r.to + 1 });
    else if (indeks > r.to) ranges.push(r);
    // Sisipan di TENGAH rentang memecah keutuhannya, jadi rentangnya dibuang.
  }

  return { items, pointers, ranges, nextId: state.nextId + 1 };
}

/** Keadaan sesudah array dipotong menjadi `dari..sampai` (inklusif). */
function potongElemen(state: ArrayLabState, dari: number, sampai: number): ArrayLabState {
  const items = state.items.slice(dari, sampai + 1);
  const pointers = state.pointers.map((p) => ({ ...p, index: p.index - dari }));
  const ranges = state.ranges
    .filter((r) => r.from >= dari && r.to <= sampai)
    .map((r) => ({ ...r, from: r.from - dari, to: r.to - dari }));

  return { items, pointers, ranges, nextId: state.nextId };
}

/** Keadaan dengan elemen `a` dan `b` bertukar tempat, id ikut berpindah. */
function tukarElemen(state: ArrayLabState, a: number, b: number): ArrayLabState {
  const items = state.items.slice();
  const simpan = items[a];
  items[a] = items[b];
  items[b] = simpan;
  return { ...state, items };
}

// ---------------------------------------------------------------------------
// Operasi
// ---------------------------------------------------------------------------

/**
 * Menjalankan satu operasi dan mengembalikan langkah-langkahnya.
 *
 * Saat gagal, `state` yang masuk tidak tersentuh sama sekali — setiap cabang
 * memeriksa SELURUH masukannya sebelum membangun keadaan baru pertamanya,
 * jadi tidak ada operasi yang separuh jadi.
 */
export function applyArrayOp(state: ArrayLabState, op: ArrayOp): ArrayOpResult {
  const n = state.items.length;

  switch (op.kind) {
    case "isiDariTeks": {
      // Koma ATAU spasi: orang menempel "5, 3, 8" dari papan tulis dan
      // "5 3 8" dari kodenya sendiri; keduanya harus bekerja.
      const potongan = cleanLabText(op.teks)
        .split(/[,\s]+/)
        .filter((s) => s.length > 0);

      if (potongan.length === 0) return gagal("Tidak ada nilai yang bisa dibaca dari teks itu.");
      if (potongan.length > LAB_MAX_ITEMS) {
        return gagal(
          `Maksimal ${LAB_MAX_ITEMS} elemen, sedangkan teks itu berisi ${potongan.length} nilai.`,
        );
      }

      const nilai: string[] = [];
      for (const p of potongan) {
        const bersih = nilaiBersih(p);
        if (bersih === null) return gagal(`Nilai "${p}" tidak sah. ${GALAT_NILAI}`);
        nilai.push(bersih);
      }

      // Penunjuk dibawa (lalu di-clamp) tapi sorotan dibuang: sorotan menunjuk
      // elemen yang sudah tidak ada, sedangkan `i` masih bermakna sesudah
      // array diisi ulang.
      const isi = arrayStateFromValues(nilai);
      const akhir: ArrayLabState = { ...isi, pointers: state.pointers, ranges: [] };

      return berhasil([
        langkah(
          akhir,
          `Array diisi ulang dengan ${nilai.length} elemen: ${daftarSingkat(akhir.items)}.`,
          akhir.items.map((_, i) => i),
        ),
      ]);
    }

    case "acak": {
      if (!Number.isInteger(op.panjang) || op.panjang < 1 || op.panjang > LAB_MAX_ITEMS) {
        return gagal(`Panjang array harus bilangan bulat 1 sampai ${LAB_MAX_ITEMS}.`);
      }
      if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > LAB_MAX_RANDOM_VALUE) {
        return gagal(`Nilai terbesar harus bilangan bulat 1 sampai ${LAB_MAX_RANDOM_VALUE}.`);
      }
      if (!Number.isInteger(op.benih)) return gagal("Benih acak harus bilangan bulat.");

      // Generator berbenih, BUKAN Math.random: hasil yang sama untuk benih yang
      // sama berarti papannya bisa dibagikan lewat tautan, dan render server
      // sama dengan render klien (Math.random di sini = hydration mismatch).
      const acak = mulberry32(op.benih);
      const nilai: string[] = [];
      for (let i = 0; i < op.panjang; i += 1) {
        nilai.push(String(Math.floor(acak() * (op.maks + 1))));
      }

      const isi = arrayStateFromValues(nilai);
      const akhir: ArrayLabState = { ...isi, pointers: state.pointers, ranges: [] };

      return berhasil([
        langkah(
          akhir,
          `Array acak berisi ${op.panjang} elemen dibuat dari benih ${op.benih}: ${daftarSingkat(akhir.items)}.`,
          akhir.items.map((_, i) => i),
        ),
      ]);
    }

    case "kosongkan": {
      const akhir: ArrayLabState = { ...state, items: [], ranges: [] };
      const narasi =
        n === 0
          ? "Array sudah kosong, tidak ada elemen yang perlu dihapus."
          : `Seluruh ${n} elemen dihapus, panjang array kini 0.`;
      return berhasil([langkah(akhir, narasi)]);
    }

    case "push": {
      const value = nilaiBersih(op.nilai);
      if (value === null) return gagal(GALAT_NILAI);
      if (n >= LAB_MAX_ITEMS) return gagal(galatPenuh());

      const akhir = sisipElemen(state, n, value);
      return berhasil([
        langkah(akhir, `Elemen ${value} ditambahkan di akhir, panjang array kini ${n + 1}.`, [n]),
      ]);
    }

    case "pop": {
      if (n === 0) return gagal("Array masih kosong, tidak ada elemen yang bisa diambil dari akhir.");

      const value = state.items[n - 1].value;
      const akhir = hapusElemen(state, n - 1);

      return berhasil([
        langkah(
          denganSorotan(state, { from: n - 1, to: n - 1, tone: "buang" }),
          `Elemen terakhir ${value} di indeks ${n - 1} ditandai untuk diambil.`,
          [n - 1],
        ),
        langkah(akhir, `Elemen ${value} diambil dari akhir, panjang array kini ${n - 1}.`),
      ]);
    }

    case "unshift": {
      const value = nilaiBersih(op.nilai);
      if (value === null) return gagal(GALAT_NILAI);
      if (n >= LAB_MAX_ITEMS) return gagal(galatPenuh());

      const akhir = sisipElemen(state, 0, value);
      const narasi =
        n === 0
          ? `Elemen ${value} menjadi elemen pertama array.`
          : `Elemen ${value} disisipkan di awal, dan ${n} elemen lama bergeser satu petak ke kanan.`;

      return berhasil([langkah(akhir, narasi, [0])]);
    }

    case "shift": {
      if (n === 0) return gagal("Array masih kosong, tidak ada elemen yang bisa diambil dari awal.");

      const value = state.items[0].value;
      const akhir = hapusElemen(state, 0);
      const narasi =
        n === 1
          ? `Elemen ${value} diambil dari awal, panjang array kini 0.`
          : `Elemen ${value} diambil dari awal, dan ${n - 1} elemen sisanya bergeser satu petak ke kiri.`;

      return berhasil([
        langkah(
          denganSorotan(state, { from: 0, to: 0, tone: "buang" }),
          `Elemen pertama ${value} di indeks 0 ditandai untuk diambil.`,
          [0],
        ),
        langkah(akhir, narasi),
      ]);
    }

    case "bacaIndeks": {
      const galat = galatIndeksElemen(state, op.indeks, "Indeks");
      if (galat) return gagal(galat);

      const item = state.items[op.indeks];
      // Sorotannya DIBIARKAN menetap: membaca satu indeks adalah langkah yang
      // ingin dilihat berdampingan dengan langkah sesudahnya, bukan kilatan.
      const akhir = denganSorotan(state, { from: op.indeks, to: op.indeks, tone: "sorot" });

      return berhasil([
        langkah(akhir, `Nilai di indeks ${op.indeks} dibaca, isinya ${item.value}.`, [op.indeks]),
      ]);
    }

    case "setIndeks": {
      const galat = galatIndeksElemen(state, op.indeks, "Indeks");
      if (galat) return gagal(galat);

      const value = nilaiBersih(op.nilai);
      if (value === null) return gagal(GALAT_NILAI);

      const lama = state.items[op.indeks].value;
      // Id sel DIPERTAHANKAN: yang berubah isi petaknya, bukan petaknya, jadi
      // papan memudarkan nilainya di tempat alih-alih menerbangkan sel baru.
      const items = state.items.map((it, i) => (i === op.indeks ? { ...it, value } : it));
      const akhir: ArrayLabState = { ...state, items };

      return berhasil([
        langkah(
          denganSorotan(state, { from: op.indeks, to: op.indeks, tone: "sorot" }),
          `Indeks ${op.indeks} yang berisi ${lama} disiapkan untuk ditimpa.`,
          [op.indeks],
        ),
        langkah(akhir, `Nilai di indeks ${op.indeks} diubah dari ${lama} menjadi ${value}.`, [
          op.indeks,
        ]),
      ]);
    }

    case "sisip": {
      // Jangkauan sisip adalah 0..n, satu lebih panjang dari indeks elemen:
      // menyisipkan "sebelum elemen ke-n" berarti menaruhnya di akhir, dan
      // melarang itu membuat `sisip` tidak bisa dipakai menggantikan `push`.
      if (!Number.isInteger(op.indeks) || op.indeks < 0 || op.indeks > n) {
        return gagal(`Indeks sisip ${op.indeks} di luar jangkauan; pilih 0 sampai ${n}.`);
      }

      const value = nilaiBersih(op.nilai);
      if (value === null) return gagal(GALAT_NILAI);
      if (n >= LAB_MAX_ITEMS) return gagal(galatPenuh());

      const akhir = sisipElemen(state, op.indeks, value);
      const sesudahnya = n - op.indeks;
      const narasi =
        sesudahnya === 0
          ? `Elemen ${value} disisipkan di indeks ${op.indeks}, tepat di akhir array.`
          : `Elemen ${value} disisipkan di indeks ${op.indeks}, dan ${sesudahnya} elemen sesudahnya bergeser satu petak ke kanan.`;

      return berhasil([langkah(akhir, narasi, [op.indeks])]);
    }

    case "hapus": {
      const galat = galatIndeksElemen(state, op.indeks, "Indeks");
      if (galat) return gagal(galat);

      const value = state.items[op.indeks].value;
      const akhir = hapusElemen(state, op.indeks);
      const sesudahnya = n - 1 - op.indeks;
      const narasi =
        sesudahnya === 0
          ? `Elemen ${value} di indeks ${op.indeks} dihapus, panjang array kini ${n - 1}.`
          : `Elemen ${value} di indeks ${op.indeks} dihapus, dan ${sesudahnya} elemen sesudahnya bergeser satu petak ke kiri.`;

      return berhasil([
        langkah(
          denganSorotan(state, { from: op.indeks, to: op.indeks, tone: "buang" }),
          `Elemen ${value} di indeks ${op.indeks} ditandai untuk dihapus.`,
          [op.indeks],
        ),
        langkah(akhir, narasi),
      ]);
    }

    case "tukar": {
      const galatA = galatIndeksElemen(state, op.a, "Indeks pertama");
      if (galatA) return gagal(galatA);
      const galatB = galatIndeksElemen(state, op.b, "Indeks kedua");
      if (galatB) return gagal(galatB);

      // Menukar satu indeks dengan dirinya sendiri BUKAN galat: kasus itu
      // benar-benar muncul di dalam loop sorting, dan pesan galat di situ akan
      // membuat murid mengira algoritmanya yang salah.
      if (op.a === op.b) {
        return berhasil([
          langkah(
            state,
            `Indeks ${op.a} ditukar dengan dirinya sendiri, jadi tidak ada yang berubah.`,
            [op.a],
          ),
        ]);
      }

      const va = state.items[op.a].value;
      const vb = state.items[op.b].value;
      const kiri = Math.min(op.a, op.b);
      const kanan = Math.max(op.a, op.b);

      return berhasil([
        langkah(
          denganSorotan(state, { from: kiri, to: kanan, tone: "banding" }),
          `Elemen di indeks ${op.a} (${va}) dan indeks ${op.b} (${vb}) disiapkan untuk ditukar.`,
          [op.a, op.b],
        ),
        langkah(
          tukarElemen(state, op.a, op.b),
          `Elemen ${va} kini berada di indeks ${op.b} dan elemen ${vb} kini berada di indeks ${op.a}.`,
          [op.a, op.b],
        ),
      ]);
    }

    case "balik": {
      if (n < 2) {
        return berhasil([
          langkah(state, `Array berisi ${n} elemen, jadi membaliknya tidak mengubah apa pun.`),
        ]);
      }

      const jumlahTukar = Math.floor(n / 2);
      const steps: ArrayStep[] = [
        langkah(
          state,
          `Array dibalik dengan menukar pasangan elemen dari kedua ujung, sebanyak ${jumlahTukar} kali tukar.`,
        ),
      ];

      let berjalan = state;
      for (let a = 0, b = n - 1; a < b; a += 1, b -= 1) {
        const va = berjalan.items[a].value;
        const vb = berjalan.items[b].value;
        berjalan = tukarElemen(berjalan, a, b);
        steps.push(
          langkah(
            denganSorotan(berjalan, { from: a, to: b, tone: "banding" }),
            `Elemen ${va} di indeks ${a} ditukar dengan elemen ${vb} di indeks ${b}.`,
            [a, b],
          ),
        );
      }

      // Sorotan sementara dikembalikan ke sorotan milik pengguna di langkah
      // penutup, supaya keadaan akhir tidak menyimpan sisa pembukuan animasi.
      const akhir: ArrayLabState = { ...berjalan, ranges: state.ranges };
      steps.push(langkah(akhir, `Array selesai dibalik, isinya kini ${daftarSingkat(akhir.items)}.`));

      return berhasil(steps);
    }

    case "slice": {
      const galatDari = galatIndeksElemen(state, op.dari, "Indeks awal");
      if (galatDari) return gagal(galatDari);
      const galatSampai = galatIndeksElemen(state, op.sampai, "Indeks akhir");
      if (galatSampai) return gagal(galatSampai);

      if (op.dari > op.sampai) {
        return gagal(`Indeks awal ${op.dari} tidak boleh lebih besar dari indeks akhir ${op.sampai}.`);
      }

      // INKLUSIF di kedua ujung, berbeda dari Array.prototype.slice. Alasannya
      // ada pada LabRange di labTypes.ts; label form berbunyi "sampai
      // (termasuk)" supaya tidak ada yang perlu menebak.
      const akhir = potongElemen(state, op.dari, op.sampai);
      const jumlah = op.sampai - op.dari + 1;

      return berhasil([
        langkah(
          denganSorotan(state, { from: op.dari, to: op.sampai, tone: "hasil" }),
          `Rentang indeks ${op.dari} sampai ${op.sampai} dipilih, berisi ${jumlah} elemen.`,
          [op.dari, op.sampai],
        ),
        langkah(
          akhir,
          `Array dipotong menjadi ${jumlah} elemen, yaitu ${daftarSingkat(akhir.items)}, dan indeksnya dihitung ulang dari 0.`,
        ),
      ]);
    }

    case "setPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      if (!LAB_POINTER_NAME_RE.test(nama)) return gagal(GALAT_NAMA_PENUNJUK);
      if (!isLabPointerTone(op.tone)) return gagal("Nada penunjuk tidak dikenal.");

      const galat = galatIndeksPenunjuk(state, op.indeks);
      if (galat) return gagal(galat);

      const posisi = state.pointers.findIndex((p) => p.name === nama);
      if (posisi < 0 && state.pointers.length >= LAB_MAX_POINTERS) {
        return gagal(`Maksimal ${LAB_MAX_POINTERS} penunjuk di papan; lepas salah satunya dulu.`);
      }

      const penunjuk: LabPointer = { name: nama, index: op.indeks, tone: op.tone };
      // Nama yang sama MENIMPA penunjuk lama, tidak menambah entri kedua: dua
      // penunjuk `i` di dua indeks berbeda adalah papan yang mengajarkan hal
      // yang salah tentang apa itu variabel.
      const pointers =
        posisi >= 0
          ? state.pointers.map((p, k) => (k === posisi ? penunjuk : p))
          : [...state.pointers, penunjuk];

      const akhir: ArrayLabState = { ...state, pointers };
      const narasi =
        op.indeks === n && n > 0
          ? `Penunjuk ${nama} dipasang di indeks ${op.indeks}, posisi lepas sesudah elemen terakhir.`
          : `Penunjuk ${nama} dipasang di indeks ${op.indeks}.`;

      return berhasil([langkah(akhir, narasi, [op.indeks])]);
    }

    case "geserPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      const posisi = state.pointers.findIndex((p) => p.name === nama);
      if (posisi < 0) return gagal(`Penunjuk ${nama || "itu"} belum dipasang di papan.`);
      if (!Number.isInteger(op.delta)) return gagal("Besar geseran harus bilangan bulat.");

      const lama = state.pointers[posisi].index;
      const baru = lama + op.delta;

      if (baru < 0 || baru > n) {
        return gagal(
          `Penunjuk ${nama} tidak bisa digeser ke indeks ${baru}; batasnya 0 sampai ${n}.`,
        );
      }

      if (op.delta === 0) {
        return berhasil([langkah(state, `Penunjuk ${nama} tetap di indeks ${lama}.`, [lama])]);
      }

      const pointers = state.pointers.map((p, k) => (k === posisi ? { ...p, index: baru } : p));
      const akhir: ArrayLabState = { ...state, pointers };
      const lepas = baru === n && n > 0 ? ", posisi lepas sesudah elemen terakhir" : "";

      return berhasil([
        langkah(akhir, `Penunjuk ${nama} bergeser dari indeks ${lama} ke indeks ${baru}${lepas}.`, [
          lama,
          baru,
        ]),
      ]);
    }

    case "hapusPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      const posisi = state.pointers.findIndex((p) => p.name === nama);
      if (posisi < 0) return gagal(`Penunjuk ${nama || "itu"} belum dipasang di papan.`);

      const akhir: ArrayLabState = {
        ...state,
        pointers: state.pointers.filter((_, k) => k !== posisi),
      };
      return berhasil([langkah(akhir, `Penunjuk ${nama} dilepas dari papan.`)]);
    }

    case "sorotRentang": {
      const galatDari = galatIndeksElemen(state, op.dari, "Indeks awal");
      if (galatDari) return gagal(galatDari);
      const galatSampai = galatIndeksElemen(state, op.sampai, "Indeks akhir");
      if (galatSampai) return gagal(galatSampai);

      if (op.dari > op.sampai) {
        return gagal(`Indeks awal ${op.dari} tidak boleh lebih besar dari indeks akhir ${op.sampai}.`);
      }
      if (!isLabTone(op.tone)) return gagal("Nada sorotan tidak dikenal.");

      const rentang: LabRange = { from: op.dari, to: op.sampai, tone: op.tone };
      // Menyorot ulang rentang yang sama hanya mengganti nadanya, jadi tidak
      // dihitung sebagai sorotan baru saat jatahnya sudah penuh.
      const sudahAda = state.ranges.some((r) => r.from === rentang.from && r.to === rentang.to);
      if (!sudahAda && state.ranges.length >= LAB_MAX_RANGES) {
        return gagal(`Maksimal ${LAB_MAX_RANGES} sorotan di papan; hapus sorotan dulu.`);
      }

      const akhir: ArrayLabState = { ...state, ranges: tambahRentang(state.ranges, rentang) };
      const jumlah = op.sampai - op.dari + 1;

      return berhasil([
        langkah(
          akhir,
          `Rentang indeks ${op.dari} sampai ${op.sampai} yang berisi ${jumlah} elemen disorot.`,
          [op.dari, op.sampai],
        ),
      ]);
    }

    case "hapusSorotan": {
      const jumlah = state.ranges.length;
      const akhir: ArrayLabState = { ...state, ranges: [] };
      const narasi =
        jumlah === 0
          ? "Tidak ada sorotan di papan, jadi tidak ada yang dihapus."
          : `${jumlah} sorotan dihapus dari papan.`;
      return berhasil([langkah(akhir, narasi)]);
    }

    case "catat": {
      const galat = galatIndeksElemen(state, op.indeks, "Indeks");
      if (galat) return gagal(galat);

      // Catatan kosong berarti MELEPAS catatan, bukan galat: tanpa ini tidak
      // ada cara membatalkan catatan yang salah tempel selain menghapus elemennya.
      const catatan = cleanLabText(op.catatan);
      if (catatan.length > 0 && !LAB_NOTE_RE.test(catatan)) return gagal(GALAT_CATATAN);

      const note = catatan.length > 0 ? catatan : null;
      const items = state.items.map((it, i) => (i === op.indeks ? { ...it, note } : it));
      const akhir: ArrayLabState = { ...state, items };
      const narasi =
        note === null
          ? `Catatan di indeks ${op.indeks} dihapus.`
          : `Catatan "${note}" ditempel di indeks ${op.indeks}.`;

      return berhasil([langkah(akhir, narasi, [op.indeks])]);
    }

    case "bubbleSort":
    case "selectionSort":
    case "insertionSort":
    case "mergeSort":
    case "quickSort":
      return urutkanArray(state, op);

    default: {
      // Operasi baru yang lupa ditangani menjadi galat TIPE di sini, bukan
      // papan yang diam-diam tidak bereaksi saat tombolnya ditekan.
      const _lengkap: never = op;
      throw new Error(`applyArrayOp: operasi tidak dikenal (${JSON.stringify(_lengkap)}).`);
    }
  }
}

/**
 * Pengurutan 1D: satu deret, slot = indeks. Sorotan pengguna disembunyikan
 * selama animasi (warnanya akan bertabrakan dengan warna peran) dan kembali
 * di langkah terakhir; penunjuk tetap di indeksnya.
 */
function urutkanArray(state: ArrayLabState, op: { kind: KindUrut; arah: ArahUrut }): ArrayOpResult {
  const n = state.items.length;
  if (n === 0) return { ok: false, error: "Array masih kosong, tidak ada yang bisa diurutkan." };
  if (!isArahUrut(op.arah)) return { ok: false, error: "Arah pengurutan harus naik atau turun." };
  const susun = (pen: ReadonlyMap<number, number>) => state.items.map((_, p) => state.items[pen.get(p) ?? p]);
  const { steps } = langkahUrut<ArrayLabState>({
    kind: op.kind,
    arah: op.arah,
    deret: [{ posisi: state.items.map((_, i) => i), awalan: "" }],
    nilaiDi: (p) => state.items[p].value,
    idDi: (p) => state.items[p].id,
    nama: (p) => `indeks ${p}`,
    bingkai: (pen) => settleMarkers({ ...state, items: susun(pen), ranges: [] }),
    akhir: (pen) => settleMarkers({ ...state, items: susun(pen) }),
    pembuka: `${n} elemen akan diurutkan. Ikuti warna dan label kecil di atas sel; legendanya ada di atas papan.`,
  });
  if (steps.length > LAB_MAX_STEPS_URUT) return { ok: false, error: galatTerlaluPanjang(op.kind, steps.length, LAB_MAX_STEPS_URUT) };
  return { ok: true, steps };
}
