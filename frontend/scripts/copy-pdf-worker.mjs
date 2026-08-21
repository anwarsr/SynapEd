/**
 * Menyalin worker PDF.js ke public/.
 *
 * PDF.js menjalankan pengurainya di Web Worker, dan berkas worker itu harus
 * dilayani sebagai aset statis. Disalin saat dev/build, bukan dikomit:
 * berkas terbangun di dalam repo pasti tertinggal versi begitu pdfjs-dist
 * diperbarui, dan ketidakcocokan versi worker membuat PDF gagal dimuat
 * dengan pesan yang membingungkan.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const from = join(dirname(require.resolve("pdfjs-dist/package.json")), "build/pdf.worker.min.mjs");
const to = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);

console.log("pdf.worker.min.mjs disalin ke public/");
