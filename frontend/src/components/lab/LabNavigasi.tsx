"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ItemNavigasi {
  id: string;
  nama: string;
  ket: string;
}

export interface BagianNavigasi {
  nomor: string;
  nama: string;
  item: readonly ItemNavigasi[];
}

/**
 * Navigasi materi SynapLab: tombol hamburger + laci setinggi layar di kiri.
 *
 * SENGAJA tidak tahu apa pun tentang lab yang sedang dibuka — ia hanya
 * menerima daftar bagian & item (teks) dan memanggil `onPilih(id)`. Setiap
 * materi boleh punya halaman yang sama sekali berbeda; laci ini dirender
 * SEKALI di tingkat halaman, di luar ruang kerja materi mana pun, sehingga
 * tidak ikut berubah, tersembunyi, atau terpasang ulang saat materi berganti.
 *
 * Laci MENIMPA halaman (fixed + latar gelap), tidak menggeser isinya: papan
 * yang sedang dipakai mengajar tidak boleh melompat hanya karena menu dibuka.
 *
 * Tombolnya: di layar lebar berupa kolom sempit tepat di kiri judul halaman
 * (bagian dari tata letak `LabShell`, bukan melayang, supaya sejajar dengan
 * isi dan tidak menutupi apa pun); di layar sempit mengambang di TENGAH bawah —
 * tepi kiri ponsel tidak punya ruang kosong, pojok kanan bawah dipakai tombol
 * asisten chat, dan pojok kiri bawah tertutup lencana Next.js saat dev.
 */
export default function LabNavigasi({
  bagian,
  aktif,
  onPilih,
}: {
  bagian: readonly BagianNavigasi[];
  aktif: string;
  onPilih: (id: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const laciRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buka) return;
    // Fokus ke item yang aktif saat laci terbuka (hanya DOM, tanpa setState).
    laciRef.current?.querySelector<HTMLElement>("[aria-current='page']")?.focus();
    // Halaman di belakang laci tidak ikut tergulir.
    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Fase capture: Esc menutup laci saja, tidak ikut menutup mode presentasi.
        e.stopPropagation();
        setBuka(false);
        tombolRef.current?.focus();
        return;
      }
      // Fokus dikurung di dalam laci selama terbuka (aria-modal).
      if (e.key === "Tab" && laciRef.current) {
        const bisa = [...laciRef.current.querySelectorAll<HTMLElement>("button")];
        const awal = bisa[0];
        const akhir = bisa[bisa.length - 1];
        if (e.shiftKey && document.activeElement === awal) {
          e.preventDefault();
          akhir.focus();
        } else if (!e.shiftKey && document.activeElement === akhir) {
          e.preventDefault();
          awal.focus();
        }
      }
    };
    document.addEventListener("keydown", tombol, true);
    return () => {
      document.body.style.overflow = overflowLama;
      document.removeEventListener("keydown", tombol, true);
    };
  }, [buka]);

  const tutup = () => {
    setBuka(false);
    tombolRef.current?.focus();
  };

  const ikonMenu = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );

  return (
    <>
      {/* ── Tombol: kolom sempit di kiri judul (lg) / pil mengambang tengah bawah (sempit) ── */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 lg:pointer-events-auto lg:static lg:z-auto lg:shrink-0 lg:translate-x-0 lg:pt-0.5">
        <button
          ref={tombolRef}
          type="button"
          aria-label="Buka daftar materi"
          title="Daftar materi"
          aria-haspopup="dialog"
          aria-expanded={buka}
          onClick={() => setBuka(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border border-rule bg-paper-card px-4 py-2.5 text-sm font-semibold text-ink shadow-lift",
            "transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700",
            "lg:h-10 lg:w-10 lg:justify-center lg:rounded-xl lg:px-0 lg:py-0 lg:shadow-soft",
          )}
        >
          {ikonMenu}
          <span className="lg:hidden">Materi</span>
        </button>
      </div>

      {/* ── Latar gelap + laci ──────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={tutup}
        className={cn(
          "fixed inset-0 z-[60] bg-ink/35 transition-opacity duration-300 ease-out-soft",
          buka ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={laciRef}
        role="dialog"
        aria-modal="true"
        aria-label="Daftar materi SynapLab"
        // `inert` saat tertutup: laci tetap terpasang (supaya bisa meluncur
        // masuk), tapi tidak bisa difokus atau dibaca pembaca layar.
        inert={!buka}
        className={cn(
          "fixed inset-y-0 left-0 z-[61] flex w-[min(340px,88vw)] flex-col border-r border-rule bg-paper shadow-lift",
          "transition-transform duration-300 ease-out-soft motion-reduce:transition-none",
          buka ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <p className="t-h3 text-xl">
            Synap<span className="text-blue-600">Lab</span>
          </p>
          <button
            type="button"
            aria-label="Tutup daftar materi"
            onClick={tutup}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-paper-alt hover:text-ink"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav aria-label="Materi" className="lab-pane flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            <span aria-hidden="true" className="h-px w-5 bg-rule-strong" />
            Daftar materi
          </p>
          {bagian.map((b) => (
            <section key={b.nomor} className="mb-6">
              <h2 className="mb-2 flex items-baseline gap-2.5">
                <span className="t-numeral text-sm tabular-nums text-ink-faint">{b.nomor}</span>
                <span className="text-base font-medium text-ink">{b.nama}</span>
              </h2>
              <ul className="space-y-0.5">
                {b.item.map((it) => {
                  const dipilih = it.id === aktif;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        aria-current={dipilih ? "page" : undefined}
                        onClick={() => {
                          onPilih(it.id);
                          tutup();
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                          dipilih ? "bg-blue-50 text-blue-700" : "text-ink-body hover:bg-paper-alt hover:text-ink",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dipilih ? "bg-blue-600" : "border border-rule-strong")}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{it.nama}</span>
                          <span className={cn("block text-xs leading-relaxed", dipilih ? "text-blue-700/80" : "text-ink-muted")}>{it.ket}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </>
  );
}
