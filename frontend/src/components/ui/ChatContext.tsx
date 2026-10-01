"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Jembatan konteks pelajaran dari halaman belajar (Server Component) ke
 * ChatWidget yang dipasang sekali secara global di layout.tsx. Sengaja HANYA
 * identitas (slug), bukan konten — server yang mengambil & mengotorisasi isi
 * sesungguhnya lewat resolveLessonPromptContext() saat /api/chat menerimanya,
 * bukan mempercayai apa pun yang klien kirim langsung.
 *
 * Context React pertama di proyek ini (sebelumnya tidak ada satu pun store
 * global) — dipilih karena ChatWidget dipasang sekali di root layout
 * (Server Component) sementara halaman belajar juga Server Component;
 * keduanya tidak berbagi leluhur client selain lewat provider ini.
 */
export interface ChatLessonContext {
  courseSlug: string;
  lessonSlug: string;
}

interface ChatContextValue {
  lessonContext: ChatLessonContext | null;
  setLessonContext: (ctx: ChatLessonContext | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [lessonContext, setLessonContext] = useState<ChatLessonContext | null>(null);
  return <ChatContext.Provider value={{ lessonContext, setLessonContext }}>{children}</ChatContext.Provider>;
}

export function useChatLessonContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatLessonContext dipakai di luar ChatContextProvider");
  return ctx;
}
