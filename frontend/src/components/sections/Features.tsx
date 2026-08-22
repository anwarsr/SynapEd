"use client";

import { useEffect, useRef } from "react";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

const STAGE_CARDS = [0, 1, 3, 4].map((i) => ({
  title: features[i].title,
  desc: features[i].desc,
}));

export default function Features() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const reducedMotion = useReducedMotion();

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

      const radiusX = mobile
        ? Math.min(vw * 0.78, 300)
        : Math.min(vw * 0.34, 480);

      const radiusZ = mobile
        ? Math.min(vw * 0.3, 160)
        : Math.min(vw * 0.18, 240);

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

        const opacity =
          0.1 +
          Math.pow(depth, 1.6) * 0.9;

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
      /* Kartu di panggung sengaja ber-overflow visible supaya kedalaman 3D-nya
         tidak terpotong. Di layar sempit sebaran kipasnya (radiusX sampai
         300px dari pusat) melampaui viewport dan MELEBARKAN halaman — muncul
         gulir horizontal dan section lain jadi tampak bergeser.

         Diklip di section, bukan di panggung: batas section selebar layar,
         jadi potongannya jatuh persis di tepi dan tidak terlihat.

         clip, BUKAN hidden — hidden membentuk scroll container baru dan itu
         mematikan position: sticky milik .features-stage. */
      className="py-28 overflow-x-clip"
    >
      <div className="container-page">

        {/* ======================================
            HEADING
        ====================================== */}

        <div className="flex flex-col items-start text-left">

          <h1
            className="rise-in text-blue-600"
            style={{
              fontFamily:
                "var(--font-inter)",

              fontSize:
                "clamp(2.5rem, 6.5vw, 5.75rem)",

              fontWeight: 800,

              lineHeight: 1.03,

              letterSpacing:
                "-0.04em",

              "--rise-delay":
                "170ms",
            } as React.CSSProperties}
          >
            Keunggulan
            <br />
            SynapEd
          </h1>

          <p
            className="
              rise-in
              mt-8
              max-w-md
              text-justify
              text-base
              leading-relaxed
              text-ink-muted
              md:text-lg
            "
            style={{
              "--rise-delay":
                "260ms",
            } as React.CSSProperties}
          >
            Pembelajaran yang dirancang
            sistematis, mudah dipahami,
            dan relevan untuk kebutuhan
            belajar masa kini.
          </p>

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
                      border-none
                      outline-none
                      ring-0
                    "
                    style={{
                      border:
                        "none",

                      outline:
                        "none",

                      boxShadow:
                        "none",
                    }}
                  >

                    {/* =================================
                        FOIL
                    ================================= */}

                    <span
                      className="
                        feature-card__foil
                      "
                      aria-hidden="true"
                    />

                    {/* =================================
                        RAINBOW
                    ================================= */}

                    <span
                      className="
                        feature-card__rainbow
                      "
                      aria-hidden="true"
                    />

                    {/* =================================
                        GLOSS
                    ================================= */}

                    <span
                      className="
                        feature-card__gloss
                      "
                      aria-hidden="true"
                    />

                    {/* =================================
                        GRAIN
                    ================================= */}

                    <span
                      className="
                        feature-card__grain
                      "
                      aria-hidden="true"
                    />

                    {/* =================================
                        CONTENT
                    ================================= */}

                    <div
                      className="
                        feature-card__content
                        relative
                        z-10
                        flex
                        h-full
                        flex-col
                        justify-start
                        p-9
                        max-sm:p-6
                      "
                    >

                      <h2
                        className="
                          text-black
                        "
                        style={{
                          fontFamily:
                            "var(--font-inter)",

                          fontSize:
                            "clamp(1.75rem, 3.6vw, 2.75rem)",

                          fontWeight: 900,

                          lineHeight:
                            0.98,

                          letterSpacing:
                            "-0.025em",
                        }}
                      >
                        {feat.title}
                      </h2>

                      <p
                        className="
                          mt-4
                          max-w-[30ch]
                          text-[0.9375rem]
                          leading-relaxed
                          text-ink-muted
                        "
                        style={{
                          fontFamily:
                            "var(--font-inter)",
                        }}
                      >
                        {feat.desc}
                      </p>

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