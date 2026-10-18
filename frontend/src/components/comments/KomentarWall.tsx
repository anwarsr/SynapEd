"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import Stars from "@/components/ui/Stars";
import AvatarMini from "@/components/profile/AvatarMini";
import { cn } from "@/lib/cn";

export interface KomentarItem {
  id: string;
  uid: string;
  name: string;
  avatar: string | null;
  content: string;
  rating: number;
  courseTitle: string;
  courseSlug: string;
  /** Sudah diformat di server. */
  tanggal: string;
  reply: { body: string; by: string } | null;
}

const SANS = { fontFamily: "var(--font-sans)" } as const;
const PANJANG = 220;

/**
 * Satu kartu komentar. SATU WARNA (paper-card) untuk semua kartu; kesan hidup
 * datang dari interaksi:
 *  - kartu MIRING mengikuti kursor (3D ringan) dan terangkat;
 *  - cahaya sorot lembut mengikuti kursor di permukaannya;
 *  - garis biru di tepi kiri tumbuh saat di-hover;
 *  - komentar panjang dipotong dengan pudar di bawah, dibuka halus lewat
 *    "Baca selengkapnya";
 *  - foto penulis dapat dipencet (mini-profil).
 * Posisi kursor ditulis langsung ke variabel CSS (tanpa render React).
 */
function Kartu({ k }: { k: KomentarItem }) {
  const ref = useRef<HTMLElement>(null);
  const [buka, setBuka] = useState(false);
  const panjang = k.content.length > PANJANG;

  function gerak(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.setProperty("--rx", `${((0.5 - y / r.height) * 5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x / r.width - 0.5) * 7).toFixed(2)}deg`);
  }

  function lepas() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <article ref={ref} onPointerMove={gerak} onPointerLeave={lepas} className="komen-kartu group relative overflow-hidden bg-paper-card p-7">
      <span aria-hidden="true" className="komen-sorot pointer-events-none absolute inset-0" />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-blue-500 transition-transform duration-500 ease-warm group-hover:scale-y-100"
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <AvatarMini uid={k.uid} name={k.name} photoURL={k.avatar} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-[-0.01em] text-white" style={SANS}>
              {k.name}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-ink-faint">{k.tanggal}</p>
          </div>
        </div>
        <Stars value={k.rating} size="sm" />
      </div>

      <div
        className={cn(
          "relative mt-6 overflow-hidden transition-[max-height] duration-700 ease-warm",
          panjang && !buka ? "max-h-[10.5rem] [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]" : "max-h-[60rem]",
        )}
      >
        <p className="whitespace-pre-line break-words text-[0.97rem] leading-[1.75] text-ink-body" style={SANS}>
          {k.content}
        </p>
      </div>

      {panjang && (
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          aria-expanded={buka}
          className="relative mt-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-blue-300 underline-offset-[6px] transition-colors hover:text-white hover:underline"
        >
          {buka ? "Ringkas" : "Baca selengkapnya"}
        </button>
      )}

      {k.reply && (
        <div className="relative mt-5 bg-white/[0.04] px-4 py-3 shadow-[inset_3px_0_0_var(--color-blue-500)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-blue-300">Balasan</p>
          <p className="mt-1.5 whitespace-pre-line break-words text-[13px] leading-[1.6] text-ink-muted">{k.reply.body}</p>
        </div>
      )}

      <Link
        href={`/courses/${k.courseSlug}`}
        className="relative mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted transition-colors duration-300 hover:text-white"
      >
        <span aria-hidden="true" className="h-px w-6 bg-white/30 transition-all duration-500 ease-warm group-hover:w-10 group-hover:bg-blue-400" />
        <span className="truncate">{k.courseTitle}</span>
      </Link>
    </article>
  );
}

/**
 * Dinding komentar: kolom bata (masonry) berisi SEMUA ulasan + saringan bintang.
 * Kartu masuk berurutan (Reveal).
 */
export default function KomentarWall({ items }: { items: KomentarItem[] }) {
  const [bintang, setBintang] = useState<number>(0);

  const hitung = useMemo(() => {
    const h: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const i of items) h[i.rating] = (h[i.rating] ?? 0) + 1;
    return h;
  }, [items]);

  const tampil = useMemo(() => (bintang === 0 ? items : items.filter((i) => i.rating === bintang)), [items, bintang]);

  return (
    <>
      <div className="mb-10 flex flex-wrap items-center justify-center gap-1" role="group" aria-label="Saring menurut bintang">
        {[0, 5, 4, 3, 2, 1].map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBintang(b)}
            aria-pressed={bintang === b}
            disabled={b !== 0 && !hitung[b]}
            className={cn(
              "px-5 py-3 text-[13px] font-semibold transition-colors duration-300 disabled:opacity-30",
              bintang === b ? "bg-blue-600 text-[#fff]" : "bg-white/10 text-white/75 hover:bg-white/15 hover:text-white",
            )}
          >
            {b === 0 ? `Semua (${items.length})` : `${b} ★ (${hitung[b] ?? 0})`}
          </button>
        ))}
      </div>

      {tampil.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-muted">Belum ada komentar dengan bintang itu.</p>
      ) : (
        <div key={bintang} className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {tampil.map((k, i) => (
            <Reveal key={k.id} delay={(i % 3) * 90} className="mb-4 break-inside-avoid">
              <Kartu k={k} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}
