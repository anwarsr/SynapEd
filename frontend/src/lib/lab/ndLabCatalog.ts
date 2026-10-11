/**
 * Katalog operasi lab array N-dimensi — panel kontrol dibangun dari sini.
 *
 * Indeks multi-dimensi ditulis sebagai teks (`1, 2, 0` atau `[1][2][0]`),
 * karena jumlah kotaknya bergantung pada bentuk array yang sedang dibuka;
 * reducer yang mengurai dan memberi galat yang menjelaskan. Isian bernama
 * `indeks` diisi tombol "pakai sel" dengan koordinat sel terpilih — irisan
 * sengaja memakai nama `posisi` supaya tidak ikut terisi.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { isLabTone, LAB_MAX_ITEM_CHARS } from "./labTypes";
import { formAngka, formTeks, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";
import { isArahUrut, isKindUrut, katalogUrut } from "./labSort";
import { ND_MAX_DIMS, ND_MAX_ELEMENTS, type NdOp } from "./ndLab";

export type NdOpGrup = "bentuk" | "akses" | "telusur" | "ubah" | "urut";
export type NdOpSpec = OpSpecOf<NdOp["kind"], NdOpGrup, NdOp>;

export const ND_OP_GROUPS: readonly { id: NdOpGrup; label: string }[] = [
  { id: "bentuk", label: "Bentuk & isi" },
  { id: "akses", label: "Akses & sorotan" },
  { id: "telusur", label: "Penelusuran" },
  { id: "ubah", label: "Transformasi" },
  { id: "urut", label: "Pengurutan" },
];

const F_INDEKS: OpField = { name: "indeks", label: "Indeks", kind: "teks", placeholder: "1, 2, 0", maxLength: ND_MAX_DIMS * 4 };
const F_BENTUK: OpField = { name: "bentuk", label: "Panjang tiap dimensi", kind: "teks", placeholder: "2, 3, 4", maxLength: ND_MAX_DIMS * 4 };

export const ND_OP_CATALOG: Record<NdOp["kind"], NdOpSpec> = {
  buat: {
    kind: "buat",
    label: "Buat array",
    grup: "bentuk",
    ringkas: "Membuat array dengan berapa pun dimensinya, mis. 2, 3, 4 untuk arr[2][3][4]. Isinya 0, 1, 2, … sesuai urutan memori.",
    fields: [F_BENTUK],
    contoh: { kind: "buat", bentuk: "2, 3, 4" },
  },
  isiAcak: {
    kind: "isiAcak",
    label: "Isi acak",
    grup: "bentuk",
    ringkas: "Mengganti seluruh isi dengan angka acak - selalu sama untuk benih yang sama.",
    fields: [
      { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "99", min: 1 },
      { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0 },
    ],
    contoh: { kind: "isiAcak", maks: 99, benih: 42 },
  },
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi dari teks",
    grup: "bentuk",
    ringkas: "Mengisi seluruh elemen mengikuti urutan memori; jumlah nilainya harus sama dengan jumlah elemen.",
    fields: [
      {
        name: "teks",
        label: "Nilai, urutan memori",
        kind: "teksBaris",
        placeholder: "1 2 3 4 5 6",
        maxLength: ND_MAX_ELEMENTS * (LAB_MAX_ITEM_CHARS + 2),
      },
    ],
    contoh: { kind: "isiDariTeks", teks: Array.from({ length: 24 }, (_, i) => i * 2).join(" ") },
  },
  ubahBentuk: {
    kind: "ubahBentuk",
    label: "Ubah bentuk (reshape)",
    grup: "bentuk",
    ringkas: "Membaca ulang deret memori yang sama dengan bentuk lain - jumlah elemennya harus tetap.",
    fields: [{ ...F_BENTUK, label: "Bentuk baru", placeholder: "4, 6" }],
    contoh: { kind: "ubahBentuk", bentuk: "4, 6" },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan array",
    grup: "bentuk",
    ringkas: "Menghapus seluruh elemen dan bentuknya.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },

  bacaElemen: {
    kind: "bacaElemen",
    label: "Baca elemen",
    grup: "akses",
    ringkas: "Menunjukkan nilai di indeks tertentu beserta hitungan offset-nya di memori.",
    fields: [F_INDEKS],
    contoh: { kind: "bacaElemen", indeks: "1, 2, 3" },
  },
  setElemen: {
    kind: "setElemen",
    label: "Ubah elemen",
    grup: "akses",
    ringkas: "Mengganti nilai di indeks tertentu.",
    fields: [F_INDEKS, { name: "nilai", label: "Nilai", kind: "teks", placeholder: "9", maxLength: LAB_MAX_ITEM_CHARS }],
    contoh: { kind: "setElemen", indeks: "0, 0, 0", nilai: "9" },
  },
  setKursor: {
    kind: "setKursor",
    label: "Pasang kursor",
    grup: "akses",
    ringkas: "Menandai satu elemen dengan kursor yang tetap di papan.",
    fields: [F_INDEKS],
    contoh: { kind: "setKursor", indeks: "1, 0, 2" },
  },
  hapusKursor: {
    kind: "hapusKursor",
    label: "Lepas kursor",
    grup: "akses",
    ringkas: "Melepas kursor dari papan.",
    fields: [],
    contoh: { kind: "hapusKursor" },
  },
  sorotIrisan: {
    kind: "sorotIrisan",
    label: "Sorot irisan",
    grup: "akses",
    ringkas: "Menyorot semua elemen yang indeks di satu sumbunya bernilai tertentu, mis. arr[*][1][*].",
    fields: [
      { name: "sumbu", label: "Sumbu", kind: "angka", placeholder: "1", min: 0, max: ND_MAX_DIMS - 1 },
      { name: "posisi", label: "Posisi", kind: "angka", placeholder: "0", min: 0 },
      { name: "tone", label: "Nada sorotan", kind: "nada" },
    ],
    contoh: { kind: "sorotIrisan", sumbu: 1, posisi: 0, tone: "sorot" },
  },
  hapusSorotan: {
    kind: "hapusSorotan",
    label: "Hapus semua sorotan",
    grup: "akses",
    ringkas: "Membersihkan seluruh sorotan irisan.",
    fields: [],
    contoh: { kind: "hapusSorotan" },
  },

  telusuri: {
    kind: "telusuri",
    label: "Telusuri urutan memori",
    grup: "telusur",
    ringkas: "Mengunjungi setiap elemen sesuai urutan di memori: indeks paling kanan berubah paling cepat.",
    fields: [],
    contoh: { kind: "telusuri" },
  },

  tukarSumbu: {
    kind: "tukarSumbu",
    label: "Tukar dua sumbu",
    grup: "ubah",
    ringkas: "Menukar peran dua sumbu - perumuman transpose untuk berapa pun dimensinya.",
    fields: [
      { name: "sumbuA", label: "Sumbu pertama", kind: "angka", placeholder: "0", min: 0, max: ND_MAX_DIMS - 1 },
      { name: "sumbuB", label: "Sumbu kedua", kind: "angka", placeholder: "1", min: 0, max: ND_MAX_DIMS - 1 },
    ],
    contoh: { kind: "tukarSumbu", sumbuA: 0, sumbuB: 1 },
  },
  ...katalogUrut<NdOpGrup, NdOp>(
    "urut",
    [
      {
        name: "sepanjang",
        label: "Yang diurutkan",
        kind: "pilihan",
        opsi: [
          { nilai: "semua", label: "Seluruh array (urutan memori)" },
          ...Array.from({ length: ND_MAX_DIMS }, (_, s) => ({ nilai: String(s), label: `Tiap garis sepanjang sumbu ${s}` })),
        ],
      },
    ],
    (kind) => ({ kind, arah: "naik", sumbu: null }),
  ),
};

/** Null hanya untuk masalah BENTUK form — domainnya urusan `applyNdOp`. */
export function buildNdOp(kind: NdOp["kind"], nilai: Record<string, string>): NdOp | null {
  if (isKindUrut(kind)) {
    const arah = formTeks(nilai, "arah");
    const sepanjang = formTeks(nilai, "sepanjang");
    const sumbu = sepanjang === "semua" ? null : Number(sepanjang);
    if (!isArahUrut(arah) || (sumbu !== null && !Number.isInteger(sumbu))) return null;
    return { kind, arah, sumbu };
  }
  const angka = (n: string) => formAngka(nilai, n);
  switch (kind) {
    case "buat":
    case "ubahBentuk": {
      const bentuk = formTeksWajib(nilai, "bentuk");
      return bentuk === null ? null : { kind, bentuk };
    }
    case "isiAcak": {
      const maks = angka("maks");
      const benih = angka("benih");
      return maks === null || benih === null ? null : { kind, maks, benih };
    }
    case "isiDariTeks": {
      const teks = formTeksWajib(nilai, "teks");
      return teks === null ? null : { kind, teks };
    }
    case "kosongkan":
    case "hapusKursor":
    case "hapusSorotan":
    case "telusuri":
      return { kind };
    case "bacaElemen":
    case "setKursor": {
      const indeks = formTeksWajib(nilai, "indeks");
      return indeks === null ? null : { kind, indeks };
    }
    case "setElemen": {
      const indeks = formTeksWajib(nilai, "indeks");
      const v = formTeksWajib(nilai, "nilai");
      return indeks === null || v === null ? null : { kind, indeks, nilai: v };
    }
    case "sorotIrisan": {
      const sumbu = angka("sumbu");
      const posisi = angka("posisi");
      const tone = formTeks(nilai, "tone");
      return sumbu === null || posisi === null || !isLabTone(tone) ? null : { kind, sumbu, posisi, tone };
    }
    case "tukarSumbu": {
      const sumbuA = angka("sumbuA");
      const sumbuB = angka("sumbuB");
      return sumbuA === null || sumbuB === null ? null : { kind, sumbuA, sumbuB };
    }
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildNdOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
