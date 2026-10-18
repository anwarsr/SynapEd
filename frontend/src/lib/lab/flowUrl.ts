/**
 * Menyimpan flowchart di tautan (`/lab?f=…`) dan di berkas `.json`.
 *
 * Tautan: JSON ringkas → deflate (CompressionStream bawaan browser & Node) →
 * base64url, diawali digit versi. Flowchart jauh lebih besar dari papan
 * array, jadi skema `?s=` lima ruas tidak cocok; parameternya sendiri.
 *
 * Membaca bersifat SEMUA-ATAU-TIDAK, sama seperti tautan lab lain: masukan
 * rusak, terlalu besar, id kembar, atau garis yang menunjuk simpul tak ada →
 * `null`, tidak pernah setengah diagram. Berkas `.json` melewati pemeriksa
 * yang SAMA — berkas dari luar sama tidak tepercayanya dengan tautan.
 *
 * Modul netral (async karena kompresi); diuji `verify-flowchart`.
 */
import {
  FLOW_BATAS_KOORDINAT,
  FLOW_MAX_GARIS,
  FLOW_MAX_LABEL,
  FLOW_MAX_SIMPUL,
  FLOW_MAX_TEKS,
  FLOW_MAX_UKURAN,
  FLOW_MIN_UKURAN,
  JENIS_SIMPUL,
  SISI,
  type Diagram,
  type Garis,
  type JenisSimpul,
  type Simpul,
  type Sisi,
} from "./flowTypes";

export const FLOW_URL_PARAM = "f";
/** Di atas ini tautan ditolak dengan saran memakai berkas. Aman untuk WhatsApp & peramban. */
export const FLOW_MAX_URL = 8000;
const VERSI = "1";
const MAKS_ID = 1_000_000;

// ── Pemeriksa bentuk ────────────────────────────────────────────────────

const bulat = (v: unknown, min: number, maks: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks;
const angka = (v: unknown, min: number, maks: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= maks;
const teks = (v: unknown, maks: number): v is string => typeof v === "string" && [...v].length <= maks;

/** Diagram yang sah, atau null. Satu-satunya pintu masuk data dari luar. */
export function sahkanDiagram(raw: unknown): Diagram | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.simpul) || !Array.isArray(r.garis)) return null;
  if (r.simpul.length > FLOW_MAX_SIMPUL || r.garis.length > FLOW_MAX_GARIS) return null;

  const id = new Set<number>();
  const simpul: Simpul[] = [];
  for (const x of r.simpul) {
    if (!x || typeof x !== "object") return null;
    const s = x as Record<string, unknown>;
    if (!bulat(s.id, 1, MAKS_ID) || id.has(s.id)) return null;
    if (typeof s.jenis !== "string" || !JENIS_SIMPUL.includes(s.jenis as JenisSimpul)) return null;
    if (!angka(s.x, -FLOW_BATAS_KOORDINAT, FLOW_BATAS_KOORDINAT) || !angka(s.y, -FLOW_BATAS_KOORDINAT, FLOW_BATAS_KOORDINAT)) return null;
    if (!angka(s.w, FLOW_MIN_UKURAN, FLOW_MAX_UKURAN) || !angka(s.h, FLOW_MIN_UKURAN, FLOW_MAX_UKURAN)) return null;
    if (!teks(s.teks, FLOW_MAX_TEKS)) return null;
    id.add(s.id);
    simpul.push({ id: s.id, jenis: s.jenis as JenisSimpul, x: s.x, y: s.y, w: s.w, h: s.h, teks: s.teks });
  }

  const garis: Garis[] = [];
  for (const x of r.garis) {
    if (!x || typeof x !== "object") return null;
    const g = x as Record<string, unknown>;
    if (!bulat(g.id, 1, MAKS_ID) || id.has(g.id)) return null;
    if (!bulat(g.dari, 1, MAKS_ID) || !bulat(g.ke, 1, MAKS_ID)) return null;
    if (!simpul.some((s) => s.id === g.dari) || !simpul.some((s) => s.id === g.ke)) return null;
    if (!SISI.includes(g.dariSisi as Sisi) || !SISI.includes(g.keSisi as Sisi)) return null;
    if (!teks(g.label, FLOW_MAX_LABEL)) return null;
    id.add(g.id);
    garis.push({ id: g.id, dari: g.dari, ke: g.ke, dariSisi: g.dariSisi as Sisi, keSisi: g.keSisi as Sisi, label: g.label });
  }

  const maksId = Math.max(0, ...id);
  const nextId = bulat(r.nextId, 1, MAKS_ID + 1) && r.nextId > maksId ? r.nextId : maksId + 1;
  return { simpul, garis, nextId };
}

// ── Bentuk ringkas untuk tautan ─────────────────────────────────────────

type SimpulRingkas = [number, number, number, number, number, number, string];
type GarisRingkas = [number, number, number, number, number, string];

const bulatkan = (n: number) => Math.round(n * 10) / 10;

function keRingkas(d: Diagram): { n: number; s: SimpulRingkas[]; g: GarisRingkas[] } {
  return {
    n: d.nextId,
    s: d.simpul.map((s) => [s.id, JENIS_SIMPUL.indexOf(s.jenis), bulatkan(s.x), bulatkan(s.y), bulatkan(s.w), bulatkan(s.h), s.teks]),
    g: d.garis.map((g) => [g.id, g.dari, g.ke, SISI.indexOf(g.dariSisi), SISI.indexOf(g.keSisi), g.label]),
  };
}

function dariRingkas(raw: unknown): Diagram | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.s) || !Array.isArray(r.g)) return null;
  if (r.s.length > FLOW_MAX_SIMPUL || r.g.length > FLOW_MAX_GARIS) return null;
  const simpul = r.s.map((x) =>
    Array.isArray(x) && x.length === 7
      ? { id: x[0], jenis: JENIS_SIMPUL[x[1] as number], x: x[2], y: x[3], w: x[4], h: x[5], teks: x[6] }
      : null,
  );
  const garis = r.g.map((x) =>
    Array.isArray(x) && x.length === 6
      ? { id: x[0], dari: x[1], ke: x[2], dariSisi: SISI[x[3] as number], keSisi: SISI[x[4] as number], label: x[5] }
      : null,
  );
  return sahkanDiagram({ simpul, garis, nextId: r.n });
}

// ── base64url & kompresi ────────────────────────────────────────────────

function keBase64Url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const biner = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function aliran(data: Uint8Array, ubah: CompressionStream | DecompressionStream, batas: number): Promise<Uint8Array | null> {
  const tulis = ubah.writable.getWriter();
  void tulis.write(data as BufferSource).then(() => tulis.close()).catch(() => undefined);
  const baca = ubah.readable.getReader();
  const potong: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await baca.read();
    if (done) break;
    total += value.length;
    // Bom kompresi: tautan beberapa KB yang mengembang jadi ratusan MB.
    if (total > batas) {
      await baca.cancel().catch(() => undefined);
      return null;
    }
    potong.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of potong) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Kode tautan, atau null bila diagram terlalu besar untuk tautan (pakai berkas). */
export async function encodeFlow(d: Diagram): Promise<string | null> {
  const json = new TextEncoder().encode(JSON.stringify(keRingkas(d)));
  const padat = await aliran(json, new CompressionStream("deflate-raw"), Infinity);
  if (!padat) return null;
  const kode = VERSI + keBase64Url(padat);
  return kode.length <= FLOW_MAX_URL ? kode : null;
}

export async function decodeFlow(kode: string): Promise<Diagram | null> {
  if (typeof kode !== "string" || kode.length < 2 || kode.length > FLOW_MAX_URL || kode[0] !== VERSI) return null;
  const biner = dariBase64Url(kode.slice(1));
  if (!biner) return null;
  try {
    const json = await aliran(biner, new DecompressionStream("deflate-raw"), 512 * 1024);
    if (!json) return null;
    return dariRingkas(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json)));
  } catch {
    return null;
  }
}

// ── Berkas .json ────────────────────────────────────────────────────────

export const FORMAT_BERKAS = "synaplab-flowchart";
export const MAKS_BERKAS_BYTE = 1024 * 1024;

/** Isi berkas `.json` yang mudah dibaca manusia. */
export function diagramKeBerkas(d: Diagram): string {
  return JSON.stringify({ format: FORMAT_BERKAS, versi: 1, nextId: d.nextId, simpul: d.simpul, garis: d.garis }, null, 2);
}

export function berkasKeDiagram(isi: string): Diagram | null {
  if (isi.length > MAKS_BERKAS_BYTE) return null;
  try {
    const r = JSON.parse(isi) as Record<string, unknown>;
    if (!r || r.format !== FORMAT_BERKAS || r.versi !== 1) return null;
    return sahkanDiagram(r);
  } catch {
    return null;
  }
}
