/**
 * Bentuk katalog operasi dan penolong form yang dipakai SEMUA lab.
 *
 * Panel operasi di layar digenerate dari katalog — tidak ditulis tangan per
 * operasi. Dengan satu bentuk katalog untuk 1D, 2D, dan N-dimensi, panel itu
 * cukup satu komponen; tiga panel tulisan tangan adalah tiga tempat yang
 * harus diingat setiap kali sebuah isian baru diperkenalkan.
 *
 * Modul NETRAL tanpa impor alias `@/`: dipakai komponen klien dan skrip uji.
 */
import { cleanLabText, parseLabInt } from "./labTypes";

/**
 * Satu kolom masukan.
 *
 * `min`/`max`/`maxLength` adalah PETUNJUK untuk atribut input, bukan aturan
 * kebenaran: keyboard bisa dilewati. Penolakan yang sesungguhnya — beserta
 * kalimat galatnya — ada di reducer masing-masing lab.
 *
 * `teksBaris` dirender sebagai area teks beberapa baris (mis. isi array 2D,
 * satu baris array per baris teks).
 */
export interface OpField {
  name: string;
  label: string;
  kind: "teks" | "teksBaris" | "angka" | "nada" | "penunjukNama" | "penunjukNada" | "pilihan";
  /** Untuk `pilihan`: daftar pilihan; yang pertama menjadi nilai bawaan. */
  opsi?: readonly { nilai: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface OpSpecOf<K extends string, G extends string, Op> {
  kind: K;
  label: string;
  grup: G;
  /** Satu kalimat untuk tooltip dan pembaca layar. */
  ringkas: string;
  fields: OpField[];
  /** Operasi contoh yang pasti sah — dipakai skrip uji. */
  contoh: Op;
}

/**
 * Batas longgar untuk angka yang masuk dari form.
 *
 * SENGAJA jauh lebih lebar dari batas papan: kalau indeks 99 ditolak di sini,
 * yang muncul di layar adalah "masukan tidak lengkap", padahal reducer punya
 * kalimat yang sesungguhnya menjelaskan ("baris yang ada hanya 0 sampai 2").
 * Penolong di bawah hanya memeriksa BENTUK; domainnya diputuskan di satu
 * tempat saja.
 */
const BATAS_ANGKA_BENTUK = 1000000;

export function formAngka(nilai: Record<string, string>, name: string): number | null {
  // Kolom kosong diperiksa SENDIRI lebih dulu: `Number("")` bernilai 0 dan 0
  // adalah bilangan bulat yang sah, jadi form yang belum diisi akan berubah
  // menjadi "indeks 0" — operasi yang tidak pernah diminta siapa pun.
  if (cleanLabText(nilai[name]).length === 0) return null;
  return parseLabInt(nilai[name], -BATAS_ANGKA_BENTUK, BATAS_ANGKA_BENTUK);
}

/** Teks apa adanya; pembersihan dan validasinya tugas reducer. */
export function formTeks(nilai: Record<string, string>, name: string): string {
  const raw: unknown = nilai[name];
  return typeof raw === "string" ? raw : "";
}

/** Teks yang wajib ada isinya — null berarti form belum lengkap. */
export function formTeksWajib(nilai: Record<string, string>, name: string): string | null {
  const raw = formTeks(nilai, name);
  return cleanLabText(raw).length > 0 ? raw : null;
}
