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

  // Tiga garis: saat tombol di-hover, garis teratas & terbawah menjauh sedikit dari garis tengah
  // (tanpa perubahan warna). Garis ditulis sebagai kotak 1.5px, bukan SVG, agar mudah bergeser.
  const ikonMenu = (
    <span aria-hidden="true" className="flex h-5 w-5 flex-col items-center justify-center gap-[5px]">
      <span className="block h-[1.5px] w-5 bg-current transition-transform duration-500 ease-warm group-hover:-translate-y-[3px]" />
      <span className="block h-[1.5px] w-5 bg-current" />
      <span className="block h-[1.5px] w-5 bg-current transition-transform duration-500 ease-warm group-hover:translate-y-[3px]" />
    </span>
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
            "group pointer-events-auto flex items-center gap-3 bg-paper-card px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
            "lg:h-11 lg:w-11 lg:justify-center lg:px-0 lg:py-0",
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
          // Seluruh laman di belakang laci diburamkan, bukan sekadar digelapkan.
          "fixed inset-0 z-[60] bg-black/30 backdrop-blur-md transition-opacity duration-500 ease-out-soft",
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
          "fixed inset-y-0 left-0 z-[61] flex w-[min(360px,88vw)] flex-col bg-header",
          "transition-transform duration-500 ease-warm motion-reduce:transition-none",
          buka ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-7 pb-4 pt-7">
          <p className="sr-only">SynapLab</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/SynapLab.png" alt="" width={157} height={30} className="logo-on-dark h-7 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/SynapLab Black.png" alt="" width={157} height={30} className="logo-on-light h-7 w-auto" />
          <button
            type="button"
            aria-label="Tutup daftar materi"
            onClick={tutup}
            className="flex h-10 w-10 items-center justify-center bg-white/[0.06] text-ink-body transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav aria-label="Materi" className="lab-pane flex-1 overflow-y-auto px-7 pb-8 pt-6">
          <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted">Daftar materi</p>
          {bagian.map((b) => (
            <section key={b.nomor} className="mb-9">
              <h2 className="mb-3 flex items-end gap-3">
                <span className="text-[2.4rem] font-black leading-[0.8] tracking-[-0.06em] tabular-nums text-white/15" style={{ fontFamily: "var(--font-sans)" }}>
                  {b.nomor}
                </span>
                <span className="pb-0.5 text-[1.05rem] font-bold tracking-[-0.01em] text-white" style={{ fontFamily: "var(--font-sans)" }}>
                  {b.nama}
                </span>
              </h2>
              <ul className="space-y-1">
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
                          "block w-full px-5 py-3.5 text-left transition-colors duration-300",
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
                          dipilih
                            ? "bg-white/[0.07] shadow-[inset_3px_0_0_var(--color-blue-500)]"
                            : "hover:bg-white/[0.04]",
                        )}
                      >
                        <span className={cn("block text-[15px] font-semibold", dipilih ? "text-white" : "text-ink-body")}>{it.nama}</span>
                        <span className="mt-1 block text-xs leading-[1.65] text-ink-muted">{it.ket}</span>
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
