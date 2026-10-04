/**
 * Katalog operasi lab array 2D — panel kontrol dibangun dari sini.
 *
 * `Record<MatrixOp["kind"], …>` membuat operasi yang lupa didaftarkan menjadi
 * galat TIPE, jadi panel tidak pernah tertinggal dari reducer.
 *
 * Nama isian sengaja `baris`/`kolom` (bukan `indeks`): tombol "pakai sel" di
 * panel mengisi kolom bernama `baris` dengan baris sel terpilih dan `kolom`
 * dengan kolomnya. Isian jumlah (ukuran acak) memakai nama lain supaya tidak
 * ikut terisi indeks sel.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { isLabPointerTone, isLabTone, LAB_MAX_ITEM_CHARS, LAB_MAX_NOTE_CHARS } from "./labTypes";
import { formAngka, formTeks, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";
import { MATRIX_MAX_COLS, MATRIX_MAX_ROWS, type MatrixOp } from "./matrixLab";

export type MatrixOpGrup = "bentuk" | "akses" | "penanda" | "telusur" | "ubah";
export type MatrixOpSpec = OpSpecOf<MatrixOp["kind"], MatrixOpGrup, MatrixOp>;

export const MATRIX_OP_GROUPS: readonly { id: MatrixOpGrup; label: string }[] = [
  { id: "bentuk", label: "Bentuk & isi" },
  { id: "akses", label: "Akses" },
  { id: "penanda", label: "Penunjuk & sorotan" },
  { id: "telusur", label: "Penelusuran" },
  { id: "ubah", label: "Transformasi" },
];

const F_BARIS: OpField = { name: "baris", label: "Baris", kind: "angka", placeholder: "0", min: 0, max: MATRIX_MAX_ROWS - 1 };
const F_KOLOM: OpField = { name: "kolom", label: "Kolom", kind: "angka", placeholder: "0", min: 0, max: MATRIX_MAX_COLS - 1 };
const F_NILAI: OpField = { name: "nilai", label: "Nilai", kind: "teks", placeholder: "0", maxLength: LAB_MAX_ITEM_CHARS };
const F_NADA: OpField = { name: "tone", label: "Nada sorotan", kind: "nada" };
const F_NAMA: OpField = { name: "nama", label: "Nama penunjuk", kind: "penunjukNama", placeholder: "p", maxLength: 6 };

export const MATRIX_OP_CATALOG: Record<MatrixOp["kind"], MatrixOpSpec> = {
  // ── Bentuk & isi ──────────────────────────────────────────────────────
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi dari teks",
    grup: "bentuk",
    ringkas: "Satu baris teks untuk satu baris array (atau pisahkan dengan titik koma); nilai dipisah koma atau spasi.",
    fields: [
      {
        name: "teks",
        label: "Baris-baris nilai",
        kind: "teksBaris",
        placeholder: "1 2 3\n4 5 6\n7 8 9",
        maxLength: MATRIX_MAX_ROWS * MATRIX_MAX_COLS * (LAB_MAX_ITEM_CHARS + 2),
      },
    ],
    contoh: { kind: "isiDariTeks", teks: "1 2 3; 4 5 6" },
  },
  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "bentuk",
    ringkas: "Membuat array 2D berukuran tertentu berisi angka acak — selalu sama untuk benih yang sama.",
    fields: [
      { name: "jumlahBaris", label: "Jumlah baris", kind: "angka", placeholder: "3", min: 1, max: MATRIX_MAX_ROWS },
      { name: "jumlahKolom", label: "Jumlah kolom", kind: "angka", placeholder: "4", min: 1, max: MATRIX_MAX_COLS },
      { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "9", min: 1 },
      { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0 },
    ],
    contoh: { kind: "acak", jumlahBaris: 3, jumlahKolom: 4, maks: 9, benih: 42 },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan array",
    grup: "bentuk",
    ringkas: "Menghapus semua baris dan kolom.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },
  tambahBaris: {
    kind: "tambahBaris",
    label: "Sisipkan baris",
    grup: "bentuk",
    ringkas: "Menyisipkan satu baris baru di posisi tertentu; setiap selnya berisi nilai yang sama.",
    fields: [{ ...F_BARIS, label: "Di posisi baris", max: MATRIX_MAX_ROWS }, F_NILAI],
    contoh: { kind: "tambahBaris", baris: 1, nilai: "0" },
  },
  hapusBaris: {
    kind: "hapusBaris",
    label: "Hapus baris",
    grup: "bentuk",
    ringkas: "Menghapus satu baris utuh; baris di bawahnya naik satu.",
    fields: [F_BARIS],
    contoh: { kind: "hapusBaris", baris: 0 },
  },
  tambahKolom: {
    kind: "tambahKolom",
    label: "Sisipkan kolom",
    grup: "bentuk",
    ringkas: "Menyisipkan satu kolom baru di setiap baris pada posisi yang sama.",
    fields: [{ ...F_KOLOM, label: "Di posisi kolom", max: MATRIX_MAX_COLS }, F_NILAI],
    contoh: { kind: "tambahKolom", kolom: 1, nilai: "0" },
  },
  hapusKolom: {
    kind: "hapusKolom",
    label: "Hapus kolom",
    grup: "bentuk",
    ringkas: "Menghapus satu kolom dari setiap baris; kolom di kanannya bergeser kiri.",
    fields: [F_KOLOM],
    contoh: { kind: "hapusKolom", kolom: 0 },
  },

  // ── Akses ─────────────────────────────────────────────────────────────
  bacaSel: {
    kind: "bacaSel",
    label: "Baca arr[i][j]",
    grup: "akses",
    ringkas: "Menunjukkan nilai di baris i, kolom j tanpa mengubah apa pun.",
    fields: [F_BARIS, F_KOLOM],
    contoh: { kind: "bacaSel", baris: 1, kolom: 2 },
  },
  setSel: {
    kind: "setSel",
    label: "Ubah arr[i][j]",
    grup: "akses",
    ringkas: "Mengganti nilai di baris i, kolom j.",
    fields: [F_BARIS, F_KOLOM, F_NILAI],
    contoh: { kind: "setSel", baris: 0, kolom: 0, nilai: "9" },
  },
  catat: {
    kind: "catat",
    label: "Tempel catatan",
    grup: "akses",
    ringkas: "Menempelkan catatan pendek pada satu sel; kosongkan untuk melepasnya.",
    fields: [F_BARIS, F_KOLOM, { name: "catatan", label: "Catatan", kind: "teks", placeholder: "pivot", maxLength: LAB_MAX_NOTE_CHARS }],
    contoh: { kind: "catat", baris: 0, kolom: 0, catatan: "awal" },
  },

  // ── Penanda ───────────────────────────────────────────────────────────
  setPenunjuk: {
    kind: "setPenunjuk",
    label: "Pasang penunjuk",
    grup: "penanda",
    ringkas: "Memasang penunjuk bernama pada satu sel; nama yang sama dipindahkan, bukan digandakan.",
    fields: [F_NAMA, F_BARIS, F_KOLOM, { name: "tone", label: "Warna", kind: "penunjukNada" }],
    contoh: { kind: "setPenunjuk", nama: "p", baris: 0, kolom: 0, tone: "utama" },
  },
  geserPenunjuk: {
    kind: "geserPenunjuk",
    label: "Geser penunjuk",
    grup: "penanda",
    ringkas: "Menggeser penunjuk beberapa baris dan kolom; boleh negatif.",
    fields: [
      F_NAMA,
      { name: "dBaris", label: "Geser baris", kind: "angka", placeholder: "0" },
      { name: "dKolom", label: "Geser kolom", kind: "angka", placeholder: "1" },
    ],
    contoh: { kind: "geserPenunjuk", nama: "p", dBaris: 0, dKolom: 1 },
  },
  hapusPenunjuk: {
    kind: "hapusPenunjuk",
    label: "Lepas penunjuk",
    grup: "penanda",
    ringkas: "Melepas penunjuk dari papan.",
    fields: [F_NAMA],
    contoh: { kind: "hapusPenunjuk", nama: "p" },
  },
  sorotBaris: {
    kind: "sorotBaris",
    label: "Sorot satu baris",
    grup: "penanda",
    ringkas: "Menyorot seluruh sel di satu baris — arr[i] sebagai array 1D-nya sendiri.",
    fields: [F_BARIS, F_NADA],
    contoh: { kind: "sorotBaris", baris: 0, tone: "sorot" },
  },
  sorotKolom: {
    kind: "sorotKolom",
    label: "Sorot satu kolom",
    grup: "penanda",
    ringkas: "Menyorot sel di kolom yang sama dari setiap baris.",
    fields: [F_KOLOM, F_NADA],
    contoh: { kind: "sorotKolom", kolom: 0, tone: "banding" },
  },
  sorotSubKisi: {
    kind: "sorotSubKisi",
    label: "Sorot sub-kisi",
    grup: "penanda",
    ringkas: "Menyorot persegi panjang dari sudut kiri-atas sampai sudut kanan-bawah; semua sudut termasuk.",
    fields: [
      { ...F_BARIS, name: "dariBaris", label: "Dari baris" },
      { ...F_KOLOM, name: "dariKolom", label: "Dari kolom" },
      { ...F_BARIS, name: "sampaiBaris", label: "Sampai baris", placeholder: "1" },
      { ...F_KOLOM, name: "sampaiKolom", label: "Sampai kolom", placeholder: "1" },
      F_NADA,
    ],
    contoh: { kind: "sorotSubKisi", dariBaris: 0, dariKolom: 0, sampaiBaris: 1, sampaiKolom: 1, tone: "hasil" },
  },
  hapusSorotan: {
    kind: "hapusSorotan",
    label: "Hapus semua sorotan",
    grup: "penanda",
    ringkas: "Membersihkan seluruh sorotan dari papan.",
    fields: [],
    contoh: { kind: "hapusSorotan" },
  },

  // ── Penelusuran ───────────────────────────────────────────────────────
  telusurBaris: {
    kind: "telusurBaris",
    label: "Baris demi baris",
    grup: "telusur",
    ringkas: "Mengunjungi setiap sel seperti dua loop bersarang: i di luar, j di dalam (row-major).",
    fields: [],
    contoh: { kind: "telusurBaris" },
  },
  telusurKolom: {
    kind: "telusurKolom",
    label: "Kolom demi kolom",
    grup: "telusur",
    ringkas: "Loop luar menelusuri kolom, loop dalam menelusuri baris (column-major).",
    fields: [],
    contoh: { kind: "telusurKolom" },
  },
  telusurDiagonal: {
    kind: "telusurDiagonal",
    label: "Diagonal utama",
    grup: "telusur",
    ringkas: "Mengunjungi arr[k][k] — sel yang nomor baris dan kolomnya sama.",
    fields: [],
    contoh: { kind: "telusurDiagonal" },
  },

  // ── Transformasi ──────────────────────────────────────────────────────
  transpose: {
    kind: "transpose",
    label: "Transpose",
    grup: "ubah",
    ringkas: "Menukar baris dengan kolom: arr[i][j] pindah ke arr[j][i].",
    fields: [],
    contoh: { kind: "transpose" },
  },
  balikTiapBaris: {
    kind: "balikTiapBaris",
    label: "Balik setiap baris",
    grup: "ubah",
    ringkas: "Membalik isi tiap baris — cerminan kiri-kanan.",
    fields: [],
    contoh: { kind: "balikTiapBaris" },
  },
  balikUrutanBaris: {
    kind: "balikUrutanBaris",
    label: "Balik urutan baris",
    grup: "ubah",
    ringkas: "Baris paling atas pindah ke paling bawah — cerminan atas-bawah.",
    fields: [],
    contoh: { kind: "balikUrutanBaris" },
  },
  putar90: {
    kind: "putar90",
    label: "Putar 90°",
    grup: "ubah",
    ringkas: "Memutar searah jarum jam: transpose, lalu balik setiap baris.",
    fields: [],
    contoh: { kind: "putar90" },
  },
};

/**
 * Menyusun `MatrixOp` dari nilai form (semuanya string). Null hanya untuk
 * masalah BENTUK — domainnya beserta kalimat galatnya urusan `applyMatrixOp`.
 */
export function buildMatrixOp(kind: MatrixOp["kind"], nilai: Record<string, string>): MatrixOp | null {
  const angka = (n: string) => formAngka(nilai, n);
  switch (kind) {
    case "isiDariTeks": {
      const teks = formTeksWajib(nilai, "teks");
      return teks === null ? null : { kind, teks };
    }
    case "acak": {
      const jumlahBaris = angka("jumlahBaris");
      const jumlahKolom = angka("jumlahKolom");
      const maks = angka("maks");
      const benih = angka("benih");
      if (jumlahBaris === null || jumlahKolom === null || maks === null || benih === null) return null;
      return { kind, jumlahBaris, jumlahKolom, maks, benih };
    }
    case "kosongkan":
    case "hapusSorotan":
    case "telusurBaris":
    case "telusurKolom":
    case "telusurDiagonal":
    case "transpose":
    case "balikTiapBaris":
    case "balikUrutanBaris":
    case "putar90":
      return { kind };
    case "tambahBaris": {
      const baris = angka("baris");
      const v = formTeksWajib(nilai, "nilai");
      return baris === null || v === null ? null : { kind, baris, nilai: v };
    }
    case "hapusBaris": {
      const baris = angka("baris");
      return baris === null ? null : { kind, baris };
    }
    case "tambahKolom": {
      const kolom = angka("kolom");
      const v = formTeksWajib(nilai, "nilai");
      return kolom === null || v === null ? null : { kind, kolom, nilai: v };
    }
    case "hapusKolom": {
      const kolom = angka("kolom");
      return kolom === null ? null : { kind, kolom };
    }
    case "bacaSel":
    case "setSel":
    case "catat": {
      const baris = angka("baris");
      const kolom = angka("kolom");
      if (baris === null || kolom === null) return null;
      if (kind === "bacaSel") return { kind, baris, kolom };
      if (kind === "catat") return { kind, baris, kolom, catatan: formTeks(nilai, "catatan") };
      const v = formTeksWajib(nilai, "nilai");
      return v === null ? null : { kind, baris, kolom, nilai: v };
    }
    case "setPenunjuk": {
      const nama = formTeksWajib(nilai, "nama");
      const baris = angka("baris");
      const kolom = angka("kolom");
      const tone = formTeks(nilai, "tone");
      if (nama === null || baris === null || kolom === null || !isLabPointerTone(tone)) return null;
      return { kind, nama, baris, kolom, tone };
    }
    case "geserPenunjuk": {
      const nama = formTeksWajib(nilai, "nama");
      const dBaris = angka("dBaris");
      const dKolom = angka("dKolom");
      if (nama === null || dBaris === null || dKolom === null) return null;
      return { kind, nama, dBaris, dKolom };
    }
    case "hapusPenunjuk": {
      const nama = formTeksWajib(nilai, "nama");
      return nama === null ? null : { kind, nama };
    }
    case "sorotBaris": {
      const baris = angka("baris");
      const tone = formTeks(nilai, "tone");
      return baris === null || !isLabTone(tone) ? null : { kind, baris, tone };
    }
    case "sorotKolom": {
      const kolom = angka("kolom");
      const tone = formTeks(nilai, "tone");
      return kolom === null || !isLabTone(tone) ? null : { kind, kolom, tone };
    }
    case "sorotSubKisi": {
      const dariBaris = angka("dariBaris");
      const dariKolom = angka("dariKolom");
      const sampaiBaris = angka("sampaiBaris");
      const sampaiKolom = angka("sampaiKolom");
      const tone = formTeks(nilai, "tone");
      if (dariBaris === null || dariKolom === null || sampaiBaris === null || sampaiKolom === null || !isLabTone(tone)) {
        return null;
      }
      return { kind, dariBaris, dariKolom, sampaiBaris, sampaiKolom, tone };
    }
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildMatrixOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
