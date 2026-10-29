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
    <svg className="relative h-[68px] w-[68px]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${g}-e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3cc94" />
          <stop offset="1" stopColor="#9c7f3e" />
        </linearGradient>
      </defs>
      {/* gagang: garis tipis, tanpa isi */}
      <path d="M21 14h-5.5c0 6.5 2.8 10 7.5 11M43 14h5.5c0 6.5-2.8 10-7.5 11" stroke="#b39556" strokeWidth="1.4" strokeLinecap="round" />
      {/* cangkir ramping */}
      <path d="M20 9h24v12.5c0 8.2-5.2 13.5-12 13.5S20 29.7 20 21.5V9z" fill={`url(#${g}-e)`} />
      <path d="M20 9h24" stroke="#f0e2b8" strokeWidth="1" strokeLinecap="round" />
      <path d="M25.5 13v8.5c0 4 2.2 7 5.2 8.2" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
      {/* tangkai & alas */}
      <path d="M30.8 35h2.4v9h-2.4z" fill="#b39556" />
      <path d="M26 44h12l1.5 3.5h-15L26 44z" fill="#a98b4b" />
      <rect x="22.5" y="47.5" width="19" height="3.5" fill={`url(#${g}-e)`} />
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
    <div className={cn("podium relative min-h-[218px] w-full shrink-0 overflow-hidden bg-paper-card", className)} data-buka={buka}>
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
                        <span className="block text-[9.5px] text-ink-muted">{formatDurasi(b.detik)}</span>
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
        className="podium-pintu absolute inset-0 z-[1] flex flex-col items-center justify-center gap-4 bg-paper-card"
        style={{ transform: buka ? "translateY(-100%)" : "translateY(0)" }}
      >
        <Piala />
        <span className="relative flex flex-col items-center gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-body">Peringkat</span>
        </span>
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
