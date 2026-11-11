/**
 * Menguji pembaca berkas untuk koreksi AI: AI harus membaca SELURUH isi
 * dokumen - termasuk gambar di dalam DOCX/PPTX/XLSX/PDF dan PDF hasil pindai -
 * dan setiap bagian yang tetap tidak terbaca harus muncul sebagai peringatan.
 *
 * Murni (tanpa dev server & kredensial): dokumen ujinya dibuat di sini.
 *
 *   npx tsx scripts/verify-berkas-ai.ts
 */
import { deflateRawSync, deflateSync, inflateSync } from "node:zlib";
import { check, finish } from "./checks";
import { crc32, encodePng, perkecil, ringkasKanal } from "../frontend/src/lib/pngMini";
import { extractOfficeIsi, extractOfficeText } from "../frontend/src/lib/officeText";
import { bacaPdf } from "../frontend/src/lib/pdfIsi";
import { POLA_PENANDA } from "../frontend/src/lib/isiDokumen";
import { MAX_GAMBAR_BYTES, bacaIsiBerkas, type BerkasMasuk } from "../frontend/src/lib/berkasAiCore";
import { teksBagianJawaban, teksBagianSoal } from "../frontend/src/lib/classGradingPrompt";
import { buildGradingPrompt } from "../frontend/src/lib/gradingPrompt";

// ── Bahan uji ─────────────────────────────────────────────────────────────

/** JPEG 40x30 (abu muda + garis gelap) dan PNG 30x30 merah, dibuat dengan Pillow. */
const JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAeACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6zorz349/8LM/4Q+0/wCFVf8AIb/tBPP/AOPf/j38uTd/r/l+/wCX05/DNeI/8Zl/5/smgD6wor5P/wCMy/8AP9k0f8Zl/wCf7JoA+sKK89+An/CzP+EPu/8Ahav/ACG/7QfyP+Pf/j38uPb/AKj5fv8AmdefwxRQB6FRRRQAUUUUAFFFFAH/2Q==",
  "base64",
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAIAAAC0Ujn1AAAANklEQVR4nO3QMQEAMAjEQKgQ/EtBVvcw/5YTkCG9M5XxQt0yffgaHAIOAYeAQ8Ah4BBwCASHfB6UAUDu6YPfAAAAAElFTkSuQmCC",
  "base64",
);

/** ZIP minimal (sama dengan verify-class-assignment) untuk membuat DOCX/PPTX/XLSX uji. */
function zip(isi: Record<string, string | Buffer>): Buffer {
  const lokal: Buffer[] = [];
  const pusat: Buffer[] = [];
  let offset = 0;
  for (const [nama, data] of Object.entries(isi)) {
    const mentah = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const padat = deflateRawSync(mentah);
    const n = Buffer.from(nama, "utf8");
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(8, 8);
    h.writeUInt32LE(padat.length, 18);
    h.writeUInt32LE(mentah.length, 22);
    h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(padat.length, 20);
    c.writeUInt32LE(mentah.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    lokal.push(h, n, padat);
    pusat.push(c, n);
    offset += 30 + n.length + padat.length;
  }
  const cd = Buffer.concat(pusat);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(Object.keys(isi).length, 8);
  e.writeUInt16LE(Object.keys(isi).length, 10);
  e.writeUInt32LE(cd.length, 12);
  e.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, e]);
}

const rels = (r: [string, string, boolean?][]) =>
  `<Relationships>${r.map(([id, t, luar]) => `<Relationship Id="${id}" Type="x" Target="${t}"${luar ? ' TargetMode="External"' : ""}/>`).join("")}</Relationships>`;
const blip = (id: string) => `<w:r><w:drawing><a:graphic><pic:pic><pic:blipFill><a:blip r:embed="${id}"/></pic:blipFill></pic:pic></a:graphic></w:drawing></w:r>`;
const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;

interface ObjPdf {
  isi: string;
  xobject?: Record<string, { dict: string; data: Buffer }>;
}

/** PDF uji: tiap halaman = aliran konten + gambar (XObject) opsional. */
function buatPdf(halaman: ObjPdf[]): Buffer {
  const objek: Buffer[] = [];
  const tambah = (s: string | Buffer) => objek.push(typeof s === "string" ? Buffer.from(s) : s) && objek.length;
  tambah("<< /Type /Catalog /Pages 2 0 R >>");
  tambah("PAGES");
  const font = tambah("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids: number[] = [];
  for (const h of halaman) {
    const isi = Buffer.from(h.isi);
    const konten = tambah(Buffer.concat([Buffer.from(`<< /Length ${isi.length} >> stream\n`), isi, Buffer.from("\nendstream")]));
    const xo: string[] = [];
    for (const [nama, g] of Object.entries(h.xobject ?? {})) {
      const n = tambah(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image ${g.dict} /Length ${g.data.length} >> stream\n`), g.data, Buffer.from("\nendstream")]));
      xo.push(`/${nama} ${n} 0 R`);
    }
    kids.push(tambah(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents ${konten} 0 R /Resources << /Font << /F1 ${font} 0 R >> /XObject << ${xo.join(" ")} >> >> >>`));
  }
  objek[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`);

  const bagian: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  let pos = bagian[0].length;
  const off: number[] = [];
  objek.forEach((o, i) => {
    off.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj `), o, Buffer.from(" endobj\n")]);
    bagian.push(b);
    pos += b.length;
  });
  let x = `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  for (const o of off) x += `${String(o).padStart(10, "0")} 00000 n \n`;
  bagian.push(Buffer.from(`${x}trailer << /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`));
  return Buffer.concat(bagian);
}

const teksPdf = (t: string) => `BT /F1 12 Tf 20 250 Td (${t}) Tj ET`;
const gambarPdf = (nama: string) => `q 100 0 0 80 20 20 cm /${nama} Do Q`;
function rgb(w: number, h: number, f: (x: number, y: number) => [number, number, number]) {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(f(x, y), (y * w + x) * 3);
  return { dict: `/Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, data: deflateSync(px) };
}

/** Membaca ulang PNG: ukuran, kanal, piksel, dan CRC setiap potongan. */
function bacaPng(b: Buffer) {
  const tanda = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let pos = 8;
  let crcOk = true;
  let ihdr: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const n = b.readUInt32BE(pos);
    const jenis = b.toString("ascii", pos + 4, pos + 8);
    const isi = b.subarray(pos + 8, pos + 8 + n);
    if (crc32(b.subarray(pos + 4, pos + 8 + n)) !== b.readUInt32BE(pos + 8 + n)) crcOk = false;
    if (jenis === "IHDR") ihdr = isi;
    if (jenis === "IDAT") idat.push(isi);
    pos += 12 + n;
  }
  const lebar = ihdr!.readUInt32BE(0);
  const tinggi = ihdr!.readUInt32BE(4);
  const kanal = ({ 0: 1, 2: 3, 6: 4 } as Record<number, number>)[ihdr![9]];
  const mentah = inflateSync(Buffer.concat(idat));
  const piksel = (x: number, y: number) => [...mentah.subarray(y * (lebar * kanal + 1) + 1 + x * kanal, y * (lebar * kanal + 1) + 1 + (x + 1) * kanal)];
  return { tanda, crcOk, lebar, tinggi, kanal, piksel };
}

const berkas = (nama: string, mime: string, data: Buffer | null): BerkasMasuk => ({ nama, mime, ambil: async () => data });
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function main() {
  // ── PNG ─────────────────────────────────────────────────────────────
  {
    const data = new Uint8Array(4 * 3 * 3);
    for (let i = 0; i < 12; i++) data.set([i * 20, 255 - i * 20, 7], i * 3);
    const png = bacaPng(encodePng({ lebar: 4, tinggi: 3, kanal: 3, data }));
    check("PNG: tanda tangan & CRC setiap potongan sah", png.tanda && png.crcOk, "dibaca ulang");
    check("PNG: ukuran & piksel bolak-balik utuh", png.lebar === 4 && png.tinggi === 3 && png.piksel(3, 2).join() === `${11 * 20},${255 - 11 * 20},7`, png.piksel(3, 2).join());

    const kecil = perkecil({ lebar: 3200, tinggi: 100, kanal: 1, data: new Uint8Array(3200 * 100).map((_, i) => ((i % 3200) % 2 ? 255 : 0)) }, 1600);
    check("perkecil: sisi terpanjang jadi 1600, rasio terjaga", kecil.lebar === 1600 && kecil.tinggi === 50, `${kecil.lebar}x${kecil.tinggi}`);
    check("perkecil: rata-rata kotak (garis tipis jadi abu, tidak hilang)", Math.abs(kecil.data[0] - 128) <= 1, String(kecil.data[0]));
    check("gambar kecil tidak diubah", perkecil({ lebar: 10, tinggi: 10, kanal: 1, data: new Uint8Array(100) }, 1600).lebar === 10, "10x10");
    const abu = ringkasKanal({ lebar: 2, tinggi: 1, kanal: 3, data: Uint8Array.from([9, 9, 9, 200, 200, 200]) });
    check("RGB abu-abu diringkas jadi 1 kanal", abu.kanal === 1 && abu.data.join() === "9,200", abu.data.join());
    check("RGB berwarna tetap 3 kanal", ringkasKanal({ lebar: 1, tinggi: 1, kanal: 3, data: Uint8Array.from([9, 8, 9]) }).kanal === 3, "warna");
  }

  // ── DOCX ────────────────────────────────────────────────────────────
  {
    const doc = `<w:document><w:body>
      ${p("Soal 1 dijawab di gambar berikut")}${blip("rId1")}
      ${p("Soal 2")}${blip("rId1")}${blip("rId2")}${blip("rId3")}
      <w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><wps:wsp><wps:txbx><w:p><w:r><w:t>ISI KOTAK TEKS</w:t></w:r></w:p></wps:txbx></wps:wsp></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:p><w:r><w:t>ISI KOTAK TEKS</w:t></w:r></w:p></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>
      <w:p><w:r><w:drawing><wps:wsp><wps:spPr/></wps:wsp></w:drawing></w:r></w:p>
      <w:p><m:oMath><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup><m:r><m:t>+</m:t></m:r><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath></w:p>
      <w:p><w:r><w:drawing><a:graphic><c:chart r:id="rId4"/></a:graphic></w:drawing></w:r></w:p>
      ${blip("rId5")}
    </w:body></w:document>`;
    const docx = zip({
      "word/document.xml": doc,
      "word/_rels/document.xml.rels": rels([
        ["rId1", "media/image1.png"],
        ["rId2", "media/image2.emf"],
        ["rId3", "http://contoh.com/a.png", true],
        ["rId4", "charts/chart1.xml"],
        ["rId5", "media/image3.jpeg"],
      ]),
      "word/media/image1.png": PNG,
      "word/media/image2.emf": Buffer.from("EMF palsu"),
      "word/media/image3.jpeg": JPG,
      "word/charts/chart1.xml": "<c:chartSpace><a:t>Nilai Ujian</a:t><c:v>Budi</c:v><c:v>87</c:v></c:chartSpace>",
      "word/footnotes.xml": `<w:footnotes>${p("Sumber: buku paket")}</w:footnotes>`,
      "word/header1.xml": `<w:hdr>${p("SMA Uji")}${blip("rIdLogo")}</w:hdr>`,
      "word/_rels/header1.xml.rels": rels([["rIdLogo", "media/logo.png"]]),
      "word/media/logo.png": PNG,
    });

    const isi = extractOfficeIsi(docx, "docx", 10)!;
    const t = isi.teks;
    const pos = (s: string) => t.indexOf(s);
    check("DOCX: gambar terbaca dan diberi penanda di posisinya", isi.gambar[0]?.data?.equals(PNG) === true && pos("Soal 1") < t.search(POLA_PENANDA) && t.search(POLA_PENANDA) < pos("Soal 2"), t.replace(/\u0000/g, "¤").slice(0, 120));
    check("DOCX: gambar yang sama dipakai dua kali = satu gambar, dua penanda", t.split("\u0000G0\u0000").length - 1 === 2 && isi.gambar.length === 5, isi.gambar.map((g) => g.label).join(","));
    check("DOCX: gambar EMF dicatat tak terbaca beserta formatnya", isi.gambar[1]?.data === null && /EMF/.test(isi.gambar[1]?.sebab ?? ""), String(isi.gambar[1]?.sebab));
    check("DOCX: gambar tautan internet dicatat tak terbaca", isi.gambar[2]?.data === null && /tautan/.test(isi.gambar[2]?.sebab ?? ""), String(isi.gambar[2]?.sebab));
    check("DOCX: JPEG ikut terbaca", isi.gambar[3]?.mime === "image/jpeg" && isi.gambar[3]?.data?.equals(JPG) === true, String(isi.gambar[3]?.mime));
    check("DOCX: isi kotak teks dibaca SEKALI (dulu dua kali)", t.split("ISI KOTAK TEKS").length - 1 === 1, String(t.split("ISI KOTAK TEKS").length - 1));
    check("DOCX: rumus dibaca linear (pangkat & pecahan)", t.includes("x^(2)") && t.includes("((a)/(b))"), t.slice(pos("x"), pos("x") + 30));
    check("DOCX: grafik dibaca dari datanya", t.includes("[Grafik: Nilai Ujian, Budi, 87]"), "c:v");
    check("DOCX: bentuk garis/panah tanpa gambar diberi catatan", isi.catatan.some((c) => /1 bentuk gambar/.test(c)), isi.catatan.join(" | "));
    check("DOCX: catatan kaki & header ikut dibaca", t.includes("[Catatan kaki]\nSumber: buku paket") && t.includes("[Header]\nSMA Uji"), "footnotes/header");
    check("DOCX: logo header di urutan terakhir (tak merebut jatah gambar jawaban)", isi.gambar[isi.gambar.length - 1].lokasi === "header", isi.gambar.map((g) => g.lokasi).join(","));

    const hemat = extractOfficeIsi(docx, "docx", 1)!;
    check("DOCX: gambar di atas jatah dicatat 'melebihi batas', datanya tidak dibongkar", hemat.gambar[0].data !== null && hemat.gambar[3].data === null && hemat.gambar[3].sebab === "melebihi batas jumlah gambar", String(hemat.gambar[3].sebab));
    const lama = extractOfficeText(docx, "docx", 10_000) ?? "";
    check("extractOfficeText lama: tanpa penanda gambar", !/\u0000/.test(lama) && lama.includes("Soal 2"), "kompatibel");

    const tinta = extractOfficeIsi(
      zip({
        "word/document.xml": `<w:document><w:body>${p("Coret")}<w:p><w:r><mc:AlternateContent><mc:Choice><w14:contentPart r:id="rIdI"/></mc:Choice><mc:Fallback><w:pict><v:shape><v:imagedata r:id="rIdF"/></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p><w:p><w:r><w14:contentPart r:id="rIdJ"/></w:r></w:p></w:body></w:document>`,
        "word/_rels/document.xml.rels": rels([["rIdF", "media/tinta.png"]]),
        "word/media/tinta.png": PNG,
      }),
      "docx",
      5,
    )!;
    check("DOCX: coretan tinta dibaca lewat gambar cadangannya", tinta.gambar.length === 1 && tinta.gambar[0].data !== null, `${tinta.gambar.length} gambar`);
    check("DOCX: coretan tinta tanpa cadangan diberi catatan", tinta.catatan.some((c) => /coretan tinta/.test(c)), tinta.catatan.join(" | "));
  }

  // ── PPTX & XLSX ─────────────────────────────────────────────────────
  {
    const pptx = zip({
      "ppt/slides/slide1.xml": `<p:sld><a:p><a:r><a:t>Slide jawaban</a:t></a:r></a:p><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:sld>`,
      "ppt/slides/_rels/slide1.xml.rels": rels([["rId2", "../media/image1.png"]]),
      "ppt/media/image1.png": PNG,
    });
    const ip = extractOfficeIsi(pptx, "pptx", 5)!;
    check("PPTX: gambar slide terbaca (target relatif ../media)", ip.gambar.length === 1 && ip.gambar[0].data?.equals(PNG) === true && ip.gambar[0].lokasi === "slide 1", ip.gambar.map((g) => g.sebab ?? g.lokasi).join());

    const xlsx = zip({
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Tabel</t></is></c></row></sheetData></worksheet>`,
      "xl/worksheets/_rels/sheet1.xml.rels": rels([["rId1", "../drawings/drawing1.xml"]]),
      "xl/drawings/drawing1.xml": `<xdr:wsDr><xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic></xdr:wsDr>`,
      "xl/drawings/_rels/drawing1.xml.rels": rels([["rId1", "../media/image1.png"]]),
      "xl/media/image1.png": PNG,
    });
    const ix = extractOfficeIsi(xlsx, "xlsx", 5)!;
    check("XLSX: gambar di lembar terbaca lewat drawing", ix.gambar.length === 1 && ix.gambar[0].data !== null && ix.teks.includes("A1: Tabel"), ix.gambar.map((g) => g.sebab ?? g.lokasi).join());
  }

  // ── PDF ─────────────────────────────────────────────────────────────
  {
    const biasa = await bacaPdf(
      buatPdf([{ isi: `${teksPdf("Jawaban nomor satu")} ${gambarPdf("Im1")}`, xobject: { Im1: rgb(40, 30, (x) => [x * 6, 100, 200]) } }]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    const g0 = biasa.ok ? biasa.gambar[0] : null;
    const png0 = g0?.data ? bacaPng(g0.data) : null;
    check("PDF: teks & gambar sama-sama terbaca", biasa.ok && biasa.teks.includes("Jawaban nomor satu") && png0?.lebar === 40 && png0.tinggi === 30, biasa.ok ? biasa.teks.replace(/\u0000/g, "¤") : "rusak");
    check("PDF: piksel gambar utuh (RGB)", png0?.kanal === 3 && png0.piksel(5, 0).join() === "30,100,200", png0?.piksel(5, 0).join() ?? "-");
    check("PDF: penanda gambar di halamannya", biasa.ok && /\[Halaman 1\][\s\S]*\u0000G0\u0000/.test(biasa.teks), "halaman 1");

    const pindai = await bacaPdf(
      buatPdf([{ isi: gambarPdf("Im1"), xobject: { Im1: { dict: "/Width 40 /Height 30 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", data: JPG } } }]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    const pj = pindai.ok && pindai.gambar[0]?.data ? bacaPng(pindai.gambar[0].data) : null;
    check("PDF hasil pindai (JPEG, tanpa teks): gambarnya terbaca", pj?.lebar === 40 && pj.tinggi === 30, pindai.ok ? `${pindai.gambar.length} gambar` : "rusak");
    check("PDF hasil pindai: halaman TIDAK dilaporkan kosong", pindai.ok && pindai.catatan.length === 0, pindai.ok ? pindai.catatan.join(" | ") : "-");

    const besar = await bacaPdf(buatPdf([{ isi: gambarPdf("Im1"), xobject: { Im1: rgb(2400, 60, () => [0, 0, 0]) } }]), { maxHalaman: 30, maxGambar: 3 });
    const pb = besar.ok && besar.gambar[0]?.data ? bacaPng(besar.gambar[0].data) : null;
    check("PDF: gambar lebar dikecilkan ke 1600 & diringkas ke 1 kanal", pb?.lebar === 1600 && pb.tinggi === 40 && pb.kanal === 1, pb ? `${pb.lebar}x${pb.tinggi} k${pb.kanal}` : "-");

    const maskData = Buffer.alloc(4 * 32);
    maskData.fill(0x00, 0, 4 * 16);
    maskData.fill(0xff, 4 * 16);
    const mask = await bacaPdf(
      buatPdf([{ isi: `0 0 0 rg ${gambarPdf("M")}`, xobject: { M: { dict: "/Width 32 /Height 32 /ImageMask true /BitsPerComponent 1", data: maskData } } }]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    const pm = mask.ok && mask.gambar[0]?.data ? bacaPng(mask.gambar[0].data) : null;
    check("PDF: mask 1-bit (pindaian hitam-putih) terbaca, bit 0 = tinta hitam", pm?.kanal === 1 && pm.piksel(0, 0)[0] === 0 && pm.piksel(0, 31)[0] === 255, pm ? `${pm.piksel(0, 0)}/${pm.piksel(0, 31)}` : "-");

    const kecilDanUlang = await bacaPdf(
      buatPdf([
        { isi: `${teksPdf("a")} ${gambarPdf("Ikon")} ${gambarPdf("Im1")} ${gambarPdf("Im1")}`, xobject: { Ikon: rgb(10, 10, () => [9, 9, 9]), Im1: rgb(30, 30, () => [1, 2, 3]) } },
      ]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    check("PDF: ikon kecil diabaikan, gambar yang digambar dua kali dihitung sekali", kecilDanUlang.ok && kecilDanUlang.gambar.length === 1, kecilDanUlang.ok ? `${kecilDanUlang.gambar.length} gambar` : "-");

    const lintas = await bacaPdf(
      buatPdf([
        { isi: `${teksPdf("Satu")} ${gambarPdf("Im1")}`, xobject: { Im1: rgb(30, 30, () => [5, 6, 7]) } },
        { isi: `${teksPdf("Dua")} ${gambarPdf("Im9")}`, xobject: { Im9: rgb(30, 30, () => [5, 6, 7]) } },
      ]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    check(
      "PDF: gambar sama di dua halaman dikirim sekali, dirujuk di kedua halaman",
      lintas.ok && lintas.gambar.length === 1 && lintas.teks.split("\u0000G0\u0000").length - 1 === 2,
      lintas.ok ? `${lintas.gambar.length} gambar` : "-",
    );

    const lengkung = Array.from({ length: 30 }, (_, i) => `${i} 0 m ${i} 10 ${i + 5} 20 ${i + 9} 30 c S`).join(" ");
    const garis = Array.from({ length: 60 }, (_, i) => `0 ${i * 3} m 200 ${i * 3} l S`).join(" ");
    const vektor = await bacaPdf(
      buatPdf([
        { isi: `${teksPdf("Diagram")} ${lengkung}` },
        { isi: `${teksPdf("Tabel")} ${garis}` },
        { isi: "" },
      ]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    const cv = vektor.ok ? vektor.catatan.join(" | ") : "";
    check("PDF: halaman berisi gambar garis/diagram diberi catatan", /halaman 1 tampaknya berisi gambar garis/.test(cv), cv);
    check("PDF: tabel bergaris biasa TIDAK dianggap diagram", !/halaman 2 tampaknya|halaman 1, 2|halaman 1 dan 2/.test(cv), cv);
    check("PDF: halaman kosong diberi catatan", /halaman 3 tidak berisi teks atau gambar/.test(cv), cv);

    const panjang = await bacaPdf(buatPdf([{ isi: teksPdf("satu") }, { isi: teksPdf("dua") }]), { maxHalaman: 1, maxGambar: 3 });
    check("PDF: halaman di luar batas diberi catatan", panjang.ok && panjang.catatan.some((c) => /hanya 1 dari 2 halaman/.test(c)) && !panjang.teks.includes("dua"), panjang.ok ? panjang.catatan.join(" | ") : "-");

    const raksasa = await bacaPdf(
      buatPdf([{ isi: gambarPdf("Im1"), xobject: { Im1: { dict: "/Width 6000 /Height 6000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode", data: deflateSync(Buffer.alloc(16)) } } }]),
      { maxHalaman: 30, maxGambar: 3 },
    );
    check("PDF: gambar raksasa (36 MP) tidak didekode & halamannya dilaporkan", raksasa.ok && raksasa.gambar.length === 0 && raksasa.catatan.some((c) => /halaman 1 tidak berisi/.test(c)), raksasa.ok ? raksasa.catatan.join(" | ") : "rusak");
    check("PDF rusak → ok:false, tidak melempar", !(await bacaPdf(Buffer.from("%PDF-1.4 bukan pdf"), { maxHalaman: 5, maxGambar: 1 })).ok, "rusak");

    const jatah = await bacaPdf(
      buatPdf([1, 2, 3].map((n) => ({ isi: gambarPdf(`Im${n}`), xobject: { [`Im${n}`]: rgb(30, 30, () => [n, n, n]) } }))),
      { maxHalaman: 30, maxGambar: 2 },
    );
    check("PDF: gambar di atas jatah ditemukan tetapi tidak didekode", jatah.ok && jatah.gambar.length === 3 && jatah.gambar[2].data === null && jatah.gambar[2].sebab === "melebihi batas jumlah gambar", jatah.ok ? jatah.gambar.map((g) => g.sebab ?? "ok").join(",") : "-");
  }

  // ── Inti: anggaran bersama, penanda, peringatan ─────────────────────
  {
    const docx = zip({
      "word/document.xml": `<w:document><w:body>${p("Jawaban A")}${blip("r1")}${p("Jawaban B")}${blip("r2")}${blip("r3")}</w:body></w:document>`,
      "word/_rels/document.xml.rels": rels([["r1", "media/1.png"], ["r2", "media/2.jpeg"], ["r3", "media/3.png"]]),
      "word/media/1.png": PNG,
      "word/media/2.jpeg": JPG,
      "word/media/3.png": PNG,
    });
    const isi = await bacaIsiBerkas([berkas("foto.png", "image/png", PNG), berkas("jawab.docx", DOCX, docx)], { maxChars: 12000, maxGambar: 2 });
    check("inti: jatah gambar dibagi antar-berkas (foto + 1 gambar dokumen)", isi.gambar.length === 2 && isi.gambar[0].label === "foto.png" && isi.gambar[1].label === "jawab.docx - Gambar 1", isi.gambar.map((g) => g.label).join(","));
    check("inti: rujukan di teks = label gambar yang dikirim", isi.teks.includes('[Gambar 1: lihat gambar "jawab.docx - Gambar 1"]'), isi.teks);
    check("inti: gambar di luar jatah ditandai di teks (AI tahu ada yang hilang)", isi.teks.includes("[Gambar 2 - tidak terbaca: melebihi batas 2 gambar sekali koreksi]"), isi.teks);
    check("inti: peringatan pengajar mengelompokkan gambar yang tak terkirim", isi.tidakTerbaca.some((w) => /jawab\.docx - 2 gambar \(2, 3\) di badan dokumen tidak terbaca: melebihi batas 2 gambar/.test(w)), isi.tidakTerbaca.join(" | "));
    check("inti: urutan teks terjaga (Jawaban A, gambar, Jawaban B)", isi.teks.indexOf("Jawaban A") < isi.teks.indexOf("[Gambar 1") && isi.teks.indexOf("[Gambar 1") < isi.teks.indexOf("Jawaban B"), "posisi");
    check("inti: gambar dikirim sebagai data URL bertipe benar", isi.gambar[1].url.startsWith("data:image/png;base64,"), isi.gambar[1].url.slice(0, 30));

    // 20 baris di dalam halaman (teks di luar halaman memang tidak dibaca pdf.js).
    const baris = Array.from({ length: 20 }, (_, i) => `(Baris ${String(i).padStart(2, "0")} jawaban panjang sekali) Tj T*`).join(" ");
    const potong = await bacaIsiBerkas([berkas("panjang.pdf", "application/pdf", buatPdf([{ isi: `BT /F1 8 Tf 10 TL 10 290 Td ${baris} ET` }]))], { maxChars: 300, maxGambar: 3 });
    check("inti: teks yang terpotong diberi peringatan", potong.tidakTerbaca.some((w) => /panjang\.pdf - teksnya terlalu panjang, hanya ±300 karakter/.test(w)) && potong.teks.length <= 300 + 40, potong.tidakTerbaca.join(" | "));

    const kosong = await bacaIsiBerkas([berkas("kosong.pdf", "application/pdf", buatPdf([{ isi: "" }]))], { maxChars: 1000, maxGambar: 3 });
    check("inti: dokumen tanpa isi terbaca tidak dikirim & diperingatkan", kosong.teks === "" && kosong.tidakTerbaca.some((w) => /tidak ada teks maupun gambar/.test(w)), kosong.tidakTerbaca.join(" | "));

    const lain = await bacaIsiBerkas(
      [
        berkas("a.zip", "application/zip", Buffer.from("zip")),
        berkas("hilang.pdf", "application/pdf", null),
        berkas("besar.png", "image/png", Buffer.alloc(MAX_GAMBAR_BYTES + 1)),
        berkas("rusak.docx", DOCX, Buffer.from("bukan zip")),
      ],
      { maxChars: 1000, maxGambar: 3 },
    );
    const w = lain.tidakTerbaca.join(" | ");
    check("inti: ZIP, berkas hilang, gambar > 4 MB, & dokumen rusak semuanya diperingatkan", /a\.zip - arsip ZIP/.test(w) && /hilang\.pdf - berkasnya sudah tidak ada/.test(w) && /besar\.png - gambar di atas 4 MB/.test(w) && /rusak\.docx - berkas rusak/.test(w), w);
    check("inti: tidak ada yang dikirim dari berkas-berkas itu", lain.teks === "" && lain.gambar.length === 0, "kosong");
  }

  // ── Prompt menyampaikan bagian yang hilang ke AI ────────────────────
  {
    const j = teksBagianJawaban({ teks: "isi", tidakTerbaca: ["a.pdf - halaman 2 tidak berisi teks atau gambar yang bisa dibaca"], jumlahGambar: 2 });
    check("prompt kelas: bagian jawaban yang hilang disebut ke AI", j.includes("halaman 2 tidak berisi") && j.includes("Jangan menghukum siswa") && j.includes("2 gambar jawaban"), j);
    const s = teksBagianSoal({ judul: "T", maxPoints: 100, instruksi: "x", catatan: "", teksBerkasKonteks: "", tidakTerbaca: ["kunci.docx - Gambar 1 tidak terbaca"], jumlahGambar: 0 });
    check("prompt kelas: bagian soal yang hilang disebut ke AI", s.includes("kunci.docx - Gambar 1"), s);
    const k = buildGradingPrompt({ lessonTitle: "L", instructions: null, passingGrade: 70, submissionText: "", jumlahGambar: 1, tidakTerbaca: ["b.pdf - hanya 30 dari 40 halaman"] }).user;
    check("prompt kursus: gambar & bagian yang hilang disebut ke AI", k.includes("1 gambar dari berkas peserta") && k.includes("hanya 30 dari 40 halaman") && k.includes("jawabannya berupa gambar"), k.slice(-300));
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
