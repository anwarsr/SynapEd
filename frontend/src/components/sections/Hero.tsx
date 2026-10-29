"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { heroHref, type HeroPrompt } from "@/lib/heroPrompts";
import HeroStars from "@/components/sections/HeroStars";
import { useAuth } from "@/lib/useAuth";

type LetterPosition = {
  x: number;
  y: number;
};

/** Jeda antar huruf saat muncul "pop" (ms). */
const LETTER_STAGGER_MS = 45;
/** Judul mulai muncul sedikit setelah halaman terbuka. */
const LETTER_START_MS = 150;

/** Ukuran tombol awal & bilah akhir (px). */
const BTN_W = 200;
const BTN_H = 52;
const BAR_H = 76;
const BAR_MAX_W = 520;

/** Kunci sessionStorage: kalimat terakhir, agar muat ulang selalu berganti kalimat. */
const KUNCI_TERAKHIR = "synaped_hero_prompt";

/**
 * `prompts` dibangun server dari katalog (lib/heroPrompts.ts), jadi kursus baru
 * otomatis menambah kalimat. Dipilih ACAK tiap kunjungan, tiap muat ulang
 * (tidak pernah sama dengan yang sebelumnya), dan tiap kali pengunjung kembali
 * ke atas. Anak panah membawa ke /courses?q=… sesuai kalimat yang tampil.
 */
export default function Hero({ prompts }: { prompts: HeroPrompt[] }) {
  // Tombol "Mulai Belajar": sudah masuk → langsung ke katalog kursus; belum → halaman masuk.
  const { status: statusAuth } = useAuth();
  const tujuanMulai = statusAuth === "authenticated" ? "/courses" : "/login";

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
  // Prompt acak (indeks baru dipilih setelah mount supaya HTML server = klien)
  const [promptIdx, setPromptIdx] = useState(0);
  const promptRef = useRef(0);
  // Hero baru beranimasi SESUDAH splash loader selesai (lihat SplashLoader.intiSelesai).
  const [siap, setSiap] = useState(false);
  // Fase hover tombol "Mulai Belajar": masuk = AYOK KITA… turun dari atas; keluar = kata turun ke
  // bawah & label bawaan datang dari atas (seperti memutar). diam = keadaan awal.
  const [mulaiFase, setMulaiFase] = useState<"diam" | "masuk" | "keluar">("diam");

  useEffect(() => {
    const mulai = () => setSiap(true);
    if (document.documentElement.dataset.intro === "selesai") {
      const id = requestAnimationFrame(mulai);
      return () => cancelAnimationFrame(id);
    }
    window.addEventListener("synaped:intro-selesai", mulai, { once: true });
    // Jaring pengaman: bila splash tak pernah memberi tanda, hero tetap tampil.
    const darurat = setTimeout(mulai, 8000);
    return () => {
      window.removeEventListener("synaped:intro-selesai", mulai);
      clearTimeout(darurat);
    };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    let sudahPenuh = false;

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
      setTyped(Math.round(t * (prompts[promptRef.current]?.text.length ?? 0)));
      setBar(p > 0.3);

      if (t >= 1) sudahPenuh = true;

      // Kembali ke atas: kunjungan berikutnya dapat kalimat baru.
      if (p < 0.05 && sudahPenuh) {
        sudahPenuh = false;
        let n = promptRef.current;
        while (prompts.length > 1 && n === promptRef.current) n = Math.floor(Math.random() * prompts.length);
        promptRef.current = n;
        setPromptIdx(n);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(() => {
      // Pilih kalimat acak SEKALI setelah mount, lalu mulai pembaruan.
      let n = Math.floor(Math.random() * prompts.length);
      try {
        // Muat ulang tidak boleh mengulang kalimat yang baru saja tampil.
        const lalu = Number(sessionStorage.getItem(KUNCI_TERAKHIR));
        while (prompts.length > 1 && n === lalu) n = Math.floor(Math.random() * prompts.length);
        sessionStorage.setItem(KUNCI_TERAKHIR, String(n));
      } catch {
        // Penyimpanan diblokir: acak biasa sudah cukup.
      }
      promptRef.current = n;
      setPromptIdx(n);
      update();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [prompts]);

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
      data-tunggu={siap ? "false" : "true"}
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
            "linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
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
      {/* Bintang berkedip membentuk pensil, buku, lampu, laptop; hancur oleh kursor/sentuhan.
          Memudar bersama judul (--c) saat hero digulir. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ opacity: "var(--c)" }}>
        <HeroStars mulai={siap} />
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
                 (40px) membuat baris kedua - yang terpanjang - melebihi
                 layar sempit dan terpotong: 15px di 375px, 70px di 320px.
                 Lebar baris itu ~9,15x ukuran font, jadi 1.8rem (28.8px)
                 pas di area konten 320px yang cuma 272px.
                 Nilai 6.5vw dan batas 5.75rem TIDAK diubah - di layar
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
              BUTTONS
              ================================================= */}

          <div
            className="
              flex
              flex-wrap
              gap-3
              mt-10
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
            href={tujuanMulai}
            tabIndex={bar ? -1 : 0}
            data-fase={mulaiFase}
            onPointerEnter={() => setMulaiFase("masuk")}
            onPointerLeave={() => setMulaiFase((f) => (f === "masuk" ? "keluar" : f))}
            className="group absolute inset-0 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-blue-600 text-sm font-semibold text-white shadow-soft"
            style={{
              opacity: "clamp(0, calc(1 - var(--e) * 3), 1)",
              pointerEvents: bar ? "none" : "auto",
            }}
          >
            {/* Label bawaan: turun & memudar saat di-hover */}
            <span className="mulai-label flex items-center gap-2">
              Mulai Belajar
              <svg
                className="mulai-panah h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>

            {/* Saat di-hover: AYOK KITA MULAI BELAJAR, kata demi kata jatuh dari atas, terpotong batas tombol */}
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-[0.45em] whitespace-nowrap px-3 text-[10px] font-bold uppercase tracking-[0.07em]">
              {["AYOK", "KITA", "MULAI", "BELAJAR"].map((k, i) => (
                <span key={k} className="mulai-kata" style={{ "--i": i } as React.CSSProperties}>
                  {k}
                </span>
              ))}
            </span>
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
                {(prompts[promptIdx]?.text ?? "").slice(0, typed)}
                <span aria-hidden="true" className="ml-px inline-block h-5 w-0.5 translate-y-1 bg-white" />
              </p>
              <Link
                href={heroHref(prompts[promptIdx] ?? { text: "", q: "" })}
                aria-label="Cari kursus sesuai kalimat ini"
                tabIndex={bar ? 0 : -1}
                className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
              >
                <svg className="bilah-panah h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
