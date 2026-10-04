/**
 * Katalog operasi lab array 3D — panel kontrol dibangun dari sini.
 *
 * `Record<CubeOp["kind"], …>` membuat operasi yang lupa didaftarkan menjadi
 * galat TIPE. Nama isian `lapisan`/`baris`/`kolom` sengaja sama dengan nama
 * sumbunya: tombol "pakai sel" mengisi ketiganya dari sel terpilih. Isian
 * ukuran memakai nama lain (`jumlah…`) supaya tidak ikut terisi indeks.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { isLabPointerTone, isLabTone, LAB_MAX_ITEM_CHARS } from "./labTypes";
import { formAngka, formTeks, formTeksWajib, type OpField, type OpSpecOf } from "./labForm";
import { CAKUPAN_KUBUS, CUBE_MAX_SIDE, type CakupanKubus, type CubeOp } from "./cubeLab";
import { isArahUrut, isKindUrut, katalogUrut } from "./labSort";

export type CubeOpGrup = "bentuk" | "akses" | "sorot" | "telusur" | "ubah" | "urut";
export type CubeOpSpec = OpSpecOf<CubeOp["kind"], CubeOpGrup, CubeOp>;

export const CUBE_OP_GROUPS: readonly { id: CubeOpGrup; label: string }[] = [
  { id: "bentuk", label: "Bentuk & isi" },
  { id: "akses", label: "Akses & penunjuk" },
  { id: "sorot", label: "Sorotan" },
  { id: "telusur", label: "Penelusuran" },
  { id: "ubah", label: "Transformasi" },
  { id: "urut", label: "Pengurutan" },
];

const indeks = (name: string, label: string): OpField => ({
  name,
  label,
  kind: "angka",
  placeholder: "0",
  min: 0,
  max: CUBE_MAX_SIDE - 1,
});
const jumlah = (name: string, label: string, placeholder: string): OpField => ({
  name,
  label,
  kind: "angka",
  placeholder,
  min: 1,
  max: CUBE_MAX_SIDE,
});
const F_LAPISAN = indeks("lapisan", "Lapisan");
const F_BARIS = indeks("baris", "Baris");
const F_KOLOM = indeks("kolom", "Kolom");
const F_NILAI: OpField = { name: "nilai", label: "Nilai", kind: "teks", placeholder: "0", maxLength: LAB_MAX_ITEM_CHARS };
const F_NADA: OpField = { name: "tone", label: "Nada sorotan", kind: "nada" };
const F_NAMA: OpField = { name: "nama", label: "Nama penunjuk", kind: "penunjukNama", placeholder: "p", maxLength: 6 };
const F_UKURAN = [jumlah("jumlahLapisan", "Jumlah lapisan", "3"), jumlah("jumlahBaris", "Jumlah baris", "3"), jumlah("jumlahKolom", "Jumlah kolom", "4")];

export const CUBE_OP_CATALOG: Record<CubeOp["kind"], CubeOpSpec> = {
  // ── Bentuk & isi ──────────────────────────────────────────────────────
  buat: {
    kind: "buat",
    label: "Buat berurutan",
    grup: "bentuk",
    ringkas: "Kubus baru diisi 0, 1, 2, … sesuai urutannya di memori — mudah melihat elemen mana tetangga di memori.",
    fields: F_UKURAN,
    contoh: { kind: "buat", jumlahLapisan: 3, jumlahBaris: 3, jumlahKolom: 4 },
  },
  acak: {
    kind: "acak",
    label: "Isi acak",
    grup: "bentuk",
    ringkas: "Kubus baru berisi angka acak. Benih yang sama selalu menghasilkan isi yang sama.",
    fields: [...F_UKURAN, { name: "maks", label: "Nilai terbesar", kind: "angka", placeholder: "9", min: 1 }, { name: "benih", label: "Benih acak", kind: "angka", placeholder: "42", min: 0 }],
    contoh: { kind: "acak", jumlahLapisan: 2, jumlahBaris: 3, jumlahKolom: 3, maks: 9, benih: 42 },
  },
  isiDariTeks: {
    kind: "isiDariTeks",
    label: "Isi dari teks",
    grup: "bentuk",
    ringkas: "Lapisan dipisah | atau baris kosong, baris dipisah titik koma atau baris baru, nilai dipisah spasi/koma.",
    fields: [
      {
        name: "teks",
        label: "Lapisan-lapisan nilai",
        kind: "teksBaris",
        placeholder: "1 2; 3 4 | 5 6; 7 8",
        maxLength: CUBE_MAX_SIDE * CUBE_MAX_SIDE * CUBE_MAX_SIDE * (LAB_MAX_ITEM_CHARS + 2),
      },
    ],
    contoh: { kind: "isiDariTeks", teks: "1 2; 3 4 | 5 6; 7 8" },
  },
  kosongkan: {
    kind: "kosongkan",
    label: "Kosongkan array",
    grup: "bentuk",
    ringkas: "Menghapus seluruh elemen, penunjuk, dan sorotan.",
    fields: [],
    contoh: { kind: "kosongkan" },
  },
  tambahLapisan: {
    kind: "tambahLapisan",
    label: "Sisipkan lapisan",
    grup: "bentuk",
    ringkas: "Lapisan baru berukuran sama, diisi satu nilai, di posisi lapisan tertentu.",
    fields: [{ ...F_LAPISAN, label: "Di posisi lapisan", max: CUBE_MAX_SIDE }, F_NILAI],
    contoh: { kind: "tambahLapisan", lapisan: 1, nilai: "0" },
  },
  hapusLapisan: {
    kind: "hapusLapisan",
    label: "Hapus lapisan",
    grup: "bentuk",
    ringkas: "Membuang satu lapisan utuh; lapisan di belakangnya maju satu.",
    fields: [F_LAPISAN],
    contoh: { kind: "hapusLapisan", lapisan: 0 },
  },

  // ── Akses & penunjuk ──────────────────────────────────────────────────
  bacaSel: {
    kind: "bacaSel",
    label: "Baca arr[k][i][j]",
    grup: "akses",
    ringkas: "Menunjukkan nilai satu elemen beserta hitungan offset-nya di memori. Papan tidak berubah.",
    fields: [F_LAPISAN, F_BARIS, F_KOLOM],
    contoh: { kind: "bacaSel", lapisan: 1, baris: 2, kolom: 0 },
  },
  setSel: {
    kind: "setSel",
    label: "Ubah arr[k][i][j]",
    grup: "akses",
    ringkas: "Mengganti nilai satu elemen.",
    fields: [F_LAPISAN, F_BARIS, F_KOLOM, F_NILAI],
    contoh: { kind: "setSel", lapisan: 0, baris: 0, kolom: 0, nilai: "9" },
  },
  setPenunjuk: {
    kind: "setPenunjuk",
    label: "Pasang penunjuk",
    grup: "akses",
    ringkas: "Penanda bernama (mis. p) yang menempel di satu sel dan ikut berpindah saat kubus diubah.",
    fields: [F_NAMA, F_LAPISAN, F_BARIS, F_KOLOM, { name: "tone", label: "Warna", kind: "penunjukNada" }],
    contoh: { kind: "setPenunjuk", nama: "p", lapisan: 0, baris: 0, kolom: 0, tone: "utama" },
  },
  geserPenunjuk: {
    kind: "geserPenunjuk",
    label: "Geser penunjuk",
    grup: "akses",
    ringkas: "Menggeser penunjuk sejauh sekian lapisan, baris, dan kolom (boleh negatif).",
    fields: [
      F_NAMA,
      { name: "dLapisan", label: "Geser lapisan", kind: "angka", placeholder: "1" },
      { name: "dBaris", label: "Geser baris", kind: "angka", placeholder: "0" },
      { name: "dKolom", label: "Geser kolom", kind: "angka", placeholder: "0" },
    ],
    contoh: { kind: "geserPenunjuk", nama: "p", dLapisan: 1, dBaris: 0, dKolom: 0 },
  },
  hapusPenunjuk: {
    kind: "hapusPenunjuk",
    label: "Lepas penunjuk",
    grup: "akses",
    ringkas: "Menghapus satu penunjuk dari papan.",
    fields: [F_NAMA],
    contoh: { kind: "hapusPenunjuk", nama: "p" },
  },

  // ── Sorotan ───────────────────────────────────────────────────────────
  sorotLapisan: {
    kind: "sorotLapisan",
    label: "Sorot satu lapisan",
    grup: "sorot",
    ringkas: "arr[k] — satu lapisan utuh, yang sendirinya sebuah array 2D.",
    fields: [F_LAPISAN, F_NADA],
    contoh: { kind: "sorotLapisan", lapisan: 0, tone: "sorot" },
  },
  sorotBaris: {
    kind: "sorotBaris",
    label: "Sorot baris di semua lapisan",
    grup: "sorot",
    ringkas: "arr[*][i][*] — irisan mendatar yang memotong setiap lapisan.",
    fields: [F_BARIS, F_NADA],
    contoh: { kind: "sorotBaris", baris: 1, tone: "banding" },
  },
  sorotKolom: {
    kind: "sorotKolom",
    label: "Sorot kolom di semua lapisan",
    grup: "sorot",
    ringkas: "arr[*][*][j] — irisan tegak yang memotong setiap lapisan.",
    fields: [F_KOLOM, F_NADA],
    contoh: { kind: "sorotKolom", kolom: 0, tone: "hasil" },
  },
  sorotPilar: {
    kind: "sorotPilar",
    label: "Sorot pilar",
    grup: "sorot",
    ringkas: "arr[*][i][j] — satu sel dari setiap lapisan, berjajar menembus kubus.",
    fields: [F_BARIS, F_KOLOM, F_NADA],
    contoh: { kind: "sorotPilar", baris: 1, kolom: 1, tone: "buang" },
  },
  hapusSorotan: {
    kind: "hapusSorotan",
    label: "Hapus semua sorotan",
    grup: "sorot",
    ringkas: "Membersihkan semua sorotan. Penunjuk tetap di tempatnya.",
    fields: [],
    contoh: { kind: "hapusSorotan" },
  },

  // ── Penelusuran ───────────────────────────────────────────────────────
  telusurLapisan: {
    kind: "telusurLapisan",
    label: "Lapisan demi lapisan",
    grup: "telusur",
    ringkas: "Tiga perulangan bersarang k → i → j. Urutannya sama persis dengan urutan memori.",
    fields: [],
    contoh: { kind: "telusurLapisan" },
  },
  telusurPilar: {
    kind: "telusurPilar",
    label: "Pilar demi pilar",
    grup: "telusur",
    ringkas: "Perulangan i → j → k: menuruni semua lapisan dulu. Bandingkan lompatan offset-nya.",
    fields: [],
    contoh: { kind: "telusurPilar" },
  },
  telusurDiagonal: {
    kind: "telusurDiagonal",
    label: "Diagonal ruang",
    grup: "telusur",
    ringkas: "arr[k][k][k] — dari pojok depan-kiri-atas menembus ke pojok seberangnya.",
    fields: [],
    contoh: { kind: "telusurDiagonal" },
  },

  // ── Transformasi ──────────────────────────────────────────────────────
  transposeTiapLapisan: {
    kind: "transposeTiapLapisan",
    label: "Transpose setiap lapisan",
    grup: "ubah",
    ringkas: "arr[k][i][j] pindah ke arr[k][j][i]; baris dan kolom tiap lapisan bertukar.",
    fields: [],
    contoh: { kind: "transposeTiapLapisan" },
  },
  putarTiapLapisan: {
    kind: "putarTiapLapisan",
    label: "Putar setiap lapisan 90°",
    grup: "ubah",
    ringkas: "Setiap lapisan diputar searah jarum jam — kubus berputar pada sumbu lapisannya.",
    fields: [],
    contoh: { kind: "putarTiapLapisan" },
  },
  balikUrutanLapisan: {
    kind: "balikUrutanLapisan",
    label: "Balik urutan lapisan",
    grup: "ubah",
    ringkas: "Lapisan paling depan pindah ke paling belakang, dan sebaliknya.",
    fields: [],
    contoh: { kind: "balikUrutanLapisan" },
  },
  tukarSumbu: {
    kind: "tukarSumbu",
    label: "Tukar dua sumbu",
    grup: "ubah",
    ringkas: "Sumbu 0 = lapisan, 1 = baris, 2 = kolom. Menukar 0 dan 1 berarti melihat kubus dari atas.",
    fields: [
      { name: "sumbuA", label: "Sumbu pertama", kind: "angka", placeholder: "0", min: 0, max: 2 },
      { name: "sumbuB", label: "Sumbu kedua", kind: "angka", placeholder: "1", min: 0, max: 2 },
    ],
    contoh: { kind: "tukarSumbu", sumbuA: 0, sumbuB: 1 },
  },
  ...katalogUrut<CubeOpGrup, CubeOp>(
    "urut",
    [
      {
        name: "cakupan",
        label: "Yang diurutkan",
        kind: "pilihan",
        opsi: [
          { nilai: "baris", label: "Tiap baris (di setiap lapisan)" },
          { nilai: "kolom", label: "Tiap kolom (di setiap lapisan)" },
          { nilai: "pilar", label: "Tiap pilar (menembus lapisan)" },
          { nilai: "semua", label: "Seluruh kubus (urutan memori)" },
        ],
      },
    ],
    (kind) => ({ kind, arah: "naik", cakupan: "baris" }),
  ),
};

/** Null hanya untuk masalah BENTUK form — domainnya urusan `applyCubeOp`. */
export function buildCubeOp(kind: CubeOp["kind"], nilai: Record<string, string>): CubeOp | null {
  const angka = (n: string) => formAngka(nilai, n);
  const tone = formTeks(nilai, "tone");
  if (isKindUrut(kind)) {
    const arah = formTeks(nilai, "arah");
    const cakupan = formTeks(nilai, "cakupan") as CakupanKubus;
    return isArahUrut(arah) && CAKUPAN_KUBUS.includes(cakupan) ? { kind, arah, cakupan } : null;
  }
  switch (kind) {
    case "buat":
    case "acak": {
      const jumlahLapisan = angka("jumlahLapisan");
      const jumlahBaris = angka("jumlahBaris");
      const jumlahKolom = angka("jumlahKolom");
      if (jumlahLapisan === null || jumlahBaris === null || jumlahKolom === null) return null;
      if (kind === "buat") return { kind, jumlahLapisan, jumlahBaris, jumlahKolom };
      const maks = angka("maks");
      const benih = angka("benih");
      return maks === null || benih === null ? null : { kind, jumlahLapisan, jumlahBaris, jumlahKolom, maks, benih };
    }
    case "isiDariTeks": {
      const teks = formTeksWajib(nilai, "teks");
      return teks === null ? null : { kind, teks };
    }
    case "kosongkan":
    case "hapusSorotan":
    case "telusurLapisan":
    case "telusurPilar":
    case "telusurDiagonal":
    case "transposeTiapLapisan":
    case "putarTiapLapisan":
    case "balikUrutanLapisan":
      return { kind };
    case "tambahLapisan": {
      const lapisan = angka("lapisan");
      const v = formTeksWajib(nilai, "nilai");
      return lapisan === null || v === null ? null : { kind, lapisan, nilai: v };
    }
    case "hapusLapisan": {
      const lapisan = angka("lapisan");
      return lapisan === null ? null : { kind, lapisan };
    }
    case "bacaSel":
    case "setSel":
    case "setPenunjuk": {
      const lapisan = angka("lapisan");
      const baris = angka("baris");
      const kolom = angka("kolom");
      if (lapisan === null || baris === null || kolom === null) return null;
      if (kind === "bacaSel") return { kind, lapisan, baris, kolom };
      if (kind === "setSel") {
        const v = formTeksWajib(nilai, "nilai");
        return v === null ? null : { kind, lapisan, baris, kolom, nilai: v };
      }
      const nama = formTeksWajib(nilai, "nama");
      return nama === null || !isLabPointerTone(tone) ? null : { kind, nama, lapisan, baris, kolom, tone };
    }
    case "geserPenunjuk": {
      const nama = formTeksWajib(nilai, "nama");
      const dLapisan = angka("dLapisan");
      const dBaris = angka("dBaris");
      const dKolom = angka("dKolom");
      if (nama === null || dLapisan === null || dBaris === null || dKolom === null) return null;
      return { kind, nama, dLapisan, dBaris, dKolom };
    }
    case "hapusPenunjuk": {
      const nama = formTeksWajib(nilai, "nama");
      return nama === null ? null : { kind, nama };
    }
    case "sorotLapisan": {
      const lapisan = angka("lapisan");
      return lapisan === null || !isLabTone(tone) ? null : { kind, lapisan, tone };
    }
    case "sorotBaris": {
      const baris = angka("baris");
      return baris === null || !isLabTone(tone) ? null : { kind, baris, tone };
    }
    case "sorotKolom": {
      const kolom = angka("kolom");
      return kolom === null || !isLabTone(tone) ? null : { kind, kolom, tone };
    }
    case "sorotPilar": {
      const baris = angka("baris");
      const kolom = angka("kolom");
      return baris === null || kolom === null || !isLabTone(tone) ? null : { kind, baris, kolom, tone };
    }
    case "tukarSumbu": {
      const sumbuA = angka("sumbuA");
      const sumbuB = angka("sumbuB");
      return sumbuA === null || sumbuB === null ? null : { kind, sumbuA, sumbuB };
    }
    default: {
      const _lengkap: never = kind;
      throw new Error(`buildCubeOp: operasi tidak dikenal (${String(_lengkap)}).`);
    }
  }
}
