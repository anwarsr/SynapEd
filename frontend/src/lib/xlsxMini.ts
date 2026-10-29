/**
 * Penulis .xlsx minimal (satu lembar, teks & angka) tanpa dependensi.
 *
 * Modul NETRAL: hanya memakai `Buffer`, jadi bisa diuji skrip tsx dan dipakai
 * rute server. xlsx = ZIP berisi XML; di sini ZIP "stored" (tanpa kompresi) -
 * berkasnya kecil dan Excel/Sheets/LibreOffice membukanya biasa. Teks disimpan
 * sebagai `inlineStr` (tanpa sharedStrings) dan SELALU di-escape XML.
 *
 * Sel yang diawali = + - @ pada teks dianggap rumus oleh Excel ("CSV injection");
 * di sini teks tak pernah ditulis sebagai rumus (inlineStr), jadi aman, tetapi
 * nama peserta tetap disaring dari karakter kontrol XML yang membuat berkas rusak.
 */

export type SelXlsx = string | number | null;

export interface LembarXlsx {
  nama: string;
  /** Baris pertama dianggap judul kolom (ditebalkan). */
  baris: SelXlsx[][];
  /** Lebar kolom (satuan karakter Excel), opsional. */
  lebar?: number[];
}

// ── CRC32 ────────────────────────────────────────────────────────────────
const TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABEL[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP (stored) ─────────────────────────────────────────────────────────
function buatZip(berkas: { nama: string; isi: Buffer }[]): Buffer {
  const bagian: Buffer[] = [];
  const pusat: Buffer[] = [];
  let offset = 0;

  for (const b of berkas) {
    const nama = Buffer.from(b.nama, "utf8");
    const crc = crc32(b.isi);
    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(20, 4); // versi minimum
    lokal.writeUInt16LE(0x0800, 6); // nama berkas UTF-8
    lokal.writeUInt16LE(0, 8); // stored
    lokal.writeUInt16LE(0, 10);
    lokal.writeUInt16LE(0x21, 12); // 1980-01-01
    lokal.writeUInt32LE(crc, 14);
    lokal.writeUInt32LE(b.isi.length, 18);
    lokal.writeUInt32LE(b.isi.length, 22);
    lokal.writeUInt16LE(nama.length, 26);
    lokal.writeUInt16LE(0, 28);
    bagian.push(lokal, nama, b.isi);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(b.isi.length, 20);
    dir.writeUInt32LE(b.isi.length, 24);
    dir.writeUInt16LE(nama.length, 28);
    dir.writeUInt32LE(offset, 42);
    pusat.push(dir, nama);

    offset += lokal.length + nama.length + b.isi.length;
  }

  const ukuranPusat = pusat.reduce((n, b) => n + b.length, 0);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(berkas.length, 8);
  akhir.writeUInt16LE(berkas.length, 10);
  akhir.writeUInt32LE(ukuranPusat, 12);
  akhir.writeUInt32LE(offset, 16);
  return Buffer.concat([...bagian, ...pusat, akhir]);
}

// ── XML ──────────────────────────────────────────────────────────────────
/** Karakter kontrol (selain tab/LF/CR) tidak sah di XML 1.0 dan merusak berkas. */
const KONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function esc(s: string): string {
  return s.replace(KONTROL, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
function hurufKolom(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nama lembar: maks 31 karakter, tanpa : \ / ? * [ ]. */
export function namaLembarSah(nama: string): string {
  return nama.replace(/[:\\/?*[\]]/g, " ").replace(KONTROL, "").trim().slice(0, 31) || "Lembar1";
}

function xmlLembar(l: LembarXlsx): string {
  const kolom = l.lebar?.length
    ? `<cols>${l.lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const baris = l.baris
    .map((r, ri) => {
      const sel = r
        .map((v, ci) => {
          if (v === null || v === "") return "";
          const ref = `${hurufKolom(ci)}${ri + 1}`;
          const gaya = ri === 0 ? ' s="1"' : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${gaya}><v>${v}</v></c>`;
          return `<c r="${ref}"${gaya} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${sel}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${kolom}<sheetData>${baris}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

export function buatXlsx(lembar: LembarXlsx): Buffer {
  const T = (s: string) => Buffer.from(s, "utf8");
  return buatZip([
    {
      nama: "[Content_Types].xml",
      isi: T(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      nama: "_rels/.rels",
      isi: T(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      nama: "xl/workbook.xml",
      isi: T(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(namaLembarSah(lembar.nama))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      nama: "xl/_rels/workbook.xml.rels",
      isi: T(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { nama: "xl/styles.xml", isi: T(STYLES) },
    { nama: "xl/worksheets/sheet1.xml", isi: T(xmlLembar(lembar)) },
  ]);
}
