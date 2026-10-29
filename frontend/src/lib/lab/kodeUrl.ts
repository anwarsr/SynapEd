/**
 * Tautan & berkas lab kode: `/lab?py=…` (Python) dan `/lab?ps=…` (pseudocode).
 *
 * Isi tautan = digit versi + padatan JSON `{k: kode, m: masukan}` (lihat
 * `labKompres.ts`). Membaca bersifat SEMUA-ATAU-TIDAK seperti tautan lab lain:
 * bentuk salah, terlalu panjang, atau rusak → null, lab dibuka dengan contoh
 * dan pemberitahuan.
 *
 * Kode dari tautan TIDAK dijalankan saat dibuka — hanya ditampilkan di editor.
 * Pengguna sendiri yang menekan Jalankan.
 *
 * Modul netral; diuji `verify-kode`.
 */
import { KODE_MAKS_KARAKTER, KODE_MAKS_MASUKAN } from "./kodeTypes";
import { bukaPadatan, padatkan } from "./labKompres";

export type BahasaKode = "python" | "pseudocode";

export const KODE_URL_PARAM: Record<BahasaKode, string> = { python: "py", pseudocode: "ps" };
/** Sama dengan flowchart: aman untuk WhatsApp & peramban. */
export const KODE_MAX_URL = 8000;
/** Hasil buka padatan paling besar: kode + masukan maksimum, dengan ruang untuk escape JSON. */
const BATAS_BUKA = 256 * 1024;
const VERSI = "1";

export interface IsiKode {
  kode: string;
  masukan: string;
}

/** Satu-satunya pintu masuk isi kode dari luar (tautan, berkas, draf). */
export function sahkanIsi(raw: unknown): IsiKode | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.k !== "string" || typeof r.m !== "string") return null;
  if (r.k.length > KODE_MAKS_KARAKTER || r.m.length > KODE_MAKS_MASUKAN) return null;
  return { kode: r.k, masukan: r.m };
}

/** Kode tautan, atau null bila terlalu panjang untuk tautan (pakai berkas). */
export async function encodeKode(isi: IsiKode): Promise<string | null> {
  if (isi.kode.length > KODE_MAKS_KARAKTER || isi.masukan.length > KODE_MAKS_MASUKAN) return null;
  const padat = await padatkan(JSON.stringify({ k: isi.kode, m: isi.masukan }));
  if (!padat) return null;
  const kode = VERSI + padat;
  return kode.length <= KODE_MAX_URL ? kode : null;
}

export async function decodeKode(kode: string): Promise<IsiKode | null> {
  if (typeof kode !== "string" || kode.length < 2 || kode.length > KODE_MAX_URL || kode[0] !== VERSI) return null;
  const json = await bukaPadatan(kode.slice(1), BATAS_BUKA);
  if (json === null) return null;
  try {
    return sahkanIsi(JSON.parse(json));
  } catch {
    return null;
  }
}

// ── Berkas ──────────────────────────────────────────────────────────────

/** Berkas yang dibuka dari komputer; di atas ini ditolak sebelum dibaca. */
export const KODE_MAKS_BERKAS_BYTE = 200 * 1024;

/**
 * Berkas `.py`/`.txt` = kode polos (bisa dibuka & dijalankan di tempat lain),
 * jadi masukan tidak ikut. Akhir baris dinormalkan ke `\n`; BOM dibuang.
 */
export function berkasKeKode(isi: string): string | null {
  const bersih = isi.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (bersih.length > KODE_MAKS_KARAKTER) return null;
  // Berkas biner (gambar, PDF, …) yang salah pilih: karakter kendali selain tab/baris baru.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(bersih)) return null;
  return bersih;
}

// ── Draf browser ────────────────────────────────────────────────────────

export function drafKeTeks(isi: IsiKode): string {
  return JSON.stringify({ k: isi.kode, m: isi.masukan });
}

export function teksKeDraf(teks: string | null): IsiKode | null {
  if (!teks) return null;
  try {
    return sahkanIsi(JSON.parse(teks));
  } catch {
    return null;
  }
}
