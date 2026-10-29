import "server-only";
import { adminStorage } from "@/lib/firebase/admin";
import { extractPdfText } from "@/lib/pdfText";
import { extractOfficeText, type JenisOffice } from "@/lib/officeText";
import { ekstensiOf, type KelasBerkas } from "@/lib/classAssignmentRules";

/**
 * Mengubah berkas kelas (lampiran, konteks AI, jawaban siswa) menjadi sesuatu
 * yang bisa dikirim ke model: teks, atau gambar base64 untuk model vision.
 *
 * Tidak pernah melempar. Berkas yang tidak terbaca dilaporkan lewat namanya,
 * supaya pengajar tahu AI menilai tanpa berkas itu — lebih jujur daripada
 * nilai yang diam-diam dihitung dari separuh jawaban.
 */

/** Batas gambar yang dikirim — base64 menggembungkan ±33%, dan model gratis punya batas permintaan. */
const MAX_GAMBAR_BYTES = 4 * 1024 * 1024;

export interface IsiBerkas {
  teks: string;
  gambar: string[];
  tidakTerbaca: string[];
}

const OFFICE: Record<string, JenisOffice> = { ".docx": "docx", ".pptx": "pptx", ".xlsx": "xlsx" };

/**
 * Membaca sederet berkas dengan anggaran bersama: total teks ≤ `maxChars`,
 * total gambar ≤ `maxGambar`. Berkas yang melampaui anggaran dihitung tidak
 * terbaca, bukan dipotong diam-diam.
 */
export async function bacaBerkasAi(
  files: readonly KelasBerkas[],
  opts: { maxChars: number; maxGambar: number },
): Promise<IsiBerkas> {
  const bucket = adminStorage().bucket();
  const out: IsiBerkas = { teks: "", gambar: [], tidakTerbaca: [] };

  for (const f of files) {
    const sisa = opts.maxChars - out.teks.length;
    const ext = ekstensiOf(f.name);
    const gambar = f.mime === "image/jpeg" || f.mime === "image/png";

    if ((gambar && out.gambar.length >= opts.maxGambar) || (!gambar && sisa < 200)) {
      out.tidakTerbaca.push(`${f.name} (melebihi batas yang bisa dibaca sekaligus)`);
      continue;
    }

    try {
      const berkas = bucket.file(f.path);
      const [ada] = await berkas.exists();
      if (!ada) {
        out.tidakTerbaca.push(`${f.name} (sudah tidak ada)`);
        continue;
      }
      const [buf] = await berkas.download();

      if (gambar) {
        if (buf.byteLength > MAX_GAMBAR_BYTES) {
          out.tidakTerbaca.push(`${f.name} (gambar di atas 4 MB)`);
          continue;
        }
        out.gambar.push(`data:${f.mime};base64,${buf.toString("base64")}`);
        continue;
      }

      let teks: string | null = null;
      if (f.mime === "application/pdf") {
        const hasil = await extractPdfText(buf, { maxPages: 30, maxChars: sisa, minChars: 40 });
        teks = hasil.ok ? hasil.text : null;
        if (!teks) {
          out.tidakTerbaca.push(`${f.name} (PDF tanpa teks, kemungkinan hasil pindai)`);
          continue;
        }
      } else if (OFFICE[ext]) {
        teks = extractOfficeText(buf, OFFICE[ext], sisa);
      }

      if (!teks) {
        out.tidakTerbaca.push(f.mime === "application/zip" ? `${f.name} (arsip ZIP tidak dibuka)` : f.name);
        continue;
      }
      out.teks += `${out.teks ? "\n\n" : ""}[Berkas: ${f.name}]\n${teks}`;
    } catch (e) {
      console.error("[classGradingFiles] Gagal membaca", f.path, e);
      out.tidakTerbaca.push(f.name);
    }
  }

  out.teks = out.teks.slice(0, opts.maxChars);
  return out;
}
