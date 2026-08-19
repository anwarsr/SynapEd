/**
 * Memeriksa apakah GEMINI_API_KEY sudah benar dan SDK-nya terpasang benar —
 * satu panggilan API minimal, tanpa menguji perilaku streaming, isi prompt,
 * atau pembatas laju (itu non-deterministik / butuh dev server, lebih pas
 * diuji manual lewat browser).
 *
 *   npm run check:chat
 *
 * Gemini punya tingkat gratis, jadi skrip ini praktis tanpa biaya.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiError, GoogleGenAI } from "@google/genai";

const ENV_PATH = resolve(__dirname, "../frontend/.env.local");

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);
const info = (m: string) => console.log(`    ${m}`);

let failures = 0;
function fail(m: string, hint?: string) {
  bad(m);
  if (hint) info(hint);
  failures++;
}

/** Membaca .env.local secara sederhana (KEY=value, tanda kutip dilepas). */
function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  console.log("\nMemeriksa konfigurasi Asisten Chat (Gemini)\n" + "=".repeat(46) + "\n");

  console.log("1. frontend/.env.local");
  if (!existsSync(ENV_PATH)) {
    fail("tidak ditemukan", "Jalankan: cd frontend && copy .env.example .env.local");
    console.log("\nBerhenti — perbaiki dulu yang di atas.\n");
    process.exit(1);
  }
  ok("ditemukan");

  const env = readEnvFile(ENV_PATH);
  const apiKey = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

  console.log("\n2. GEMINI_API_KEY");
  if (!apiKey || apiKey.startsWith("...") || apiKey.length < 10) {
    fail("kosong atau terlihat seperti placeholder", "Ambil kunci di https://aistudio.google.com/apikey lalu isi GEMINI_API_KEY di frontend/.env.local");
    console.log("\nBerhenti — perbaiki dulu yang di atas.\n");
    process.exit(1);
  }
  ok("terisi");

  console.log("\n3. Panggilan uji ke Gemini");
  const client = new GoogleGenAI({ apiKey });
  try {
    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Balas dengan satu kata: OK",
    });
    if (response.text) {
      ok("berhasil dapat balasan dari Gemini");
      info(`balasan: ${response.text.trim()}`);
    } else {
      fail("panggilan berhasil tapi tidak ada teks balasan", "Kemungkinan diblokir oleh filter keamanan — periksa response.promptFeedback");
    }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) {
        fail(`ditolak (HTTP ${e.status})`, "Periksa GEMINI_API_KEY di frontend/.env.local — mungkin salah atau sudah dicabut");
      } else if (e.status === 404) {
        fail(`model tidak ditemukan (HTTP 404)`, 'Model "gemini-3.6-flash" mungkin sudah dipensiunkan — ganti CHAT_MODEL di frontend/src/lib/geminiClient.ts dengan model aktif dari Google AI Studio');
      } else if (e.status === 429) {
        fail("kena batas kuota (HTTP 429)", "Ini masalah sisi Google (tingkat gratis), bukan konfigurasi — coba lagi sebentar lagi");
      } else if (e.status >= 500) {
        fail(`layanan Gemini bermasalah (HTTP ${e.status})`, "Coba lagi sebentar lagi, ini bukan masalah konfigurasi");
      } else {
        fail(`HTTP ${e.status}: ${e.message}`);
      }
    } else {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
