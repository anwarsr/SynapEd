"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { extractChatOptions, renderChatText } from "@/lib/chatMarkdown";
import { useChatLessonContext } from "./ChatContext";
import ChatRobot, { type RobotPos } from "./ChatRobot";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING = "Halo! Aku Asisten SynapEd. Ada yang bisa kubantu soal kursus, pendaftaran, atau akunmu?";

const SUGGESTIONS = [
  "Bagaimana cara mendaftar kursus?",
  "Apakah kursus berbayar sudah bisa dibeli?",
  "Bagaimana cara mendapat sertifikat?",
];

/**
 * Widget chat mengambang — dipasang sekali di layout.tsx supaya muncul di
 * setiap halaman. Panel-nya SENGAJA bukan <dialog>/showModal() seperti
 * ConfirmDialog: chat harus non-modal, halaman di baliknya tetap bisa
 * di-scroll sementara panel terbuka.
 *
 * Tidak ada riwayat tersimpan di server — percakapan hidup di state React
 * saja dan hilang saat halaman dimuat ulang. Ini batasan MVP yang
 * disengaja, bukan bug.
 */
export default function ChatWidget() {
  const pathname = usePathname();
  const { lessonContext } = useChatLessonContext();
  const [open, setOpen] = useState(false);
  // Posisi robot (null sampai ia dimuat); panel chat menempel di dekatnya.
  const [anchor, setAnchor] = useState<RobotPos | null>(null);
  const onPos = useCallback((p: RobotPos) => setAnchor(p), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, context: lessonContext ?? undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError((data as { message?: string } | null)?.message ?? "Asisten sedang tidak bisa dihubungi.");
        setMessages(nextMessages); // buang placeholder balasan kosong
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Koneksi terputus. Coba kirim ulang pertanyaanmu.");
      }
    } finally {
      setIsStreaming(false);
    }
  }

  // Hook harus tetap dipanggil sebelum kemungkinan early return di bawah.
  if (pathname === "/login" || pathname === "/register") return null;

  const isTyping = isStreaming && messages.at(-1)?.content === "";

  // Panel dibuka di sisi robot yang lapang: sejajar tepi robot (kiri/kanan) dan
  // di atas atau di bawahnya menurut separuh layar tempat robot berada.
  let panelStyle: React.CSSProperties | undefined;
  if (anchor) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const W = Math.min(400, vw - 32);
    const H = Math.min(560, vh * 0.7);
    const kanan = anchor.x + 32 > vw / 2;
    const bawah = anchor.y + 32 > vh / 2;
    const left = Math.min(vw - W - 16, Math.max(16, kanan ? anchor.x + 64 - W : anchor.x));
    const top = Math.min(vh - H - 16, Math.max(16, bawah ? anchor.y - H - 12 : anchor.y + 64 + 12));
    panelStyle = { left, top };
  }

  const SANS = { fontFamily: "var(--font-sans)" } as const;

  return (
    <>
      <ChatRobot open={open} onToggle={() => setOpen((o) => !o)} onPos={onPos} />

      {/* Panel persegi tanpa garis tepi: kesan datang dari tipografi, jarak, dan satu
          garis aksen biru di sisi balasan - bukan dari kotak bertumpuk. */}
      <div
        role="dialog"
        aria-label="Asisten SynapEd"
        style={panelStyle}
        className={cn(
          "fixed z-[60] flex h-[min(560px,70vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden bg-paper-card shadow-lift transition-[opacity,transform] duration-300 ease-warm",
          !anchor && "bottom-24 right-6",
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-[0.97] opacity-0",
        )}
      >
        <div className="flex items-start justify-between px-6 pb-4 pt-5">
          <div>
            <p className="text-[1.1rem] font-bold leading-tight tracking-[-0.025em] text-white" style={SANS}>
              Asisten SynapEd
            </p>
            <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-muted">
              Siap membantu
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-ink-faint transition-[color,transform] duration-300 ease-warm hover:rotate-90 hover:text-white"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <span aria-hidden="true" className="mx-6 h-px shrink-0 bg-white/10" />

        {lessonContext && (
          <p className="mx-6 mt-4 bg-blue-50 px-4 py-2.5 text-xs leading-[1.6] text-blue-300">
            Mode materi kursus aktif - tanya apa saja soal pelajaran yang sedang dibuka.
          </p>
        )}

        <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {messages.length === 0 && (
            <div className="chat-masuk space-y-5">
              <p className="text-[15px] leading-[1.7] text-white/90" style={SANS}>
                {GREETING}
              </p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="group flex items-center justify-between gap-4 bg-white/[0.05] px-4 py-3 text-left text-[13px] text-ink-body transition-colors duration-300 hover:bg-white/10 hover:text-white"
                  >
                    {s}
                    <span aria-hidden="true" className="text-white/30 transition-[transform,color] duration-300 ease-warm group-hover:translate-x-1 group-hover:text-blue-300">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            // Baris [[options: ...]] hanya berguna sekali balasan selesai —
            // saat masih streaming ia tampil apa adanya (belum terpotong).
            const { text, options } =
              m.role === "assistant" && !(isLast && isStreaming) ? extractChatOptions(m.content) : { text: m.content, options: [] };

            return (
              <div key={i} className={cn("chat-masuk flex flex-col gap-2.5", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "whitespace-pre-wrap text-sm leading-[1.7]",
                    m.role === "user"
                      ? "max-w-[85%] bg-blue-600 px-4 py-2.5 text-white"
                      : "max-w-[94%] pl-4 text-ink-body shadow-[inset_2px_0_0_var(--color-blue-500)]",
                  )}
                >
                  {m.role === "assistant" ? (
                    text ? (
                      renderChatText(text)
                    ) : isTyping && isLast ? (
                      <span className="chat-titik" role="status" aria-label="Mengetik">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      ""
                    )
                  ) : (
                    m.content
                  )}
                </div>
                {options.length > 0 && (
                  <div className="flex max-w-[94%] flex-wrap gap-1.5 pl-4">
                    {options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => sendMessage(o)}
                        disabled={isStreaming}
                        className="bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-600 disabled:opacity-50"
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div role="alert" className="bg-rust-100 px-4 py-3 text-xs leading-[1.6] text-rust-700">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-stretch gap-2 px-6 pb-5 pt-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan sesuatu…"
            disabled={isStreaming}
            className="min-w-0 flex-1 bg-white/[0.06] px-4 py-3 text-sm text-white shadow-[inset_0_-1px_0_var(--color-rule)] outline-none transition-[background-color,box-shadow] duration-300 placeholder:text-white/35 focus:bg-white/[0.09] focus:shadow-[inset_0_-2px_0_var(--color-blue-400)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Kirim"
            className="flex w-12 shrink-0 items-center justify-center bg-blue-600 text-[#fff] transition-colors duration-200 ease-out-soft hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
