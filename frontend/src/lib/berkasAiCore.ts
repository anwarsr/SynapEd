import { POLA_PENANDA, type GambarDokumen, type IsiDokumen } from "./isiDokumen";
import { extractOfficeIsi, type JenisOffice } from "./officeText";
import { bacaPdf } from "./pdfIsi";

/**
 * Mengubah berkas (jawaban siswa, lampiran soal, konteks pengajar) menjadi
 * apa yang dikirim ke AI: teks + gambar, dengan anggaran bersama.
 *
 * Prinsip (permintaan pemilik): AI harus membaca SELURUH isi dokumen -
 * termasuk gambar di dalam DOCX/PPTX/XLSX/PDF dan PDF hasil pindai - dan
 * setiap bagian yang tetap tidak terbaca dilaporkan ke pengajar di
 * `tidakTerbaca`, lengkap dengan lokasi & sebabnya. Nilai yang diam-diam
 * dihitung dari separuh jawaban lebih berbahaya daripada peringatan.
 *
 * Posisi gambar ditulis di teks ("[Gambar 2: lihat gambar …]") dan setiap
 * gambar dikirim berlabel sama, jadi AI tahu gambar mana menjawab soal mana.
 *
 * Netral (tanpa `server-only`, tanpa `@/`): pembaca Storage ada di
 * classGradingFiles.ts, dan skrip verifikasi menguji modul ini langsung.
 */

/** Batas ukuran tiap gambar yang dikirim - base64 menggembungkan ±33%, dan model gratis punya batas permintaan. */
export const MAX_GAMBAR_BYTES = 4 * 1024 * 1024;
/** Halaman PDF yang dibaca per berkas. */
export const MAX_HALAMAN_PDF = 30;

/** Gambar yang diverifikasi bisa dilihat VISION_MODELS. */
const MIME_GAMBAR = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const OFFICE: Record<string, JenisOffice> = { docx: "docx", pptx: "pptx", xlsx: "xlsx" };

export interface BerkasMasuk {
  nama: string;
  mime: string;
  /** Null = berkasnya sudah tidak ada. */
  ambil: () => Promise<Buffer | null>;
}

export interface GambarAi {
  /** Ditulis tepat sebelum gambarnya, sama dengan rujukan di teks. */
  label: string;
  url: string;
}

export interface IsiBerkas {
  teks: string;
  gambar: GambarAi[];
  /** Kalimat untuk pengajar (dan untuk AI): apa yang tidak terbaca, di mana, dan mengapa. */
  tidakTerbaca: string[];
}

const ekstensi = (nama: string) => nama.slice(nama.lastIndexOf(".") + 1).toLowerCase();
const dataUrl = (mime: string, data: Buffer) => `data:${mime};base64,${data.toString("base64")}`;

/**
 * Membaca sederet berkas dengan anggaran bersama: total teks ≤ `maxChars`,
 * total gambar ≤ `maxGambar`. Tidak pernah melempar - berkas yang gagal
 * dilaporkan lewat `tidakTerbaca`.
 */
export async function bacaIsiBerkas(files: readonly BerkasMasuk[], opts: { maxChars: number; maxGambar: number }): Promise<IsiBerkas> {
  const out: IsiBerkas = { teks: "", gambar: [], tidakTerbaca: [] };

  for (const f of files) {
    const sisaTeks = opts.maxChars - out.teks.length;
    const sisaGambar = opts.maxGambar - out.gambar.length;
    const gambarSaja = MIME_GAMBAR.has(f.mime);

    try {
      // ── Berkas gambar biasa ──
      if (gambarSaja) {
        if (sisaGambar <= 0) {
          out.tidakTerbaca.push(`${f.nama} - tidak dikirim ke AI: melebihi batas ${opts.maxGambar} gambar sekali koreksi`);
          continue;
        }
        const buf = await f.ambil();
        if (!buf) {
          out.tidakTerbaca.push(`${f.nama} - berkasnya sudah tidak ada`);
          continue;
        }
        if (buf.byteLength > MAX_GAMBAR_BYTES) {
          out.tidakTerbaca.push(`${f.nama} - gambar di atas ${MAX_GAMBAR_BYTES / 1024 / 1024} MB`);
          continue;
        }
        out.gambar.push({ label: f.nama, url: dataUrl(f.mime, buf) });
        continue;
      }

      if (sisaTeks < 200) {
        out.tidakTerbaca.push(`${f.nama} - tidak dibaca: batas panjang teks sekali koreksi sudah habis`);
        continue;
      }

      const ext = ekstensi(f.nama);
      const pdf = f.mime === "application/pdf";
      const office = OFFICE[ext];
      if (!pdf && !office) {
        out.tidakTerbaca.push(f.mime === "application/zip" || ext === "zip" ? `${f.nama} - arsip ZIP tidak dibuka` : `${f.nama} - jenis berkas ini tidak bisa dibaca AI`);
        continue;
      }

      const buf = await f.ambil();
      if (!buf) {
        out.tidakTerbaca.push(`${f.nama} - berkasnya sudah tidak ada`);
        continue;
      }

      let isi: IsiDokumen | null;
      if (pdf) {
        const hasil = await bacaPdf(buf, { maxHalaman: MAX_HALAMAN_PDF, maxGambar: Math.max(0, sisaGambar) });
        isi = hasil.ok ? hasil : null;
      } else {
        isi = extractOfficeIsi(buf, office, Math.max(0, sisaGambar));
      }
      if (!isi) {
        out.tidakTerbaca.push(`${f.nama} - berkas rusak, terkunci kata sandi, atau bukan ${pdf ? "PDF" : ext.toUpperCase()} yang sah`);
        continue;
      }

      tambahDokumen(out, f.nama, isi, sisaTeks, opts.maxGambar);
    } catch (e) {
      console.error("[berkasAiCore] Gagal membaca", f.nama, e);
      out.tidakTerbaca.push(`${f.nama} - gagal dibaca`);
    }
  }

  return out;
}

/** Satu dokumen yang sudah diurai → teks berpenanda + gambar + peringatan. */
function tambahDokumen(out: IsiBerkas, nama: string, isi: IsiDokumen, sisaTeks: number, maxGambar: number) {
  // Gambar mana yang benar-benar dikirim; sisanya dikelompokkan per sebab.
  const sebabGambar = new Map<number, string>();
  for (const [i, g] of isi.gambar.entries()) {
    const sebab = sebabTakTerkirim(g, out.gambar.length, maxGambar);
    if (sebab) {
      sebabGambar.set(i, sebab);
      continue;
    }
    out.gambar.push({ label: `${nama} - ${g.label}`, url: dataUrl(g.mime, g.data!) });
  }

  let teks = isi.teks.replace(POLA_PENANDA, (_, n: string) => {
    const g = isi.gambar[Number(n)];
    if (!g) return "";
    const sebab = sebabGambar.get(Number(n));
    return sebab ? `[${g.label} - tidak terbaca: ${sebab}]` : `[${g.label}: lihat gambar "${nama} - ${g.label}"]`;
  });

  let terpotong = false;
  if (teks.length > sisaTeks) {
    teks = teks.slice(0, sisaTeks);
    terpotong = true;
  }

  // Isi sungguhan = teks tanpa penanda gambar & judul halaman/slide/lembar, atau gambar yang terkirim.
  // Dokumen tanpa keduanya tidak dikirim, supaya AI tidak "menilai" penanda kosong.
  const adaGambar = isi.gambar.some((_, i) => !sebabGambar.has(i));
  const adaTeks = isi.teks.replace(POLA_PENANDA, "").replace(/\[(Halaman|Slide|Lembar) \d+\]/g, "").trim().length > 0;
  if (adaTeks || adaGambar) out.teks += `${out.teks ? "\n\n" : ""}[Berkas: ${nama}]\n${teks}`;
  else out.tidakTerbaca.push(`${nama} - tidak ada teks maupun gambar yang bisa dibaca`);

  for (const [sebab, label] of kelompokkan(sebabGambar, isi.gambar)) {
    out.tidakTerbaca.push(`${nama} - ${label} tidak terbaca: ${sebab}`);
  }
  for (const c of isi.catatan) out.tidakTerbaca.push(`${nama} - ${c}`);
  if (terpotong) out.tidakTerbaca.push(`${nama} - teksnya terlalu panjang, hanya ±${sisaTeks.toLocaleString("id-ID")} karakter pertama yang dibaca`);
}

function sebabTakTerkirim(g: GambarDokumen, terkirim: number, maxGambar: number): string | null {
  if (!g.data) return g.sebab === "melebihi batas jumlah gambar" ? `melebihi batas ${maxGambar} gambar sekali koreksi` : (g.sebab ?? "gagal dibaca");
  if (!MIME_GAMBAR.has(g.mime)) return "format gambarnya tidak bisa dilihat AI";
  if (g.data.byteLength > MAX_GAMBAR_BYTES) return `ukurannya di atas ${MAX_GAMBAR_BYTES / 1024 / 1024} MB`;
  if (terkirim >= maxGambar) return `melebihi batas ${maxGambar} gambar sekali koreksi`;
  return null;
}

/** "Gambar 4, Gambar 5 (halaman 2, 3)" per sebab, supaya 20 gambar tidak jadi 20 baris peringatan. */
function kelompokkan(sebab: Map<number, string>, gambar: GambarDokumen[]): [string, string][] {
  const per = new Map<string, number[]>();
  for (const [i, s] of sebab) per.set(s, [...(per.get(s) ?? []), i]);
  return [...per].map(([s, idx]) => {
    const lokasi = [...new Set(idx.map((i) => gambar[i].lokasi))];
    const nama = idx.length === 1 ? gambar[idx[0]].label : `${idx.length} gambar (${idx.map((i) => gambar[i].label.replace("Gambar ", "")).join(", ")})`;
    return [s, `${nama} di ${lokasi.join(", ")}`];
  });
}
