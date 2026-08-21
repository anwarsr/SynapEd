"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LetterPosition = {
  x: number;
  y: number;
};

export default function Hero() {
  // =========================================================
  // MOUNT
  // =========================================================
  const [mounted, setMounted] = useState(false);

  // =========================================================
  // SCROLL EXIT PROGRESS
  // =========================================================
  const [exitT, setExitT] = useState(0);

  // =========================================================
  // MOUSE PARALLAX
  // =========================================================
  const [mouse, setMouse] = useState({
    x: 0,
    y: 0,
  });

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
  // MOUNT ANIMATION
  // =========================================================
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  // =========================================================
  // SCROLL
  // =========================================================
  useEffect(() => {
    const hero = document.getElementById("hero");

    if (!hero) return;

    const onScroll = () => {
      const rect = hero.getBoundingClientRect();

      const progress = -rect.top / rect.height;

      setExitT(Math.min(Math.max(progress, 0), 1));
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // =========================================================
  // MOUSE PARALLAX
  // =========================================================
  useEffect(() => {
    const hero = document.getElementById("hero");

    if (!hero) return;

    const onMouseMove = (event: MouseEvent) => {
      // Jangan jalankan parallax saat huruf sedang di-drag
      if (draggingLetter !== null) return;

      const rect = hero.getBoundingClientRect();

      const normalizedX =
        (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);

      const normalizedY =
        (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);

      const x = Math.max(-1, Math.min(1, normalizedX));
      const y = Math.max(-1, Math.min(1, normalizedY));

      setMouse({
        x,
        y,
      });
    };

    const onMouseLeave = () => {
      if (draggingLetter !== null) return;

      setMouse({
        x: 0,
        y: 0,
      });
    };

    hero.addEventListener("mousemove", onMouseMove);
    hero.addEventListener("mouseleave", onMouseLeave);

    return () => {
      hero.removeEventListener("mousemove", onMouseMove);
      hero.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [draggingLetter]);

  // =========================================================
  // PARALLAX DEPTH
  // =========================================================

  // Book
  const bookX = mouse.x * 24;
  const bookY = mouse.y * 15;

  // Ruler
  const rulerX = mouse.x * 32;
  const rulerY = mouse.y * 19;

  // Bottle
  const bottleX = mouse.x * 40;
  const bottleY = mouse.y * 24;

  // Karakter kiri
  const leftPersonX = mouse.x * 28;
  const leftPersonY = mouse.y * 18;

  // Karakter kanan
  const rightPersonX = mouse.x * 32;
  const rightPersonY = mouse.y * 20;

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
                inline-block
                relative
                select-none
                touch-none
                cursor-grab
                will-change-transform

                ${isDragging ? "cursor-grabbing z-50" : ""}
              `}
              style={{
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
                  ? "0 12px 25px rgba(0,0,0,0.25)"
                  : "none",
              }}
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
      id="hero"
      className="
        relative
        min-h-screen
        flex
        items-center
        bg-hero-navy
        overflow-hidden
      "
    >
      {/* =====================================================
          FLOATING BOOK
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          absolute
          z-[5]
          pointer-events-none
          select-none
        "
        style={{
          left: "16%",
          top: "11%",
          transform: `
            translate(
              ${bookX}px,
              ${bookY}px
            )
            rotate(${mouse.x * 5 - 8}deg)
          `,
          opacity: mounted ? 1 : 0,
          transition:
            "transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms var(--ease-warm)",
        }}
      >
        <div className="animate-float-bob-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/book.png"
            alt=""
            className="
              w-28
              md:w-32
              lg:w-36
              xl:w-44
              2xl:w-48
              h-auto
              drop-shadow-2xl
            "
          />
        </div>
      </div>

      {/* =====================================================
          FLOATING RULER
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          absolute
          z-[5]
          pointer-events-none
          select-none
        "
        style={{
          right: "8%",
          top: "8%",
          transform: `
            translate(
              ${rulerX}px,
              ${rulerY}px
            )
            rotate(${mouse.x * 7 + 12}deg)
          `,
          opacity: mounted ? 1 : 0,
          transition:
            "transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms var(--ease-warm)",
        }}
      >
        <div className="animate-float-bob-right">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ruler.png"
            alt=""
            className="
              w-32
              md:w-36
              lg:w-40
              xl:w-48
              2xl:w-52
              h-auto
              drop-shadow-2xl
            "
          />
        </div>
      </div>

      {/* =====================================================
          FLOATING BOTTLE
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          absolute
          z-[6]
          pointer-events-none
          select-none
        "
        style={{
          left: "7%",
          top: "27%",
          transform: `
            translate(
              ${bottleX}px,
              ${bottleY}px
            )
            rotate(${mouse.x * 6 - 10}deg)
          `,
          opacity: mounted ? 1 : 0,
          transition:
            "transform 550ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms var(--ease-warm)",
        }}
      >
        <div className="animate-float-bob-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/bottle.png"
            alt=""
            className="
              w-24
              md:w-28
              lg:w-32
              xl:w-36
              2xl:w-40
              h-auto
              drop-shadow-2xl
            "
          />
        </div>
      </div>

      {/* =====================================================
          ORANG KIRI
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          hidden
          lg:block
          absolute
          bottom-0
          left-0
          xl:left-25
          xl:bottom-10
          z-10
          w-48
          xl:w-64
          pointer-events-none
          select-none
        "
        style={{
          transform: `
            translate(
              ${mounted ? -exitT * 120 + leftPersonX : -140}px,
              ${mounted ? exitT * 160 + leftPersonY : 180}px
            )
            rotate(
              ${mounted ? -exitT * 14 : -18}deg
            )
            scale(
              ${mounted ? 1 - exitT * 0.15 : 0.85}
            )
          `,
          opacity: mounted ? Math.max(0, 1 - exitT * 1.3) : 0,
          transition:
            "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms var(--ease-warm)",
        }}
      >
        <div
          className={`
            transition-transform
            duration-300
            ease-out-soft
            ${mounted && exitT === 0 ? "animate-float-bob-left" : ""}
          `}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/4.png"
            alt=""
            className="
              w-full
              h-auto
              drop-shadow-2xl
              scale-x-[-4]
              scale-y-[4]
            "
          />
        </div>
      </div>

      {/* =====================================================
          ORANG KANAN
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          hidden
          lg:block
          absolute
          bottom-0
          right-0
          xl:right-25
          xl:bottom-10
          z-10
          w-48
          xl:w-64
          pointer-events-none
          select-none
        "
        style={{
          transform: `
            translate(
              ${mounted ? exitT * 120 + rightPersonX : 140}px,
              ${mounted ? exitT * 160 + rightPersonY : 180}px
            )
            rotate(
              ${mounted ? exitT * 14 : 18}deg
            )
            scale(
              ${mounted ? 1 - exitT * 0.15 : 0.85}
            )
          `,
          opacity: mounted ? Math.max(0, 1 - exitT * 1.3) : 0,
          transition:
            "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms var(--ease-warm)",
        }}
      >
        <div
          className={`
            transition-transform
            duration-300
            ease-out-soft
            ${mounted && exitT === 0 ? "animate-float-bob-right" : ""}
          `}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/5.png"
            alt=""
            className="
              w-full
              h-auto
              drop-shadow-2xl
              scale-x-[5]
              scale-y-[5]
            "
          />
        </div>
      </div>

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
              rise-in
              text-paper
              select-none
            "
            style={
              {
                fontFamily: "var(--font-inter)",
                fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
                fontWeight: 800,
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
                "--rise-delay": "170ms",
              } as React.CSSProperties
            }
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
              text-blue-100/80
              max-w-lg
              2xl:max-w-xl
              mt-8
              mx-auto
            "
            style={
              {
                "--rise-delay": "300ms",
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
              rise-in
              flex
              flex-wrap
              gap-3
              mt-9
              justify-center
            "
            style={
              {
                "--rise-delay": "400ms",
              } as React.CSSProperties
            }
          >
            <Link
              href="/register"
              className="
                group
                inline-flex
                items-center
                justify-center
                gap-2
                px-7
                py-3.5
                rounded-lg
                text-sm
                font-semibold
                bg-paper
                text-navy
                transition-all
                duration-200
                ease-out-soft
                hover:bg-white
                hover:-translate-y-0.5
                hover:shadow-lift
              "
            >
              Mulai Belajar
              <svg
                className="
                  w-4
                  h-4
                  transition-transform
                  duration-200
                  ease-out-soft
                  group-hover:translate-x-1
                "
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>

            <a
              href="#courses"
              className="
                inline-flex
                items-center
                justify-center
                px-7
                py-3.5
                rounded-lg
                text-sm
                font-semibold
                text-paper
                border
                border-white/25
                transition-colors
                duration-200
                ease-out-soft
                hover:bg-white/10
                hover:border-white/50
              "
            >
              Lihat Kurikulum
            </a>

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
                  text-white/50
                  hover:text-white/80
                  transition-colors
                "
              >
                Reset posisi huruf
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
