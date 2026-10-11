"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { getMiniProfile } from "@/lib/miniProfileActions";
import type { MiniProfile as MiniProfileData } from "@/lib/miniProfileTypes";

const SANS = { fontFamily: "var(--font-sans)" } as const;
const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

/**
 * Kartu mini-profil penulis komentar (muncul di atas dialog komentar).
 *
 * Pengguna biasa: foto, banner, dan kursus yang diikuti beserta kemajuannya
 * (tiap kursus menautkan ke halaman detailnya). Educator: itu + kursus yang
 * DIBUAT (tanpa bilah kemajuan). Admin: hanya tulisan FORBIDDEN yang ber-glitch.
 * Data dari server action publik yang dibatasi (lihat miniProfileActions.ts).
 */
export default function MiniProfile({
  uid,
  name,
  avatar,
  banner,
  onClose,
}: {
  uid: string;
  name: string;
  avatar: string | null;
  banner: string | null;
  onClose: () => void;
}) {
  // undefined = memuat, null = tak tersedia, objek = data
  const [data, setData] = useState<MiniProfileData | null | undefined>(undefined);

  useEffect(() => {
    let batal = false;
    getMiniProfile(uid)
      .then((r) => {
        if (!batal) setData(r);
      })
      .catch(() => {
        if (!batal) setData(null);
      });
    return () => {
      batal = true;
    };
  }, [uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const nama = data?.name ?? name;
  const foto = data?.photoURL ?? avatar;
  const sampul = data ? data.bannerURL : banner;
  const admin = data?.role === "admin";

  return (
    <div
      className="mini-latar fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Profil ${nama}`}
        className="mini-kartu relative max-h-[88vh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto bg-paper-card"
      >
        {/* Banner + foto + nama */}
        <div className="keep-white relative flex h-44 w-full flex-col items-center justify-center overflow-hidden bg-banner pb-4">
          {sampul && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sampul} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {sampul && <span aria-hidden="true" className="absolute inset-0 bg-black/45" />}

          <UserAvatar name={nama} photoURL={foto} size="lg" className="relative h-[72px] w-[72px] text-lg ring-2 ring-white/25" />
          <p className="relative mt-3 max-w-[85%] truncate text-lg text-white" style={{ ...SANS, fontWeight: 900, letterSpacing: "-0.025em" }}>
            {nama}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup profil"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-black/50 text-white/80 backdrop-blur-sm transition-colors duration-200 hover:bg-black/70 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-7 pb-7 pt-6">
          {data === undefined && (
            <div aria-busy="true" aria-label="Memuat" className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-2/3 animate-pulse bg-white/10" />
                  <div className="h-[3px] w-full animate-pulse bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {data === null && <p className="text-center text-sm text-ink-muted">Profil ini tidak tersedia.</p>}

          {admin && (
            <div className="py-6 text-center">
              <p
                className="forbidden text-[clamp(2.2rem,9vw,3.4rem)] leading-none"
                data-text="FORBIDDEN"
                style={SANS}
              >
                FORBIDDEN
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted">403 · akses ditolak</p>
            </div>
          )}

          {data && !admin && (
            <>
              <Bagian judul="Kursus yang diikuti" mulai={150}>
                {data.followed.length === 0 ? (
                  <p className="text-sm text-ink-muted">Belum mengikuti kursus.</p>
                ) : (
                  <ul>
                    {data.followed.map((k, i) => (
                      <li key={k.slug} className="mini-masuk border-t border-white/10 first:border-t-0" style={d(220 + i * 70)}>
                        <Link href={`/courses/${k.slug}`} className="group block py-3.5">
                          <span className="flex items-baseline justify-between gap-4">
                            <span className="min-w-0 truncate text-[0.95rem] font-semibold tracking-[-0.015em] text-white transition-colors duration-200 group-hover:text-blue-300" style={SANS}>
                              {k.title}
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-white" style={SANS}>
                              {k.percent}%
                            </span>
                          </span>
                          <span className="mt-2 block h-[3px] w-full bg-white/10" role="presentation">
                            <span
                              className="mini-isi block h-full origin-left bg-blue-500"
                              style={{ width: `${k.percent}%`, ...d(380 + i * 70) }}
                            />
                          </span>
                          <span className="mt-1.5 block text-[12px] text-ink-muted">
                            {k.done} dari {k.total} pelajaran · {k.level}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Bagian>

              {data.role === "educator" && (
                <Bagian judul="Kursus yang dibuat" mulai={300} className="mt-8">
                  {data.created.length === 0 ? (
                    <p className="text-sm text-ink-muted">Belum ada kursus yang tayang.</p>
                  ) : (
                    <ul>
                      {data.created.map((k, i) => (
                        <li key={k.slug} className="mini-masuk border-t border-white/10 first:border-t-0" style={d(380 + i * 70)}>
                          <Link href={`/courses/${k.slug}`} className="group flex items-baseline justify-between gap-4 py-3.5">
                            <span className="min-w-0 truncate text-[0.95rem] font-semibold tracking-[-0.015em] text-white transition-colors duration-200 group-hover:text-blue-300" style={SANS}>
                              {k.title}
                            </span>
                            <span className="shrink-0 text-[12px] text-ink-muted tabular-nums">
                              {k.students.toLocaleString("id-ID")} peserta
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Bagian>
              )}

              {/* Pintu ke profil lengkap: batang selebar kartu; saat di-hover latarnya
                  mengisi biru dan garis penunjuk memanjang. */}
              <Link
                href={`/profil/${uid}`}
                className="mini-masuk group mt-8 flex items-center justify-between bg-white/[0.06] px-5 py-4 text-[11.5px] font-semibold uppercase tracking-[0.26em] text-white transition-colors duration-500 ease-warm hover:bg-blue-600"
                style={d(520)}
              >
                <span>Profil lengkap</span>
                <span aria-hidden="true" className="flex items-center gap-2">
                  <span className="h-px w-7 bg-white/40 transition-all duration-500 ease-warm group-hover:w-12 group-hover:bg-white" />
                  <svg className="h-3.5 w-3.5 transition-transform duration-500 ease-warm group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bagian({
  judul,
  mulai,
  className,
  children,
}: {
  judul: string;
  mulai: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="mini-masuk mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted" style={d(mulai)}>
        {judul}
      </h3>
      {children}
    </section>
  );
}
