/**
 * Logika murni Roda Pemilih (modul netral: dipakai komponen klien + skrip verifikasi).
 *
 * Roda hanya hidup di peramban pengajar (localStorage per kelas) - tanpa Firestore,
 * tanpa Server Action. Pemenang DIUNDI dulu (`acakIndeks`), baru roda diputar ke
 * sudut yang pasti berhenti di irisan itu (`sudutTujuan`), jadi hasilnya jujur dan
 * animasinya tak bisa "meleset".
 */

export const WHEEL_MAX_RODA = 12;
export const WHEEL_MAX_ITEM = 60;
export const WHEEL_MAX_NAMA_RODA = 40;
export const WHEEL_MAX_NAMA_ITEM = 40;
export const WHEEL_DURASI_MIN = 3;
export const WHEEL_DURASI_MAKS = 12;

export type PaletBawaan = "samudra" | "pelangi" | "hangat" | "hutan" | "mono";
/** "kustom" = warna pilihan pengajar sendiri (Wheel.warna). */
export type PaletId = PaletBawaan | "kustom";
export const WHEEL_MAX_WARNA = 8;
export const WHEEL_MIN_WARNA = 2;
export const WARNA_KUSTOM_AWAL: readonly string[] = ["#2F6FED", "#E5484D", "#2E9E5B", "#F08C00"];

export const PALET: Record<PaletBawaan, { label: string; warna: readonly string[] }> = {
  samudra: { label: "Samudra", warna: ["#2F6FED", "#1F4FB5", "#3E8BFF", "#173C8C", "#5B9BFF", "#254FA8"] },
  pelangi: { label: "Pelangi", warna: ["#E5484D", "#F08C00", "#C9A400", "#2E9E5B", "#2F6FED", "#8E4EC6"] },
  hangat: { label: "Hangat", warna: ["#C2410C", "#B45309", "#9F1239", "#A16207", "#BE123C", "#92400E"] },
  hutan: { label: "Hutan", warna: ["#166534", "#0F766E", "#3F6212", "#115E59", "#15803D", "#0E7490"] },
  mono: { label: "Mono", warna: ["#1F2A33", "#2C3A46", "#38495A", "#26323C", "#445769", "#303F4C"] },
};

export interface Wheel {
  id: string;
  name: string;
  items: string[];
  palet: PaletId;
  /** Warna roda kustom (heksa #rrggbb); dipakai bila palet = "kustom". */
  warna: string[];
  /** Nama pemenang muncul besar di tengah layar (layar diburamkan ±2 dtk). */
  popup: boolean;
  /** Pemenang dikeluarkan dari roda setelah terpilih (giliran tak berulang). */
  hapusPemenang: boolean;
  /** Lama putaran, detik. */
  durasi: number;
}

function bersihTeks(v: unknown, maks: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maks) : "";
}

export function rodaBaru(id: string, name: string, items: string[] = []): Wheel {
  return { id, name, items: items.slice(0, WHEEL_MAX_ITEM), palet: "samudra", warna: [...WARNA_KUSTOM_AWAL], popup: false, hapusPemenang: false, durasi: 6 };
}

/** Normaliser pembacaan localStorage: data rusak/lama tak boleh merusak halaman. */
export function bersihkanRoda(raw: unknown): Wheel[] {
  if (!Array.isArray(raw)) return [];
  const hasil: Wheel[] = [];
  const dipakai = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = bersihTeks(o.id, 40);
    if (!id || dipakai.has(id)) continue;
    dipakai.add(id);
    const items = Array.isArray(o.items)
      ? o.items.map((x) => bersihTeks(x, WHEEL_MAX_NAMA_ITEM)).filter(Boolean).slice(0, WHEEL_MAX_ITEM)
      : [];
    const warna = Array.isArray(o.warna)
      ? o.warna.filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase()).slice(0, WHEEL_MAX_WARNA)
      : [];
    const palet: PaletId =
      o.palet === "kustom" ? "kustom" : typeof o.palet === "string" && o.palet in PALET ? (o.palet as PaletBawaan) : "samudra";
    const durasi = typeof o.durasi === "number" && Number.isFinite(o.durasi)
      ? Math.min(WHEEL_DURASI_MAKS, Math.max(WHEEL_DURASI_MIN, Math.round(o.durasi)))
      : 6;
    hasil.push({
      id,
      name: bersihTeks(o.name, WHEEL_MAX_NAMA_RODA) || "Roda",
      items,
      palet,
      warna: warna.length >= WHEEL_MIN_WARNA ? warna : [...WARNA_KUSTOM_AWAL],
      popup: o.popup === true,
      hapusPemenang: o.hapusPemenang === true,
      durasi,
    });
    if (hasil.length >= WHEEL_MAX_RODA) break;
  }
  return hasil;
}

/** Tambah nama (tanpa duplikat persis, tanpa kosong, dalam batas). */
export function tambahItem(items: readonly string[], nama: string): { items: string[]; error?: string } {
  const n = bersihTeks(nama, WHEEL_MAX_NAMA_ITEM);
  if (!n) return { items: [...items], error: "Nama tidak boleh kosong." };
  if (items.length >= WHEEL_MAX_ITEM) return { items: [...items], error: `Maksimal ${WHEEL_MAX_ITEM} nama per roda.` };
  return { items: [...items, n] };
}

/** Indeks acak seragam 0..n-1 (rejection sampling agar tak bias). */
export function acakIndeks(n: number, rand32: () => number): number {
  if (n <= 0) return -1;
  const batas = Math.floor(0x100000000 / n) * n;
  let x = rand32();
  while (x >= batas) x = rand32();
  return x % n;
}

/**
 * Sudut roda (derajat, searah jarum jam, KUMULATIF) agar penunjuk di atas jatuh di tengah
 * irisan `indeks` (+ goyangan `jitter` -0,4..0,4 lebar irisan) setelah minimal `putaran`
 * putaran penuh dari sudut `sekarang`.
 */
export function sudutTujuan(sekarang: number, indeks: number, n: number, putaran: number, jitter = 0): number {
  const seg = 360 / n;
  const dasar = -((indeks + 0.5 + jitter) * seg);
  const minimal = sekarang + putaran * 360;
  const k = Math.ceil((minimal - dasar) / 360);
  return dasar + k * 360;
}

/** Irisan yang berada di bawah penunjuk (atas) saat roda berputar `sudut` derajat. */
export function indeksDiPenunjuk(sudut: number, n: number): number {
  if (n <= 0) return -1;
  const a = (((360 - sudut) % 360) + 360) % 360;
  return Math.min(n - 1, Math.floor(a / (360 / n)));
}

/** Teks di atas warna irisan: putih atau gelap menurut kecerahan. */
export function warnaTeks(hex: string): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#07131b" : "#ffffff";
}

/** Warna yang dipakai roda: kustom bila dipilih (dan sah), selain itu palet bawaan. */
export function warnaRoda(w: Pick<Wheel, "palet" | "warna">): readonly string[] {
  if (w.palet === "kustom" && w.warna.length >= WHEEL_MIN_WARNA) return w.warna;
  return PALET[w.palet === "kustom" ? "samudra" : w.palet].warna;
}
