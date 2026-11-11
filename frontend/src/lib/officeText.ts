import { inflateRawSync } from "node:zlib";
import { POLA_PENANDA, penandaGambar, type GambarDokumen, type IsiDokumen } from "./isiDokumen";

export type { GambarDokumen, IsiDokumen } from "./isiDokumen";

/**
 * Teks dari dokumen Office (DOCX, PPTX, XLSX) untuk dibaca AI.
 *
 * Berkas Office hanyalah arsip ZIP berisi XML. Membongkarnya cukup dengan
 * zlib bawaan Node — tanpa dependensi baru, dan tanpa paket seperti mammoth
 * yang menarik puluhan modul hanya untuk mengambil teks polos.
 *
 * Gambar ikut diambil (dengan penanda posisinya di teks) supaya AI melihat
 * jawaban yang berupa gambar; rumus dibaca linear, grafik & SmartArt dari
 * datanya. Yang tetap tak terbaca (format gambar EMF/WMF, garis/panah,
 * coretan tinta, gambar tautan internet) dicatat, bukan dilewati diam-diam.
 *
 * Berkasnya kiriman siswa, jadi dianggap bermusuhan: setiap entri dibatasi
 * ukuran hasil bongkarnya (`maxOutputLength`) supaya "bom ZIP" berukuran
 * beberapa KB tidak bisa mengembang jadi gigabyte di memori server. Tidak
 * pernah melempar — berkas rusak menghasilkan `null`.
 *
 * Tanpa `server-only` dan tanpa impor `@/` supaya skrip verifikasi bisa
 * mengujinya langsung; isinya tetap hanya dipakai di server (butuh zlib).
 */

const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 2000;

interface Entri {
  nama: string;
  metode: number;
  ukuranTerkompresi: number;
  offsetLokal: number;
}

/** Daftar isi arsip dari central directory, atau null kalau bukan ZIP yang sah. */
function bacaDaftar(buf: Buffer): Entri[] | null {
  // End of central directory: dicari dari belakang (komentar arsip maks 65535 byte).
  const batas = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= batas; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const jumlah = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  if (jumlah > MAX_ENTRIES) return null;

  const out: Entri[] = [];
  for (let n = 0; n < jumlah; n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) return null;
    const panjangNama = buf.readUInt16LE(pos + 28);
    const panjangEkstra = buf.readUInt16LE(pos + 30);
    const panjangKomentar = buf.readUInt16LE(pos + 32);
    out.push({
      metode: buf.readUInt16LE(pos + 10),
      ukuranTerkompresi: buf.readUInt32LE(pos + 20),
      offsetLokal: buf.readUInt32LE(pos + 42),
      nama: buf.toString("utf8", pos + 46, pos + 46 + panjangNama),
    });
    pos += 46 + panjangNama + panjangEkstra + panjangKomentar;
  }
  return out;
}

function bongkarBuffer(buf: Buffer, e: Entri): Buffer | null {
  const p = e.offsetLokal;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return null;
  const awal = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(awal, awal + e.ukuranTerkompresi);

  try {
    if (e.metode === 0) return data.length <= MAX_ENTRY_BYTES ? Buffer.from(data) : null;
    if (e.metode === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
  } catch {
    // Melampaui batas atau data rusak — perlakukan sebagai tidak terbaca.
  }
  return null;
}

function bongkar(buf: Buffer, e: Entri): string | null {
  return bongkarBuffer(buf, e)?.toString("utf8") ?? null;
}

function entitas(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/**
 * Rumus Word (OMML) dibaca linear: tanpa ini "x² + 1" terbaca "x2 + 1" dan
 * pecahan kehilangan garisnya - jawaban matematika jadi salah di mata AI.
 */
function rumusLinear(xml: string): string {
  return xml
    .replace(/<m:sup>/g, "^(")
    .replace(/<\/m:sup>/g, ")")
    .replace(/<m:sub>/g, "_(")
    .replace(/<\/m:sub>/g, ")")
    .replace(/<m:num>/g, "((")
    .replace(/<\/m:num>/g, ")/(")
    .replace(/<\/m:den>/g, "))")
    .replace(/<m:rad>/g, "√(")
    .replace(/<\/m:rad>/g, ")")
    .replace(/<m:deg>[\s\S]*?<\/m:deg>/g, "")
    .replace(/<m:deg\/>/g, "");
}

/** XML → teks: penanda paragraf/baris jadi baris baru, sisa tag dibuang. */
function teksDariXml(xml: string, paragraf: RegExp): string {
  return entitas(
    rumusLinear(xml)
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>|<a:br\/>/g, "\n")
      .replace(paragraf, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const nomorDi = (nama: string) => Number(/(\d+)\.xml$/.exec(nama)?.[1] ?? 0);

// ── Gambar & bagian lain yang dirujuk dokumen ─────────────────────────────

/** Format yang diverifikasi bisa dilihat VISION_MODELS (lihat gradingActions.ts). */
const MIME_GAMBAR: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

interface Relasi {
  target: string;
  eksternal: boolean;
}

function folder(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

/** "media/a.png" relatif terhadap "word/document.xml" → "word/media/a.png". */
function selesaikan(dari: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const bagian = (folder(dari) + target).split("/");
  const out: string[] = [];
  for (const b of bagian) {
    if (b === "..") out.pop();
    else if (b !== "." && b !== "") out.push(b);
  }
  return out.join("/");
}

/** Relasi satu bagian dokumen (`<folder>/_rels/<nama>.rels`): Id → berkas tujuan. */
function relasi(buf: Buffer, daftar: Entri[], part: string): Map<string, Relasi> {
  const map = new Map<string, Relasi>();
  const nama = `${folder(part)}_rels/${part.slice(folder(part).length)}.rels`;
  const e = daftar.find((x) => x.nama === nama);
  const xml = e ? bongkar(buf, e) : null;
  if (!xml) return map;
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = m[1];
    const id = /\bId="([^"]+)"/.exec(a)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(a)?.[1];
    if (!id || !target) continue;
    const eksternal = /\bTargetMode="External"/.test(a);
    map.set(id, { target: eksternal ? target : selesaikan(part, entitas(target)), eksternal });
  }
  return map;
}

/** Pengumpul gambar & catatan bersama untuk satu dokumen. */
class Pengumpul {
  gambar: GambarDokumen[] = [];
  catatan = new Set<string>();
  private indeks = new Map<string, number>();
  private diambil = 0;

  constructor(
    readonly buf: Buffer,
    readonly daftar: Entri[],
    private maxGambar: number,
  ) {}

  /** Penanda untuk gambar di `path` (dalam arsip); gambar yang sama dipakai ulang. */
  gambarDari(path: string, lokasi: string): string {
    const ada = this.indeks.get(path);
    if (ada !== undefined) return penandaGambar(ada);

    const label = `Gambar ${this.gambar.length + 1}`;
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    const mime = MIME_GAMBAR[ext];
    const e = this.daftar.find((x) => x.nama === path);
    let g: GambarDokumen;
    if (!mime) {
      g = { label, lokasi, mime: "", data: null, sebab: `format ${ext.toUpperCase() || "tak dikenal"} tidak bisa dilihat AI` };
    } else if (!e) {
      g = { label, lokasi, mime, data: null, sebab: "berkas gambarnya tidak ada di dokumen" };
    } else if (this.diambil >= this.maxGambar) {
      g = { label, lokasi, mime, data: null, sebab: "melebihi batas jumlah gambar" };
    } else {
      const data = bongkarBuffer(this.buf, e);
      g = data ? { label, lokasi, mime, data } : { label, lokasi, mime, data: null, sebab: "terlalu besar atau rusak" };
      if (data) this.diambil++;
    }
    this.gambar.push(g);
    this.indeks.set(path, this.gambar.length - 1);
    return penandaGambar(this.gambar.length - 1);
  }

  /** Gambar yang hanya ditautkan ke internet: tidak ikut berkasnya, jadi tidak terbaca. */
  gambarLuar(lokasi: string): string {
    const label = `Gambar ${this.gambar.length + 1}`;
    this.gambar.push({ label, lokasi, mime: "", data: null, sebab: "hanya tautan ke internet, gambarnya tidak ada di berkas" });
    return penandaGambar(this.gambar.length - 1);
  }

  bacaBagian(path: string): string | null {
    const e = this.daftar.find((x) => x.nama === path);
    return e ? bongkar(this.buf, e) : null;
  }
}

/**
 * Isi `mc:AlternateContent`: versi modern (Choice), KECUALI coretan tinta
 * (`contentPart`) yang hanya terbaca lewat gambar cadangannya (Fallback).
 * Dulu keduanya ikut terbaca, jadi isi kotak teks tercatat dua kali.
 */
function pilihAlternatif(xml: string): string {
  return xml.replace(/<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/g, (_, isi: string) => {
    const choice = /<mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice>/.exec(isi)?.[1] ?? "";
    const fallback = /<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/.exec(isi)?.[1] ?? "";
    return /contentPart\b/.test(choice) && fallback ? fallback : choice || fallback;
  });
}

/** Angka & judul grafik dari XML-nya: bentuk batangnya tak terlihat, tetapi datanya terbaca. */
function teksGrafik(xml: string): string {
  const judul = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => entitas(m[1])).filter(Boolean);
  const nilai = [...xml.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map((m) => entitas(m[1])).filter(Boolean);
  return [...judul, ...nilai].join(", ").slice(0, 1500);
}

/**
 * Mengganti setiap gambar/grafik/SmartArt di XML dengan teks penanda, supaya
 * posisinya ikut terbaca setelah tag dibuang. Bentuk gambar lain (garis,
 * panah, coretan) yang tidak punya berkas gambar dicatat sebagai tak terbaca.
 */
function tandaiObjek(xml: string, part: string, lokasi: string, p: Pengumpul): string {
  const rel = relasi(p.buf, p.daftar, part);
  let bentuk = 0;

  const hasil = pilihAlternatif(xml)
    .replace(/<a:blip\b[^>]*?r:(?:embed|link)="([^"]+)"[^>]*>/g, (_, id: string) => {
      const r = rel.get(id);
      if (!r) return "";
      return r.eksternal ? p.gambarLuar(lokasi) : p.gambarDari(r.target, lokasi);
    })
    .replace(/<v:imagedata\b[^>]*?r:id="([^"]+)"[^>]*>/g, (_, id: string) => {
      const r = rel.get(id);
      if (!r) return "";
      return r.eksternal ? p.gambarLuar(lokasi) : p.gambarDari(r.target, lokasi);
    })
    .replace(/<c:chart\b[^>]*?r:id="([^"]+)"[^>]*>/g, (_, id: string) => {
      const r = rel.get(id);
      const xmlGrafik = r && !r.eksternal ? p.bacaBagian(r.target) : null;
      const isi = xmlGrafik ? teksGrafik(xmlGrafik) : "";
      if (!isi) p.catatan.add(`grafik di ${lokasi} tidak bisa dibaca`);
      return isi ? `\n[Grafik: ${isi}]\n` : "\n[Grafik - tidak terbaca]\n";
    })
    .replace(/<dgm:relIds\b[^>]*?r:dm="([^"]+)"[^>]*>/g, (_, id: string) => {
      const r = rel.get(id);
      const xmlDiagram = r && !r.eksternal ? p.bacaBagian(r.target) : null;
      const isi = xmlDiagram ? [...xmlDiagram.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => entitas(m[1])).filter(Boolean).join(" / ") : "";
      if (!isi) p.catatan.add(`diagram SmartArt di ${lokasi} tidak bisa dibaca`);
      return isi ? `\n[Diagram: ${isi}]\n` : "\n[Diagram - tidak terbaca]\n";
    })
    // Bentuk gambar tanpa berkas gambar & tanpa teks (garis, panah, kotak kosong, coretan tinta).
    .replace(/<wps:wsp\b[\s\S]*?<\/wps:wsp>/g, (s) => {
      if (!/<wps:txbx\b/.test(s) && !/\u0000G\d+\u0000/.test(s)) bentuk++;
      return s;
    })
    .replace(/<v:(?:shape|line|polyline|oval|rect|roundrect|arc|curve)\b(?:[^>]*\/>|[\s\S]*?<\/v:(?:shape|line|polyline|oval|rect|roundrect|arc|curve)>)/g, (s) => {
      if (!/<v:textbox\b/.test(s) && !/\u0000G\d+\u0000/.test(s) && !/<v:imagedata\b/.test(s)) bentuk++;
      return s;
    });

  const tinta = (hasil.match(/<(?:w14:|w:|p14:)?contentPart\b/g) ?? []).length;
  if (bentuk > 0) p.catatan.add(`${bentuk} bentuk gambar (garis, panah, atau kotak tanpa teks) di ${lokasi} tidak bisa dilihat AI`);
  if (tinta > 0) p.catatan.add(`${tinta} coretan tinta/tulisan tangan digital di ${lokasi} tidak bisa dilihat AI`);
  return hasil;
}

function docx(buf: Buffer, daftar: Entri[], p: Pengumpul): string | null {
  const utama = p.bacaBagian("word/document.xml");
  if (utama === null) return null;

  const bagian = [teksDariXml(tandaiObjek(utama, "word/document.xml", "badan dokumen", p), /<\/w:p>/g)];
  // Isi di luar badan dokumen juga dibaca; header/footer terakhir karena
  // biasanya hanya identitas & logo (logo tak boleh menghabiskan jatah gambar).
  const lain: [RegExp, string][] = [
    [/^word\/footnotes\.xml$/, "Catatan kaki"],
    [/^word\/endnotes\.xml$/, "Catatan akhir"],
    [/^word\/comments\.xml$/, "Komentar di dokumen"],
    [/^word\/header\d*\.xml$/, "Header"],
    [/^word\/footer\d*\.xml$/, "Footer"],
  ];
  for (const [pola, judul] of lain) {
    for (const e of daftar.filter((x) => pola.test(x.nama)).sort((a, b) => nomorDi(a.nama) - nomorDi(b.nama))) {
      const xml = bongkar(buf, e);
      if (xml === null) continue;
      const teks = teksDariXml(tandaiObjek(xml, e.nama, judul.toLowerCase(), p), /<\/w:p>/g);
      if (teks) bagian.push(`[${judul}]\n${teks}`);
    }
  }
  return bagian.filter(Boolean).join("\n\n");
}

function pptx(buf: Buffer, daftar: Entri[], p: Pengumpul): string | null {
  const slide = daftar
    .filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x.nama))
    .sort((a, b) => nomorDi(a.nama) - nomorDi(b.nama));
  if (slide.length === 0) return null;

  const bagian: string[] = [];
  for (const [i, e] of slide.entries()) {
    const xml = bongkar(buf, e);
    if (xml !== null) bagian.push(`[Slide ${i + 1}]\n${teksDariXml(tandaiObjek(xml, e.nama, `slide ${i + 1}`, p), /<\/a:p>/g)}`);
  }
  return bagian.join("\n\n");
}

function xlsx(buf: Buffer, daftar: Entri[], p: Pengumpul): string | null {
  const ss = daftar.find((x) => x.nama === "xl/sharedStrings.xml");
  const ssXml = ss ? bongkar(buf, ss) : "";
  const shared = [...(ssXml ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    entitas(m[1].replace(/<[^>]+>/g, "")),
  );

  const lembar = daftar
    .filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x.nama))
    .sort((a, b) => nomorDi(a.nama) - nomorDi(b.nama));
  if (lembar.length === 0) return null;

  const bagian: string[] = [];
  for (const [i, e] of lembar.entries()) {
    const xml = bongkar(buf, e);
    if (xml === null) continue;
    const baris = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((c) => {
          const atribut = c[1];
          const isi = c[2] ?? "";
          const ref = /\br="([A-Z]+\d+)"/.exec(atribut)?.[1] ?? "";
          let nilai: string;
          if (/\bt="s"/.test(atribut)) nilai = shared[Number(/<v>(\d+)<\/v>/.exec(isi)?.[1] ?? -1)] ?? "";
          else if (/\bt="inlineStr"/.test(atribut)) nilai = entitas(isi.replace(/<[^>]+>/g, ""));
          else nilai = entitas(/<v>([\s\S]*?)<\/v>/.exec(isi)?.[1] ?? "");
          return nilai ? `${ref}: ${nilai}` : "";
        })
        .filter(Boolean)
        .join(" | "),
    );

    // Gambar, grafik, dan kotak teks lembar ini tinggal di bagian "drawing".
    const gambarLembar: string[] = [];
    for (const r of relasi(buf, daftar, e.nama).values()) {
      if (r.eksternal || !/^xl\/drawings\/drawing\d+\.xml$/.test(r.target)) continue;
      const xmlGambar = p.bacaBagian(r.target);
      if (xmlGambar === null) continue;
      const t = teksDariXml(tandaiObjek(xmlGambar, r.target, `lembar ${i + 1}`, p), /<\/a:p>/g);
      if (t) gambarLembar.push(t);
    }
    bagian.push([`[Lembar ${i + 1}]`, baris.filter(Boolean).join("\n"), ...gambarLembar].filter(Boolean).join("\n"));
  }
  return bagian.join("\n\n");
}

export type JenisOffice = "docx" | "pptx" | "xlsx";

/**
 * Teks + gambar dokumen Office. `maxGambar` = berapa gambar yang boleh
 * dibongkar datanya (sisanya tetap tercatat dengan sebabnya). Teks TIDAK
 * dipotong di sini - pemotongan & peringatannya urusan pemanggil.
 * Null = bukan dokumen yang sah.
 */
export function extractOfficeIsi(buf: Buffer, jenis: JenisOffice, maxGambar: number): IsiDokumen | null {
  try {
    const daftar = bacaDaftar(buf);
    if (!daftar) return null;
    const p = new Pengumpul(buf, daftar, maxGambar);
    const teks = jenis === "docx" ? docx(buf, daftar, p) : jenis === "pptx" ? pptx(buf, daftar, p) : xlsx(buf, daftar, p);
    if (teks === null) return null;
    return { teks: teks.trim(), gambar: p.gambar, catatan: [...p.catatan] };
  } catch {
    return null;
  }
}

/** Teks saja (penanda gambar dibuang), dipotong ke `maxChars`. Null = tidak terbaca atau kosong. */
export function extractOfficeText(buf: Buffer, jenis: JenisOffice, maxChars: number): string | null {
  const isi = extractOfficeIsi(buf, jenis, 0);
  const bersih = isi?.teks.replace(POLA_PENANDA, "").replace(/\n{3,}/g, "\n\n").trim() ?? "";
  return bersih ? bersih.slice(0, maxChars) : null;
}
