import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { buildChatSystemPrompt } from "@/lib/chatPrompt";
import { checkChatRateLimit } from "@/lib/chatRateLimit";
import { CHAT_MODEL, getGeminiClient } from "@/lib/geminiClient";

/**
 * Batas ukuran percakapan yang dikirim klien. Server di sini TANPA STATUS
 * (riwayat percakapan dikirim ulang utuh oleh klien tiap giliran, tidak
 * disimpan sama sekali) — artinya tidak ada rekaman percakapan yang sah
 * untuk diperiksa server. Tanpa batas ini, siapa pun bisa mengirim array
 * `messages` yang dikarang sendiri sebesar apa pun di setiap permintaan.
 * Pembatas laju (checkChatRateLimit) membatasi permintaan/menit, BUKAN
 * token/permintaan — dua pembatas ini saling melengkapi, bukan tumpang tindih.
 */
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOTAL_LENGTH = 20000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function isValidMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;

  let total = 0;
  for (const m of value) {
    if (typeof m !== "object" || m === null) return false;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return false;
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_MESSAGE_LENGTH) return false;
    total += content.length;
  }
  if (total > MAX_TOTAL_LENGTH) return false;

  // Giliran terakhir harus dari pengguna — kalau tidak, tidak ada yang
  // sedang ditanyakan ke asisten.
  return value[value.length - 1].role === "user";
}

/**
 * Riwayat dirangkai jadi satu string transkrip biasa, bukan array
 * `Content[]` bergiliran-per-peran milik Gemini — sengaja. Server ini
 * tanpa status (klien mengirim ulang riwayat utuh tiap giliran, tidak ada
 * yang disimpan), dan `contents` menerima string biasa dengan aman
 * (bagian dari `ContentListUnion`), jadi tidak perlu menyusun ulang objek
 * giliran yang lebih rumit untuk kasus pemakaian yang sesederhana ini.
 */
function buildTranscriptInput(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Pengguna" : "Asisten"}: ${m.content}`)
    .join("\n\n");
}

const FRIENDLY_STREAM_ERROR =
  "\n\nMaaf, terjadi gangguan saat menyusun jawaban. Coba kirim ulang pertanyaanmu.";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Isi permintaan tidak valid." }, { status: 400 });
  }

  const messages = (body as Record<string, unknown> | null)?.messages;
  if (!isValidMessages(messages)) {
    return NextResponse.json(
      { message: "Format pesan tidak valid, atau percakapan sudah terlalu panjang — mulai percakapan baru." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateLimitKey = user ? `uid:${user.uid}` : `ip:${ip}`;

  const limit = checkChatRateLimit(rateLimitKey);
  if (!limit.ok) {
    return NextResponse.json(
      { message: "Terlalu banyak pesan dalam waktu singkat. Coba lagi dalam beberapa menit." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  let client;
  try {
    client = getGeminiClient();
  } catch (e) {
    console.error("[api/chat] Gemini belum dikonfigurasi:", e);
    return NextResponse.json({ message: "Asisten belum dikonfigurasi. Coba lagi nanti." }, { status: 500 });
  }

  const systemPrompt = await buildChatSystemPrompt();

  let geminiStream;
  try {
    geminiStream = await client.models.generateContentStream({
      model: CHAT_MODEL,
      contents: buildTranscriptInput(messages),
      config: { systemInstruction: systemPrompt },
    });
  } catch (e) {
    console.error("[api/chat] Gagal memulai stream Gemini:", e);
    return NextResponse.json({ message: "Asisten sedang tidak bisa dihubungi. Coba lagi nanti." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of geminiStream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } catch (e) {
        // Respons 200 sudah terkirim begitu stream mulai dikonsumsi —
        // galat di sini TIDAK BISA lagi jadi status HTTP. Satu-satunya
        // jalan adalah mencatatnya di server dan menyisipkan kalimat
        // ramah seolah itu balasan asisten, supaya widget tidak butuh
        // penanganan khusus untuk kasus ini.
        console.error("[api/chat] Galat saat streaming dari Gemini:", e);
        controller.enqueue(encoder.encode(FRIENDLY_STREAM_ERROR));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseBody, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
