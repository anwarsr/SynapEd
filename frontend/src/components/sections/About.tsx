"use client";

import { useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

/* =============================================================
   DATA
============================================================= */

const points = [
  {
    num: "01",
    title: "Terstruktur",
    desc: "Belajar dari dasar hingga mahir melalui alur yang jelas dan bertahap.",
  },
  {
    num: "02",
    title: "Interaktif",
    desc: "Belajar melalui aktivitas dan kuis yang membuat materi lebih mudah dipahami.",
  },
  {
    num: "03",
    title: "Berbasis Riset",
    desc: "Materi dikembangkan berdasarkan literatur dan sumber ilmiah yang relevan.",
  },
];

/* =============================================================
   ABOUT
============================================================= */

export default function About() {
  return (
    <section
      id="about"
      className="
        relative
        overflow-hidden
        bg-paper
        py-24
        sm:py-28
        lg:py-32
      "
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div
        className="
          container-page
          mb-12
          sm:mb-16
          lg:mb-20
        "
      >
        <Reveal>
          <div className="max-w-3xl">
            <h1
              className="
                rise-in
                text-blue-600
                text-[clamp(2.8rem,6.5vw,5.75rem)]
                font-extrabold
                leading-[0.96]
                tracking-[-0.055em]
              "
              style={
                {
                  fontFamily: "var(--font-inter)",
                  "--rise-delay": "170ms",
                } as React.CSSProperties
              }
            >
              Tentang
              <br />
              SynapEd
            </h1>

            <p
              className="
                mt-6
                max-w-lg
                text-sm
                leading-[1.7]
                text-neutral-600
                sm:text-base
              "
            >
              Pembelajaran yang terarah, interaktif, dan didukung oleh sumber
              yang dapat dipercaya.
            </p>
          </div>
        </Reveal>
      </div>

      {/* =====================================================
          CARDS
      ====================================================== */}

      <div
        className="
          container-page
          grid
          grid-cols-1
          gap-6
          md:grid-cols-3
          lg:gap-7
        "
      >
        {points.map((point, index) => (
          <Reveal key={point.title} delay={index * 120}>
            <AboutCard point={point} index={index} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* =============================================================
   CARD
============================================================= */

function AboutCard({
  point,
  index,
}: {
  point: (typeof points)[number];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;

    if (!card) return;

    const rect = card.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;

    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const rotateY = ((x - 50) / 50) * 4;
    const rotateX = ((50 - y) / 50) * 4;

    card.style.setProperty("--mouse-x", `${x}%`);
    card.style.setProperty("--mouse-y", `${y}%`);
    card.style.setProperty("--rotate-x", `${rotateX}deg`);
    card.style.setProperty("--rotate-y", `${rotateY}deg`);
  };

  const handlePointerLeave = () => {
    const card = cardRef.current;

    if (!card) return;

    card.style.setProperty("--mouse-x", "50%");
    card.style.setProperty("--mouse-y", "50%");
    card.style.setProperty("--rotate-x", "0deg");
    card.style.setProperty("--rotate-y", "0deg");

    setHover(false);
  };

  return (
    <article
      ref={cardRef}
      onPointerEnter={() => setHover(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="
        group
        relative
        min-h-[560px]
        overflow-hidden
        rounded-[30px]
        border
        border-black/[0.07]
        bg-[#f8f7f2]
        p-6
        shadow-[0_18px_50px_rgba(0,0,0,0.07)]
        transition-shadow
        duration-500
        hover:shadow-[0_30px_80px_rgba(0,0,0,0.13)]
        sm:p-7
        lg:min-h-[590px]
      "
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "50%",
          "--rotate-x": "0deg",
          "--rotate-y": "0deg",
        } as React.CSSProperties
      }
    >
      {/* =====================================================
          LIGHT
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          rounded-[30px]
          opacity-0
          transition-opacity
          duration-500
          group-hover:opacity-100
        "
        style={{
          background:
            "radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,.8), transparent 38%)",
        }}
      />

      {/* =====================================================
          NUMBER
      ====================================================== */}

      <div
        className="
          relative
          z-50
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          bg-blue-600
          text-xs
          font-extrabold
          text-white
          shadow-[0_8px_25px_rgba(37,99,235,.25)]
        "
      >
        {point.num}
      </div>

      {/* =====================================================
          VISUAL
      ====================================================== */}

      <div
        className="
          relative
          z-10
          mt-2
          flex
          h-[330px]
          items-center
          justify-center
          [perspective:1000px]
        "
      >
        {index === 0 && <StructuredGame hover={hover} />}

        {index === 1 && <InteractiveGame hover={hover} />}

        {index === 2 && <ResearchGame hover={hover} />}
      </div>

      {/* =====================================================
          TEXT
      ====================================================== */}

      <div className="relative z-50 mt-1">
        <h2
          className="
            text-[clamp(2rem,4vw,3rem)]
            font-extrabold
            leading-none
            tracking-[-0.05em]
            text-neutral-950
          "
          style={{
            fontFamily: "var(--font-inter)",
          }}
        >
          {point.title}
        </h2>

        <p
          className="
            mt-3
            max-w-sm
            text-[13px]
            leading-[1.65]
            text-neutral-500
            sm:text-sm
          "
        >
          {point.desc}
        </p>
      </div>
    </article>
  );
}

/* =============================================================
   01 — TERSTRUKTUR
   SATU TOMBOL SAJA

   Kondisi awal:
   tombol = shuffle

   Setelah diacak:
   tombol = undo

   Setiap klik:
   satu kertas dirapikan

   Setelah semua rapi:
   tombol kembali menjadi shuffle
============================================================= */

type FileItem = {
  id: number;
  title: string;
  type: string;
};

type FilePosition = {
  x: number;
  y: number;
  rotate: number;
};

const FILES: FileItem[] = [
  {
    id: 1,
    title: "Materi Dasar",
    type: "DOC",
  },
  {
    id: 2,
    title: "Konsep Utama",
    type: "PDF",
  },
  {
    id: 3,
    title: "Latihan",
    type: "TASK",
  },
  {
    id: 4,
    title: "Evaluasi",
    type: "QUIZ",
  },
  {
    id: 5,
    title: "Referensi",
    type: "REF",
  },
  {
    id: 6,
    title: "Ringkasan",
    type: "NOTE",
  },
];

const ORIGINAL_POSITIONS: FilePosition[] = [
  {
    x: 50,
    y: 53,
    rotate: -3,
  },
  {
    x: 50,
    y: 51,
    rotate: 2,
  },
  {
    x: 50,
    y: 49,
    rotate: -2,
  },
  {
    x: 50,
    y: 47,
    rotate: 3,
  },
  {
    x: 50,
    y: 45,
    rotate: -4,
  },
  {
    x: 50,
    y: 43,
    rotate: 2,
  },
];

const RANDOM_POSITIONS: FilePosition[] = [
  {
    x: 35,
    y: 42,
    rotate: -12,
  },
  {
    x: 67,
    y: 45,
    rotate: 9,
  },
  {
    x: 41,
    y: 65,
    rotate: 6,
  },
  {
    x: 65,
    y: 67,
    rotate: -8,
  },
  {
    x: 31,
    y: 55,
    rotate: 15,
  },
  {
    x: 61,
    y: 55,
    rotate: -16,
  },
];

function StructuredGame({ hover }: { hover: boolean }) {
  const [positions, setPositions] =
    useState<FilePosition[]>(ORIGINAL_POSITIONS);

  const [dragging, setDragging] = useState<number | null>(null);

  /*
   * Menyimpan index kertas yang belum
   * dikembalikan ke posisi awal.
   */
  const [undoStack, setUndoStack] = useState<number[]>([]);

  const isMessy = undoStack.length > 0;

  /* =========================================================
     SATU-SATUNYA AKSI TOMBOL
  ========================================================== */

  const handleAction = () => {
    /*
     * Jika masih rapi:
     * acak semua kertas.
     */
    if (undoStack.length === 0) {
      const shuffled: FilePosition[] = [];
      const used: number[] = [];

      for (let i = 0; i < FILES.length; i++) {
        let randomIndex = Math.floor(Math.random() * RANDOM_POSITIONS.length);

        while (used.includes(randomIndex)) {
          randomIndex = Math.floor(Math.random() * RANDOM_POSITIONS.length);
        }

        used.push(randomIndex);

        shuffled.push({
          ...RANDOM_POSITIONS[randomIndex],
        });
      }

      setPositions(shuffled);

      /*
       * Rapikan dari kertas terakhir
       * menuju kertas pertama.
       */
      setUndoStack([5, 4, 3, 2, 1, 0]);

      return;
    }

    /*
     * Jika sudah berantakan:
     * kembalikan SATU kertas.
     */
    setUndoStack((current) => {
      if (current.length === 0) {
        return current;
      }

      const next = [...current];

      const fileIndex = next.shift();

      if (fileIndex !== undefined) {
        setPositions((currentPositions) => {
          const updated = [...currentPositions];

          updated[fileIndex] = {
            ...ORIGINAL_POSITIONS[fileIndex],
          };

          return updated;
        });
      }

      return next;
    });
  };

  /* =========================================================
     DRAG PAPER
  ========================================================== */

  const handlePointerMove = (
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (dragging !== index) return;

    const parent = e.currentTarget.parentElement;

    if (!parent) return;

    const rect = parent.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;

    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPositions((current) => {
      const updated = [...current];

      updated[index] = {
        ...updated[index],
        x: Math.max(18, Math.min(82, x)),
        y: Math.max(25, Math.min(76, y)),
      };

      return updated;
    });
  };

  return (
    <div
      className="
        relative
        h-[300px]
        w-[270px]
        [transform-style:preserve-3d]
        [transform:rotateX(var(--rotate-x))_rotateY(var(--rotate-y))]
        transition-transform
        duration-200
      "
    >
      {/* =====================================================
          SHADOW
      ====================================================== */}

      <div
        className="
          absolute
          bottom-7
          left-1/2
          h-8
          w-48
          -translate-x-1/2
          rounded-full
          bg-black/10
          blur-xl
        "
      />

      {/* =====================================================
          PAPERS
      ====================================================== */}

      {FILES.map((file, index) => {
        const position = positions[index];

        return (
          <button
            key={file.id}
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);

              setDragging(index);
            }}
            onPointerMove={(e) => handlePointerMove(e, index)}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
            className={cn(
              `
                absolute
                h-[82px]
                w-[178px]
                rounded-2xl
                border
                border-neutral-200
                bg-white
                p-3
                text-left
                shadow-[0_14px_30px_rgba(0,0,0,.1)]
                transition-[left,top,transform,box-shadow]
                duration-500
                select-none
                touch-none
                cursor-grab
                active:cursor-grabbing
              `,
              dragging === index
                ? "z-[100] shadow-[0_25px_50px_rgba(0,0,0,.18)]"
                : "",
            )}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: dragging === index ? 100 : index + 1,
              transform: `
                translate(-50%, -50%)
                translateZ(${index * 14}px)
                rotate(${position.rotate}deg)
                ${dragging === index ? "scale(1.06)" : ""}
              `,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-blue-50
                  text-[8px]
                  font-black
                  text-blue-600
                "
              >
                {file.type}
              </div>

              <div className="min-w-0">
                <div className="truncate text-[10px] font-black text-neutral-800">
                  {file.title}
                </div>

                <div className="mt-2 h-1.5 w-20 rounded-full bg-neutral-100" />

                <div className="mt-1.5 h-1.5 w-12 rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="absolute bottom-2 right-3 flex gap-1">
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
            </div>
          </button>
        );
      })}

      {/* =====================================================
          ONE BUTTON ONLY
      ====================================================== */}

      <button
        type="button"
        onClick={handleAction}
        className="
          absolute
          right-0
          top-3
          z-[150]
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-blue-600
          text-white
          shadow-[0_15px_35px_rgba(37,99,235,.3)]
          transition-all
          duration-300
          hover:scale-110
          hover:-rotate-6
          active:scale-95
        "
        style={{
          transform: hover ? "translateZ(150px)" : "translateZ(120px)",
        }}
        aria-label={isMessy ? "Rapikan satu kertas" : "Acak kertas"}
      >
        {isMessy ? (
          /* UNDO ICON */
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 14L4 9l5-5"
            />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 9h10a6 6 0 016 6v1"
            />
          </svg>
        ) : (
          /* SHUFFLE ICON */
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5" />

            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20L21 3" />

            <path strokeLinecap="round" strokeLinejoin="round" d="M16 16l5 5" />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 16v5h-5"
            />

            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l5 5" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* =============================================================
   02 — INTERAKTIF
   QUICK QUIZ
============================================================= */

type QuizQuestion = {
  question: string;
  answers: string[];
  correct: number;
};

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "Apa tahap setelah memahami konsep?",
    answers: ["Praktik", "Istirahat", "Mengulang"],
    correct: 0,
  },
  {
    question: "Apa yang membantu menguji pemahaman?",
    answers: ["Dekorasi", "Evaluasi", "Warna"],
    correct: 1,
  },
  {
    question: "Apa tujuan latihan dalam pembelajaran?",
    answers: ["Menerapkan konsep", "Menghapus materi", "Mengurangi waktu"],
    correct: 0,
  },
];

function InteractiveGame({ hover }: { hover: boolean }) {
  const [questionIndex, setQuestionIndex] = useState(0);

  const [selected, setSelected] = useState<number | null>(null);

  const [score, setScore] = useState(0);

  const [finished, setFinished] = useState(false);

  const question = QUIZ_QUESTIONS[questionIndex];

  /*
   * Progress benar-benar berdasarkan
   * soal yang sudah dijawab.
   */
  const progress = finished
    ? 100
    : ((questionIndex + (selected !== null ? 1 : 0)) / QUIZ_QUESTIONS.length) *
      100;

  /* =========================================================
     ANSWER
  ========================================================== */

  const chooseAnswer = (index: number) => {
    if (selected !== null) return;

    setSelected(index);

    if (index === question.correct) {
      setScore((prev) => prev + 1);
    }
  };

  /* =========================================================
     NEXT
  ========================================================== */

  const nextQuestion = () => {
    if (selected === null) return;

    if (questionIndex >= QUIZ_QUESTIONS.length - 1) {
      setFinished(true);
      return;
    }

    setQuestionIndex((prev) => prev + 1);

    setSelected(null);
  };

  /* =========================================================
     RESTART
  ========================================================== */

  const restart = () => {
    setQuestionIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  return (
    <div
      className="
        relative
        h-[300px]
        w-[270px]
        [perspective:1000px]
        [transform-style:preserve-3d]
        [transform:rotateX(var(--rotate-x))_rotateY(var(--rotate-y))]
        transition-transform
        duration-200
      "
    >
      {/* =====================================================
          QUIZ CARD
      ====================================================== */}

      <div
        className="
          absolute
          left-1/2
          top-1/2
          h-[250px]
          w-[224px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-[24px]
          border
          border-blue-100
          bg-white
          p-4
          shadow-[0_20px_45px_rgba(0,0,0,.11)]
          [transform:translateZ(60px)]
        "
      >
        {/* HEADER */}

        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black tracking-[0.14em] text-neutral-400">
            QUICK QUIZ
          </span>

          <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">
            {score}/{QUIZ_QUESTIONS.length}
          </span>
        </div>

        {/* ===================================================
            PROGRESS BAR
        ==================================================== */}

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-50">
          <div
            className="
              h-full
              rounded-full
              bg-blue-600
              transition-all
              duration-500
              ease-out
            "
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {!finished ? (
          <div className="relative mt-3 h-[198px]">
            {/* =================================================
                QUESTION
            ================================================== */}

            <div>
              <div className="text-[7px] font-black uppercase tracking-[0.1em] text-neutral-400">
                Pertanyaan {questionIndex + 1} / {QUIZ_QUESTIONS.length}
              </div>

              <p
                className="
                  mt-1.5
                  max-w-[185px]
                  text-[10px]
                  font-bold
                  leading-[1.35]
                  text-neutral-800
                "
              >
                {question.question}
              </p>
            </div>

            {/* =================================================
                ANSWERS
            ================================================== */}

            <div className="mt-3 space-y-1.5">
              {question.answers.map((answer, index) => {
                const isSelected = selected === index;

                const isCorrect = index === question.correct;

                const showCorrect = selected !== null && isCorrect;

                const showWrong = isSelected && !isCorrect;

                return (
                  <button
                    key={answer}
                    type="button"
                    onClick={() => chooseAnswer(index)}
                    className={cn(
                      `
                          flex
                          min-h-[32px]
                          w-full
                          items-center
                          gap-2
                          rounded-xl
                          border
                          px-2
                          py-1.5
                          text-left
                          transition-all
                          duration-300
                        `,
                      showCorrect
                        ? "border-green-200 bg-green-50"
                        : showWrong
                          ? "border-red-200 bg-red-50"
                          : "border-neutral-100 bg-white hover:border-blue-200 hover:bg-blue-50/30",
                    )}
                  >
                    <span
                      className={cn(
                        `
                            flex
                            h-6
                            w-6
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            text-[8px]
                            font-black
                          `,
                        showCorrect
                          ? "bg-green-500 text-white"
                          : showWrong
                            ? "bg-red-500 text-white"
                            : "bg-blue-50 text-blue-500",
                      )}
                    >
                      {showCorrect
                        ? "✓"
                        : showWrong
                          ? "×"
                          : String.fromCharCode(65 + index)}
                    </span>

                    <span className="min-w-0 truncate text-[8px] font-semibold text-neutral-600">
                      {answer}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* =================================================
                NEXT
            ================================================== */}

            {selected !== null && (
              <button
                type="button"
                onClick={nextQuestion}
                className="
                  absolute
                  bottom-0
                  right-0
                  rounded-full
                  bg-blue-600
                  px-3
                  py-1.5
                  text-[8px]
                  font-black
                  text-white
                  shadow-[0_8px_18px_rgba(37,99,235,.22)]
                  transition-all
                  hover:scale-105
                  active:scale-95
                "
              >
                {questionIndex === QUIZ_QUESTIONS.length - 1
                  ? "Selesai"
                  : "Lanjut →"}
              </button>
            )}
          </div>
        ) : (
          /* =================================================
             RESULT
          ================================================== */

          <div className="flex h-[195px] flex-col items-center justify-center text-center">
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-green-50
                text-xl
              "
            >
              {score === QUIZ_QUESTIONS.length ? "✓" : "★"}
            </div>

            <div className="mt-2 text-[8px] font-black uppercase tracking-[0.12em] text-neutral-400">
              Quiz selesai
            </div>

            <div className="mt-1 text-3xl font-black tracking-[-0.05em] text-neutral-900">
              {score} / {QUIZ_QUESTIONS.length}
            </div>

            <button
              type="button"
              onClick={restart}
              className="
                mt-3
                rounded-full
                bg-blue-50
                px-4
                py-2
                text-[8px]
                font-black
                text-blue-600
                transition-all
                hover:bg-blue-100
                active:scale-95
              "
            >
              Ulangi Quiz
            </button>
          </div>
        )}
      </div>

      {/* =====================================================
          FLOATING SCORE
      ====================================================== */}

      <div
        className="
          absolute
          -right-1
          top-5
          z-50
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-blue-600
          text-white
          shadow-[0_18px_40px_rgba(37,99,235,.3)]
          transition-all
          duration-500
        "
        style={{
          transform:
            finished && score === QUIZ_QUESTIONS.length
              ? "translateZ(170px) scale(1.1) rotate(8deg)"
              : hover
                ? "translateZ(150px)"
                : "translateZ(120px)",
        }}
      >
        <span className="text-lg font-black">
          {finished ? `${score}/${QUIZ_QUESTIONS.length}` : `${score}`}
        </span>
      </div>
    </div>
  );
}

/* =============================================================
   03 — BERBASIS RISET
   REAL TEXT + MOVING MAGNIFIER
============================================================= */

function ResearchGame({ hover }: { hover: boolean }) {
  const paperRef = useRef<HTMLDivElement>(null);

  const [pointer, setPointer] = useState({
    x: 50,
    y: 50,
    visible: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const paper = paperRef.current;

    if (!paper) return;

    const rect = paper.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;

    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPointer({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      visible: true,
    });
  };

  const handlePointerLeave = () => {
    setPointer((current) => ({
      ...current,
      visible: false,
    }));
  };

  return (
    <div
      className="
        relative
        h-[300px]
        w-[270px]
        [perspective:1000px]
        [transform-style:preserve-3d]
        [transform:rotateX(var(--rotate-x))_rotateY(var(--rotate-y))]
        transition-transform
        duration-200
      "
    >
      {/* =====================================================
          PAPER
      ====================================================== */}

      <div
        ref={paperRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="
          absolute
          left-1/2
          top-1/2
          h-[238px]
          w-[238px]
          -translate-x-1/2
          -translate-y-1/2
          overflow-hidden
          rounded-3xl
          border
          border-neutral-200
          bg-white
          p-5
          shadow-[0_25px_50px_rgba(0,0,0,.11)]
          [transform:translateZ(60px)_rotateZ(-3deg)]
        "
      >
        {/* ===================================================
            DOCUMENT
        ==================================================== */}

        <div className="select-none">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
              R
            </div>

            <div>
              <h3 className="text-[10px] font-black text-neutral-800">
                Learning Research
              </h3>

              <p className="mt-1 text-[6px] text-neutral-400">
                Evidence-based learning
              </p>
            </div>
          </div>

          <p className="mt-5 text-[7px] leading-[1.7] text-neutral-600">
            Interactive learning can support student engagement by encouraging
            learners to actively participate in the learning process.
          </p>

          <p className="mt-3 text-[7px] leading-[1.7] text-neutral-600">
            Research-based learning materials can also help students connect
            theoretical concepts with practical activities.
          </p>

          <div className="mt-4 rounded-xl bg-blue-50 p-3">
            <p className="text-[6px] font-black uppercase tracking-[0.12em] text-blue-600">
              Research finding
            </p>

            <p className="mt-2 text-[7px] leading-[1.6] text-blue-800">
              Active participation may improve understanding and retention when
              learners interact directly with the material.
            </p>
          </div>

          <p className="mt-4 text-[6px] leading-[1.6] text-neutral-400">
            Source: Educational Research Review · 2025
          </p>
        </div>

        {/* ===================================================
            MAGNIFIED AREA
        ==================================================== */}

        {pointer.visible && (
          <div
            className="
              pointer-events-none
              absolute
              z-30
              h-[112px]
              w-[112px]
              -translate-x-1/2
              -translate-y-1/2
              overflow-hidden
              rounded-full
              border-[5px]
              border-white
              bg-white
              shadow-[0_15px_40px_rgba(0,0,0,.28)]
            "
            style={{
              left: `${pointer.x}%`,
              top: `${pointer.y}%`,
            }}
          >
            <div
              className="
                absolute
                left-0
                top-0
                w-[238px]
                origin-top-left
                scale-[2.4]
                bg-white
                p-5
              "
              style={{
                transformOrigin: `${pointer.x}% ${pointer.y}%`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
                  R
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-neutral-800">
                    Learning Research
                  </h3>

                  <p className="mt-1 text-[6px] text-neutral-400">
                    Evidence-based learning
                  </p>
                </div>
              </div>

              <p className="mt-5 text-[7px] leading-[1.7] text-neutral-600">
                Interactive learning can support student engagement by
                encouraging learners to actively participate in the learning
                process.
              </p>

              <p className="mt-3 text-[7px] leading-[1.7] text-neutral-600">
                Research-based learning materials can also help students connect
                theoretical concepts with practical activities.
              </p>

              <div className="mt-4 rounded-xl bg-blue-50 p-3">
                <p className="text-[6px] font-black uppercase tracking-[0.12em] text-blue-600">
                  Research finding
                </p>

                <p className="mt-2 text-[7px] leading-[1.6] text-blue-800">
                  Active participation may improve understanding and retention
                  when learners interact directly with the material.
                </p>
              </div>

              <p className="mt-4 text-[6px] leading-[1.6] text-neutral-400">
                Source: Educational Research Review · 2025
              </p>
            </div>

            {/* GLASS REFLECTION */}

            <div
              className="
                pointer-events-none
                absolute
                left-3
                top-2
                h-5
                w-8
                rotate-[-25deg]
                rounded-full
                bg-white/60
                blur-[2px]
              "
            />
          </div>
        )}

        {/* ===================================================
            HINT
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            bottom-3
            left-5
            right-5
            text-center
            text-[7px]
            font-bold
            text-neutral-400
          "
        >
          Gerakkan kursor untuk membaca
        </div>
      </div>

      {/* =====================================================
          MAGNIFYING GLASS
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          right-0
          top-3
          z-50
          transition-transform
          duration-200
        "
        style={{
          transform: hover
            ? "translateZ(160px) rotate(8deg) scale(1.08)"
            : "translateZ(120px) rotate(8deg)",
        }}
      >
        {/* LENS */}

        <div
          className="
            relative
            h-16
            w-16
            rounded-full
            border-[6px]
            border-blue-600
            bg-white/20
            shadow-[0_18px_40px_rgba(37,99,235,.25)]
            backdrop-blur-[1px]
          "
        >
          <div
            className="
              absolute
              left-2
              top-2
              h-4
              w-6
              rotate-[-25deg]
              rounded-full
              bg-white/70
              blur-[1px]
            "
          />
        </div>

        {/* HANDLE */}

        <div
          className="
            absolute
            -bottom-9
            -right-5
            h-11
            w-3
            rotate-[-42deg]
            rounded-full
            bg-blue-600
          "
        />
      </div>
    </div>
  );
}
