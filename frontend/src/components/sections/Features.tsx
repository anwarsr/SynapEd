"use client";

import { useEffect, useRef, useState } from "react";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SectionTitle from "@/components/sections/SectionTitle";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

const STAGE_CARDS = [0, 1, 3, 4].map((i) => ({
  title: features[i].title,
  desc: features[i].desc,
}));

/* =============================================================
   EASTER EGG - angka kartu dipencet → warna kartu berganti dengan
   gelombang "sisik ikan" dari pojok kiri atas. Tanpa petunjuk visual.
============================================================= */

const EGG_COLORS = ["var(--color-paper-card)", "#2F6FED", "#0E7C86", "#5B4BC4", "#1F8A5B"];
/** Lama gelombang (ms) — sedikit di atas jeda terjauh (≈890) + durasi satu sisik (600). */
const WAVE_MS = 1550;
/** Lama sisik memudar setelah warna dasar kartu diganti (ms) — inilah yang
 *  menghilangkan kesan "terpotong" di ujung animasi. */
const FADE_MS = 550;
const SCALE = 46;
const SCALE_COLS = 11;
const SCALE_ROWS = 26;

/** Lapisan sisik: lingkaran bertumpuk, baris selang-seling bergeser setengah,
 *  muncul berurutan menyapu diagonal dan menutupi warna lama. */
function FishScales({ color, fading }: { color: string; fading: boolean }) {
  const cells: React.ReactNode[] = [];

  for (let r = 0; r < SCALE_ROWS; r++) {
    for (let c = 0; c < SCALE_COLS; c++) {
      cells.push(
        <span
          key={`${r}-${c}`}
          className="egg-scale"
          style={{
            left: c * SCALE + (r % 2 ? SCALE / 2 : 0) - SCALE / 2,
            top: r * (SCALE / 2) - SCALE / 2,
            width: SCALE,
            height: SCALE,
            background: color,
            animationDelay: `${r * 30 + c * 14}ms`,
          }}
        />,
      );
    }
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity ease-out"
      style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      {cells}
    </div>
  );
}

export default function Features() {
  // Warna dasar tiap kartu (indeks ke EGG_COLORS) + gelombang yang sedang jalan.
  const reducedMotion = useReducedMotion();
  const [bases, setBases] = useState<number[]>([0, 0, 0, 0]);
  const [wave, setWave] = useState<{ card: number; to: number; fading: boolean } | null>(null);
  const animatingRef = useRef(false);
  const eggTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const downTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => () => clearTimeout(eggTimer.current), []);

  const triggerEgg = (card: number) => {
    // Pointerup dan klik asli bisa sama-sama sampai di sini — abaikan yang kedua.
    if (animatingRef.current) return;
    const to = (bases[card] + 1) % EGG_COLORS.length;

    if (reducedMotion) {
      setBases((b) => b.map((v, i) => (i === card ? to : v)));
      return;
    }

    animatingRef.current = true;
    setWave({ card, to, fading: false });

    // 1) gelombang selesai: warna dasar kartu diganti (sama dengan warna sisik,
    //    jadi tak terlihat berubah) dan lapisan sisik mulai memudar;
    // 2) setelah memudar, lapisan dilepas. Tanpa tahap pemudaran, tepi gelap
    //    tiap sisik lenyap sekaligus dan terlihat seperti terpotong.
    eggTimer.current = setTimeout(() => {
      setBases((b) => b.map((v, i) => (i === card ? to : v)));
      setWave((w) => (w ? { ...w, fading: true } : w));

      eggTimer.current = setTimeout(() => {
        setWave(null);
        animatingRef.current = false;
      }, FADE_MS);
    }, WAVE_MS);
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);


  // ============================
  // CAROUSEL ROTATION
  // ============================

  const rotationRef = useRef(0);
  const rotationTargetRef = useRef(0);

  // ============================
  // DRAG
  // ============================

  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartRotation = useRef(0);

  // ============================
  // CURSOR WOBBLE
  // ============================

  const wobbleTarget = useRef({
    x: 0,
    y: 0,
  });

  const wobbleCurrent = useRef({
    x: 0,
    y: 0,
  });

  const frontIndexRef = useRef(0);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    let raf = 0;

    // ========================================
    // APPLY 3D CARD TRANSFORMS
    // ========================================

    const applyTransforms = () => {
      const cards = cardRefs.current;
      const count = cards.length;

      if (!count) {
        raf = requestAnimationFrame(applyTransforms);
        return;
      }

      // Smooth rotation
      rotationRef.current = lerp(
        rotationRef.current,
        rotationTargetRef.current,
        0.12
      );

      // Smooth cursor wobble
      wobbleCurrent.current.x = lerp(
        wobbleCurrent.current.x,
        wobbleTarget.current.x,
        0.12
      );

      wobbleCurrent.current.y = lerp(
        wobbleCurrent.current.y,
        wobbleTarget.current.y,
        0.12
      );

      const vw = window.innerWidth;
      const mobile = vw < 640;

      // ========================================
      // CARD WIDTH / STAGE SPREAD
      // ========================================

      const radiusX = mobile
        ? Math.min(vw * 0.58, 230)
        : Math.min(vw * 0.26, 370);

      const radiusZ = mobile
        ? Math.min(vw * 0.24, 130)
        : Math.min(vw * 0.15, 200);

      const step = (Math.PI * 2) / count;

      // ========================================
      // FIND FRONT CARD
      // ========================================

      let frontIndex = 0;
      let frontDepth = -1;

      cards.forEach((card, index) => {
        if (!card) return;

        const angle =
          (index - rotationRef.current) * step;

        const cos = Math.cos(angle);
        const depth = (cos + 1) / 2;

        if (depth > frontDepth) {
          frontDepth = depth;
          frontIndex = index;
        }
      });

      frontIndexRef.current = frontIndex;

      // ========================================
      // POSITION EVERY CARD
      // ========================================

      cards.forEach((card, index) => {
        if (!card) return;

        const angle =
          (index - rotationRef.current) * step;

        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const x = sin * radiusX;

        const z =
          (cos - 1) * radiusZ;

        const depth =
          (cos + 1) / 2;

        const rotateY =
          sin * (mobile ? 22 : 32);

        const scale =
          0.74 +
          Math.pow(depth, 1.6) * 0.26;

        // ========================================
        // IMPORTANT:
        // CARD SELALU OPAQUE
        // ========================================

        const opacity = 1;

        const blur =
          depth < 0.3
            ? 2.2
            : depth < 0.6
              ? 0.8
              : 0;

        const y =
          depth > 0.7
            ? -(depth - 0.7) * 10
            : 0;

        const isFront =
          index === frontIndex;

        const wobbleRotX = isFront
          ? wobbleCurrent.current.y * -8
          : 0;

        const wobbleRotY = isFront
          ? wobbleCurrent.current.x * 8
          : 0;

        card.style.transform = `
          translate3d(
            ${x.toFixed(2)}px,
            ${y.toFixed(2)}px,
            ${z.toFixed(2)}px
          )
          rotateX(${wobbleRotX.toFixed(2)}deg)
          rotateY(
            ${(rotateY + wobbleRotY).toFixed(2)}deg
          )
          scale(${scale.toFixed(3)})
        `;

        // Card tidak pernah transparan
        card.style.opacity =
          opacity.toFixed(3);

        card.style.filter = blur
          ? `blur(${blur.toFixed(2)}px)`
          : "";

        card.style.zIndex =
          String(Math.round(depth * 1000));

        card.style.pointerEvents =
          depth > 0.72
            ? "auto"
            : "none";

        // ========================================
        // HOLOGRAM VARIABLES
        // ========================================

        card.style.setProperty(
          "--holo-strength",
          (
            0.35 +
            depth * 0.65
          ).toFixed(3)
        );

        card.style.setProperty(
          "--holo-shift",
          `${(sin * 55).toFixed(2)}%`
        );

        card.style.setProperty(
          "--content-shift",
          `${(sin * 14).toFixed(2)}px`
        );
      });

      raf = requestAnimationFrame(
        applyTransforms
      );
    };

    // ========================================
    // UPDATE CURSOR POSITION
    // ========================================

    const updateWobble = (
      clientX: number,
      clientY: number
    ) => {
      const rect =
        stage.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }

      wobbleTarget.current = {
        x: clamp(
          ((clientX - rect.left) /
            rect.width) *
            2 -
            1,
          -1,
          1
        ),

        y: clamp(
          ((clientY - rect.top) /
            rect.height) *
            2 -
            1,
          -1,
          1
        ),
      };

      // ========================================
      // HOLOGRAM LIGHT
      // ========================================

      const front =
        cardRefs.current[
          frontIndexRef.current
        ];

      if (!front) return;

      const rectCard =
        front.getBoundingClientRect();

      if (
        rectCard.width <= 0 ||
        rectCard.height <= 0
      ) {
        return;
      }

      front.style.setProperty(
        "--mouse-x",
        `${(
          ((clientX - rectCard.left) /
            rectCard.width) *
          100
        ).toFixed(2)}%`
      );

      front.style.setProperty(
        "--mouse-y",
        `${(
          ((clientY - rectCard.top) /
            rectCard.height) *
          100
        ).toFixed(2)}%`
      );
    };

    // ========================================
    // POINTER DOWN
    // ========================================

    const handlePointerDown = (
      e: PointerEvent
    ) => {
      dragging.current = true;

      downTargetRef.current = e.target;

      dragStartX.current =
        e.clientX;

      dragStartRotation.current =
        rotationTargetRef.current;

      stage.setPointerCapture(
        e.pointerId
      );

      stage.style.cursor =
        "grabbing";

      updateWobble(
        e.clientX,
        e.clientY
      );
    };

    // ========================================
    // POINTER MOVE
    // ========================================

    const handlePointerMove = (
      e: PointerEvent
    ) => {
      updateWobble(
        e.clientX,
        e.clientY
      );

      if (!dragging.current) {
        return;
      }

      const deltaX =
        e.clientX -
        dragStartX.current;

      const sensitivity = 180;

      rotationTargetRef.current =
        dragStartRotation.current -
        deltaX / sensitivity;
    };

    // ========================================
    // POINTER UP
    // ========================================

    const handlePointerUp = (
      e: PointerEvent
    ) => {
      dragging.current = false;

      try {
        stage.releasePointerCapture(
          e.pointerId
        );
      } catch {
        // Pointer capture sudah dilepas.
      }

      stage.style.cursor =
        "grab";

      const down = downTargetRef.current;
      downTargetRef.current = null;

      if (
        e.type === "pointerup" &&
        Math.abs(e.clientX - dragStartX.current) < 6 &&
        down instanceof Element
      ) {
        const egg = down.closest<HTMLElement>("[data-egg]");

        // .click() memanggil onClick React pada tombol angka.
        egg?.click();
      }
    };

    // ========================================
    // POINTER LEAVE
    // ========================================

    const handlePointerLeave = () => {
      if (dragging.current) {
        return;
      }

      wobbleTarget.current = {
        x: 0,
        y: 0,
      };

      cardRefs.current.forEach(
        (card) => {
          if (!card) return;

          card.style.removeProperty(
            "--mouse-x"
          );

          card.style.removeProperty(
            "--mouse-y"
          );
        }
      );
    };

    // ========================================
    // EVENT LISTENERS
    // ========================================

    stage.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    stage.addEventListener(
      "pointermove",
      handlePointerMove
    );

    stage.addEventListener(
      "pointerup",
      handlePointerUp
    );

    stage.addEventListener(
      "pointercancel",
      handlePointerUp
    );

    stage.addEventListener(
      "pointerleave",
      handlePointerLeave
    );

    stage.style.cursor =
      "grab";

    // ========================================
    // START ANIMATION
    // ========================================

    if (!reducedMotion) {
      raf =
        requestAnimationFrame(
          applyTransforms
        );
    } else {
      applyTransforms();
    }

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      stage.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      stage.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      stage.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      stage.removeEventListener(
        "pointercancel",
        handlePointerUp
      );

      stage.removeEventListener(
        "pointerleave",
        handlePointerLeave
      );

      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [reducedMotion]);

  return (
    <section
      id="features"
      className="
        overflow-x-clip
        bg-ivory
        py-28
      "
    >
      <div className="container-page">

        {/* ======================================
            HEADING
        ====================================== */}

        <div className="flex flex-col items-center text-center">

          <SectionTitle as="h1" title="Features" />

        </div>

        {/* ======================================
            CARD STAGE
        ====================================== */}

        <div className="relative mt-8">

          <div
            ref={stageRef}
            className="
              features-stage
              relative
              select-none
              touch-pan-y
            "
            style={{
              height:
                "min(620px, 75vh)",

              overflow:
                "visible",

              touchAction:
                "pan-y",
            }}
          >

            <div className="cards-stack">

              {STAGE_CARDS.map(
                (feat, index) => (

                  <div
                    key={feat.title}
                    ref={(el) => {
                      cardRefs.current[
                        index
                      ] = el;
                    }}
                    className="
                      feature-card
                      group
                      relative
                      overflow-hidden
                    "
                    style={{
                      width:
                        "clamp(280px, 68vw, 410px)",

                      maxWidth:
                        "410px",

                      /* Kotak solid, tanpa garis, bayangan, kaca, atau
                         lapisan holo - kesannya datang dari tipografi. */
                      backgroundColor:
                        EGG_COLORS[bases[index]],

                      borderRadius: 0,
                      opacity: 1,
                      border: "none",
                      outline: "none",
                      boxShadow: "none",
                      backdropFilter: "none",
                      WebkitBackdropFilter: "none",
                    }}
                  >

                    {wave?.card === index && (
                      <FishScales color={EGG_COLORS[wave.to]} fading={wave.fading} />
                    )}

                    <div
                      className="
                        feature-card__content
                        relative
                        z-10
                        flex
                        h-full
                        flex-col
                        justify-between
                        p-9
                        max-sm:p-6
                      "
                    >

                      {/* Angka besar — juga pemicu easter egg ganti warna kartu */}
                      <button
                        type="button"
                        data-egg={index}
                        onClick={() => triggerEgg(index)}
                        aria-label="Ganti warna kartu"
                        className="
                          cursor-pointer
                          select-none
                          self-start
                          text-left
                          text-white
                          focus-visible:outline-none
                        "
                        style={{
                          fontFamily:
                            "var(--font-sans)",

                          fontSize:
                            "clamp(4.5rem, 10vw, 7rem)",

                          fontWeight: 900,

                          lineHeight: 0.8,

                          letterSpacing:
                            "-0.08em",
                        }}
                      >
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </button>

                      <div>
                        {/* Judul: tiap kata satu baris */}
                        <h2
                          className="text-white"
                          style={{
                            fontFamily:
                              "var(--font-sans)",

                            fontSize:
                              "clamp(2.1rem, 4.2vw, 3.1rem)",

                            fontWeight: 800,

                            lineHeight: 0.98,

                            letterSpacing:
                              "-0.04em",
                          }}
                        >
                          {feat.title
                            .split(" ")
                            .map((word, w) => (
                              <span key={w} className="block">
                                {word}
                              </span>
                            ))}
                        </h2>

                        <p
                          className="
                            mt-5
                            max-w-[30ch]
                            text-[1.0625rem]
                            leading-[1.6]
                            text-white
                          "
                          style={{
                            fontFamily:
                              "var(--font-sans)",
                          }}
                        >
                          {feat.desc}
                        </p>
                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}