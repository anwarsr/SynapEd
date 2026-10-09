"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/* =============================================================
   DATA
============================================================= */

type Point = {
  num: string;
  title: string;
  desc: string;
  /** Kata yang disorot dengan sapuan garis saat panel terbuka. */
  mark?: string[];
  /** Warna dasar panel — berbeda tipis antar panel supaya batasnya terbaca tanpa garis. */
  bg: string;
};

const points: Point[] = [
  {
    num: "01",
    title: "Terstruktur",
    desc: "Belajar dari dasar hingga mahir melalui alur yang jelas dan bertahap.",
    bg: "var(--color-deep)",
  },
  {
    num: "02",
    title: "Interaktif",
    desc: "Belajar melalui aktivitas dan kuis yang membuat materi lebih mudah dipahami.",
    bg: "var(--color-paper)",
  },
  {
    num: "03",
    title: "Berbasis Riset",
    desc: "Materi dikembangkan berdasarkan literatur dan sumber ilmiah yang relevan.",
    mark: ["literatur", "ilmiah"],
    bg: "var(--color-paper-card)",
  },
];

/** Bobot lebar: panel terbuka mengambil 3,4 bagian, yang lain 1 bagian. */
const GROW_OPEN = 3.4;
const GROW_CLOSED = 1;

/* =============================================================
   ABOUT
============================================================= */

export default function About() {
  const [active, setActive] = useState(0);

  return (
    <section id="about" className="relative flex min-h-screen flex-col overflow-hidden bg-ivory">
      {/* =====================================================
          PANEL - memenuhi SELURUH section sampai tepi layar, tanpa jarak,
          garis, maupun sudut membulat. Yang dipencet melebar, dua lainnya
          menyempit; lebar dianimasikan lewat flex-grow. Di ponsel susunannya
          vertikal dan yang dianimasikan adalah tinggi.
      ====================================================== */}

      <div className="flex min-h-[640px] flex-1 flex-col lg:min-h-[720px] lg:flex-row">
        {points.map((point, i) => {
          const isActive = active === i;

          return (
            <article
              key={point.num}
              data-open={isActive}
              className={cn(
                "about-panel group relative min-h-[84px] min-w-0 overflow-hidden",
                "transition-[flex-grow] duration-[900ms] ease-warm motion-reduce:transition-none",
              )}
              style={{ flexGrow: isActive ? GROW_OPEN : GROW_CLOSED, flexBasis: 0, backgroundColor: point.bg }}
            >
              {/* Sorotan tipis saat panel yang menyempit di-hover */}
              {!isActive && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-500 group-hover:bg-white/[0.04]"
                />
              )}

              {/* ── Keadaan menyempit: hanya judul (tegak di desktop) ── */}
              <div
                aria-hidden={isActive}
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center px-6 lg:justify-center lg:px-0",
                  "transition-opacity duration-300 ease-out-soft",
                  isActive ? "opacity-0" : "opacity-100 delay-500",
                )}
              >
                <span
                  className="text-xl font-extrabold tracking-tight text-white lg:rotate-180 lg:text-[2rem] lg:[writing-mode:vertical-rl]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {point.title}
                </span>
              </div>

              {/* ── Keadaan melebar: judul huruf-demi-huruf, penjelasan kata-demi-kata, peraga teks ── */}
              <div
                aria-hidden={!isActive}
                className={cn(
                  "absolute inset-0 flex flex-col justify-end gap-8 p-7 sm:p-10 lg:p-14",
                  "transition-opacity duration-500 ease-warm",
                  isActive ? "opacity-100 delay-[300ms]" : "pointer-events-none opacity-0",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-6 top-24 select-none font-black leading-none tracking-[-0.08em] text-white/5 sm:right-10"
                  style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(8rem, 18vw, 17rem)" }}
                >
                  {point.num}
                </span>

                <div className="relative max-w-2xl">
                  <h3
                    className="mb-5 text-[clamp(2.4rem,5.4vw,4.75rem)] font-extrabold leading-[0.95] tracking-[-0.045em] text-white"
                    style={{ fontFamily: "var(--font-sans)" }}
                    aria-label={point.title}
                  >
                    <Letters text={point.title} />
                  </h3>

                  <p className="max-w-xl text-base leading-[1.75] text-white/80 sm:text-lg">
                    <Words text={point.desc} mark={point.mark} start={520} />
                  </p>
                </div>

                <div className="relative max-w-xl">
                  {i === 0 && <LearningPath open={isActive} />}
                  {i === 1 && <Ticker />}
                  {i === 2 && <Sources open={isActive} />}
                </div>
              </div>

              {/* Penutup klik/keyboard untuk panel yang menyempit */}
              {!isActive && (
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-expanded={false}
                  aria-label={`Buka ${point.title}`}
                  className="absolute inset-0 z-30 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-500"
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* =============================================================
   ANIMASI TEKS
   Semua animasi hanya berjalan di bawah `.about-panel[data-open="true"]`
   (lihat globals.css), jadi memutar ulang setiap panel dibuka. Jeda
   `--d` ditambah 300 ms agar mulai sesudah isi panel selesai memudar masuk.
============================================================= */

/** Judul: tiap huruf naik dari balik topeng, bergiliran. */
function Letters({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((ch, i) =>
        ch === " " ? (
          <span key={i}> </span>
        ) : (
          <span key={i} className="about-mask" aria-hidden="true">
            <span className="about-up" style={{ "--d": `${i * 45}ms` } as React.CSSProperties}>
              {ch}
            </span>
          </span>
        ),
      )}
    </>
  );
}

/** Penjelasan: tiap kata naik dari balik topeng; kata kunci mendapat sapuan garis bawah. */
function Words({ text, mark = [], start = 0 }: { text: string; mark?: string[]; start?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => {
        const bersih = word.toLowerCase().replace(/[^a-z]/g, "");
        const disorot = mark.includes(bersih);
        const d = start + i * 55;

        return (
          <span key={i}>
            <span className="about-mask">
              <span
                className={cn("about-up", disorot && "about-sweep font-semibold text-white")}
                style={{ "--d": `${d}ms` } as React.CSSProperties}
              >
                {word}
              </span>
            </span>{" "}
          </span>
        );
      })}
    </>
  );
}

/** Memutar indeks 0..n-1 tiap `ms` selama panel terbuka dan belum disentuh pengguna. */
function useAutoCycle(open: boolean, n: number, ms: number) {
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!open || manual) return;
    const t = setInterval(() => setIndex((v) => (v + 1) % n), ms);
    return () => clearInterval(t);
  }, [open, manual, n, ms]);

  const pilih = (i: number) => {
    setManual(true);
    setIndex(i);
  };

  return [index, pilih] as const;
}

/** 01 — alur belajar, versi minimalis: tiga kata di atas satu garis tipis; garis
 *  biru pendek meluncur ke kata aktif, keterangannya naik-memudar di bawah.
 *  Berputar sendiri; arahkan kursor atau tekan kata untuk mengambil alih. */
function LearningPath({ open }: { open: boolean }) {
  const stages = [
    { label: "Dasar", note: "Kenali konsep inti lewat contoh yang sederhana." },
    { label: "Menengah", note: "Terapkan langsung lewat latihan dan kuis." },
    { label: "Mahir", note: "Selesaikan tugas nyata dan raih sertifikat." },
  ];
  const [stage, pilih] = useAutoCycle(open, stages.length, 2600);

  return (
    <div className="about-pop max-w-md" style={{ "--d": "900ms" } as React.CSSProperties}>
      <div className="relative grid grid-cols-3">
        {stages.map((st, i) => (
          <button
            key={st.label}
            type="button"
            onClick={() => pilih(i)}
            onPointerEnter={() => pilih(i)}
            onFocus={() => pilih(i)}
            aria-pressed={stage === i}
            className={cn(
              "pb-3 text-left text-sm font-semibold tracking-wide transition-colors duration-300 focus-visible:outline-none",
              stage === i ? "text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            {st.label}
          </button>
        ))}

        {/* Garis dasar + penanda aktif (sepertiga lebar, meluncur) */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-px w-1/3 bg-blue-400 transition-transform duration-500 ease-warm motion-reduce:transition-none"
          style={{ transform: `translateX(${stage * 100}%)` }}
        />
      </div>

      {/* Keterangan — key = tahap, jadi naik ulang tiap berganti */}
      <p key={stage} className="about-note mt-4 min-h-12 text-sm leading-relaxed text-white/70">
        {stages[stage].note}
      </p>
    </div>
  );
}

/** 02 — papan kata berputar: kegiatan belajar bergantian naik ke tengah. */
function Ticker() {
  const items = ["Jawab kuis", "Coba langsung", "Diskusi kelas", "Dapat umpan balik"];
  const loop = [...items, items[0]];

  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Sambil</span>
      <div className="h-[1.5em] overflow-hidden text-2xl font-bold tracking-tight text-white sm:text-3xl" aria-hidden="true">
        <ul className="about-ticker">
          {loop.map((item, i) => (
            <li key={i} className="h-[1.5em] whitespace-nowrap leading-[1.5]">
              {item}
              <span className="text-blue-400">.</span>
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">{items.join(", ")}</span>
    </div>
  );
}

/** 03 — daftar sumber: tiga poin (1 Jurnal, 2 Buku ajar, 3 Penelitian).
 *  Penjelasan HANYA muncul saat poinnya ditekan, dan keluar dari ujung teks
 *  poin itu sendiri (melebar ke kanan sambil bergeser keluar & memudar masuk).
 *  Tekan lagi untuk menutup; menekan poin lain memindahkan penjelasan.
 *  Judul & penjelasan Plus Jakarta Sans; nomor font mono. */
function Sources({ open }: { open: boolean }) {
  const rows = [
    { k: "Jurnal", note: "artikel ilmiah yang ditelaah sejawat" },
    { k: "Buku ajar", note: "rujukan baku para akademisi" },
    { k: "Penelitian", note: "temuan mutakhir dari bidangnya" },
  ];
  const [sel, setSel] = useState<number | null>(null);

  return (
    <ul className="about-pop max-w-xl font-sans" style={{ "--d": "900ms" } as React.CSSProperties}>
      {rows.map((r, i) => {
        const on = open && sel === i;

        return (
          <li key={r.k}>
            <button
              type="button"
              onClick={() => setSel(on ? null : i)}
              aria-expanded={on}
              className="group/row flex min-h-12 w-full cursor-pointer items-center text-left focus-visible:outline-none"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className={cn("font-mono text-sm tabular-nums transition-colors duration-300", on ? "text-blue-300" : "text-white/35")}>
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xl font-semibold transition-colors duration-300",
                    on ? "text-white" : "text-white/60 group-hover/row:text-white",
                  )}
                >
                  {r.k}
                </span>

                {/* Penjelasan: keluar dari ujung teks poin */}
                <span
                  aria-hidden={!on}
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-sm text-blue-200 transition-[max-width,opacity,transform] duration-700 ease-warm motion-reduce:transition-none",
                    on ? "max-w-80 translate-x-0 opacity-100" : "max-w-0 -translate-x-3 opacity-0",
                  )}
                >
                  {r.note}
                </span>
              </span>

              {/* Petunjuk bisa ditekan: plus yang berputar jadi silang saat terbuka */}
              <span
                aria-hidden="true"
                className={cn(
                  "ml-4 text-lg leading-none text-white/35 transition-transform duration-500 ease-warm group-hover/row:text-white/70",
                  on && "rotate-45",
                )}
              >
                +
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
