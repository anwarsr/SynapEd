import "server-only";

/**
 * Ekstraksi teks PDF sisi server — dipakai tutor dalam course (cuplikan
 * materi, lihat chatLessonContext.ts) dan draf penilaian AI (baca berkas
 * pengumpulan, lihat gradingActions.ts).
 *
 * Sengaja memakai pdfjs-dist (sudah terpasang untuk PdfViewer.tsx di klien),
 * BUKAN paket pdf-parse: pdf-parse punya bug ENOENT yang terdokumentasi luas
 * saat di-deploy di Next.js — modul itu mencoba membaca berkas contoh
 * internalnya sendiri (test/data/...) yang tidak ikut ter-bundle di build
 * production. Build legacy Node pdfjs-dist di sini TIDAK butuh worker (yang
 * dipakai PdfViewer.tsx untuk rendering canvas di browser) — ekstraksi teks
 * berjalan sinkron in-process.
 */

export type PdfExtraction =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: "empty" | "parse-error" };

export interface ExtractOptions {
  /** Batas jumlah halaman yang diproses — menjaga latensi & biaya. */
  maxPages?: number;
  /** Batas panjang teks hasil akhir — menjaga biaya token di hilir. */
  maxChars?: number;
  /** Di bawah ini (setelah whitespace dibuang), dianggap tidak terbaca — kemungkinan besar hasil pindai/gambar. */
  minChars?: number;
}

const DEFAULTS = { maxPages: 30, maxChars: 8000, minChars: 80 };

export async function extractPdfText(buffer: Buffer, opts: ExtractOptions = {}): Promise<PdfExtraction> {
  const { maxPages, maxChars, minChars } = { ...DEFAULTS, ...opts };

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;

    let text = "";
    const pages = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
      if (text.length >= maxChars) break;
    }
    await loadingTask.destroy();

    const trimmed = text.trim();
    if (trimmed.replace(/\s+/g, "").length < minChars) return { ok: false, reason: "empty" };

    return { ok: true, text: trimmed.slice(0, maxChars), truncated: trimmed.length > maxChars };
  } catch (e) {
    console.error("[pdfText] Gagal mengekstrak teks PDF:", e);
    return { ok: false, reason: "parse-error" };
  }
}
