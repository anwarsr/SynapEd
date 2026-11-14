"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { cn } from "@/lib/cn";
import type { StatusTugas } from "@/lib/classAssignmentRules";
import {
  LABEL_SARINGAN,
  LABEL_URUTAN,
  berikutnyaPerlu,
  cocokCari,
  cocokSaringan,
  hitungSaringan,
  perluDinilai,
  urutkan,
  type BarisPengumpulan,
  type Saringan,
  type Urutan,
} from "@/lib/pengumpulanTugas";

/**
 * Tabel pengumpulan tugas untuk pengajar: ringkasan berbatang, saringan,
 * pencarian, urutan, dan baris yang bisa dibuka (jawaban + formulir nilai).
 *
 * Isi tiap baris yang dibuka (`detail`) dirender SERVER dan dioper sebagai
 * node - data jawaban & pengaturan AI tidak pernah dikirim ulang lewat props
 * komponen ini. Penyaringan murni di peramban terhadap baris yang sudah dimuat.
 */

interface KonteksNilai {
  /** Nama siswa berikutnya yang perlu dinilai setelah `uid`, atau null bila tak ada lagi. */
  namaBerikutnya: (uid: string) => string | null;
  /** Menutup baris `uid`, membuka & menggulir ke siswa berikutnya yang perlu dinilai. */
  bukaBerikutnya: (uid: string) => void;
}

const Konteks = createContext<KonteksNilai | null>(null);

/** Dipakai `ClassGradeForm`. Null di luar tabel ini (tombol "Nilai berikutnya" tidak tampil). */
export function useNilaiBerikutnya(): KonteksNilai | null {
  return useContext(Konteks);
}

const TAMPIL_STATUS: Record<StatusTugas, { label: string; titik: string }> = {
  dikumpulkan: { label: "Perlu dinilai", titik: "bg-amber-500" },
  terlambat: { label: "Perlu dinilai", titik: "bg-amber-500" },
  dinilai: { label: "Dinilai", titik: "bg-blue-500" },
  belum: { label: "Belum mengumpulkan", titik: "bg-white/25" },
  terlewat: { label: "Tidak mengumpulkan", titik: "bg-rust-700" },
};

const TITIK_SARINGAN: Record<Saringan, string | null> = {
  semua: null,
  perlu: "bg-amber-500",
  dinilai: "bg-blue-500",
  terlambat: "bg-rust-700",
  belum: "bg-white/25",
};

const KOLOM = "grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_4.5rem_1rem] sm:grid-cols-[2rem_minmax(0,1fr)_8.5rem_9.5rem_4.5rem_1rem]";

export default function DaftarPengumpulan({
  baris,
  detail,
  maxPoints,
}: {
  baris: BarisPengumpulan[];
  detail: Record<string, ReactNode>;
  maxPoints: number;
}) {
  const [saringan, setSaringan] = useState<Saringan>("semua");
  const [cari, setCari] = useState("");
  const [urutan, setUrutan] = useState<Urutan>("status");
  // Yang perlu dinilai pertama terbuka sejak awal: itu pekerjaan berikutnya.
  const [terbuka, setTerbuka] = useState<Set<string>>(() => {
    const pertama = urutkan(baris, "status").find((b) => perluDinilai(b.status));
    return new Set(pertama ? [pertama.uid] : []);
  });
  const [gulirKe, setGulirKe] = useState<string | null>(null);

  const jumlah = useMemo(() => hitungSaringan(baris), [baris]);
  const semuaUrut = useMemo(() => urutkan(baris, urutan), [baris, urutan]);
  const tampil = useMemo(
    () => semuaUrut.filter((b) => cocokSaringan(b, saringan) && cocokCari(b, cari)),
    [semuaUrut, saringan, cari],
  );

  // Gulir SETELAH baris tujuan dirender (bisa saja baru muncul karena saringan direset).
  useEffect(() => {
    if (!gulirKe) return;
    const el = document.getElementById(`siswa-${gulirKe}`);
    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "start", behavior: hemat ? "auto" : "smooth" });
    el?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [gulirKe]);

  const konteks = useMemo<KonteksNilai>(
    () => ({
      namaBerikutnya: (uid) => (berikutnyaPerlu(tampil, uid) ?? berikutnyaPerlu(semuaUrut, uid))?.nama ?? null,
      bukaBerikutnya: (uid) => {
        let lanjut = berikutnyaPerlu(tampil, uid);
        if (!lanjut) {
          // Yang berikutnya tersembunyi saringan/pencarian: tampilkan semua lagi.
          lanjut = berikutnyaPerlu(semuaUrut, uid);
          if (lanjut) {
            setSaringan("semua");
            setCari("");
          }
        }
        if (!lanjut) return;
        setTerbuka(new Set([lanjut.uid]));
        setGulirKe(lanjut.uid);
      },
    }),
    [tampil, semuaUrut],
  );

  function alih(uid: string) {
    setGulirKe(null);
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(uid)) baru.delete(uid);
      else baru.add(uid);
      return baru;
    });
  }

  const total = baris.length;
  const persen = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <Konteks.Provider value={konteks}>
      <section aria-labelledby="judul-pengumpulan" className="bg-paper-card">
        {/* Kepala: judul, batang komposisi, saringan sekaligus legenda */}
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="judul-pengumpulan" className="t-h3">
              Pengumpulan siswa
            </h2>
            <p className="text-sm tabular-nums text-ink-muted">
              <span className="font-semibold text-ink">{total - jumlah.belum}</span> dari {total} mengumpulkan
            </p>
          </div>

          <div
            className="mt-4 flex h-2 w-full overflow-hidden bg-white/[0.08]"
            role="img"
            aria-label={`${jumlah.dinilai} dinilai, ${jumlah.perlu} perlu dinilai, ${jumlah.belum} belum mengumpulkan`}
          >
            <span className="h-full bg-blue-500 transition-[width] duration-500" style={{ width: `${persen(jumlah.dinilai)}%` }} />
            <span className="h-full bg-amber-500 transition-[width] duration-500" style={{ width: `${persen(jumlah.perlu)}%` }} />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Saring daftar">
            {(Object.keys(LABEL_SARINGAN) as Saringan[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSaringan(s)}
                aria-pressed={saringan === s}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  saringan === s
                    ? "bg-white/[0.12] text-ink shadow-[inset_0_-2px_0_var(--color-blue-500)]"
                    : "bg-white/[0.04] text-ink-muted hover:bg-white/[0.08] hover:text-ink",
                )}
              >
                {TITIK_SARINGAN[s] && <span aria-hidden="true" className={cn("h-2 w-2", TITIK_SARINGAN[s])} />}
                {LABEL_SARINGAN[s]}
                <span className="tabular-nums text-ink-faint">{jumlah[s]}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Cari nama siswa</span>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama siswa…"
                className="w-full bg-white/[0.06] py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Urutkan
              <select
                value={urutan}
                onChange={(e) => setUrutan(e.target.value as Urutan)}
                className="bg-white/[0.06] px-3 py-2 text-sm text-ink focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
              >
                {(Object.keys(LABEL_URUTAN) as Urutan[]).map((u) => (
                  <option key={u} value={u}>
                    {LABEL_URUTAN[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Kepala kolom */}
        <div
          aria-hidden="true"
          className={cn(KOLOM, "bg-white/[0.04] px-5 py-2.5 sm:px-6", "t-label text-[10.5px] text-ink-faint")}
        >
          <span className="max-sm:hidden">No</span>
          <span>Siswa</span>
          <span className="max-sm:hidden">Dikirim</span>
          <span className="max-sm:hidden">Status</span>
          <span className="text-right">Nilai</span>
          <span />
        </div>

        {tampil.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-muted">
            {total === 0 ? "Belum ada anggota di kelas ini." : "Tidak ada siswa yang cocok dengan saringan ini."}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {tampil.map((b, i) => {
              const st = TAMPIL_STATUS[b.status];
              const bisaBuka = Boolean(detail[b.uid]);
              const buka = bisaBuka && terbuka.has(b.uid);
              const isiBaris = (
                <>
                  <span className="text-xs tabular-nums text-ink-faint max-sm:hidden">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={b.nama} photoURL={b.foto} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {b.nama}
                        {b.keluar && <span className="ml-2 text-xs font-normal text-ink-muted">(sudah keluar)</span>}
                      </span>
                      {/* Ponsel: status & waktu kirim pindah ke bawah nama */}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted sm:hidden">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0", st.titik)} />
                          {st.label}
                        </span>
                        {b.dikirimTeks && <span className="whitespace-nowrap">· {b.dikirimTeks}</span>}
                        {b.terlambat && <span className="whitespace-nowrap text-error-text">· terlambat</span>}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-ink-body max-sm:hidden" title={b.dikirimLengkap ?? undefined}>
                    {b.dikirimTeks ?? <span className="text-ink-faint">-</span>}
                    {b.terlambat && <span className="mt-0.5 block font-medium text-error-text">Terlambat</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-body max-sm:hidden">
                    <span aria-hidden="true" className={cn("h-2 w-2 shrink-0", st.titik)} />
                    {st.label}
                  </span>
                  <span className="text-right tabular-nums">
                    {b.nilai !== null ? (
                      <>
                        <span className="text-[15px] font-semibold text-ink">{b.nilai}</span>
                        <span className="text-xs text-ink-faint">/{maxPoints}</span>
                      </>
                    ) : (
                      <span className="text-sm text-ink-faint">-</span>
                    )}
                  </span>
                  <span aria-hidden="true" className="flex justify-end">
                    {bisaBuka && (
                      <svg
                        className={cn("h-4 w-4 text-ink-muted transition-transform duration-200", buka && "rotate-180")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                  </span>
                </>
              );

              return (
                <li
                  key={b.uid}
                  id={`siswa-${b.uid}`}
                  className={cn("scroll-mt-4", buka && "bg-white/[0.035] shadow-[inset_3px_0_0_var(--color-blue-500)]")}
                >
                  {bisaBuka ? (
                    <button
                      type="button"
                      onClick={() => alih(b.uid)}
                      aria-expanded={buka}
                      aria-controls={`jawaban-${b.uid}`}
                      className={cn(
                        KOLOM,
                        "w-full px-5 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04] sm:px-6",
                        // Tanpa garis fokus bawaan (terbaca sebagai kotak berborder); papan ketik tetap diberi tanda.
                        "focus:outline-none focus-visible:bg-white/[0.06] focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue-500)]",
                      )}
                    >
                      {isiBaris}
                    </button>
                  ) : (
                    <div className={cn(KOLOM, "px-5 py-3 opacity-75 sm:px-6")}>{isiBaris}</div>
                  )}
                  {/* Tetap terpasang saat ditutup (hanya disembunyikan): nilai & komentar yang
                      sudah diketik tidak hilang bila barisnya ditutup lalu dibuka lagi. */}
                  {bisaBuka && (
                    <div id={`jawaban-${b.uid}`} hidden={!buka} className="px-5 pb-5 sm:pl-[4.25rem] sm:pr-6">
                      {detail[b.uid]}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Konteks.Provider>
  );
}
