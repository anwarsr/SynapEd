import { inflateRawSync } from "node:zlib";

/**
 * Teks dari dokumen Office (DOCX, PPTX, XLSX) untuk dibaca AI.
 *
 * Berkas Office hanyalah arsip ZIP berisi XML. Membongkarnya cukup dengan
 * zlib bawaan Node — tanpa dependensi baru, dan tanpa paket seperti mammoth
 * yang menarik puluhan modul hanya untuk mengambil teks polos. Tata letak,
 * gambar, dan rumus diabaikan; yang dibutuhkan penilaian AI hanya kata-katanya.
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

function bongkar(buf: Buffer, e: Entri): string | null {
  const p = e.offsetLokal;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return null;
  const awal = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(awal, awal + e.ukuranTerkompresi);

  try {
    if (e.metode === 0) return data.length <= MAX_ENTRY_BYTES ? data.toString("utf8") : null;
    if (e.metode === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES }).toString("utf8");
  } catch {
    // Melampaui batas atau data rusak — perlakukan sebagai tidak terbaca.
  }
  return null;
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

/** XML → teks: penanda paragraf/baris jadi baris baru, sisa tag dibuang. */
function teksDariXml(xml: string, paragraf: RegExp): string {
  return entitas(
    xml
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

function docx(buf: Buffer, daftar: Entri[]): string | null {
  const e = daftar.find((x) => x.nama === "word/document.xml");
  const xml = e ? bongkar(buf, e) : null;
  return xml === null ? null : teksDariXml(xml, /<\/w:p>/g);
}

function pptx(buf: Buffer, daftar: Entri[]): string | null {
  const slide = daftar
    .filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x.nama))
    .sort((a, b) => nomorDi(a.nama) - nomorDi(b.nama));
  if (slide.length === 0) return null;

  const bagian: string[] = [];
  for (const [i, e] of slide.entries()) {
    const xml = bongkar(buf, e);
    if (xml !== null) bagian.push(`[Slide ${i + 1}]\n${teksDariXml(xml, /<\/a:p>/g)}`);
  }
  return bagian.join("\n\n");
}

function xlsx(buf: Buffer, daftar: Entri[]): string | null {
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
    bagian.push(`[Lembar ${i + 1}]\n${baris.filter(Boolean).join("\n")}`);
  }
  return bagian.join("\n\n");
}

export type JenisOffice = "docx" | "pptx" | "xlsx";

/** Teks dokumen Office, dipotong ke `maxChars`. Null = tidak terbaca atau kosong. */
export function extractOfficeText(buf: Buffer, jenis: JenisOffice, maxChars: number): string | null {
  try {
    const daftar = bacaDaftar(buf);
    if (!daftar) return null;
    const teks = jenis === "docx" ? docx(buf, daftar) : jenis === "pptx" ? pptx(buf, daftar) : xlsx(buf, daftar);
    const bersih = teks?.trim() ?? "";
    return bersih ? bersih.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}
