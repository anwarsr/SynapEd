/**
 * Geometri flowchart: bentuk simpul, titik sambung, rute garis siku, dan
 * pembungkusan teks.
 *
 * Semuanya fungsi murni atas ANGKA — dipakai kanvas (React) DAN pengekspor
 * SVG/PNG, supaya gambar yang diunduh persis sama dengan yang di layar. Modul
 * netral: tidak menyentuh DOM, jadi hasilnya identik di server dan browser
 * (tidak ada hydration mismatch) dan bisa diuji `verify-flowchart`.
 */
import { FLOW_GRID, type Diagram, type Garis, type Simpul, type Sisi } from "./flowTypes";

export interface Titik {
  x: number;
  y: number;
}

/** Garis kerangka bentuk: `d` = badan (diisi warna), `tambahan` = garis hias tanpa isi. */
export interface Bentuk {
  d: string;
  tambahan: string | null;
  /** Catatan digambar tanpa isi & tanpa bingkai penuh. */
  tanpaIsi: boolean;
}

const r = (n: number) => Math.round(n * 10) / 10;

export function bentukSimpul(s: Pick<Simpul, "jenis" | "x" | "y" | "w" | "h">): Bentuk {
  const { x, y, w, h } = s;
  const kanan = x + w;
  const bawah = y + h;
  const tx = x + w / 2;
  const ty = y + h / 2;

  switch (s.jenis) {
    case "mulai":
    case "selesai": {
      const rad = Math.min(h / 2, w / 2);
      return {
        d: `M${r(x + rad)},${r(y)} L${r(kanan - rad)},${r(y)} A${r(rad)},${r(rad)} 0 0 1 ${r(kanan - rad)},${r(bawah)} L${r(x + rad)},${r(bawah)} A${r(rad)},${r(rad)} 0 0 1 ${r(x + rad)},${r(y)} Z`,
        tambahan: null,
        tanpaIsi: false,
      };
    }
    case "io": {
      const m = miringIo(w, h);
      return { d: `M${r(x + m)},${r(y)} L${r(kanan)},${r(y)} L${r(kanan - m)},${r(bawah)} L${r(x)},${r(bawah)} Z`, tambahan: null, tanpaIsi: false };
    }
    case "keputusan":
      return { d: `M${r(tx)},${r(y)} L${r(kanan)},${r(ty)} L${r(tx)},${r(bawah)} L${r(x)},${r(ty)} Z`, tambahan: null, tanpaIsi: false };
    case "persiapan": {
      const m = Math.min(h * 0.4, w * 0.2);
      return {
        d: `M${r(x + m)},${r(y)} L${r(kanan - m)},${r(y)} L${r(kanan)},${r(ty)} L${r(kanan - m)},${r(bawah)} L${r(x + m)},${r(bawah)} L${r(x)},${r(ty)} Z`,
        tambahan: null,
        tanpaIsi: false,
      };
    }
    case "subproses": {
      const g = Math.min(12, w * 0.1);
      return {
        d: `M${r(x)},${r(y)} H${r(kanan)} V${r(bawah)} H${r(x)} Z`,
        tambahan: `M${r(x + g)},${r(y)} V${r(bawah)} M${r(kanan - g)},${r(y)} V${r(bawah)}`,
        tanpaIsi: false,
      };
    }
    case "konektor": {
      const rx = w / 2;
      const ry = h / 2;
      return {
        d: `M${r(x)},${r(ty)} A${r(rx)},${r(ry)} 0 1 1 ${r(kanan)},${r(ty)} A${r(rx)},${r(ry)} 0 1 1 ${r(x)},${r(ty)} Z`,
        tambahan: null,
        tanpaIsi: false,
      };
    }
    case "dokumen": {
      const yg = y + h * 0.85;
      return {
        d: `M${r(x)},${r(y)} H${r(kanan)} V${r(yg)} Q${r(x + w * 0.75)},${r(y + h * 0.7)} ${r(tx)},${r(yg)} T${r(x)},${r(yg)} Z`,
        tambahan: null,
        tanpaIsi: false,
      };
    }
    case "data": {
      const ry = elipsData(w, h);
      const rx = w / 2;
      return {
        d: `M${r(x)},${r(y + ry)} A${r(rx)},${r(ry)} 0 0 1 ${r(kanan)},${r(y + ry)} V${r(bawah - ry)} A${r(rx)},${r(ry)} 0 0 1 ${r(x)},${r(bawah - ry)} Z`,
        tambahan: `M${r(x)},${r(y + ry)} A${r(rx)},${r(ry)} 0 0 0 ${r(kanan)},${r(y + ry)}`,
        tanpaIsi: false,
      };
    }
    case "catatan":
      // Simbol anotasi ISO 5807: kurung siku terbuka di kiri, tanpa isi.
      return {
        d: `M${r(x)},${r(y)} H${r(kanan)} V${r(bawah)} H${r(x)} Z`,
        tambahan: `M${r(x + 14)},${r(y)} H${r(x)} V${r(bawah)} H${r(x + 14)}`,
        tanpaIsi: true,
      };
    case "proses":
    default:
      return { d: `M${r(x)},${r(y)} H${r(kanan)} V${r(bawah)} H${r(x)} Z`, tambahan: null, tanpaIsi: false };
  }
}

function miringIo(w: number, h: number): number {
  return Math.min(h * 0.4, w * 0.2);
}

function elipsData(w: number, h: number): number {
  return Math.min(h * 0.15, 12, w / 4);
}

/** Lebar area teks di dalam bentuk (bentuk miring/ketupat lebih sempit dari kotaknya). */
export function lebarTeks(s: Pick<Simpul, "jenis" | "w" | "h">): number {
  switch (s.jenis) {
    case "keputusan":
      return s.w * 0.62;
    case "io":
      return s.w - miringIo(s.w, s.h) * 2 - 8;
    case "persiapan":
      return s.w - Math.min(s.h * 0.4, s.w * 0.2) * 2 - 4;
    case "subproses":
      return s.w - 2 * Math.min(12, s.w * 0.1) - 8;
    case "mulai":
    case "selesai":
      return s.w - s.h * 0.5;
    case "konektor":
      return s.w * 0.75;
    default:
      return s.w - 14;
  }
}

/** Titik sambung di satu sisi bentuk. */
export function titikSisi(s: Pick<Simpul, "jenis" | "x" | "y" | "w" | "h">, sisi: Sisi): Titik {
  const { x, y, w, h } = s;
  const tx = x + w / 2;
  const ty = y + h / 2;
  // Jajar genjang: titik tengah sisi miringnya, bukan tepi kotak (yang kosong).
  const m = s.jenis === "io" ? miringIo(w, h) / 2 : 0;
  switch (sisi) {
    case "atas":
      return { x: tx, y };
    case "bawah":
      return { x: tx, y: s.jenis === "dokumen" ? y + h * 0.85 : y + h };
    case "kiri":
      return { x: x + m, y: ty };
    case "kanan":
      return { x: x + w - m, y: ty };
  }
}

const ARAH: Record<Sisi, Titik> = {
  atas: { x: 0, y: -1 },
  bawah: { x: 0, y: 1 },
  kiri: { x: -1, y: 0 },
  kanan: { x: 1, y: 0 },
};

const tegak = (s: Sisi) => s === "atas" || s === "bawah";

/** Jarak garis keluar lurus dari bentuk sebelum berbelok. */
export const JARAK_KELUAR = 20;

/**
 * Rute garis siku (ortogonal) dari sisi `sa` titik `a` ke sisi `sb` titik `b`,
 * seperti gaya bawaan draw.io. Setiap ruas mendatar ATAU tegak — diuji
 * `verify-flowchart`.
 *
 * Garis selalu keluar lurus sejauh JARAK_KELUAR dulu, supaya panah tidak
 * menempel menyusuri tepi bentuk. Dua sisi yang sama (kiri→kiri, bawah→bawah)
 * menghasilkan "kurung" di luar kedua bentuk — bentuk khas garis balik pada
 * perulangan.
 */
export function ruteGaris(a: Titik, sa: Sisi, b: Titik, sb: Sisi): Titik[] {
  const da = ARAH[sa];
  const db = ARAH[sb];
  const a1 = { x: a.x + da.x * JARAK_KELUAR, y: a.y + da.y * JARAK_KELUAR };
  const b1 = { x: b.x + db.x * JARAK_KELUAR, y: b.y + db.y * JARAK_KELUAR };

  let tengah: Titik[];
  if (tegak(sa) && tegak(sb)) {
    let my = (a1.y + b1.y) / 2;
    if (sa === sb) my = sa === "bawah" ? Math.max(a1.y, b1.y) : Math.min(a1.y, b1.y);
    tengah = [{ x: a1.x, y: my }, { x: b1.x, y: my }];
  } else if (!tegak(sa) && !tegak(sb)) {
    let mx = (a1.x + b1.x) / 2;
    if (sa === sb) mx = sa === "kanan" ? Math.max(a1.x, b1.x) : Math.min(a1.x, b1.x);
    tengah = [{ x: mx, y: a1.y }, { x: mx, y: b1.y }];
  } else if (tegak(sa)) {
    tengah = [{ x: a1.x, y: b1.y }];
  } else {
    tengah = [{ x: b1.x, y: a1.y }];
  }

  return rapikan([a, a1, ...tengah, b1, b]);
}

/** Membuang titik ganda dan titik di tengah ruas lurus. */
function rapikan(t: Titik[]): Titik[] {
  const unik = t.filter((p, i) => i === 0 || p.x !== t[i - 1].x || p.y !== t[i - 1].y);
  return unik.filter((p, i) => {
    if (i === 0 || i === unik.length - 1) return true;
    const s = unik[i - 1];
    const n = unik[i + 1];
    return !((s.x === p.x && p.x === n.x) || (s.y === p.y && p.y === n.y));
  });
}

export function dGaris(t: readonly Titik[]): string {
  return t.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ");
}

/** Rute lengkap sebuah garis di diagram, atau null kalau ujungnya hilang. */
export function titikGaris(diagram: Pick<Diagram, "simpul">, g: Garis): Titik[] | null {
  const dari = diagram.simpul.find((s) => s.id === g.dari);
  const ke = diagram.simpul.find((s) => s.id === g.ke);
  if (!dari || !ke) return null;
  return ruteGaris(titikSisi(dari, g.dariSisi), g.dariSisi, titikSisi(ke, g.keSisi), g.keSisi);
}

/** Posisi label garis: dekat pangkalnya, di samping ruas pertama — "Ya"/"Tidak" terbaca milik keputusan yang mana. */
export function posisiLabel(t: readonly Titik[]): Titik {
  const a = t[0];
  const b = t[1] ?? a;
  const mendatar = a.y === b.y;
  const panjang = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const maju = Math.min(14, panjang / 2);
  const ux = (b.x - a.x) / panjang;
  const uy = (b.y - a.y) / panjang;
  return mendatar ? { x: a.x + ux * maju + ux * 4, y: a.y - 9 } : { x: a.x + 12, y: a.y + uy * maju };
}

/** Sisi bentuk yang paling dekat dengan sebuah titik. */
export function sisiTerdekat(s: Pick<Simpul, "jenis" | "x" | "y" | "w" | "h">, p: Titik): Sisi {
  let terbaik: Sisi = "atas";
  let jarak = Infinity;
  for (const sisi of ["atas", "kanan", "bawah", "kiri"] as const) {
    const q = titikSisi(s, sisi);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < jarak) {
      jarak = d;
      terbaik = sisi;
    }
  }
  return terbaik;
}

/**
 * Sisi pasangan yang wajar untuk garis baru dari `dari` ke `ke`: alur atas→bawah
 * bila tujuan di bawah, kiri↔kanan bila sejajar.
 */
export function sisiOtomatis(dari: Simpul, ke: Simpul): { dariSisi: Sisi; keSisi: Sisi } {
  const dx = ke.x + ke.w / 2 - (dari.x + dari.w / 2);
  const dy = ke.y + ke.h / 2 - (dari.y + dari.h / 2);
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? { dariSisi: "bawah", keSisi: "atas" } : { dariSisi: "atas", keSisi: "bawah" };
  return dx >= 0 ? { dariSisi: "kanan", keSisi: "kiri" } : { dariSisi: "kiri", keSisi: "kanan" };
}

export function jepret(v: number): number {
  return Math.round(v / FLOW_GRID) * FLOW_GRID;
}

export interface Kotak {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Kotak pembatas seluruh diagram (simpul + rute garis), atau null bila kosong. */
export function batasDiagram(diagram: Diagram): Kotak | null {
  if (diagram.simpul.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  const tambah = (x: number, y: number) => {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  };
  for (const s of diagram.simpul) {
    tambah(s.x, s.y);
    tambah(s.x + s.w, s.y + s.h);
  }
  for (const g of diagram.garis) for (const p of titikGaris(diagram, g) ?? []) tambah(p.x, p.y);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ── Teks ────────────────────────────────────────────────────────────────

export const UKURAN_FONT = 13;
export const TINGGI_BARIS = 16;

/**
 * Perkiraan lebar teks tanpa DOM. Sengaja perkiraan (bukan measureText):
 * hasilnya harus SAMA di server, di browser, dan di berkas ekspor — kalau
 * diukur dengan font sungguhan, pembungkusan bisa berbeda di render server
 * dan klien.
 */
function lebarKira(s: string, font: number): number {
  let n = 0;
  for (const c of s) n += /[mwMW@]/.test(c) ? 0.85 : /[iljtf.,:;'|!]/.test(c) ? 0.32 : /[A-Z0-9]/.test(c) ? 0.64 : 0.55;
  return n * font;
}

/**
 * Membungkus teks ke baris-baris yang muat di `lebar`, maksimal `maksBaris`
 * (baris terakhir diberi "…" bila terpotong). Baris baru eksplisit dihormati.
 */
export function bungkusTeks(teks: string, lebar: number, maksBaris: number, font = UKURAN_FONT): string[] {
  const hasil: string[] = [];
  const muat = (s: string) => lebarKira(s, font) <= lebar;

  for (const paragraf of teks.split(/\r?\n/)) {
    let baris = "";
    for (const kata of paragraf.split(/\s+/).filter(Boolean)) {
      const calon = baris ? `${baris} ${kata}` : kata;
      if (muat(calon)) {
        baris = calon;
        continue;
      }
      if (baris) hasil.push(baris);
      // Kata yang sendirian pun tidak muat dipenggal per karakter.
      let sisa = kata;
      while (!muat(sisa) && sisa.length > 1) {
        let n = sisa.length - 1;
        while (n > 1 && !muat(sisa.slice(0, n))) n--;
        hasil.push(sisa.slice(0, n));
        sisa = sisa.slice(n);
      }
      baris = sisa;
    }
    hasil.push(baris);
  }

  const maks = Math.max(1, maksBaris);
  if (hasil.length <= maks) return hasil;
  const potong = hasil.slice(0, maks);
  potong[maks - 1] = `${potong[maks - 1].replace(/.$/, "")}…`;
  return potong;
}

/** Baris teks sebuah simpul, siap digambar. */
export function barisSimpul(s: Simpul): string[] {
  const maks = Math.floor((s.h - (s.jenis === "keputusan" ? 24 : 8)) / TINGGI_BARIS);
  return bungkusTeks(s.teks, Math.max(10, lebarTeks(s)), maks);
}
