"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type LetterPosition = {
  x: number;
  y: number;
};

/** Jeda antar huruf saat muncul "pop" (ms). */
const LETTER_STAGGER_MS = 45;
/** Judul mulai muncul sedikit setelah halaman terbuka. */
const LETTER_START_MS = 150;

/** Teks yang "diketik" di bilah saat tombol berubah bentuk lewat scroll. */
const PROMPT_TEXT = "Saya ingin belajar analisis data dari nol";

/** Ukuran tombol awal & bilah akhir (px). */
const BTN_W = 200;
const BTN_H = 52;
const BAR_H = 76;
const BAR_MAX_W = 520;

export default function Hero() {
  // =========================================================
  // SCROLL → TOMBOL BERUBAH JADI BILAH
  // Progres scroll (0..1) ditulis ke variabel CSS --p langsung di DOM, bukan
  // state, supaya tidak merender ulang tiap frame. Hanya jumlah huruf yang
  // sudah "terketik" yang jadi state (berubah paling banyak sekali per huruf).
  // =========================================================
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  const [bar, setBar] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      el.style.setProperty("--p", p.toFixed(4));

      // Posisi awal tombol = pusat slot di dalam isi (relatif terhadap bagian
      // sticky, yang menempel di tepi atas layar); tujuan = tengah layar.
      const slot = slotRef.current;
      if (slot) {
        const r = slot.getBoundingClientRect();
        const top = stickyRef.current?.getBoundingClientRect().top ?? 0;
        el.style.setProperty("--y0", `${(r.top - top + r.height / 2).toFixed(1)}px`);
      }
      el.style.setProperty("--y1", `${window.innerHeight / 2}px`);
      el.style.setProperty("--w1", `${Math.min(window.innerWidth * 0.88, BAR_MAX_W)}px`);

      // Mengetik baru dimulai saat bilah sudah hampir selesai melebar.
      const t = Math.min(1, Math.max(0, (p - 0.4) / 0.4));
      setTyped(Math.round(t * PROMPT_TEXT.length));
      setBar(p > 0.3);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // =========================================================
  // LETTER DRAG POSITION
  // =========================================================
  const [letterPositions, setLetterPositions] = useState<
    Record<number, LetterPosition>
  >({});

  // =========================================================
  // CURRENTLY DRAGGING LETTER
  // =========================================================
  const [draggingLetter, setDraggingLetter] = useState<number | null>(null);

  // =========================================================
  // DRAG START
  // =========================================================
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
  });

  // =========================================================
  // LETTER POSITION BEFORE DRAG
  // =========================================================
  const [letterStart, setLetterStart] = useState({
    x: 0,
    y: 0,
  });

  // =========================================================
  // START DRAG
  // =========================================================
  const handlePointerDown = (
    event: React.PointerEvent<HTMLSpanElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const currentPosition = letterPositions[index] ?? {
      x: 0,
      y: 0,
    };

    setDraggingLetter(index);

    setDragStart({
      x: event.clientX,
      y: event.clientY,
    });

    setLetterStart({
      x: currentPosition.x,
      y: currentPosition.y,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // =========================================================
  // DRAG LETTER
  // =========================================================
  const handlePointerMove = (
    event: React.PointerEvent<HTMLSpanElement>,
    index: number,
  ) => {
    if (draggingLetter !== index) return;

    event.preventDefault();

    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;

    setLetterPositions((previous) => ({
      ...previous,
      [index]: {
        x: letterStart.x + deltaX,
        y: letterStart.y + deltaY,
      },
    }));
  };

  // =========================================================
  // END DRAG
  // =========================================================
  const handlePointerUp = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture mungkin sudah dilepas browser.
    }

    setDraggingLetter(null);
  };

  // =========================================================
  // RESET LETTERS
  // =========================================================
  const resetLetters = () => {
    setLetterPositions({});
  };

  // =========================================================
  // RENDER WORD
  // =========================================================
  const renderWord = (word: string, startIndex: number) => {
    return (
      <span
        className="
          inline-block
          whitespace-nowrap
        "
      >
        {word.split("").map((char, index) => {
          const letterIndex = startIndex + index;

          const position = letterPositions[letterIndex] ?? {
            x: 0,
            y: 0,
          };

          const isDragging = draggingLetter === letterIndex;

          return (
            <span
              key={`letter-${letterIndex}`}
              onPointerDown={(event) => handlePointerDown(event, letterIndex)}
              onPointerMove={(event) => handlePointerMove(event, letterIndex)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`
                letter-pop
                inline-block
                relative
                select-none
                touch-none
                cursor-grab
                will-change-transform

                ${isDragging ? "cursor-grabbing z-50" : ""}
              `}
              style={
                {
                  "--letter-delay": `${LETTER_START_MS + letterIndex * LETTER_STAGGER_MS}ms`,
                  transform: `
                    translate3d(
                      ${position.x}px,
                      ${position.y}px,
                      0
                    )
                  `,
                  transition: isDragging
                    ? "none"
                    : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                  textShadow: isDragging
                    ? "0 12px 25px rgba(10,36,99,0.25)"
                    : "none",
                } as React.CSSProperties
              }
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative h-[230vh] bg-ivory overflow-clip"
      style={
        {
          // Nilai awal sebelum pengukuran pertama (diganti efek scroll).
          "--p": 0,
          "--y0": "560px",
          "--y1": "450px",
          "--w1": "520px",
        } as React.CSSProperties
      }
    >
      {/* Kotak-kotak hitam tipis. Menempel pada section (bukan sticky), jadi
          ikut bergeser saat di-scroll sementara isi hero diam di tempat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
        }}
      />

      {/* Isi hero menempel di layar selama section tinggi ini di-scroll. */}
      <div
        ref={stickyRef}
        className="sticky top-0 flex h-screen items-center"
        style={
          {
            // --m: progres perubahan tombol→bilah (linear); --e: versi
            // smoothstep-nya, supaya mulai & berhenti lembut.
            "--m": "clamp(0, calc((var(--p) - 0.08) / 0.5), 1)",
            "--e": "calc(var(--m) * var(--m) * (3 - 2 * var(--m)))",
            "--c": "clamp(0, calc(1 - var(--p) * 4), 1)",
          } as React.CSSProperties
        }
      >
      {/* =====================================================
          HERO CONTENT
          ===================================================== */}

      <div
        className="
          relative
          z-20
          w-full
          container-page
          pt-32
          pb-20
        "
        style={{ opacity: "var(--c)" }}
      >
        <div
          className="
            relative
            max-w-3xl
            mx-auto
            text-center
          "
        >
          {/* =================================================
              INTERACTIVE TITLE
              ================================================= */}

          <h1
            className="
              text-white
              select-none
            "
            style={{
              fontFamily: "var(--font-sans)",
              /* Lantai clamp sengaja RENDAH, bukan 2.5rem.
                 Kedua baris judul dikunci whitespace-nowrap supaya
                 pemenggalannya tetap "Platform Terbaik / Kuasai Ilmu
                 Apapun". Karena tidak boleh membungkus, lantai 2.5rem
                 (40px) membuat baris kedua — yang terpanjang — melebihi
                 layar sempit dan terpotong: 15px di 375px, 70px di 320px.
                 Lebar baris itu ~9,15x ukuran font, jadi 1.8rem (28.8px)
                 pas di area konten 320px yang cuma 272px.
                 Nilai 6.5vw dan batas 5.75rem TIDAK diubah — di layar
                 lebar keduanya tetap menang, jadi desktop tidak bergeser. */
              fontSize: "clamp(1.8rem, 6.5vw, 5.75rem)",
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
            }}
          >
            {/* BARIS 1 */}

            <span className="block whitespace-nowrap">
              {renderWord("Platform", 0)} {renderWord("Terbaik", 8)}
            </span>

            {/* BARIS 2 */}

            <span className="block whitespace-nowrap">
              {renderWord("Kuasai", 15)} {renderWord("Ilmu", 21)}{" "}
              {renderWord("Apapun", 26)}
            </span>
          </h1>

          {/* =================================================
              DESCRIPTION
              ================================================= */}

          <p
            className="
              rise-in
              text-lg
              2xl:text-xl
              leading-relaxed
              text-ink-body
              max-w-lg
              2xl:max-w-xl
              mt-8
              mx-auto
            "
            style={
              {
                "--rise-delay": "1300ms",
              } as React.CSSProperties
            }
          >
            Akses ratusan materi berkualitas dari berbagai bidang ilmu. Didesain
            untuk pelajar, mahasiswa, dan profesional di semua bidang.
          </p>

          {/* =================================================
              BUTTONS
              ================================================= */}

          <div
            className="
              flex
              flex-wrap
              gap-3
              mt-9
              justify-center
            "
          >
            {/* Penahan tempat tombol — tombolnya sendiri (BILAH di bawah)
                diposisikan menimpa slot ini lalu berpindah ke tengah layar. */}
            <div
              ref={slotRef}
              aria-hidden="true"
              style={{ width: BTN_W, height: BTN_H }}
            />

            {/* =================================================
                RESET
                ================================================= */}

            {Object.keys(letterPositions).length > 0 && (
              <button
                type="button"
                onClick={resetLetters}
                className="
                  basis-full
                  mx-auto
                  mt-2
                  text-xs
                  text-ink-muted
                  hover:text-white
                  transition-colors
                "
              >
                Reset posisi huruf
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          TOMBOL → BILAH. Satu elemen: di awal berupa tombol oval
          "Mulai Belajar" tepat di atas slot, lalu saat di-scroll ia
          meluncur ke tengah layar sambil melebar & meninggi (--e), wajah
          tombol memudar dan isi bilah (teks terketik + panah) muncul.
          ===================================================== */}

      <div
        className="rise-in pointer-events-none absolute inset-0 z-30"
        style={{ "--rise-delay": "1450ms" } as React.CSSProperties}
      >
        <div
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "calc(var(--y0) + (var(--y1) - var(--y0)) * var(--e))",
            width: `calc(${BTN_W}px + (var(--w1) - ${BTN_W}px) * var(--e))`,
            height: `calc(${BTN_H}px + (${BAR_H}px - ${BTN_H}px) * var(--e))`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Wajah tombol */}
          <Link
            href="/register"
            tabIndex={bar ? -1 : 0}
            className="group absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-soft transition-colors duration-200 ease-out-soft hover:bg-blue-700"
            style={{
              opacity: "clamp(0, calc(1 - var(--e) * 3), 1)",
              pointerEvents: bar ? "none" : "auto",
            }}
          >
            Mulai Belajar
            <svg
              className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          {/* Isi bilah */}
          <div
            className="absolute inset-0 rounded-full border border-white/15 bg-white/10 p-2.5 shadow-lift backdrop-blur-md"
            style={{
              opacity: "clamp(0, calc((var(--e) - 0.25) * 2.5), 1)",
              pointerEvents: bar ? "auto" : "none",
            }}
          >
            <div className="flex h-full items-center gap-3 rounded-full bg-white/10 pl-6 pr-1.5">
              <p className="min-w-0 flex-1 truncate text-left text-base text-white">
                {PROMPT_TEXT.slice(0, typed)}
                <span aria-hidden="true" className="ml-px inline-block h-5 w-0.5 translate-y-1 bg-white" />
              </p>
              <Link
                href="/register"
                aria-label="Mulai belajar"
                tabIndex={bar ? 0 : -1}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
