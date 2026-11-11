import { createHash } from "node:crypto";
import { encodePng, perkecil, ringkasKanal, type Piksel } from "./pngMini";
import { penandaGambar, type GambarDokumen, type IsiDokumen } from "./isiDokumen";

/**
 * Isi PDF untuk penilaian AI: teks per halaman DAN gambar di dalamnya.
 *
 * Dulu hanya teksnya yang dibaca, jadi jawaban berupa foto/hasil pindai atau
 * diagram yang ditempel di PDF tak pernah terlihat AI - dan tidak ada yang
 * memberi tahu pengajar. Kini gambar diambil lewat pdf.js (yang sudah
 * mendekode JPEG/Flate sendiri di Node, tanpa canvas), diubah ke PNG, dan
 * diberi penanda posisi halamannya di teks. Yang tetap tidak bisa dibaca
 * (gambar garis/vektor, halaman kosong, halaman di luar batas) dilaporkan
 * lewat `catatan`, bukan dilewati diam-diam.
 *
 * Berkasnya kiriman siswa, jadi dianggap bermusuhan: ukuran gambar yang mau
 * didekode dibatasi `MAKS_PIKSEL` (pdf.js membuang yang lebih besar), dan
 * jumlah halaman dibatasi pemanggil.
 *
 * Tanpa `server-only` dan tanpa impor `@/` supaya skrip verifikasi bisa
 * mengujinya langsung; isinya tetap hanya dipakai di server.
 */

/** Sisi terpanjang gambar yang dikirim: cukup untuk tulisan tangan, jauh di bawah batas 4 MB. */
export const SISI_GAMBAR_MAKS = 1600;
/** Gambar lebih kecil dari ini (ikon, garis hias, poin) diabaikan. */
const SISI_GAMBAR_MIN = 24;
/** Batas piksel per gambar yang mau didekode pdf.js (±20 MP; foto ponsel 12 MP lolos). */
const MAKS_PIKSEL = 20_000_000;
/** Ambang "halaman ini berisi gambar garis": lengkung (tabel tidak punya) atau sangat banyak garis. */
const AMBANG_LENGKUNG = 24;
const AMBANG_GARIS = 400;

export type HasilPdf = ({ ok: true; totalHalaman: number } & IsiDokumen) | { ok: false; sebab: "rusak" };

interface OpsiPdf {
  maxHalaman: number;
  /** Gambar yang benar-benar diubah ke PNG; sisanya hanya dicatat (hemat waktu & memori). */
  maxGambar: number;
}

type DataGambarPdf = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray | null };

/** Data gambar pdf.js → piksel. kind 1 = 1 bit (0 hitam, 1 putih), 2 = RGB, 3 = RGBA. */
function kePiksel(img: DataGambarPdf, mask: boolean): Piksel | null {
  const { width: lebar, height: tinggi, data } = img;
  if (!data || !lebar || !tinggi) return null;
  const kind = mask ? 1 : img.kind;
  if (kind === 2 && data.length >= lebar * tinggi * 3) return { lebar, tinggi, kanal: 3, data: Uint8Array.from(data.subarray(0, lebar * tinggi * 3)) };
  if (kind === 3 && data.length >= lebar * tinggi * 4) return { lebar, tinggi, kanal: 4, data: Uint8Array.from(data.subarray(0, lebar * tinggi * 4)) };
  if (kind === 1) {
    // Satu baris = ceil(lebar/8) byte. Mask (stensil) memakai pemetaan yang sama
    // di pdf.js: bit 0 = bagian yang dicat (tinta), bit 1 = kosong.
    const perBaris = (lebar + 7) >> 3;
    if (data.length < perBaris * tinggi) return null;
    const out = new Uint8Array(lebar * tinggi);
    for (let y = 0; y < tinggi; y++) {
      for (let x = 0; x < lebar; x++) {
        const bit = (data[y * perBaris + (x >> 3)] >> (7 - (x & 7))) & 1;
        out[y * lebar + x] = bit ? 255 : 0;
      }
    }
    return { lebar, tinggi, kanal: 1, data: out };
  }
  return null;
}

/** RGBA dengan latar transparan dipipihkan ke putih: model vision membaca transparan sebagai hitam. */
function pipihkan(p: Piksel): Piksel {
  if (p.kanal !== 4) return p;
  const n = p.lebar * p.tinggi;
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = p.data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(p.data[i * 4 + c] * a + 255 * (1 - a));
  }
  return { lebar: p.lebar, tinggi: p.tinggi, kanal: 3, data: out };
}

function sidikPiksel(img: DataGambarPdf): string {
  const h = createHash("sha1");
  h.update(`${img.width}x${img.height}:${img.kind ?? "m"}:`);
  if (img.data) h.update(img.data);
  return h.digest("hex");
}

/**
 * Objek gambar pdf.js diselesaikan ASINKRON setelah daftar operasinya jadi;
 * membacanya langsung (`get(id)` tanpa callback) melempar "belum selesai".
 * Batas waktu supaya satu gambar yang macet tidak menggantung seluruh koreksi.
 */
function ambilObjek(wadah: { get(id: string, cb: (v: unknown) => void): unknown }, id: string): Promise<DataGambarPdf | null> {
  return new Promise((selesai) => {
    const batas = setTimeout(() => selesai(null), 5000);
    try {
      wadah.get(id, (v) => {
        clearTimeout(batas);
        selesai((v as DataGambarPdf | null) ?? null);
      });
    } catch {
      clearTimeout(batas);
      selesai(null);
    }
  });
}

/** Jumlah segmen lengkung & jumlah path pada satu halaman (format path pdf.js 6: kode DrawOPS + koordinat). */
function hitungVektor(fnArray: number[], argsArray: unknown[][], opConstructPath: number): { lengkung: number; path: number } {
  let lengkung = 0;
  let path = 0;
  for (let i = 0; i < fnArray.length; i++) {
    if (fnArray[i] !== opConstructPath) continue;
    path++;
    const data = (argsArray[i]?.[1] as unknown[] | undefined)?.[0];
    if (!(data instanceof Float32Array)) continue;
    for (let j = 0; j < data.length; ) {
      const op = data[j];
      if (op === 0 || op === 1) j += 3; // moveTo, lineTo
      else if (op === 2) {
        lengkung++;
        j += 7;
      } else if (op === 3) {
        lengkung++;
        j += 5;
      } else j += 1; // closePath / tak dikenal
    }
  }
  return { lengkung, path };
}

/**
 * Teks + gambar seluruh PDF (sampai `maxHalaman`). Tidak pernah melempar:
 * PDF rusak → `{ ok: false }`.
 */
export async function bacaPdf(buffer: Uint8Array, opsi: OpsiPdf): Promise<HasilPdf> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  let tugas: ReturnType<typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"]> | null = null;
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    tugas = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      // Tanpa OffscreenCanvas di Node: gambar dikembalikan sebagai piksel mentah.
      isOffscreenCanvasSupported: false,
      maxImageSize: MAKS_PIKSEL,
      verbosity: 0,
    });
    const doc = await tugas.promise;
    const OPS = pdfjs.OPS;

    const total = doc.numPages;
    const dibaca = Math.min(total, opsi.maxHalaman);
    const bagian: string[] = [];
    const gambar: GambarDokumen[] = [];
    const catatan: string[] = [];
    /** ID objek pdf.js ATAU sidik piksel → indeks gambar yang sudah tercatat. */
    const indeksGambar = new Map<string, number>();
    const halamanKosong: number[] = [];
    const halamanVektor: number[] = [];
    let diambil = 0;

    for (let n = 1; n <= dibaca; n++) {
      const page = await doc.getPage(n);
      const konten = await page.getTextContent();
      const teks = konten.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();

      const ops = await page.getOperatorList();
      const penanda: string[] = [];
      const diHalamanIni = new Set<number>();
      /** Gambar yang sudah ada dirujuk lagi (sekali per halaman), bukan dikirim ulang. */
      const rujuk = (i: number) => {
        if (!diHalamanIni.has(i)) penanda.push(penandaGambar(i));
        diHalamanIni.add(i);
      };

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];
        let img: DataGambarPdf | null = null;
        let mask = false;
        let id = "";

        if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
          if (typeof args[0] !== "string") continue;
          id = args[0];
        } else if (fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
          mask = fn === OPS.paintImageMaskXObject;
          const arg = (args[0] as (Omit<DataGambarPdf, "data"> & { data?: unknown }) | null) ?? null;
          // pdf.js 6: mask ber-ID ("mask_p0_1") yang datanya diselesaikan terpisah, seperti XObject.
          if (arg && typeof arg.data === "string") id = arg.data;
          else img = arg as DataGambarPdf | null;
        } else continue;

        const adaId = id ? indeksGambar.get(id) : undefined;
        if (adaId !== undefined) {
          rujuk(adaId);
          continue;
        }
        if (id) img = await ambilObjek(id.startsWith("g_") ? page.commonObjs : page.objs, id);
        if (img && (img.width < SISI_GAMBAR_MIN || img.height < SISI_GAMBAR_MIN)) continue;

        // ID pdf.js berlaku per halaman: gambar yang sama di halaman lain (kop,
        // foto yang diulang) dikenali dari isi pikselnya, supaya tidak memakan
        // jatah gambar dua kali.
        const sidik = img ? sidikPiksel(img) : "";
        const adaSidik = sidik ? indeksGambar.get(sidik) : undefined;
        if (adaSidik !== undefined) {
          if (id) indeksGambar.set(id, adaSidik);
          rujuk(adaSidik);
          continue;
        }
        if (id) indeksGambar.set(id, gambar.length);
        if (sidik) indeksGambar.set(sidik, gambar.length);

        const label = `Gambar ${gambar.length + 1}`;
        const lokasi = `halaman ${n}`;
        if (!img) {
          gambar.push({ label, lokasi, mime: "image/png", data: null, sebab: "gagal diurai" });
        } else if (diambil >= opsi.maxGambar) {
          gambar.push({ label, lokasi, mime: "image/png", data: null, sebab: "melebihi batas jumlah gambar" });
        } else {
          const piksel = kePiksel(img, mask);
          if (!piksel) {
            gambar.push({ label, lokasi, mime: "image/png", data: null, sebab: "format warnanya tidak didukung" });
          } else {
            const png = encodePng(ringkasKanal(perkecil(pipihkan(piksel), SISI_GAMBAR_MAKS)));
            gambar.push({ label, lokasi, mime: "image/png", data: png });
            diambil++;
          }
        }
        rujuk(gambar.length - 1);
      }

      const { lengkung, path } = hitungVektor(ops.fnArray, ops.argsArray as unknown[][], OPS.constructPath);
      if (lengkung >= AMBANG_LENGKUNG || path >= AMBANG_GARIS) halamanVektor.push(n);
      if (!teks && penanda.length === 0 && path === 0) halamanKosong.push(n);

      bagian.push([`[Halaman ${n}]`, teks, penanda.join("\n")].filter(Boolean).join("\n"));
      page.cleanup();
    }
    await tugas.destroy();

    if (total > dibaca) {
      const sisa = dibaca + 1 === total ? `halaman ${total}` : `halaman ${dibaca + 1}-${total}`;
      catatan.push(`hanya ${dibaca} dari ${total} halaman yang dibaca (${sisa} tidak dinilai AI)`);
    }
    if (halamanVektor.length > 0)
      catatan.push(`${daftarHalaman(halamanVektor)} tampaknya berisi gambar garis/diagram/grafik (vektor) yang tidak bisa dilihat AI`);
    if (halamanKosong.length > 0) catatan.push(`${daftarHalaman(halamanKosong)} tidak berisi teks atau gambar yang bisa dibaca`);

    return { ok: true, totalHalaman: total, teks: bagian.join("\n\n"), gambar, catatan };
  } catch (e) {
    console.error("[pdfIsi] PDF tidak bisa dibaca:", e);
    await tugas?.destroy().catch(() => undefined);
    return { ok: false, sebab: "rusak" };
  }
}

function daftarHalaman(n: number[]): string {
  return n.length === 1 ? `halaman ${n[0]}` : `halaman ${n.slice(0, -1).join(", ")} dan ${n[n.length - 1]}`;
}
