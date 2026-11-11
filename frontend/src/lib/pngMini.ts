import { deflateSync } from "node:zlib";

/**
 * Pembuat PNG kecil tanpa dependensi, untuk gambar yang diambil dari PDF
 * (pdf.js memberi piksel mentah, model vision butuh berkas gambar).
 *
 * Tanpa `server-only` dan tanpa impor `@/` supaya skrip verifikasi bisa
 * mengujinya langsung; isinya tetap hanya dipakai di server (butuh zlib).
 */

/** Piksel mentah: 1 (abu), 3 (RGB), atau 4 (RGBA) kanal per piksel, baris demi baris. */
export interface Piksel {
  lebar: number;
  tinggi: number;
  kanal: 1 | 3 | 4;
  data: Uint8Array;
}

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABEL_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function potongan(jenis: string, isi: Buffer): Buffer {
  const kepala = Buffer.alloc(8);
  kepala.writeUInt32BE(isi.length, 0);
  kepala.write(jenis, 4, "ascii");
  const ekor = Buffer.alloc(4);
  ekor.writeUInt32BE(crc32(Buffer.concat([kepala.subarray(4), isi])), 0);
  return Buffer.concat([kepala, isi, ekor]);
}

/** Piksel → berkas PNG (8 bit, tanpa filter baris; zlib yang memadatkan). */
export function encodePng(p: Piksel): Buffer {
  const { lebar, tinggi, kanal, data } = p;
  if (!Number.isInteger(lebar) || !Number.isInteger(tinggi) || lebar < 1 || tinggi < 1) throw new Error("Ukuran gambar tidak sah.");
  if (data.length < lebar * tinggi * kanal) throw new Error("Data piksel kurang.");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lebar, 0);
  ihdr.writeUInt32BE(tinggi, 4);
  ihdr[8] = 8; // bit per kanal
  ihdr[9] = kanal === 1 ? 0 : kanal === 3 ? 2 : 6; // abu / RGB / RGBA
  // [10..12] kompresi, filter, interlace = 0

  const baris = lebar * kanal;
  const mentah = Buffer.alloc((baris + 1) * tinggi);
  for (let y = 0; y < tinggi; y++) {
    mentah[y * (baris + 1)] = 0; // filter "None"
    mentah.set(data.subarray(y * baris, (y + 1) * baris), y * (baris + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan("IHDR", ihdr),
    potongan("IDAT", deflateSync(mentah, { level: 6 })),
    potongan("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Mengecilkan gambar supaya sisi terpanjang ≤ `maks` (rata-rata kotak, jadi
 * tulisan tipis tidak hilang seperti pada pengambilan titik terdekat).
 * Gambar yang sudah cukup kecil dikembalikan apa adanya.
 */
export function perkecil(p: Piksel, maks: number): Piksel {
  const skala = Math.min(1, maks / Math.max(p.lebar, p.tinggi));
  if (skala >= 1) return p;
  const lebar = Math.max(1, Math.round(p.lebar * skala));
  const tinggi = Math.max(1, Math.round(p.tinggi * skala));
  const k = p.kanal;
  const out = new Uint8Array(lebar * tinggi * k);
  const jumlah = new Float64Array(k);

  for (let y = 0; y < tinggi; y++) {
    const y0 = Math.floor((y * p.tinggi) / tinggi);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * p.tinggi) / tinggi));
    for (let x = 0; x < lebar; x++) {
      const x0 = Math.floor((x * p.lebar) / lebar);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * p.lebar) / lebar));
      jumlah.fill(0);
      for (let sy = y0; sy < y1; sy++) {
        let i = (sy * p.lebar + x0) * k;
        for (let sx = x0; sx < x1; sx++) {
          for (let c = 0; c < k; c++) jumlah[c] += p.data[i + c];
          i += k;
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (y * lebar + x) * k;
      for (let c = 0; c < k; c++) out[o + c] = Math.round(jumlah[c] / n);
    }
  }
  return { lebar, tinggi, kanal: k, data: out };
}

/** RGB/RGBA yang semua pikselnya abu-abu (hasil pindai hitam-putih) → 1 kanal: PNG-nya jauh lebih kecil. */
export function ringkasKanal(p: Piksel): Piksel {
  if (p.kanal === 1) return p;
  const n = p.lebar * p.tinggi;
  for (let i = 0; i < n; i++) {
    const o = i * p.kanal;
    if (p.data[o] !== p.data[o + 1] || p.data[o] !== p.data[o + 2] || (p.kanal === 4 && p.data[o + 3] !== 255)) return p;
  }
  const abu = new Uint8Array(n);
  for (let i = 0; i < n; i++) abu[i] = p.data[i * p.kanal];
  return { lebar: p.lebar, tinggi: p.tinggi, kanal: 1, data: abu };
}
