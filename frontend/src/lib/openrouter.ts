import "server-only";

/**
 * Klien OpenRouter — `fetch()` polos, tanpa SDK.
 *
 * Kenapa bukan `@openrouter/sdk` yang resmi: percobaan sebelumnya dengan
 * `@google/genai` gagal justru pada metode yang direkomendasikan
 * dokumentasinya sendiri (melempar TypeError saat dipanggil sungguhan,
 * padahal typecheck lulus). Format /chat/completions + SSE di sini adalah
 * standar de-facto yang sudah bertahun-tahun stabil dan dipakai banyak
 * penyedia — bagian API yang paling kecil kemungkinan berubah. Memakainya
 * langsung berarti nol dependensi baru dan nol risiko SDK.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Rantai model, bukan satu model — dan ini bukan kemewahan.
 *
 * Model `:free` dilayani dari kolam bersama SELURUH pengguna OpenRouter,
 * jadi HTTP 429 "upstream_provider_shared_pool" sering muncul walau jatah
 * harian kita masih utuh. Dengan parameter `models`, OpenRouter otomatis
 * berpindah ke model berikutnya saat yang pertama penuh.
 *
 * Utama: nemotron-3-ultra-550b — model reasoning 550B terbesar di tingkat
 * gratis OpenRouter, kualitas jawaban terbaik tapi lambat (~6-11 detik ke
 * jawaban, teruji langsung). Cadangan: dua model yang lebih kecil & lebih
 * cepat (~2-7 detik), dipertahankan supaya asisten tetap responsif kalau
 * model utama sedang penuh/lambat.
 *
 * Ketiganya sudah DIVERIFIKASI: menerima `reasoning: {enabled:false}` dan
 * menjawab Bahasa Indonesia dengan wajar. Jangan menambah model ke sini
 * tanpa mengeceknya — `openai/gpt-oss-20b:free`, misalnya, menolak
 * permintaan dengan "Reasoning is mandatory" dan mematahkan seluruh rantai.
 *
 * Batas keras OpenRouter: maksimal 3 entri.
 */
export const CHAT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

/** Model utama — dipakai di pesan galat & dokumentasi. */
export const CHAT_MODEL = CHAT_MODELS[0];

/**
 * Model vision gratis — dipakai gradingActions.ts saat berkas pengumpulan
 * tugas berupa gambar (JPEG/PNG/dst), bukan PDF.
 *
 * DIVERIFIKASI LANGSUNG (16 September 2026), bukan cuma dari dokumentasi
 * OpenRouter: dikirimi JPEG nyata lewat rantai ini, hasilnya deskripsi
 * rinci & akurat dalam Bahasa Indonesia. Ketiganya juga butuh
 * `reasoning:{enabled:false}` — tanpa itu, model menghabiskan seluruh
 * `max_tokens` untuk "berpikir" dan `content` balasannya kosong
 * (`finish_reason: "length"`), persis masalah GLM 5.2 di CHAT_MODELS.
 *
 * gemma-4-26b-a4b-it dipakai lagi di sini (sudah ada di CHAT_MODELS) karena
 * ia juga menerima input gambar — dua lainnya murni cadangan vision.
 */
export const VISION_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nex-agi/nex-n2.5-mini:free",
  "inclusionai/ling-3.0-flash-vl:free",
] as const;

/** Tanpa penalaran, 1500 sudah longgar untuk jawaban FAQ terpanjang. */
const MAX_TOKENS = 1500;

/**
 * WAJIB diturunkan dari default OpenRouter (1.0) — ini bukan penyetelan
 * gaya, tapi perbaikan bug.
 *
 * Uji nyata pada google/gemma-4-26b-a4b-it:free: pada temperature 1 model
 * meluruh jadi sampah ("<pad><pad><pad>..." berulang, atau kalimat
 * Indonesia yang berubah jadi teks Hindi berulang di tengah jawaban); pada
 * 0.3 jawabannya rapi dan benar. Untuk FAQ yang jawabannya sudah ditentukan
 * system prompt, variasi acak memang tidak diinginkan sama sekali.
 */
const TEMPERATURE = 0.3;

/**
 * GLM 5.2 (rantai sebelumnya) memakai 113 dari 116 token cuma untuk
 * bernalar demi menjawab "OK" — untuk FAQ yang jawabannya sudah
 * digroundkan ke system prompt, penalaran tidak menambah kualitas, hanya
 * memperlambat dan menghabiskan jatah token. Dimatikan di seluruh rantai.
 */
const REASONING = { enabled: false } as const;

/**
 * Model `:free` dilayani dari kolam bersama SELURUH pengguna OpenRouter,
 * jadi HTTP 429 "upstream_provider_shared_pool" sering muncul walau jatah
 * harian kita masih utuh — sifatnya sesaat dan hilang dalam hitungan
 * detik. Tanpa percobaan ulang, asisten akan terasa sering "rusak" padahal
 * sebenarnya cuma antre. Rantai model di atas sudah menyelamatkan mayoritas
 * kasus; ini jaring pengaman kalau SEMUA model di rantai sedang penuh.
 */
const MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 8000;

/** Bagian pesan bergambar — format OpenAI-compatible yang dipakai OpenRouter. */
export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  /** String untuk pesan teks biasa; array untuk pesan bergambar (lihat VISION_MODELS). */
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterStreamOptions {
  /** Bawaan: CHAT_MODELS. Diisi VISION_MODELS untuk pesan bergambar. */
  models?: readonly string[];
  /** Bawaan: MAX_TOKENS (1500). */
  maxTokens?: number;
}

/**
 * Apakah kunci API tersedia di server ini.
 *
 * Di produksi kunci hidup di Secret Manager; di dev lokal hanya ada kalau
 * diisi di frontend/.env.local. Tanpa pemeriksaan ini, kunci yang kosong
 * terbaca sebagai "AI tidak bisa dihubungi" — pesan yang membuat orang
 * menyalahkan jaringan atau OpenRouter, padahal penyebabnya konfigurasi.
 */
export function openRouterTerkonfigurasi(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Pesan seragam untuk kunci yang belum diisi. */
export const PESAN_AI_BELUM_DIKONFIGURASI =
  "AI belum dikonfigurasi di server ini (kunci OpenRouter belum diisi). Hubungi admin, atau nilai secara manual.";

/** Membawa status HTTP supaya pemanggil bisa membedakan 429 kuota dari galat lain. */
export class OpenRouterError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`OpenRouter membalas HTTP ${status}: ${detail}`);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

interface RateLimitInfo {
  /** true = antrean provider bersama (sesaat), false = jatah akun kita habis. */
  transient: boolean;
  retryAfterMs: number;
}

/**
 * Membedakan dua jenis 429 yang penanganannya berlawanan: antrean provider
 * layak dicoba ulang, jatah harian akun tidak (menunggu 5 detik percuma).
 */
function readRateLimit(rawBody: string): RateLimitInfo {
  try {
    const parsed = JSON.parse(rawBody) as {
      error?: { metadata?: { limit_source?: string; retry_after_seconds?: number } };
    };
    const meta = parsed.error?.metadata;
    const seconds = meta?.retry_after_seconds;

    return {
      transient: meta?.limit_source === "upstream_provider_shared_pool",
      retryAfterMs: Math.min(
        typeof seconds === "number" && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_DELAY_MS,
        MAX_RETRY_DELAY_MS,
      ),
    };
  } catch {
    return { transient: false, retryAfterMs: DEFAULT_RETRY_DELAY_MS };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Membongkar aliran SSE OpenRouter menjadi potongan teks biasa.
 *
 * Buffer dipertahankan lintas chunk karena satu paket TCP bisa terpotong di
 * tengah baris — tanpa ini, JSON yang belum utuh akan gagal di-parse dan
 * potongan jawabannya hilang diam-diam.
 */
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      for (;;) {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd === -1) break;

        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        // Baris berawalan ":" adalah komentar/keep-alive milik protokol SSE.
        if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;

        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) yield text;
        } catch {
          // Satu chunk cacat tidak boleh mematikan seluruh jawaban.
        }
      }
    }
  } finally {
    // Menutup koneksi ke hulu, penting saat pengguna menutup widget di
    // tengah jawaban — tanpa ini koneksinya menggantung sampai timeout.
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Memulai satu percakapan streaming.
 *
 * Sengaja fungsi async biasa yang MENGEMBALIKAN generator, bukan
 * `async function*` langsung: generator tidak menjalankan apa pun sampai
 * iterasi pertama, sehingga galat pra-stream (kunci salah, kuota habis)
 * baru terlempar setelah `Response` 200 terlanjur dikirim ke browser.
 * Dengan bentuk ini `fetch()` dan pemeriksaan `res.ok` terjadi saat
 * di-`await` — pemanggil masih sempat membalas status HTTP yang benar.
 */
export async function openRouterStream(
  messages: OpenRouterMessage[],
  opts: OpenRouterStreamOptions = {},
): Promise<AsyncIterable<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY belum diisi di frontend/.env.local");
  }

  const models = opts.models ?? CHAT_MODELS;
  const maxTokens = opts.maxTokens ?? MAX_TOKENS;

  let lastError: OpenRouterError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Atribusi opsional di papan peringkat OpenRouter — tidak memengaruhi
        // hasil, tapi memudahkan mengenali trafik ini di dasbor mereka.
        "X-Title": "SynapEd",
      },
      body: JSON.stringify({
        // `models` (jamak), bukan `model` — inilah yang mengaktifkan
        // perpindahan otomatis saat model pertama sedang penuh.
        models,
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature: TEMPERATURE,
        reasoning: REASONING,
      }),
    });

    if (res.ok && res.body) return parseSSE(res.body);

    const detail = await res.text().catch(() => "");
    lastError = new OpenRouterError(res.status, detail.slice(0, 500));

    if (res.status !== 429) throw lastError;

    const { transient, retryAfterMs } = readRateLimit(detail);
    // Jatah harian akun habis: menunggu tidak menolong, lempar sekarang.
    if (!transient || attempt === MAX_ATTEMPTS) throw lastError;

    console.warn(
      `[openrouter] antrean provider penuh (percobaan ${attempt}/${MAX_ATTEMPTS}), ulangi dalam ${retryAfterMs}ms`,
    );
    await sleep(retryAfterMs);
  }

  throw lastError ?? new Error("OpenRouter tidak dapat dihubungi.");
}
