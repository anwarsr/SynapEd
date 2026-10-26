"use client";
import { useId, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDurasi } from "@/lib/classQuizRules";
import type { BarisPapan } from "@/lib/classQuizzes";
import { mulaiKembangApi } from "@/lib/kembangApi";
import { cn } from "@/lib/cn";

/**
 * Piala garis halus berisi gradasi emas: cangkir, dua gagang melengkung, tangkai,
 * dan alas bertingkat, dengan bintang kecil di cangkirnya. Id gradasi dibuat per
 * instance (useId) karena beberapa quiz tampil di satu halaman.
 */
function Piala() {
  const g = useId().replace(/:/g, "");
  return (
    <svg className="relative h-[74px] w-[74px]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8dd85" />
          <stop offset="0.55" stopColor="#e0aa2e" />
          <stop offset="1" stopColor="#a8780f" />
        </linearGradient>
        <linearGradient id={`${g}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8780f" />
          <stop offset="0.5" stopColor="#f2cf6a" />
          <stop offset="1" stopColor="#a8780f" />
        </linearGradient>
      </defs>
      {/* gagang */}
      <path d="M17 13H10c0 9 3 14 10 15M47 13h7c0 9-3 14-10 15" stroke={`url(#${g}-e)`} strokeWidth="2.2" strokeLinecap="round" />
      {/* cangkir */}
      <path d="M16 9h32v14c0 9-7 15-16 15S16 32 16 23V9z" fill={`url(#${g}-e)`} />
      <path d="M16 9h32" stroke="#fbe8a6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M21 12v11c0 5 3 9 7 11" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
      {/* bintang */}
      <path d="M32 14.5l2.3 4.7 5.2.75-3.75 3.65.9 5.15L32 26.3l-4.65 2.45.9-5.15-3.75-3.65 5.2-.75L32 14.5z" fill="#7a5508" fillOpacity="0.55" />
      {/* tangkai & alas */}
      <path d="M29 38h6v8h-6z" fill={`url(#${g}-s)`} />
      <path d="M24 46h16l2 4H22l2-4z" fill={`url(#${g}-e)`} />
      <rect x="19" y="50" width="26" height="5" rx="1" fill={`url(#${g}-s)`} />
    </svg>
  );
}

/**
 * Papan peringkat di sisi kanan kotak quiz: awalnya HANYA kotak bergambar
 * piala. Ditekan → pintunya tergulung KE ATAS seperti pintu garasi (sama
 * dengan sampul kartu kursus) dan menyingkap podium: balok juara 1-3, makin
 * tinggi peringkat makin tinggi baloknya, dengan foto profil di atasnya.
 * Ditekan lagi → pintu turun menutup.
 *
 * Datanya sudah diurut & dipangkas server (`peringkatTeratas`: nilai tertinggi,
 * seri → tercepat, hanya yang dinilai penuh). Warna logam murni grafis; nama,
 * nilai, dan waktu selalu tersedia sebagai teks.
 */
const LOGAM = [
  { blok: "linear-gradient(180deg, #8db8ff, #2f6fed)", label: "Juara 1", tinggi: 100, cincin: "#bbd5ff" },
  { blok: "linear-gradient(180deg, #6aa0ff, #1e4fbf)", label: "Juara 2", tinggi: 82, cincin: "#8db8ff" },
  { blok: "linear-gradient(180deg, #4c8dff, #163a8f)", label: "Juara 3", tinggi: 64, cincin: "#6aa0ff" },
] as const;

/** Urutan tampil: juara 2, 1, 3. */
const SUSUNAN = [1, 0, 2] as const;

export default function QuizPodium({
  baris,
  className,
  rayakan = false,
}: {
  baris: readonly BarisPapan[];
  className?: string;
  /**
   * Pembaca ini juara 1: tiap kali ia MEMBUKA papan, kembang api menyala ±5 dtk.
   * Bila pertunjukan sebelumnya belum selesai, tak ada yang baru (lihat kembangApi).
   */
  rayakan?: boolean;
}) {
  const [buka, setBuka] = useState(false);

  return (
    <div className={cn("podium relative h-[218px] w-full overflow-hidden bg-white/[0.05] lg:w-[236px]", className)} data-buka={buka}>
      {/* Isi di balik pintu: podium (atau pesan kosong). */}
      <div className="absolute inset-0" aria-hidden={!buka}>
        {baris.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-[12.5px] leading-[1.7] text-ink-muted">
            Belum ada yang masuk peringkat. Muncul setelah quiz dikumpulkan dan dinilai penuh.
          </p>
        ) : (
          <ol className="podium-panggung" aria-label="Podium juara">
            {SUSUNAN.map((idx) => {
              const b = baris[idx];
              const l = LOGAM[idx];
              return (
                <li key={idx} className="podium-kolom" style={{ ["--i" as string]: idx }}>
                  <div className="podium-juara">
                    {b && (
                      <>
                        {idx === 0 && (
                          <svg className="podium-mahkota" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
                          </svg>
                        )}
                        <span className="podium-foto" style={{ boxShadow: `0 0 0 2px ${l.cincin}` }}>
                          <UserAvatar name={b.nama} photoURL={b.foto} size="sm" />
                        </span>
                        <span className="mt-1.5 block max-w-[68px] truncate text-[11px] font-semibold text-ink" title={b.nama}>
                          {b.nama}
                        </span>
                        <span className="block text-[9.5px] tabular-nums text-ink-muted">{formatDurasi(b.detik)}</span>
                      </>
                    )}
                  </div>
                  <div className="podium-blok" style={{ height: l.tinggi, background: b ? l.blok : "rgba(255,255,255,0.06)" }}>
                    <span className="podium-angka">{idx + 1}</span>
                    {b && (
                      <span className="podium-nilai">
                        {b.nilai}
                        <small>nilai</small>
                      </span>
                    )}
                    <span className="sr-only">
                      {l.label}
                      {b ? `: ${b.nama}, nilai ${b.nilai}` : ": belum ada"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Pintu bergambar piala: naik penuh ke atas (-100%) = terbuka. */}
      <span
        aria-hidden="true"
        className="podium-pintu absolute inset-0 z-[1] flex flex-col items-center justify-center gap-4 bg-paper-alt"
        style={{ transform: buka ? "translateY(-100%)" : "translateY(0)" }}
      >
        <Piala />
        <span className="relative flex flex-col items-center gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-body">Peringkat</span>
        </span>
        {/* Sekat panel pintu garasi */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgb(0 0 0 / 0.28) calc(25% - 1px), rgb(0 0 0 / 0.28) 25%)",
          }}
        />
      </span>

      {/* Satu-satunya sasaran klik/papan ketik: seluruh kotak. */}
      <button
        type="button"
        onClick={() => {
          if (!buka && rayakan) {
            // Menunggu pintu mulai terangkat supaya kembang api seirama dengan podium.
            window.setTimeout(() => mulaiKembangApi(), 450);
          }
          setBuka((v) => !v);
        }}
        aria-pressed={buka}
        aria-label={buka ? "Tutup papan peringkat" : "Buka papan peringkat"}
        className="absolute inset-0 z-[2] cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      />
    </div>
  );
}
