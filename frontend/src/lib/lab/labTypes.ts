/**
 * Tipe dan batas yang dipakai SELURUH lab SynapLab.
 *
 * Modul ini NETRAL — tanpa `server-only`, tanpa `"use client"`, dan tanpa impor
 * alias `@/`. Tiga pemakai membutuhkannya: komponen papan di browser, modul
 * logika murni, dan `scripts/verify-lab.ts` yang dijalankan tsx di luar Next.
 * Satu impor `@/…` di sini akan mematahkan `npm run typecheck` sekaligus skrip
 * ujinya, karena tsconfig akar tidak punya path mapping itu.
 *
 * Batasnya ditulis sekali di sini lalu dipakai form (maxLength), penjaga di
 * reducer, parser URL, dan skrip uji. Dua salinan batas yang sama adalah dua
 * angka yang suatu hari berbeda — dan yang kalah selalu penggunanya.
 */

/** Lebih dari ini, sel menjadi terlalu kecil untuk dibaca dari bangku belakang. */
export const LAB_MAX_ITEMS = 24;
export const LAB_MAX_ITEM_CHARS = 6;
export const LAB_MAX_NOTE_CHARS = 12;
export const LAB_MAX_POINTERS = 4;
export const LAB_MAX_RANGES = 4;
/** Balik 24 elemen = 1 pembuka + 12 tukar; 60 memberi ruang lega. */
export const LAB_MAX_STEPS = 60;
export const LAB_MAX_HISTORY = 50;

/**
 * Lama satu langkah ditahan sebelum lanjut, sebelum dibagi kecepatan pemutar.
 *
 * Sengaja lambat: penontonnya siswa yang baru pertama kali melihat konsepnya,
 * dan mereka harus sempat membaca narasi SEKALIGUS melihat papan. Yang sudah
 * paham tinggal menaikkan kecepatan; yang belum paham tidak punya jalan
 * untuk memperlambat sesuatu yang sudah terlewat.
 */
export const LAB_STEP_HOLD_MS = 1600;
/** Langkah yang memindahkan sel ditahan lebih lama: geraknya sendiri ±1 detik. */
export const LAB_MOVE_HOLD_MS = 2600;
/** Satu kunjungan penelusuran — lebih cepat dari langkah biasa, tapi tetap terikuti mata. */
export const LAB_VISIT_HOLD_MS = 950;
/** Jumlah warna asal yang bisa dibedakan papan (lihat `LabKelompok`). */
export const LAB_MAX_KELOMPOK = 8;
/**
 * Batas langkah satu operasi pengurutan. Jauh di atas batas operasi biasa
 * karena setiap perbandingan adalah satu langkah — tapi tetap dibatasi: lebih
 * dari ini animasinya berjalan belasan menit dan tidak lagi mengajarkan apa pun.
 * Pengguna diminta memperkecil array atau memilih algoritma yang lebih cepat.
 */
export const LAB_MAX_STEPS_URUT = 1000;

/**
 * Lab yang tersedia — tiga cara memandang array: satu deret (1D), kisi baris ×
 * kolom (2D), dan array bersarang dengan berapa pun dimensinya (N-D).
 *
 * Masing-masing punya kanvas & operasinya sendiri; bilah alat, langkah,
 * riwayat, presentasi, dan tautan bagikan dipakai bersama.
 */
export type LabId = "array1d" | "array2d" | "array3d" | "arrayNd";

/**
 * Nilai elemen: 1–6 karakter.
 *
 * Minus diizinkan supaya bilangan negatif bisa diajarkan. Yang dilarang punya
 * alasan masing-masing: `,` `:` `~` adalah pemisah di skema URL, dan `+`
 * didekode `URLSearchParams` menjadi SPASI — nilai yang berubah diam-diam saat
 * tautan dibuka orang lain adalah bug yang paling sulit dipercaya.
 */
export const LAB_VALUE_RE = /^[A-Za-z0-9 .\-]{1,6}$/;

/** Catatan di bawah sel: huruf, angka, spasi, dan tanda baca ringan. */
export const LAB_NOTE_RE = /^[A-Za-z0-9 .\-]{1,12}$/;

/** Nama penunjuk: huruf kecil dulu, maksimal 6 karakter. Mis. `i`, `j`, `kiri`. */
export const LAB_POINTER_NAME_RE = /^[a-z][a-z0-9]{0,5}$/;

/**
 * Nada sorotan. Warna sesungguhnya dipetakan di `components/lab/labTone.ts` —
 * modul netral ini tidak boleh tahu apa pun tentang kelas Tailwind.
 */
export type LabTone = "sorot" | "banding" | "hasil" | "buang";

export const LAB_TONES: readonly LabTone[] = ["sorot", "banding", "hasil", "buang"];

export function isLabTone(raw: unknown): raw is LabTone {
  return typeof raw === "string" && (LAB_TONES as readonly string[]).includes(raw);
}

export type LabPointerTone = "utama" | "kedua";

export const LAB_POINTER_TONES: readonly LabPointerTone[] = ["utama", "kedua"];

export function isLabPointerTone(raw: unknown): raw is LabPointerTone {
  return raw === "utama" || raw === "kedua";
}

/**
 * Sorotan rentang indeks, INKLUSIF di kedua ujung.
 *
 * Sengaja berbeda dari `Array.prototype.slice`: di layar, rentang "2 sampai 4"
 * yang menyorot tiga sel adalah yang dibaca manusia. Label di antarmuka
 * berbunyi "sampai (termasuk)" supaya tidak ada yang menebak.
 */
export interface LabRange {
  from: number;
  to: number;
  tone: LabTone;
}

/**
 * Penunjuk bernama yang menempel pada satu indeks.
 *
 * Indeksnya boleh bernilai `items.length` — slot "lepas" (past-the-end) yang
 * digambar putus-putus. Justru posisi itulah yang mengajarkan kenapa `i < n`
 * berhenti di sana; melarangnya akan menghapus setengah pelajaran tentang loop.
 */
export interface LabPointer {
  name: string;
  index: number;
  tone: LabPointerTone;
}

/**
 * Satu langkah animasi sekaligus satu kalimat narasi.
 *
 * `state` adalah keadaan SESUDAH langkah ini, bukan selisihnya. Dengan begitu
 * papan menjadi fungsi murni dari keadaan: tidak ada pembukuan animasi di
 * komponen, undo cukup memilih snapshot lain, dan mode hemat gerak tinggal
 * merender langkah terakhir.
 */
export interface LabStep<S> {
  state: S;
  /** Bahasa Indonesia, satu kalimat, harus lengkap berdiri sendiri. */
  narasi: string;
  /**
   * Indeks yang disorot sesaat di langkah ini. Satu indeks = sel yang sedang
   * dibahas (berdenyut); lebih dari satu = sekelompok sel (cincin diam) —
   * banyak sel yang berdenyut bersamaan justru membuat mata tidak tahu harus
   * melihat ke mana.
   */
  fokus: number[];
  tahanMs: number;
  /** Warna asal sel selama sebuah transformasi; lihat `LabKelompok`. */
  kelompok?: LabKelompok;
  /**
   * Id sel yang SUDAH dikunjungi penelusuran, berurutan. Papan menggambarnya
   * sebagai nomor urut di setiap sel dan garis berpanah di antaranya, supaya
   * pola penelusuran (baris demi baris, kolom demi kolom, …) terlihat utuh,
   * bukan cuma satu sel yang berpindah-pindah.
   */
  jalur?: number[];
  /**
   * Peran setiap sel dalam algoritma pengurutan (id sel → peran), mis. sedang
   * dibandingkan, pivot, sudah di tempat akhir. Mengalahkan warna lain.
   */
  peran?: Record<number, LabPeran>;
  /** Label kecil di atas sel (id sel → teks), mis. "j", "min", "pivot". */
  labelSel?: Record<number, string>;
}

/**
 * Peran sel selama pengurutan. Sengaja sedikit: setiap peran punya satu warna
 * dan satu kalimat di legenda, dan siswa harus bisa mengingat semuanya.
 */
export type LabPeran = "banding" | "kunci" | "pivot" | "sementara" | "terurut" | "luar";

/**
 * Pewarnaan sel menurut ASALNYA selama transformasi.
 *
 * Kuncinya id sel, bukan posisinya: warnanya menempel di sel dan ikut
 * berpindah. Dengan begitu "baris 0 menjadi kolom 0" terlihat sebagai deretan
 * sel biru yang berdiri tegak, bukan harus dipercaya dari narasi saja.
 */
export interface LabKelompok {
  /** Id sel → nomor warna (0 sampai LAB_MAX_KELOMPOK − 1). */
  warna: Record<number, number>;
  /** Nama tiap nomor warna untuk legenda, mis. "baris 0 semula". */
  label: string[];
}

/** Hasil sebuah operasi lab: berhasil dengan langkah-langkahnya, atau pesan galat. */
export type LabOpResult<S> =
  | { ok: true; steps: LabStep<S>[] }
  | { ok: false; error: string };

/**
 * Membersihkan masukan teks dari pengguna: buang spasi tepi, rapatkan spasi
 * ganda, dan buang karakter kendali. Dipakai sebelum SETIAP validasi regex —
 * karakter kendali tidak terlihat di layar tapi merusak URL dan narasi.
 */
export function cleanLabText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bilangan bulat dalam rentang tertutup, atau null. Tidak pernah membulatkan diam-diam. */
export function parseLabInt(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : Number(cleanLabText(raw));
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}
