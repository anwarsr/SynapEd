/**
 * Katalog operasi lab linked list — panel kontrol dibangun dari sini.
 *
 * `Record<ListOp["kind"], …>` membuat operasi yang lupa didaftarkan menjadi
 * galat TIPE. Isian `indeks` bisa diisi dari simpul terpilih di papan.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { LAB_MAX_ITEM_CHARS } from "./labTypes";
import { formAngka, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";
import { LIST_MAX_NODES, type ListOp } from "./listLab";

export type ListOpGrup = "isi" | "sisip" | "hapus" | "akses" | "susun";
export type ListOpSpec = OpSpecOf<ListOp["kind"], ListOpGrup, ListOp>;

export const LIST_OP_GROUPS: readonly { id: ListOpGrup; label: string }[] = [
  { id: "isi", label: "Isi list" },
  { id: "sisip", label: "Sisip" },
  { id: "hapus", label: "Hapus" },
  { id: "akses", label: "Akses & cari" },
  { id: "susun", label: "Susun ulang" },
];

const F_NILAI: OpField = { name: "nilai", label: "Nilai", kind: "teks", placeholder: "7", maxLength: LAB_MAX_ITEM_CHARS };
const F_INDEKS: OpField = { name: "indeks", label: "Indeks", kind: "angka", placeholder: "1", min: 0, max: LIST_MAX_NODES };

export const LIST_OP_CATALOG: Record<ListOp["kind"], ListOpSpec> = {
  // ── Isi ───────────────────────────────────────────────────────────────
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi dari teks",
    grup: "isi",
    ringkas: "Nilai-nilai dipisah koma atau spasi; yang pertama menjadi head.",
    fields: [{ name: "teks", label: "Nilai", kind: "teks", placeholder: "3, 8, 1, 5", maxLength: LIST_MAX_NODES * (LAB_MAX_ITEM_CHARS + 2) }],
    contoh: { kind: "isiDariTeks", teks: "3, 8, 1, 5" },
  },
  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "isi",
    ringkas: "List baru berisi angka acak. Benih yang sama selalu menghasilkan isi yang sama.",
    fields: [
      { name: "panjang", label: "Panjang", kind: "angka", placeholder: "5", min: 1, max: LIST_MAX_NODES },
      { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "99", min: 1 },
      { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0 },
    ],
    contoh: { kind: "acak", panjang: 5, maks: 99, benih: 42 },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan list",
    grup: "isi",
    ringkas: "Membebaskan semua simpul; head menjadi null.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },

  // ── Sisip ─────────────────────────────────────────────────────────────
  sisipDepan: {
    kind: "sisipDepan",
    label: "Sisip di depan",
    grup: "sisip",
    ringkas: "Simpul baru menjadi head. Cukup dua pointer — O(1), berapa pun panjangnya.",
    fields: [F_NILAI],
    contoh: { kind: "sisipDepan", nilai: "7" },
  },
  sisipBelakang: {
    kind: "sisipBelakang",
    label: "Sisip di belakang",
    grup: "sisip",
    ringkas: "Berjalan dari head sampai ekor, lalu sambungkan simpul baru — O(n).",
    fields: [F_NILAI],
    contoh: { kind: "sisipBelakang", nilai: "7" },
  },
  sisipDiIndeks: {
    kind: "sisipDiIndeks",
    label: "Sisip di indeks",
    grup: "sisip",
    ringkas: "Berjalan ke simpul sebelumnya, sambungkan simpul baru ke sisa list, lalu belokkan pointer pendahulunya.",
    fields: [F_INDEKS, F_NILAI],
    contoh: { kind: "sisipDiIndeks", indeks: 2, nilai: "7" },
  },

  // ── Hapus ─────────────────────────────────────────────────────────────
  hapusDepan: {
    kind: "hapusDepan",
    label: "Hapus di depan",
    grup: "hapus",
    ringkas: "head = head.next, lalu bebaskan simpul lama — O(1).",
    fields: [],
    contoh: { kind: "hapusDepan" },
  },
  hapusBelakang: {
    kind: "hapusBelakang",
    label: "Hapus di belakang",
    grup: "hapus",
    ringkas: "Berjalan sampai simpul SEBELUM ekor, lalu putuskan pointernya — O(n).",
    fields: [],
    contoh: { kind: "hapusBelakang" },
  },
  hapusDiIndeks: {
    kind: "hapusDiIndeks",
    label: "Hapus di indeks",
    grup: "hapus",
    ringkas: "Pointer simpul sebelumnya dibelokkan melompati simpul yang dihapus.",
    fields: [F_INDEKS],
    contoh: { kind: "hapusDiIndeks", indeks: 1 },
  },
  hapusNilai: {
    kind: "hapusNilai",
    label: "Hapus menurut nilai",
    grup: "hapus",
    ringkas: "Cari simpul pertama dengan nilai itu (prev dan cur berjalan berdua), lalu hapus.",
    fields: [F_NILAI],
    contoh: { kind: "hapusNilai", nilai: "8" },
  },

  // ── Akses & cari ──────────────────────────────────────────────────────
  cariNilai: {
    kind: "cariNilai",
    label: "Cari nilai",
    grup: "akses",
    ringkas: "Pencarian linear dari head: bandingkan satu per satu sampai ketemu atau sampai null.",
    fields: [F_NILAI],
    contoh: { kind: "cariNilai", nilai: "1" },
  },
  bacaIndeks: {
    kind: "bacaIndeks",
    label: "Baca indeks",
    grup: "akses",
    ringkas: "Tidak bisa melompat seperti array: berjalan k langkah dari head.",
    fields: [F_INDEKS],
    contoh: { kind: "bacaIndeks", indeks: 2 },
  },
  setIndeks: {
    kind: "setIndeks",
    label: "Ubah nilai di indeks",
    grup: "akses",
    ringkas: "Berjalan ke simpulnya, lalu ganti nilainya. Pointer tidak berubah.",
    fields: [F_INDEKS, F_NILAI],
    contoh: { kind: "setIndeks", indeks: 1, nilai: "9" },
  },
  telusuri: {
    kind: "telusuri",
    label: "Telusuri",
    grup: "akses",
    ringkas: "cur berjalan dari head mengikuti next sampai null — pola dasar semua operasi list.",
    fields: [],
    contoh: { kind: "telusuri" },
  },

  // ── Susun ulang ───────────────────────────────────────────────────────
  balik: {
    kind: "balik",
    label: "Balik list",
    grup: "susun",
    ringkas: "Tiga penunjuk prev, cur, next: setiap panah dibalik satu per satu, simpulnya tidak berpindah.",
    fields: [],
    contoh: { kind: "balik" },
  },
};

/** Null hanya untuk masalah BENTUK form — domainnya urusan `applyListOp`. */
export function buildListOp(kind: ListOp["kind"], nilai: Record<string, string>): ListOp | null {
  const angka = (n: string) => formAngka(nilai, n);
  const nilaiWajib = () => formTeksWajib(nilai, "nilai");
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
    case "kosongkan":
    case "hapusDepan":
    case "hapusBelakang":
    case "telusuri":
    case "balik":
      return { kind };
    case "sisipDepan":
    case "sisipBelakang":
    case "hapusNilai":
    case "cariNilai": {
      const v = nilaiWajib();
      return v === null ? null : { kind, nilai: v };
    }
    case "sisipDiIndeks":
    case "setIndeks": {
      const indeks = angka("indeks");
      const v = nilaiWajib();
      return indeks === null || v === null ? null : { kind, indeks, nilai: v };
    }
    case "hapusDiIndeks":
    case "bacaIndeks": {
      const indeks = angka("indeks");
      return indeks === null ? null : { kind, indeks };
    }
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildListOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
