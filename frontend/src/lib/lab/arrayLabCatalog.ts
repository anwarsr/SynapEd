/**
 * Katalog operasi lab array: deskripsi setiap operasi, lengkap dengan form yang
 * dibutuhkannya.
 *
 * Panel kontrol di papan DIBANGUN dari katalog ini, tidak ditulis tangan satu
 * per satu. Alasannya bukan kerapian: panel yang ditulis tangan adalah daftar
 * kedua yang harus diingat saat operasi baru ditambahkan, dan yang terlupa
 * selalu panelnya — operasinya ada, tombolnya tidak. Dengan
 * `Record<ArrayOp["kind"], OpSpec>` operasi yang belum didaftarkan menjadi
 * galat TIPE, jadi lupanya ketahuan saat `tsc`, bukan dari laporan pengguna.
 *
 * Modul NETRAL tanpa impor alias `@/`: ia dipakai komponen klien, dan sekalipun
 * isinya cuma teks, satu impor `@/lib/firebase/...` dari sini akan menyeret
 * firebase-admin ke bundel browser.
 */
import {
  isLabPointerTone,
  isLabTone,
  LAB_MAX_ITEMS,
  LAB_MAX_ITEM_CHARS,
  LAB_MAX_NOTE_CHARS,
} from "./labTypes";
import { LAB_MAX_RANDOM_VALUE, type ArrayOp } from "./arrayLab";
import { formAngka, formTeks, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";

/** Pengelompokan tombol di panel kontrol. */
export type OpGrup = "isi" | "ujung" | "indeks" | "susun" | "penanda";

// Bentuk kolom & spesifikasi dipakai bersama semua lab (lihat labForm.ts);
// nama lamanya tetap diekspor supaya pemakai lab 1D tidak perlu berubah.
export type { OpField };
export type OpSpec = OpSpecOf<ArrayOp["kind"], OpGrup, ArrayOp>;

export const ARRAY_OP_GROUPS: readonly { id: OpGrup; label: string }[] = [
  { id: "isi", label: "Isi array" },
  { id: "ujung", label: "Ujung array" },
  { id: "indeks", label: "Lewat indeks" },
  { id: "susun", label: "Susun ulang" },
  { id: "penanda", label: "Penunjuk & sorotan" },
];

/** Panjang maksimal kolom teks isi: cukup untuk 24 nilai beserta pemisahnya. */
const MAKS_TEKS_ISI = LAB_MAX_ITEMS * (LAB_MAX_ITEM_CHARS + 2);

const F_NILAI: OpField = {
  name: "nilai",
  label: "Nilai",
  kind: "teks",
  placeholder: "7",
  maxLength: LAB_MAX_ITEM_CHARS,
};

function fIndeksElemen(name: string, label: string): OpField {
  return { name, label, kind: "angka", placeholder: "0", min: 0, max: LAB_MAX_ITEMS - 1 };
}

const F_NAMA_PENUNJUK: OpField = {
  name: "nama",
  label: "Nama penunjuk",
  kind: "penunjukNama",
  placeholder: "i",
  maxLength: 6,
};

export const ARRAY_OP_CATALOG: Record<ArrayOp["kind"], OpSpec> = {
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi dari teks",
    grup: "isi",
    ringkas: "Mengganti seluruh isi array dengan nilai yang dipisah koma atau spasi.",
    fields: [
      {
        name: "teks",
        label: "Nilai, dipisah koma atau spasi",
        kind: "teks",
        placeholder: "5, 3, 8, 1",
        maxLength: MAKS_TEKS_ISI,
      },
    ],
    contoh: { kind: "isiDariTeks", teks: "5, 3, 8, 1" },
  },

  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "isi",
    ringkas: "Mengisi array dengan angka acak yang selalu sama untuk benih yang sama.",
    fields: [
      { name: "panjang", label: "Jumlah elemen", kind: "angka", placeholder: "8", min: 1, max: LAB_MAX_ITEMS },
      { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "99", min: 1, max: LAB_MAX_RANDOM_VALUE },
      { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0, max: LAB_MAX_RANDOM_VALUE },
    ],
    contoh: { kind: "acak", panjang: 8, maks: 99, benih: 42 },
  },

  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan array",
    grup: "isi",
    ringkas: "Menghapus semua elemen sehingga panjang array menjadi 0.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },

  push: {
    kind: "push",
    label: "Tambah di akhir (push)",
    grup: "ujung",
    ringkas: "Menambahkan satu elemen sesudah elemen terakhir tanpa menggeser yang lain.",
    fields: [F_NILAI],
    contoh: { kind: "push", nilai: "7" },
  },

  pop: {
    kind: "pop",
    label: "Ambil dari akhir (pop)",
    grup: "ujung",
    ringkas: "Mengambil elemen terakhir; elemen lain tidak bergeser sama sekali.",
    fields: [],
    contoh: { kind: "pop" },
  },

  unshift: {
    kind: "unshift",
    label: "Tambah di awal (unshift)",
    grup: "ujung",
    ringkas: "Menyisipkan satu elemen di indeks 0; semua elemen lama bergeser ke kanan.",
    fields: [F_NILAI],
    contoh: { kind: "unshift", nilai: "7" },
  },

  shift: {
    kind: "shift",
    label: "Ambil dari awal (shift)",
    grup: "ujung",
    ringkas: "Mengambil elemen pertama; semua elemen sisanya bergeser ke kiri.",
    fields: [],
    contoh: { kind: "shift" },
  },

  bacaIndeks: {
    kind: "bacaIndeks",
    label: "Baca satu indeks",
    grup: "indeks",
    ringkas: "Menyorot satu indeks dan membacakan nilainya tanpa mengubah array.",
    fields: [fIndeksElemen("indeks", "Indeks")],
    contoh: { kind: "bacaIndeks", indeks: 0 },
  },

  setIndeks: {
    kind: "setIndeks",
    label: "Timpa satu indeks",
    grup: "indeks",
    ringkas: "Mengganti nilai di satu indeks; panjang array tidak berubah.",
    fields: [fIndeksElemen("indeks", "Indeks"), F_NILAI],
    contoh: { kind: "setIndeks", indeks: 0, nilai: "7" },
  },

  sisip: {
    kind: "sisip",
    label: "Sisipkan di indeks",
    grup: "indeks",
    ringkas: "Menyisipkan elemen pada satu indeks; elemen sesudahnya bergeser ke kanan.",
    fields: [
      // Jangkauannya 0..n, satu lebih panjang dari indeks elemen, karena
      // menyisipkan di indeks n berarti menaruh elemen tepat di akhir.
      { name: "indeks", label: "Indeks", kind: "angka", placeholder: "1", min: 0, max: LAB_MAX_ITEMS },
      F_NILAI,
    ],
    contoh: { kind: "sisip", indeks: 1, nilai: "7" },
  },

  hapus: {
    kind: "hapus",
    label: "Hapus di indeks",
    grup: "indeks",
    ringkas: "Menghapus elemen di satu indeks; elemen sesudahnya bergeser ke kiri.",
    fields: [fIndeksElemen("indeks", "Indeks")],
    contoh: { kind: "hapus", indeks: 1 },
  },

  catat: {
    kind: "catat",
    label: "Tempel catatan",
    grup: "indeks",
    ringkas: "Menempelkan catatan pendek di bawah satu elemen; kosongkan untuk melepasnya.",
    fields: [
      fIndeksElemen("indeks", "Indeks"),
      {
        name: "catatan",
        label: "Catatan (kosongkan untuk melepas)",
        kind: "teks",
        placeholder: "pivot",
        maxLength: LAB_MAX_NOTE_CHARS,
      },
    ],
    contoh: { kind: "catat", indeks: 0, catatan: "pivot" },
  },

  tukar: {
    kind: "tukar",
    label: "Tukar dua elemen",
    grup: "susun",
    ringkas: "Menukar isi dua indeks; dua indeks yang sama dibolehkan dan tidak mengubah apa pun.",
    fields: [fIndeksElemen("a", "Indeks pertama"), fIndeksElemen("b", "Indeks kedua")],
    contoh: { kind: "tukar", a: 0, b: 1 },
  },

  balik: {
    kind: "balik",
    label: "Balik array",
    grup: "susun",
    ringkas: "Membalik urutan dengan menukar pasangan elemen dari kedua ujung, satu per satu.",
    fields: [],
    contoh: { kind: "balik" },
  },

  slice: {
    kind: "slice",
    label: "Potong rentang (slice)",
    grup: "susun",
    ringkas: "Menyisakan elemen pada rentang indeks tertentu; kedua ujungnya termasuk.",
    fields: [
      fIndeksElemen("dari", "Dari indeks"),
      // Label berbunyi "termasuk" karena rentang di lab ini INKLUSIF, berbeda
      // dari Array.prototype.slice — tanpa label ini pasti ada yang keliru.
      { name: "sampai", label: "Sampai indeks (termasuk)", kind: "angka", placeholder: "2", min: 0, max: LAB_MAX_ITEMS - 1 },
    ],
    contoh: { kind: "slice", dari: 0, sampai: 2 },
  },

  setPenunjuk: {
    kind: "setPenunjuk",
    label: "Pasang penunjuk",
    grup: "penanda",
    ringkas: "Memasang penunjuk bernama di satu indeks; nama yang sama menimpa penunjuk lama.",
    fields: [
      F_NAMA_PENUNJUK,
      // Sampai LAB_MAX_ITEMS, bukan LAB_MAX_ITEMS-1: penunjuk boleh berdiri di
      // slot lepas sesudah elemen terakhir, tempat `i` berhenti saat `i < n` habis.
      { name: "indeks", label: "Indeks", kind: "angka", placeholder: "0", min: 0, max: LAB_MAX_ITEMS },
      { name: "tone", label: "Warna penunjuk", kind: "penunjukNada" },
    ],
    contoh: { kind: "setPenunjuk", nama: "i", indeks: 0, tone: "utama" },
  },

  geserPenunjuk: {
    kind: "geserPenunjuk",
    label: "Geser penunjuk",
    grup: "penanda",
    ringkas: "Menggeser penunjuk yang sudah ada sejauh beberapa petak ke kanan atau ke kiri.",
    fields: [
      F_NAMA_PENUNJUK,
      {
        name: "delta",
        label: "Geser sejauh (boleh negatif)",
        kind: "angka",
        placeholder: "1",
        min: -LAB_MAX_ITEMS,
        max: LAB_MAX_ITEMS,
      },
    ],
    contoh: { kind: "geserPenunjuk", nama: "i", delta: 1 },
  },

  hapusPenunjuk: {
    kind: "hapusPenunjuk",
    label: "Lepas penunjuk",
    grup: "penanda",
    ringkas: "Melepas satu penunjuk bernama dari papan.",
    fields: [F_NAMA_PENUNJUK],
    contoh: { kind: "hapusPenunjuk", nama: "i" },
  },

  sorotRentang: {
    kind: "sorotRentang",
    label: "Sorot rentang",
    grup: "penanda",
    ringkas: "Menyorot rentang indeks dengan satu nada warna; kedua ujungnya termasuk.",
    fields: [
      fIndeksElemen("dari", "Dari indeks"),
      { name: "sampai", label: "Sampai indeks (termasuk)", kind: "angka", placeholder: "2", min: 0, max: LAB_MAX_ITEMS - 1 },
      { name: "tone", label: "Nada sorotan", kind: "nada" },
    ],
    contoh: { kind: "sorotRentang", dari: 0, sampai: 2, tone: "sorot" },
  },

  hapusSorotan: {
    kind: "hapusSorotan",
    label: "Hapus semua sorotan",
    grup: "penanda",
    ringkas: "Membersihkan seluruh sorotan rentang dari papan.",
    fields: [],
    contoh: { kind: "hapusSorotan" },
  },
};

const angka = formAngka;
const teks = formTeks;
const teksWajib = formTeksWajib;

/**
 * Menyusun `ArrayOp` dari nilai form (yang semuanya string).
 *
 * Mengembalikan null hanya untuk masalah BENTUK: kolom wajib yang kosong,
 * angka yang bukan bilangan bulat, atau nada yang tidak dikenal (tipe
 * `ArrayOp` menuntut nada yang sah, jadi itu bentuk, bukan domain). Semua
 * penolakan lain beserta kalimat galatnya ditinggalkan untuk `applyArrayOp`.
 */
export function buildArrayOp(kind: ArrayOp["kind"], nilai: Record<string, string>): ArrayOp | null {
  switch (kind) {
    case "isiDariTeks": {
      const t = teksWajib(nilai, "teks");
      return t === null ? null : { kind, teks: t };
    }

    case "acak": {
      const panjang = angka(nilai, "panjang");
      const maks = angka(nilai, "maks");
      const benih = angka(nilai, "benih");
      if (panjang === null || maks === null || benih === null) return null;
      return { kind, panjang, maks, benih };
    }

    case "kosongkan":
    case "pop":
    case "shift":
    case "balik":
    case "hapusSorotan":
      return { kind };

    case "push":
    case "unshift": {
      const n = teksWajib(nilai, "nilai");
      return n === null ? null : { kind, nilai: n };
    }

    case "bacaIndeks":
    case "hapus": {
      const indeks = angka(nilai, "indeks");
      return indeks === null ? null : { kind, indeks };
    }

    case "setIndeks":
    case "sisip": {
      const indeks = angka(nilai, "indeks");
      const n = teksWajib(nilai, "nilai");
      if (indeks === null || n === null) return null;
      return { kind, indeks, nilai: n };
    }

    case "tukar": {
      const a = angka(nilai, "a");
      const b = angka(nilai, "b");
      if (a === null || b === null) return null;
      return { kind, a, b };
    }

    case "slice": {
      const dari = angka(nilai, "dari");
      const sampai = angka(nilai, "sampai");
      if (dari === null || sampai === null) return null;
      return { kind, dari, sampai };
    }

    case "setPenunjuk": {
      const nama = teksWajib(nilai, "nama");
      const indeks = angka(nilai, "indeks");
      const tone = teks(nilai, "tone");
      if (nama === null || indeks === null || !isLabPointerTone(tone)) return null;
      return { kind, nama, indeks, tone };
    }

    case "geserPenunjuk": {
      const nama = teksWajib(nilai, "nama");
      const delta = angka(nilai, "delta");
      if (nama === null || delta === null) return null;
      return { kind, nama, delta };
    }

    case "hapusPenunjuk": {
      const nama = teksWajib(nilai, "nama");
      return nama === null ? null : { kind, nama };
    }

    case "sorotRentang": {
      const dari = angka(nilai, "dari");
      const sampai = angka(nilai, "sampai");
      const tone = teks(nilai, "tone");
      if (dari === null || sampai === null || !isLabTone(tone)) return null;
      return { kind, dari, sampai, tone };
    }

    case "catat": {
      const indeks = angka(nilai, "indeks");
      if (indeks === null) return null;
      // Catatan kosong SAH di sini: itulah cara melepas catatan yang sudah
      // tertempel, jadi kolomnya tidak boleh diperlakukan sebagai wajib.
      return { kind, indeks, catatan: teks(nilai, "catatan") };
    }

    default: {
      // Operasi baru yang lupa didaftarkan di sini menjadi galat tipe, sepasang
      // dengan penjaga serupa di `applyArrayOp`.
      const _lengkap: never = kind;
      throw new Error(`buildArrayOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
