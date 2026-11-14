import type { StatusTugas } from "./classAssignmentRules";

/**
 * Logika tabel pengumpulan tugas di halaman pengajar: saringan, pencarian,
 * urutan, "siswa berikutnya yang perlu dinilai", dan statistik nilai.
 *
 * Netral (tanpa `server-only`/`"use client"`/`@/`): dipakai komponen klien
 * `DaftarPengumpulan`, halaman server (statistik), dan `verify-pengumpulan`.
 */

export interface BarisPengumpulan {
  uid: string;
  nama: string;
  foto: string | null;
  status: StatusTugas;
  /** Sudah keluar dari kelas tetapi jawabannya tetap tercatat. */
  keluar: boolean;
  /** ISO waktu kirim (untuk mengurutkan), null bila belum mengumpulkan. */
  dikirimIso: string | null;
  /** Waktu kirim yang sudah diformat SERVER (WIB) - klien tidak memformat tanggal. */
  dikirimTeks: string | null;
  dikirimLengkap: string | null;
  /** Dikirim lewat tenggat - tetap benar setelah dinilai (status jadi "dinilai"). */
  terlambat: boolean;
  nilai: number | null;
}

export type Saringan = "semua" | "perlu" | "dinilai" | "terlambat" | "belum";
export type Urutan = "status" | "nama" | "kirim" | "nilaiTinggi" | "nilaiRendah";

export const LABEL_SARINGAN: Record<Saringan, string> = {
  semua: "Semua",
  perlu: "Perlu dinilai",
  dinilai: "Dinilai",
  terlambat: "Terlambat",
  belum: "Belum mengumpulkan",
};

export const LABEL_URUTAN: Record<Urutan, string> = {
  status: "Status",
  nama: "Nama (A-Z)",
  kirim: "Waktu kirim",
  nilaiTinggi: "Nilai tertinggi",
  nilaiRendah: "Nilai terendah",
};

export const perluDinilai = (s: StatusTugas) => s === "dikumpulkan" || s === "terlambat";
const belumKirim = (s: StatusTugas) => s === "belum" || s === "terlewat";

export function cocokSaringan(b: BarisPengumpulan, s: Saringan): boolean {
  switch (s) {
    case "semua":
      return true;
    case "perlu":
      return perluDinilai(b.status);
    case "dinilai":
      return b.status === "dinilai";
    case "terlambat":
      return b.terlambat;
    case "belum":
      return belumKirim(b.status);
  }
}

export function hitungSaringan(baris: readonly BarisPengumpulan[]): Record<Saringan, number> {
  const n = { semua: 0, perlu: 0, dinilai: 0, terlambat: 0, belum: 0 } satisfies Record<Saringan, number>;
  for (const b of baris) for (const s of Object.keys(n) as Saringan[]) if (cocokSaringan(b, s)) n[s]++;
  return n;
}

/** Huruf kecil tanpa tanda diakritik, supaya "Alya" ditemukan dengan "alya" dan "Ünal" dengan "unal". */
const lipat = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function cocokCari(b: BarisPengumpulan, q: string): boolean {
  const kunci = lipat(q);
  return kunci === "" || lipat(b.nama).includes(kunci);
}

/** Yang perlu dinilai paling atas, lalu yang sudah dinilai, lalu yang belum mengumpulkan. */
const PERINGKAT_STATUS: Record<StatusTugas, number> = { terlambat: 0, dikumpulkan: 0, dinilai: 1, terlewat: 2, belum: 2 };

const banding = new Intl.Collator("id", { sensitivity: "base" });

/** Salinan terurut; seri selalu dipecah dengan nama supaya urutan stabil antar-render. */
export function urutkan(baris: readonly BarisPengumpulan[], urutan: Urutan): BarisPengumpulan[] {
  const nama = (a: BarisPengumpulan, b: BarisPengumpulan) => banding.compare(a.nama, b.nama) || a.uid.localeCompare(b.uid);
  // Tanpa nilai / tanpa waktu kirim selalu di BAWAH, ke arah urutan mana pun.
  const kosongDiBawah = (x: number | null, y: number | null, f: (p: number, q: number) => number) =>
    x === null && y === null ? 0 : x === null ? 1 : y === null ? -1 : f(x, y);
  const waktu = (iso: string | null) => (iso ? Date.parse(iso) : null);

  return [...baris].sort((a, b) => {
    switch (urutan) {
      case "status":
        return PERINGKAT_STATUS[a.status] - PERINGKAT_STATUS[b.status] || nama(a, b);
      case "nama":
        return nama(a, b);
      case "kirim":
        return kosongDiBawah(waktu(a.dikirimIso), waktu(b.dikirimIso), (p, q) => p - q) || nama(a, b);
      case "nilaiTinggi":
        return kosongDiBawah(a.nilai, b.nilai, (p, q) => q - p) || nama(a, b);
      case "nilaiRendah":
        return kosongDiBawah(a.nilai, b.nilai, (p, q) => p - q) || nama(a, b);
    }
  });
}

/**
 * Siswa BERIKUTNYA (setelah `sekarang`, berputar ke awal) yang masih perlu
 * dinilai, menurut urutan daftar yang sedang dilihat pengajar. `sekarang`
 * sendiri tidak pernah dikembalikan - setelah disimpan ia sudah dinilai,
 * walau data yang memuat statusnya belum datang dari server.
 */
export function berikutnyaPerlu(daftar: readonly BarisPengumpulan[], sekarang: string): BarisPengumpulan | null {
  const i = daftar.findIndex((b) => b.uid === sekarang);
  for (let k = 1; k <= daftar.length; k++) {
    const b = daftar[(Math.max(i, 0) + k) % daftar.length];
    if (b.uid !== sekarang && perluDinilai(b.status)) return b;
  }
  return null;
}

export interface StatistikNilai {
  jumlah: number;
  rata: number;
  tertinggi: number;
  terendah: number;
  /** Lima kelompok menurut PERSEN dari nilai maksimal, supaya tugas bernilai 50 dan 100 terbaca sama. */
  sebaran: { label: string; jumlah: number }[];
}

export const KELOMPOK_SEBARAN = [
  { label: "< 60", min: 0 },
  { label: "60-69", min: 60 },
  { label: "70-79", min: 70 },
  { label: "80-89", min: 80 },
  { label: "90-100", min: 90 },
] as const;

/** Null bila belum ada nilai sama sekali. Rata-rata dibulatkan 1 desimal. */
export function statistikNilai(nilai: readonly number[], maks: number): StatistikNilai | null {
  const sah = nilai.filter((n) => Number.isFinite(n));
  if (sah.length === 0 || !(maks > 0)) return null;
  const sebaran = KELOMPOK_SEBARAN.map((k) => ({ label: k.label, jumlah: 0 }));
  for (const n of sah) {
    const persen = (n / maks) * 100;
    let i = KELOMPOK_SEBARAN.length - 1;
    while (i > 0 && persen < KELOMPOK_SEBARAN[i].min) i--;
    sebaran[i].jumlah++;
  }
  return {
    jumlah: sah.length,
    rata: Math.round((sah.reduce((a, b) => a + b, 0) / sah.length) * 10) / 10,
    tertinggi: Math.max(...sah),
    terendah: Math.min(...sah),
    sebaran,
  };
}
