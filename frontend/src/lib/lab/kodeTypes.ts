/**
 * Bentuk jejak eksekusi yang dipakai BERSAMA lab Python (Lab 04) dan
 * Pseudocode (Lab 05).
 *
 * Mesinnya berbeda (Pyodide di Web Worker vs interpreter TypeScript), tetapi
 * keduanya merekam program menjadi `JejakKode` yang sama — sehingga editor,
 * panel variabel, konsol, dan pemutar langkah ditulis sekali. Lab bahasa lain
 * kelak cukup menghasilkan bentuk ini.
 *
 * Seperti Python Tutor, satu langkah = keadaan SEBELUM baris `baris`
 * dijalankan. Langkah terakhir (`baris: null`) = keadaan setelah program
 * selesai atau berhenti.
 *
 * Modul netral.
 */

export interface VariabelKode {
  nama: string;
  /** Sudah diformat untuk ditampilkan (repr Python / nilai pseudocode). */
  nilai: string;
  /** "INTEGER", "int", "list", … — sesuai bahasanya. */
  jenis: string;
  /** "global" atau nama fungsi/prosedur pemiliknya. */
  lingkup: string;
}

export interface LangkahKode {
  /** Baris (1-based) yang AKAN dijalankan; null = sesudah program berakhir. */
  baris: number | null;
  vars: VariabelKode[];
  /**
   * Panjang keluaran sampai langkah ini — tampilannya `jejak.keluaran.slice(0, n)`.
   * Angka, bukan salinan teks: 2000 langkah × keluaran puluhan ribu karakter
   * terlalu boros memori (dan harus dikirim utuh dari Web Worker Python).
   */
  panjangKeluaran: number;
  /** Nama fungsi/prosedur yang sedang aktif, terluar dulu. */
  tumpukan: string[];
}

export interface GalatKode {
  baris: number | null;
  /** Nama jenis galat, mis. "NameError" atau "Galat tipe". */
  jenis: string;
  pesan: string;
  /** Penjelasan ramah berbahasa Indonesia, bila ada. */
  saran: string | null;
}

export interface JejakKode {
  langkah: LangkahKode[];
  keluaran: string;
  galat: GalatKode | null;
  /** True bila perekaman langkah dihentikan di batasnya (program mungkin tetap selesai). */
  terpotong: boolean;
}

/** Batas langkah yang DIREKAM untuk diputar ulang. */
export const KODE_MAKS_REKAM = 2000;
/** Batas panjang kode sumber. */
export const KODE_MAKS_KARAKTER = 20_000;
/** Batas panjang teks masukan. */
export const KODE_MAKS_MASUKAN = 5_000;

/** Contoh siap pakai di menu Contoh kedua lab kode. */
export interface ContohKode {
  id: string;
  nama: string;
  ket: string;
  /** Satu nilai per baris. */
  masukan: string;
  kode: string;
}

const teksMaks = (v: unknown, maks: number): v is string => typeof v === "string" && v.length <= maks;
const bulatSah = (v: unknown, min: number, maks: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks;

/**
 * Jejak yang sah, atau null. Pintu masuk hasil dari Web Worker Python: kode
 * siswa berjalan DI worker itu, jadi pesan yang datang darinya tidak lebih
 * tepercaya dari tautan siapa saja — bentuknya diperiksa sebelum dirender.
 */
export function sahkanJejak(raw: unknown): JejakKode | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!teksMaks(r.keluaran, 1_000_000) || typeof r.terpotong !== "boolean") return null;
  if (!Array.isArray(r.langkah) || r.langkah.length > KODE_MAKS_REKAM + 1) return null;
  const langkah: LangkahKode[] = [];
  for (const x of r.langkah) {
    if (!x || typeof x !== "object") return null;
    const l = x as Record<string, unknown>;
    if (!(l.baris === null || bulatSah(l.baris, 1, 1_000_000))) return null;
    if (!bulatSah(l.panjangKeluaran, 0, r.keluaran.length)) return null;
    if (!Array.isArray(l.tumpukan) || l.tumpukan.length > 10_000 || !l.tumpukan.every((t) => teksMaks(t, 200))) return null;
    if (!Array.isArray(l.vars) || l.vars.length > 100) return null;
    const vars: VariabelKode[] = [];
    for (const y of l.vars) {
      if (!y || typeof y !== "object") return null;
      const v = y as Record<string, unknown>;
      if (!teksMaks(v.nama, 200) || !teksMaks(v.nilai, 400) || !teksMaks(v.jenis, 200) || !teksMaks(v.lingkup, 200)) return null;
      vars.push({ nama: v.nama, nilai: v.nilai, jenis: v.jenis, lingkup: v.lingkup });
    }
    langkah.push({ baris: l.baris as number | null, vars, panjangKeluaran: l.panjangKeluaran, tumpukan: l.tumpukan as string[] });
  }
  let galat: GalatKode | null = null;
  if (r.galat !== null) {
    if (!r.galat || typeof r.galat !== "object") return null;
    const g = r.galat as Record<string, unknown>;
    if (!(g.baris === null || bulatSah(g.baris, 1, 1_000_000))) return null;
    if (!teksMaks(g.jenis, 200) || !teksMaks(g.pesan, 20_000) || !(g.saran === null || teksMaks(g.saran, 2_000))) return null;
    galat = { baris: g.baris as number | null, jenis: g.jenis, pesan: g.pesan, saran: g.saran as string | null };
  }
  return { langkah, keluaran: r.keluaran, galat, terpotong: r.terpotong };
}
