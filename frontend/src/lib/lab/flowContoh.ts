/**
 * Contoh flowchart siap pakai — titik mulai bagi siswa, dan bahan uji mesin
 * jalan di `verify-flowchart` (setiap contoh WAJIB lolos pemeriksa aturan
 * tanpa galat dan menghasilkan keluaran yang diharapkan).
 *
 * Modul netral.
 */
import { INFO_JENIS, type Diagram, type JenisSimpul, type Sisi } from "./flowTypes";

export interface ContohFlow {
  id: string;
  nama: string;
  ket: string;
  /** Masukan bawaan untuk mode Jalankan, mis. "4, 5". */
  masukan: string;
  diagram: Diagram;
}

type DefSimpul = [jenis: JenisSimpul, cx: number, y: number, teks: string, w?: number, h?: number];
type DefGaris = [dari: number, ke: number, dariSisi: Sisi, keSisi: Sisi, label?: string];

/** Simpul diberi id 1..n sesuai urutan; garis menyusul. `cx` = titik tengah mendatar. */
function bangun(simpul: DefSimpul[], garis: DefGaris[]): Diagram {
  const s = simpul.map(([jenis, cx, y, teks, w, h], i) => {
    const lebar = w ?? INFO_JENIS[jenis].w;
    return { id: i + 1, jenis, x: cx - lebar / 2, y, w: lebar, h: h ?? INFO_JENIS[jenis].h, teks };
  });
  const g = garis.map(([dari, ke, dariSisi, keSisi, label], i) => ({
    id: s.length + i + 1,
    dari: dari + 1,
    ke: ke + 1,
    dariSisi,
    keSisi,
    label: label ?? "",
  }));
  return { simpul: s, garis: g, nextId: s.length + g.length + 1 };
}

export const CONTOH_FLOW: readonly ContohFlow[] = [
  {
    id: "luas",
    nama: "Luas persegi panjang",
    ket: "Urutan sederhana: INPUT, hitung, OUTPUT.",
    masukan: "4, 5",
    diagram: bangun(
      [
        ["mulai", 300, 40, "START"],
        ["io", 300, 130, "INPUT Panjang"],
        ["io", 300, 230, "INPUT Lebar"],
        ["proses", 300, 330, "Luas ← Panjang * Lebar"],
        ["io", 300, 430, 'OUTPUT "Luas = ", Luas', 200],
        ["selesai", 300, 530, "STOP"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "bawah", "atas"],
        [3, 4, "bawah", "atas"],
        [4, 5, "bawah", "atas"],
      ],
    ),
  },
  {
    id: "genap",
    nama: "Genap atau ganjil",
    ket: "Percabangan: satu Keputusan, dua jalur.",
    masukan: "7",
    diagram: bangun(
      [
        ["mulai", 300, 40, "START"],
        ["io", 300, 130, "INPUT N"],
        ["keputusan", 300, 230, "N MOD 2 = 0?", 170, 96],
        ["io", 140, 380, 'OUTPUT N, " genap"', 180],
        ["io", 460, 380, 'OUTPUT N, " ganjil"', 180],
        ["selesai", 300, 500, "STOP"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "kiri", "atas", "Yes"],
        [2, 4, "kanan", "atas", "No"],
        [3, 5, "bawah", "kiri"],
        [4, 5, "bawah", "kanan"],
      ],
    ),
  },
  {
    id: "jumlah",
    nama: "Jumlah 1 sampai n",
    ket: "Perulangan: garis kembali ke Keputusan sampai kondisinya salah.",
    masukan: "5",
    diagram: bangun(
      [
        ["mulai", 260, 40, "START"],
        ["io", 260, 130, "INPUT N"],
        ["persiapan", 260, 230, "Count ← 1\nTotal ← 0"],
        ["keputusan", 260, 340, "Count <= N?", 150, 90],
        ["proses", 260, 480, "Total ← Total + Count\nCount ← Count + 1", 190, 64],
        ["io", 520, 340, 'OUTPUT "Jumlah = ", Total', 210],
        ["selesai", 520, 480, "STOP"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "bawah", "atas"],
        [3, 4, "bawah", "atas", "Yes"],
        [4, 3, "kiri", "kiri"],
        [3, 5, "kanan", "kiri", "No"],
        [5, 6, "bawah", "atas"],
      ],
    ),
  },
];
