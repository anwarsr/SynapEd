import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Singleton klien Gemini — dibuat sekali, dipakai ulang antar permintaan.
 *
 * Melempar galat polos kalau GEMINI_API_KEY kosong, dan sengaja dipanggil
 * di route handler SEBELUM stream dibuka — supaya salah konfigurasi jadi
 * HTTP 500 yang jelas, bukan teks yang muncul di tengah respons streaming.
 */
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diisi di frontend/.env.local");
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * "gemini-3.6-flash" — model cepat & murah (ada di tingkat gratis Gemini),
 * cocok untuk menjawab FAQ yang sudah digroundkan lewat system prompt.
 * Kalau model ini pernah dipensiunkan Google, `npm run check:chat` akan
 * gagal dengan galat "model not found" — ganti string ini saat itu terjadi.
 */
export const CHAT_MODEL = "gemini-3.6-flash";
