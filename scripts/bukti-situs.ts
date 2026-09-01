/**
 * Menangkap halaman legal dari situs produksi untuk lampiran Midtrans.
 *
 *   npx tsx scripts/bukti-situs.ts [baseUrl]
 */
import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));

const BASE = process.argv[2] ?? "https://synapedu.com";
const DIR = "bukti-situs";

const HALAMAN = [
  { path: "/syarat-ketentuan", nama: "syarat-ketentuan", judul: "Syarat & Ketentuan" },
  { path: "/kebijakan-privasi", nama: "kebijakan-privasi", judul: "Kebijakan Privasi" },
  { path: "/pengembalian-dana", nama: "pengembalian-dana", judul: "Kebijakan Pengembalian Dana" },
  { path: "/kontak", nama: "kontak", judul: "Kontak" },
];

async function main() {
  if (!CHROME) throw new Error("Chrome tidak ditemukan.");
  mkdirSync(DIR, { recursive: true });

  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    for (const h of HALAMAN) {
      const p = await b.newPage();
      await p.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });

      const res = await p.goto(`${BASE}${h.path}`, { waitUntil: "networkidle0", timeout: 120000 });
      const status = res?.status() ?? 0;

      // Animasi masuk perlu waktu; tanpa jeda ini isinya tertangkap transparan.
      await new Promise((r) => setTimeout(r, 2000));

      const berkas = `${DIR}/${h.nama}.png`;
      await p.screenshot({ path: berkas, fullPage: true });

      const tinggi = await p.evaluate(() => document.body.scrollHeight);
      console.log(`HTTP ${status}  ${h.path.padEnd(22)} ${String(tinggi).padStart(5)}px  -> ${berkas}`);
      await p.close();
    }
  } finally {
    await b.close();
  }
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
