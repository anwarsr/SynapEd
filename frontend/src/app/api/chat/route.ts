import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { buildChatSystemPrompt, type LessonPromptContext } from "@/lib/chatPrompt";
import { resolveLessonPromptContext } from "@/lib/chatLessonContext";
import { checkChatRateLimit } from "@/lib/chatRateLimit";
import { OpenRouterError, openRouterStream } from "@/lib/openrouter";

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

interface ChatContextInput {
  courseSlug: string;
  lessonSlug: string;
}

function isValidContext(v: unknown): v is ChatContextInput {
  if (typeof v !== "object" || v === null) return false;
  const { courseSlug, lessonSlug } = v as Record<string, unknown>;
  return (
    typeof courseSlug === "string" &&
    courseSlug.length > 0 &&
    courseSlug.length <= 100 &&
    typeof lessonSlug === "string" &&
    lessonSlug.length > 0 &&
    lessonSlug.length <= 100
  );
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

  // Konteks pelajaran itu sendiri OPSIONAL dan cuma berisi identitas (slug) —
  // isi sesungguhnya diambil & diotorisasi ulang di resolveLessonPromptContext
  // dari sesi asli, BUKAN dipercaya dari body ini. Konteks yang tidak
  // valid/kedaluwarsa/tidak berhak diam-diam jatuh ke null (mode FAQ), tidak
  // pernah jadi 400 — ini cuma pelengkap, bukan payload utama permintaan.
  const contextInput = (body as Record<string, unknown> | null)?.context;
  let lessonContext: LessonPromptContext | null = null;
  if (contextInput && isValidContext(contextInput)) {
    lessonContext = await resolveLessonPromptContext(contextInput.courseSlug, contextInput.lessonSlug).catch(
      () => null,
    );
  }

  // System prompt jadi giliran pertama percakapan — peran "user"/"assistant"
  // dari klien dipakai apa adanya karena OpenRouter memakai nama peran yang
  // sama persis (tidak perlu terjemahan bentuk seperti kasus Gemini).
  const systemPrompt = await buildChatSystemPrompt(lessonContext);
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  let stream: AsyncIterable<string>;
  try {
    stream = await openRouterStream(chatMessages);
  } catch (e) {
    if (e instanceof OpenRouterError) {
      console.error("[api/chat] OpenRouter menolak permintaan:", e.message);

      // Dibedakan dari 429 pembatas laju kita sendiri di atas: yang ini
      // berarti jatah harian akun OpenRouter habis, dan menunggu beberapa
      // menit tidak menolong — penyebabnya beda, jadi pesannya beda.
      if (e.status === 429) {
        return NextResponse.json(
          { message: "Kuota harian asisten sudah habis. Coba lagi besok, ya." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { message: "Asisten sedang tidak bisa dihubungi. Coba lagi nanti." },
        { status: 502 },
      );
    }

    // Satu-satunya galat non-OpenRouterError di sini: OPENROUTER_API_KEY kosong.
    console.error("[api/chat] Asisten belum dikonfigurasi:", e);
    return NextResponse.json({ message: "Asisten belum dikonfigurasi. Coba lagi nanti." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of stream) {
          controller.enqueue(encoder.encode(text));
        }
      } catch (e) {
        // Respons 200 sudah terkirim begitu stream mulai dikonsumsi —
        // galat di sini TIDAK BISA lagi jadi status HTTP. Satu-satunya
        // jalan adalah mencatatnya di server dan menyisipkan kalimat
        // ramah seolah itu balasan asisten, supaya widget tidak butuh
        // penanganan khusus untuk kasus ini.
        console.error("[api/chat] Galat saat streaming dari OpenRouter:", e);
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
