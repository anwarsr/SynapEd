/**
 * Memeriksa apakah OPENROUTER_API_KEY sudah benar dan modelnya bisa dipanggil —
 * satu permintaan non-streaming minimal, tanpa menguji perilaku streaming,
 * isi prompt, atau pembatas laju (itu non-deterministik / butuh dev server,
 * lebih pas diuji manual lewat browser).
 *
 *   npm run check:chat
 *
 * Memakai fetch() polos dengan parameter yang sama seperti
 * frontend/src/lib/openrouter.ts — jadi yang diuji adalah jalur yang
 * benar-benar dipakai aplikasi, bukan jalur lain.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(__dirname, "../frontend/.env.local");
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Harus sama dengan CHAT_MODELS di frontend/src/lib/openrouter.ts — kalau
// berbeda, skrip ini menguji jalur yang tidak dipakai aplikasi.
const CHAT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];
const MAX_ATTEMPTS = 2;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("\nMemeriksa konfigurasi Asisten Chat (OpenRouter)\n" + "=".repeat(46) + "\n");

  console.log("1. frontend/.env.local");
  if (!existsSync(ENV_PATH)) {
    fail("tidak ditemukan", "Jalankan: cd frontend && copy .env.example .env.local");
    console.log("\nBerhenti — perbaiki dulu yang di atas.\n");
    process.exit(1);
  }
  ok("ditemukan");

  const env = readEnvFile(ENV_PATH);
  const apiKey = env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;

  console.log("\n2. OPENROUTER_API_KEY");
  if (!apiKey || apiKey.startsWith("...") || apiKey.length < 20) {
    fail(
      "kosong atau terlihat seperti placeholder",
      "Ambil kunci di https://openrouter.ai/keys lalu isi OPENROUTER_API_KEY di frontend/.env.local",
    );
    console.log("\nBerhenti — perbaiki dulu yang di atas.\n");
    process.exit(1);
  }
  ok(`terisi (${apiKey.slice(0, 12)}…)`);

  console.log(`\n3. Panggilan uji ke OpenRouter (${CHAT_MODELS.join(" -> ")})`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "SynapEd",
        },
        body: JSON.stringify({
          models: CHAT_MODELS,
          messages: [{ role: "user", content: "Balas dengan satu kata: OK" }],
          max_tokens: 1500,
          temperature: 0.3,
          reasoning: { enabled: false },
        }),
      });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e), "Gagal menghubungi OpenRouter — periksa koneksi internet");
      break;
    }

    if (res.ok) {
      const data = (await res.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
      };
      const text = data.choices?.[0]?.message?.content;

      if (text) {
        ok("berhasil dapat balasan dari OpenRouter");
        info(`dilayani model: ${data.model ?? "?"}`);
        info(`balasan: ${text.trim().slice(0, 80)}`);
        info(
          `token: ${data.usage?.total_tokens ?? "?"} total, ` +
            `${data.usage?.completion_tokens_details?.reasoning_tokens ?? 0} penalaran (harus 0)`,
        );
      } else {
        fail("panggilan berhasil tapi tidak ada teks balasan", "Periksa apakah max_tokens terlalu kecil");
      }
      break;
    }

    // Body dibaca UTUH dulu — memotongnya sebelum JSON.parse membuat
    // parsing selalu gagal, dan 429 antrean salah dikira jatah habis.
    const rawBody = await res.text().catch(() => "");
    const detail = rawBody.slice(0, 300);

    if (res.status === 429) {
      // Dua jenis 429 yang penanganannya berlawanan — lihat komentar di
      // frontend/src/lib/openrouter.ts.
      let transient = false;
      try {
        transient =
          (JSON.parse(rawBody) as { error?: { metadata?: { limit_source?: string } } }).error?.metadata
            ?.limit_source === "upstream_provider_shared_pool";
      } catch {
        // biarkan transient = false
      }

      if (transient && attempt < MAX_ATTEMPTS) {
        info(`antrean provider penuh (percobaan ${attempt}/${MAX_ATTEMPTS}), mencoba lagi…`);
        await sleep(5000);
        continue;
      }

      if (transient) {
        fail(
          "semua model cadangan sedang penuh",
          "Ini antrean bersama semua pengguna OpenRouter, bukan jatah kita — coba lagi beberapa menit lagi.",
        );
      } else {
        fail(
          "jatah harian akun habis (HTTP 429)",
          "Jatah 50 permintaan/hari sudah terpakai. Tunggu besok, atau isi kredit $10 sekali untuk naik ke 1000/hari.",
        );
      }
      break;
    }

    if (res.status === 401) {
      fail("ditolak (HTTP 401)", "Kunci salah atau sudah dicabut — terbitkan ulang di https://openrouter.ai/keys");
    } else if (res.status === 402) {
      fail("kredit habis (HTTP 402)", "Isi kredit di https://openrouter.ai/credits");
    } else if (res.status === 400 || res.status === 404) {
      fail(
        `model ditolak (HTTP ${res.status})`,
        "Salah satu model mungkin sudah dipensiunkan — cek https://openrouter.ai/models lalu perbarui CHAT_MODELS di frontend/src/lib/openrouter.ts DAN di skrip ini.",
      );
    } else {
      fail(`HTTP ${res.status}`, detail || "tanpa detail dari server");
    }
    break;
  }

  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
