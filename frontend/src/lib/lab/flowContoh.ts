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
    ket: "Urutan sederhana: baca, hitung, tampilkan.",
    masukan: "4, 5",
    diagram: bangun(
      [
        ["mulai", 300, 40, "Mulai"],
        ["io", 300, 130, "Baca panjang, lebar"],
        ["proses", 300, 230, "luas = panjang * lebar"],
        ["io", 300, 330, 'Tampilkan "Luas =", luas', 200],
        ["selesai", 300, 430, "Selesai"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "bawah", "atas"],
        [3, 4, "bawah", "atas"],
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
        ["mulai", 300, 40, "Mulai"],
        ["io", 300, 130, "Baca n"],
        ["keputusan", 300, 230, "n mod 2 = 0?", 170, 96],
        ["io", 140, 380, 'Tampilkan n, "genap"', 180],
        ["io", 460, 380, 'Tampilkan n, "ganjil"', 180],
        ["selesai", 300, 500, "Selesai"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "kiri", "atas", "Ya"],
        [2, 4, "kanan", "atas", "Tidak"],
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
        ["mulai", 260, 40, "Mulai"],
        ["io", 260, 130, "Baca n"],
        ["persiapan", 260, 230, "i = 1\ntotal = 0"],
        ["keputusan", 260, 340, "i <= n?", 150, 90],
        ["proses", 260, 480, "total = total + i\ni = i + 1", 170, 64],
        ["io", 520, 340, 'Tampilkan "Jumlah =", total', 210],
        ["selesai", 520, 480, "Selesai"],
      ],
      [
        [0, 1, "bawah", "atas"],
        [1, 2, "bawah", "atas"],
        [2, 3, "bawah", "atas"],
        [3, 4, "bawah", "atas", "Ya"],
        [4, 3, "kiri", "kiri"],
        [3, 5, "kanan", "kiri", "Tidak"],
        [5, 6, "bawah", "atas"],
      ],
    ),
  },
];
