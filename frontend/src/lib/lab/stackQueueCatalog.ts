/**
 * Katalog operasi Lab Stack dan Lab Queue — panel kontrol dibangun dari sini.
 *
 * `Record<Op["kind"], …>` membuat operasi yang lupa didaftarkan menjadi galat
 * TIPE. Isian dari formulir hanya diperiksa BENTUKNYA di sini; arti dan
 * batasnya urusan reducer.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { formAngka, formTeks, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";
import { ADT_KAPASITAS_AWAL, ADT_MAX_KAPASITAS, ADT_MAX_MASUKAN, ADT_MIN_KAPASITAS } from "./adtBersama";
import { LAB_MAX_ITEM_CHARS } from "./labTypes";
import type { StackOp } from "./stackLab";
import type { QueueOp } from "./queueLab";

export type AdtOpGrup = "isi" | "operasi" | "penerapan";

export const ADT_OP_GROUPS: readonly { id: AdtOpGrup; label: string }[] = [
  { id: "isi", label: "Isi & ukuran" },
  { id: "operasi", label: "Operasi dasar" },
  { id: "penerapan", label: "Contoh penerapan" },
];

const F_NILAI: OpField = { name: "nilai", label: "Nilai", kind: "teks", placeholder: "7", maxLength: LAB_MAX_ITEM_CHARS };
const F_KAPASITAS: OpField = { name: "kapasitas", label: "MaxSize", kind: "angka", placeholder: String(ADT_KAPASITAS_AWAL), min: ADT_MIN_KAPASITAS, max: ADT_MAX_KAPASITAS };
const F_ISI: OpField = { name: "teks", label: "Nilai", kind: "teks", placeholder: "12, 7, 9", maxLength: ADT_MAX_KAPASITAS * (LAB_MAX_ITEM_CHARS + 2) };
const F_ACAK: OpField[] = [
  { name: "panjang", label: "Banyaknya", kind: "angka", placeholder: "4", min: 1, max: ADT_MAX_KAPASITAS },
  { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "99", min: 1, max: 999 },
  { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0 },
];

// ── Stack ────────────────────────────────────────────────────────────────

export type StackOpSpec = OpSpecOf<StackOp["kind"], AdtOpGrup, StackOp>;

export const STACK_OP_CATALOG: Record<StackOp["kind"], StackOpSpec> = {
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi stack",
    grup: "isi",
    ringkas: "Nilai dipisah koma atau spasi; yang pertama paling bawah, yang terakhir di puncak.",
    fields: [F_ISI],
    contoh: { kind: "isiDariTeks", teks: "12, 7, 9" },
  },
  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "isi",
    ringkas: "Stack berisi angka acak. Benih yang sama selalu menghasilkan isi yang sama.",
    fields: F_ACAK,
    contoh: { kind: "acak", panjang: 4, maks: 99, benih: 42 },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan",
    grup: "isi",
    ringkas: "TopPointer ← -1. Nilai lama tetap tertinggal di memori sampai ditimpa.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },
  kapasitas: {
    kind: "kapasitas",
    label: "Ubah kapasitas",
    grup: "isi",
    ringkas: `Ukuran array (MaxSize), ${ADT_MIN_KAPASITAS} sampai ${ADT_MAX_KAPASITAS}.`,
    fields: [F_KAPASITAS],
    contoh: { kind: "kapasitas", kapasitas: 8 },
  },
  push: {
    kind: "push",
    label: "Push",
    grup: "operasi",
    ringkas: "Naikkan TopPointer, lalu tulis nilai di puncak. Gagal (overflow) bila stack penuh.",
    fields: [F_NILAI],
    contoh: { kind: "push", nilai: "5" },
  },
  pop: {
    kind: "pop",
    label: "Pop",
    grup: "operasi",
    ringkas: "Ambil nilai di puncak, lalu turunkan TopPointer. Gagal (underflow) bila stack kosong.",
    fields: [],
    contoh: { kind: "pop" },
  },
  peek: {
    kind: "peek",
    label: "Peek",
    grup: "operasi",
    ringkas: "Lihat nilai di puncak tanpa mengeluarkannya.",
    fields: [],
    contoh: { kind: "peek" },
  },
  isEmpty: {
    kind: "isEmpty",
    label: "IsEmpty",
    grup: "operasi",
    ringkas: "TRUE bila TopPointer = -1.",
    fields: [],
    contoh: { kind: "isEmpty" },
  },
  isFull: {
    kind: "isFull",
    label: "IsFull",
    grup: "operasi",
    ringkas: "TRUE bila TopPointer = MaxSize - 1.",
    fields: [],
    contoh: { kind: "isFull" },
  },
  cekKurung: {
    kind: "cekKurung",
    label: "Cek kurung seimbang",
    grup: "penerapan",
    ringkas: "Kurung buka di-PUSH, kurung tutup mem-POP dan harus berpasangan. Seimbang bila stack kosong di akhir.",
    fields: [{ name: "teks", label: "Ekspresi", kind: "teks", placeholder: "{[(a+b)*c]}", maxLength: ADT_MAX_MASUKAN }],
    contoh: { kind: "cekKurung", teks: "{[(a+b)*c]}" },
  },
  balikKata: {
    kind: "balikKata",
    label: "Balik kata",
    grup: "penerapan",
    ringkas: "Setiap huruf di-PUSH, lalu di-POP satu per satu: urutannya terbalik.",
    fields: [{ name: "kata", label: "Kata", kind: "teks", placeholder: "KASUR", maxLength: ADT_MAX_KAPASITAS }],
    contoh: { kind: "balikKata", kata: "KASUR" },
  },
  undo: {
    kind: "undo",
    label: "Riwayat & undo",
    grup: "penerapan",
    ringkas: "Kata = diketik (PUSH), < = batalkan (POP kata terakhir). Dipisah spasi.",
    fields: [{ name: "kejadian", label: "Kejadian", kind: "teks", placeholder: "Saya suka kopi < teh", maxLength: ADT_MAX_MASUKAN * 7 }],
    contoh: { kind: "undo", kejadian: "Saya suka kopi < teh" },
  },
};

export function buildStackOp(kind: StackOp["kind"], nilai: Record<string, string>): StackOp | null {
  const angka = (n: string) => formAngka(nilai, n);
  switch (kind) {
    case "isiDariTeks":
    case "cekKurung": {
      const teks = formTeksWajib(nilai, "teks");
      return teks === null ? null : { kind, teks };
    }
    case "acak": {
      const panjang = angka("panjang");
      const maks = angka("maks");
      const benih = angka("benih");
      return panjang === null || maks === null || benih === null ? null : { kind, panjang, maks, benih };
    }
    case "kapasitas": {
      const kapasitas = angka("kapasitas");
      return kapasitas === null ? null : { kind, kapasitas };
    }
    case "push": {
      const v = formTeksWajib(nilai, "nilai");
      return v === null ? null : { kind, nilai: v };
    }
    case "balikKata": {
      const kata = formTeksWajib(nilai, "kata");
      return kata === null ? null : { kind, kata };
    }
    case "undo": {
      const kejadian = formTeksWajib(nilai, "kejadian");
      return kejadian === null ? null : { kind, kejadian };
    }
    case "kosongkan":
    case "pop":
    case "peek":
    case "isEmpty":
    case "isFull":
      return { kind };
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildStackOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}

// ── Queue ────────────────────────────────────────────────────────────────

export type QueueOpSpec = OpSpecOf<QueueOp["kind"], AdtOpGrup, QueueOp>;

export const QUEUE_OP_CATALOG: Record<QueueOp["kind"], QueueOpSpec> = {
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi queue",
    grup: "isi",
    ringkas: "Nilai dipisah koma atau spasi; yang pertama paling depan.",
    fields: [F_ISI],
    contoh: { kind: "isiDariTeks", teks: "12, 7, 9" },
  },
  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "isi",
    ringkas: "Queue berisi angka acak. Benih yang sama selalu menghasilkan isi yang sama.",
    fields: F_ACAK,
    contoh: { kind: "acak", panjang: 4, maks: 99, benih: 42 },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan",
    grup: "isi",
    ringkas: "FrontPointer ← 0, RearPointer ← -1, NumberInQueue ← 0.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },
  kapasitas: {
    kind: "kapasitas",
    label: "Ubah kapasitas",
    grup: "isi",
    ringkas: `Ukuran array (MaxSize), ${ADT_MIN_KAPASITAS} sampai ${ADT_MAX_KAPASITAS}. Isi disalin mulai indeks 0.`,
    fields: [F_KAPASITAS],
    contoh: { kind: "kapasitas", kapasitas: 8 },
  },
  jenis: {
    kind: "jenis",
    label: "Jenis queue",
    grup: "isi",
    ringkas: "Linear: penunjuk hanya maju. Melingkar: penunjuk kembali ke 0 setelah indeks terakhir.",
    fields: [
      {
        name: "jenis",
        label: "Jenis",
        kind: "pilihan",
        opsi: [
          { nilai: "melingkar", label: "Melingkar (circular)" },
          { nilai: "linear", label: "Linear" },
        ],
      },
    ],
    contoh: { kind: "jenis", jenis: "linear" },
  },
  enqueue: {
    kind: "enqueue",
    label: "Enqueue",
    grup: "operasi",
    ringkas: "Masuk di belakang: RearPointer maju, nilai ditulis, NumberInQueue bertambah.",
    fields: [F_NILAI],
    contoh: { kind: "enqueue", nilai: "5" },
  },
  dequeue: {
    kind: "dequeue",
    label: "Dequeue",
    grup: "operasi",
    ringkas: "Keluar dari depan: baca Queue[FrontPointer], FrontPointer maju, NumberInQueue berkurang.",
    fields: [],
    contoh: { kind: "dequeue" },
  },
  peek: {
    kind: "peek",
    label: "Peek",
    grup: "operasi",
    ringkas: "Lihat nilai paling depan tanpa mengeluarkannya.",
    fields: [],
    contoh: { kind: "peek" },
  },
  isEmpty: {
    kind: "isEmpty",
    label: "IsEmpty",
    grup: "operasi",
    ringkas: "TRUE bila NumberInQueue = 0.",
    fields: [],
    contoh: { kind: "isEmpty" },
  },
  isFull: {
    kind: "isFull",
    label: "IsFull",
    grup: "operasi",
    ringkas: "Linear: RearPointer = MaxSize - 1. Melingkar: NumberInQueue = MaxSize.",
    fields: [],
    contoh: { kind: "isFull" },
  },
  loket: {
    kind: "loket",
    label: "Antrean loket",
    grup: "penerapan",
    ringkas: "+Nama = pelanggan datang (ENQUEUE), - = loket melayani (DEQUEUE). Dipisah spasi.",
    fields: [{ name: "kejadian", label: "Kejadian", kind: "teks", placeholder: "+Ani +Budi - +Cici - -", maxLength: ADT_MAX_MASUKAN * 8 }],
    contoh: { kind: "loket", kejadian: "+Ani +Budi - +Cici - -" },
  },
  penuhSemu: {
    kind: "penuhSemu",
    label: "Kenapa linear bisa penuh?",
    grup: "penerapan",
    ringkas: "Isi sampai penuh, keluarkan dua, lalu masukkan satu lagi - bandingkan hasilnya di queue linear dan melingkar.",
    fields: [],
    contoh: { kind: "penuhSemu" },
  },
};

export function buildQueueOp(kind: QueueOp["kind"], nilai: Record<string, string>): QueueOp | null {
  const angka = (n: string) => formAngka(nilai, n);
  switch (kind) {
    case "isiDariTeks": {
      const teks = formTeksWajib(nilai, "teks");
      return teks === null ? null : { kind, teks };
    }
    case "acak": {
      const panjang = angka("panjang");
      const maks = angka("maks");
      const benih = angka("benih");
      return panjang === null || maks === null || benih === null ? null : { kind, panjang, maks, benih };
    }
    case "kapasitas": {
      const kapasitas = angka("kapasitas");
      return kapasitas === null ? null : { kind, kapasitas };
    }
    case "jenis": {
      const j = formTeks(nilai, "jenis") || "melingkar";
      return j === "linear" || j === "melingkar" ? { kind, jenis: j } : null;
    }
    case "enqueue": {
      const v = formTeksWajib(nilai, "nilai");
      return v === null ? null : { kind, nilai: v };
    }
    case "loket": {
      const kejadian = formTeksWajib(nilai, "kejadian");
      return kejadian === null ? null : { kind, kejadian };
    }
    case "kosongkan":
    case "dequeue":
    case "peek":
    case "isEmpty":
    case "isFull":
    case "penuhSemu":
      return { kind };
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildQueueOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
