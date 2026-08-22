"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

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
  const [open, setOpen] = useState(false);
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
        body: JSON.stringify({ messages: nextMessages }),
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Tutup Asisten SynapEd" : "Buka Asisten SynapEd"}
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lift transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.05 0-2.06-.16-3-.455L3 21l1.5-4.5C3.55 15.207 3 13.657 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          )}
        </svg>
      </button>

      <div
        role="dialog"
        aria-label="Asisten SynapEd"
        className={cn(
          "fixed bottom-24 right-6 z-[60] flex h-[min(560px,70vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-rule bg-paper-card shadow-lift transition-all duration-200 ease-out-soft",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <p className="t-h3 text-base">Asisten SynapEd</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            className="text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="t-body text-sm text-ink-body">{GREETING}</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink-body transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-blue-600 text-white" : "border border-rule bg-paper text-ink-body",
                )}
              >
                {m.content || (isTyping && i === messages.length - 1 ? "Mengetik…" : "")}
              </div>
            </div>
          ))}

          {error && (
            <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-3 py-2 text-xs text-rust-700">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2 border-t border-rule px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan sesuatu…"
            disabled={isStreaming}
            className="flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-blue-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700 disabled:opacity-50"
          >
            Kirim
          </button>
        </form>
      </div>
    </>
  );
}
