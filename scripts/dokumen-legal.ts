/**
 * Menyusun halaman legal situs jadi satu dokumen untuk lampiran Midtrans.
 *
 * Teksnya diambil dari situs PRODUKSI, bukan ditulis ulang — supaya dokumen
 * yang dikirim ke Midtrans tidak pernah berbeda dari yang dilihat pengunjung.
 *
 *   npx tsx scripts/dokumen-legal.ts [baseUrl]
 */
import { existsSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));

const BASE = process.argv[2] ?? "https://synapedu.com";
const KELUARAN = "dokumen-legal-synaped.html";

const HALAMAN = [
  { path: "/syarat-ketentuan", judul: "Syarat & Ketentuan" },
  { path: "/kebijakan-privasi", judul: "Kebijakan Privasi" },
  { path: "/pengembalian-dana", judul: "Kebijakan Pengembalian Dana" },
  { path: "/kontak", judul: "Kontak" },
];

const GAYA = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; line-height: 1.6; margin: 0; font-size: 10.5pt; }
  .sampul { border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 4px; }
  .sampul h1 { font-size: 19pt; margin: 0 0 4px; letter-spacing: -0.4px; }
  .sampul p { color: #555; margin: 0 0 3px; font-size: 10pt; }
  section { break-before: page; page-break-before: always; }
  section:first-of-type { break-before: auto; page-break-before: auto; }
  .bab { font-size: 14pt; color: #1d4ed8; margin: 0 0 3px; }
  .sumber { font-size: 9pt; color: #555; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid #1d4ed8; word-break: break-all; }
  h1, h2, h3, h4 { font-size: 11.5pt; margin: 14px 0 5px; color: #1a1a1a; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  li { margin-bottom: 4px; }
  a { color: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #d4d4d4; padding: 6px 8px; text-align: left; font-size: 9.5pt; }
`;

/** Tag yang dipertahankan; selebihnya dibuang beserta atributnya. */
const AMAN = ["H1","H2","H3","H4","H5","P","UL","OL","LI","STRONG","B","EM","I","BR","TABLE","THEAD","TBODY","TR","TH","TD","A"];

async function main() {
  if (!CHROME) throw new Error("Chrome tidak ditemukan.");

  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const bagian: string[] = [];

  try {
    for (const h of HALAMAN) {
      const p = await b.newPage();
      await p.setViewport({ width: 1280, height: 1200 });
      const res = await p.goto(`${BASE}${h.path}`, { waitUntil: "networkidle0", timeout: 120000 });

      if (res?.status() !== 200) throw new Error(`${h.path} -> HTTP ${res?.status()}`);
      await new Promise((r) => setTimeout(r, 1500));

      const isi = await p.evaluate((aman: string[]) => {
        const akar = document.querySelector("main") ?? document.body;
        const salinan = akar.cloneNode(true) as HTMLElement;

        salinan.querySelectorAll("script,style,svg,nav,footer,header,button,form,noscript").forEach((n) => n.remove());

        // Atribut dibuang semua kecuali href, supaya gaya situs tidak ikut
        // terbawa dan bentrok dengan gaya cetak dokumen ini.
        salinan.querySelectorAll("*").forEach((n) => {
          const el = n as HTMLElement;
          for (const a of Array.from(el.attributes)) {
            if (!(el.tagName === "A" && a.name === "href")) el.removeAttribute(a.name);
          }
          if (!aman.includes(el.tagName)) {
            el.replaceWith(...Array.from(el.childNodes));
          }
        });

        // Nomor judul di situs adalah elemen tersendiri, jadi setelah tag-nya
        // dibuang teksnya menempel jadi "1.Ketentuan". Spasinya dikembalikan.
        return salinan.innerHTML
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\s+/g, " ")
          .replace(/(>\s*\d+\.)([A-Z])/g, "$1 $2")
          .replace(/>\s+</g, ">\n<");
      }, AMAN);

      const kata = isi.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      console.log(`HTTP 200  ${h.path.padEnd(22)} ${String(kata).padStart(5)} kata`);
      if (kata < 40) throw new Error(`${h.path} nyaris kosong (${kata} kata) — jangan dikirim ke Midtrans.`);

      bagian.push(
        `<section>\n<h2 class="bab">${h.judul}</h2>\n` +
        `<p class="sumber">Sumber: ${BASE}${h.path}</p>\n${isi}\n</section>`,
      );
      await p.close();
    }
  } finally {
    await b.close();
  }

  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  writeFileSync(
    KELUARAN,
    `<!doctype html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n` +
    `<title>Dokumen Kebijakan SynapEd</title>\n<style>${GAYA}</style>\n</head>\n<body>\n` +
    `<div class="sampul">\n<h1>Dokumen Kebijakan &mdash; SynapEd</h1>\n` +
    `<p>Platform kursus daring (Learning Management System)</p>\n` +
    `<p>Situs: ${BASE} &nbsp;&middot;&nbsp; Email: support@synapedu.com</p>\n` +
    `<p>Isi dokumen ini disalin dari halaman yang tayang di situs pada ${tanggal}.</p>\n</div>\n\n` +
    bagian.join("\n\n") + `\n\n</body>\n</html>\n`,
    "utf-8",
  );

  console.log("tersimpan:", KELUARAN);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
