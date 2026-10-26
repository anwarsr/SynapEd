/**
 * Tema KUSTOM: pengguna memilih empat warna, sisanya diturunkan.
 *
 * Modul netral (tanpa `server-only`, tanpa impor `@/`): dipakai pengalih tema di
 * profil dan diuji lewat skrip. Hasilnya berupa daftar variabel CSS yang
 * dipasang LANGSUNG di <html> (inline menang atas blok `html[data-theme]` di
 * globals.css), jadi seluruh situs yang sudah memakai token ikut berubah.
 *
 * Latar terang/gelap ditentukan dari kecerahan warna Latar: latar terang memakai
 * struktur tema TERANG yang sudah ada (`data-theme="light"` + `--color-white`
 * dibalik jadi warna Teks, sehingga `text-white`/`bg-white/NN` ikut berbalik),
 * latar gelap memakai struktur tema gelap bawaan.
 *
 * Disimpan di localStorage sebagai CSS jadi (`synaped_theme_css`) supaya skrip
 * kecil di <head> bisa memasangnya sebelum cat pertama tanpa menghitung ulang.
 */

export interface PaletKustom {
  /** Latar halaman. */
  latar: string;
  /** Permukaan kartu & panel. */
  kartu: string;
  /** Warna tulisan utama. */
  teks: string;
  /** Aksen: tombol, tautan, penanda aktif. */
  aksen: string;
}

export const KUNCI_TEMA = "synaped_theme";
export const KUNCI_PALET = "synaped_theme_palet";
export const KUNCI_CSS = "synaped_theme_css";
export const KUNCI_MODE = "synaped_theme_mode";

export const PALET_BAWAAN: PaletKustom = { latar: "#0B1A24", kartu: "#12293A", teks: "#FFFFFF", aksen: "#2F6FED" };

/** Titik awal siap pakai; tetap bisa disunting satu per satu. */
export const PALET_CONTOH: { nama: string; palet: PaletKustom }[] = [
  { nama: "Samudra", palet: { latar: "#0A1628", kartu: "#12233D", teks: "#F1F6FF", aksen: "#3B82F6" } },
  { nama: "Hutan", palet: { latar: "#0E1F1A", kartu: "#16302A", teks: "#EEF8F3", aksen: "#10B981" } },
  { nama: "Senja", palet: { latar: "#1B1424", kartu: "#2A2038", teks: "#F8F1FF", aksen: "#A855F7" } },
  { nama: "Kertas", palet: { latar: "#FAF6EE", kartu: "#EFE8D8", teks: "#2A2418", aksen: "#B45309" } },
  { nama: "Es", palet: { latar: "#F2F8FC", kartu: "#E0EEF7", teks: "#0E2233", aksen: "#0284C7" } },
];

/** Seluruh variabel yang dipasang tema kustom (dipakai juga untuk melepasnya). */
export const NAMA_VARIABEL = [
  "--color-white",
  "--color-ivory",
  "--color-paper",
  "--color-paper-alt",
  "--color-paper-card",
  "--color-rule",
  "--color-rule-strong",
  "--color-ink",
  "--color-ink-body",
  "--color-ink-muted",
  "--color-ink-faint",
  "--color-blue-50",
  "--color-blue-100",
  "--color-blue-200",
  "--color-blue-300",
  "--color-blue-400",
  "--color-blue-500",
  "--color-blue-600",
  "--color-blue-700",
  "--color-blue-800",
  "--color-card-hover",
  "--color-header",
  "--color-banner",
  "--color-chip",
  "--color-deep",
  "--grid-line",
] as const;

type RGB = [number, number, number];

const RE_HEX = /^#[0-9a-fA-F]{6}$/;

export function hexSah(x: unknown): x is string {
  return typeof x === "string" && RE_HEX.test(x);
}

/** Palet dari data tak tepercaya (localStorage): setiap warna harus #RRGGBB, selain itu bawaan. */
export function sahkanPalet(raw: unknown): PaletKustom {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    latar: hexSah(r.latar) ? r.latar : PALET_BAWAAN.latar,
    kartu: hexSah(r.kartu) ? r.kartu : PALET_BAWAAN.kartu,
    teks: hexSah(r.teks) ? r.teks : PALET_BAWAAN.teks,
    aksen: hexSah(r.aksen) ? r.aksen : PALET_BAWAAN.aksen,
  };
}

function rgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function hex([r, g, b]: RGB): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Campuran linear: t=0 → a, t=1 → b. */
function campur(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function rgba(h: string, alfa: number): string {
  const [r, g, b] = rgb(h);
  return `rgb(${r} ${g} ${b} / ${alfa})`;
}

/** Kecerahan relatif WCAG 2 (0 gelap … 1 terang). */
export function kecerahan(h: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rasio kontras WCAG antara dua warna (1 … 21). */
export function kontras(a: string, b: string): number {
  const la = kecerahan(a);
  const lb = kecerahan(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface HasilTema {
  vars: Record<string, string>;
  /** Latar terang → struktur tema terang (`data-theme="light"`). */
  terang: boolean;
  /** Peringatan yang perlu diperlihatkan ke pengguna (kontras rendah, dsb.). */
  peringatan: string[];
}

export function hitungTema(p: PaletKustom): HasilTema {
  const terang = kecerahan(p.latar) > 0.4;
  const PUTIH = "#FFFFFF";
  const HITAM = "#000000";

  // Isi tombol harus terbaca dengan tulisan putih: aksen yang terlalu terang digelapkan.
  let isi = p.aksen;
  while (kontras(isi, PUTIH) < 3.2 && kecerahan(isi) > 0.02) isi = campur(isi, HITAM, 0.12);

  const vars: Record<string, string> = {
    "--color-ivory": p.latar,
    "--color-paper": p.latar,
    "--color-paper-card": p.kartu,
    "--color-paper-alt": campur(p.kartu, p.teks, 0.05),
    "--color-card-hover": campur(p.kartu, p.teks, 0.09),
    "--color-header": terang ? campur(p.latar, p.teks, 0.05) : campur(p.latar, HITAM, 0.28),
    "--color-banner": campur(p.kartu, p.latar, 0.5),
    "--color-chip": campur(p.kartu, p.aksen, 0.2),
    "--color-deep": campur(p.latar, p.kartu, 0.5),
    "--color-rule": rgba(p.teks, 0.1),
    "--color-rule-strong": rgba(p.teks, 0.18),
    "--color-ink": p.teks,
    "--color-ink-body": rgba(p.teks, 0.8),
    "--color-ink-muted": rgba(p.teks, 0.6),
    "--color-ink-faint": rgba(p.teks, 0.32),
    "--color-blue-50": rgba(p.aksen, 0.12),
    "--color-blue-100": rgba(p.aksen, 0.22),
    "--color-blue-200": terang ? campur(p.aksen, HITAM, 0.4) : campur(p.aksen, PUTIH, 0.7),
    "--color-blue-300": terang ? campur(p.aksen, HITAM, 0.2) : campur(p.aksen, PUTIH, 0.5),
    "--color-blue-400": terang ? p.aksen : campur(p.aksen, PUTIH, 0.25),
    "--color-blue-500": p.aksen,
    "--color-blue-600": isi,
    // Teks aksen: terang di latar gelap, digelapkan di latar terang agar terbaca.
    "--color-blue-700": terang ? campur(isi, HITAM, 0.2) : campur(p.aksen, PUTIH, 0.35),
    "--color-blue-800": campur(isi, HITAM, 0.3),
    "--grid-line": rgba(p.teks, terang ? 0.07 : 0.06),
  };
  // Struktur terang membalik `--color-white` jadi warna Teks (lihat globals.css).
  if (terang) vars["--color-white"] = p.teks;

  const peringatan: string[] = [];
  if (kontras(p.teks, p.latar) < 4.5) peringatan.push("Teks dan latar kurang kontras, tulisan bisa sulit dibaca.");
  if (kontras(p.teks, p.kartu) < 4.5) peringatan.push("Teks dan kartu kurang kontras.");
  if (kontras(p.aksen, p.latar) < 2) peringatan.push("Aksen hampir sama dengan latar.");
  return { vars, terang, peringatan };
}

export function cssDari(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

// ── Penerapan di browser ────────────────────────────────────────────────

/** Memasang palet ke <html> dan menyimpannya. Dipanggil dari event handler (bukan saat render). */
export function terapkanTemaKustom(p: PaletKustom): HasilTema {
  const h = hitungTema(p);
  const root = document.documentElement;
  for (const n of NAMA_VARIABEL) root.style.removeProperty(n);
  for (const [k, v] of Object.entries(h.vars)) root.style.setProperty(k, v);
  if (h.terang) root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");

  try {
    localStorage.setItem(KUNCI_TEMA, "custom");
    localStorage.setItem(KUNCI_PALET, JSON.stringify(p));
    localStorage.setItem(KUNCI_CSS, cssDari(h.vars));
    localStorage.setItem(KUNCI_MODE, h.terang ? "light" : "dark");
  } catch {
    // penyimpanan diblokir: tema tetap berlaku sampai halaman dimuat ulang
  }
  return h;
}

/** Melepas semua variabel kustom (kembali ke Gelap/Terang bawaan). */
export function lepasTemaKustom(): void {
  const root = document.documentElement;
  for (const n of NAMA_VARIABEL) root.style.removeProperty(n);
}

export function bacaPaletTersimpan(): PaletKustom {
  try {
    return sahkanPalet(JSON.parse(localStorage.getItem(KUNCI_PALET) ?? "null"));
  } catch {
    return PALET_BAWAAN;
  }
}
