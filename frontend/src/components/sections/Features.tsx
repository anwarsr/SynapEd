"use client";

import { useEffect, useRef } from "react";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const STAGE_CARDS = [0, 1, 3, 4].map((i, idx) => ({
  number: String(idx + 1).padStart(2, "0"),
  label: ["Kurikulum", "Pembelajaran", "Praktik", "Aksesibilitas"][idx],
  title: features[i].title,
  desc: features[i].desc,
}));

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const track = trackRef.current;
    if (!track) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;

      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;

      const range = Math.max(rect.height - vh, 1);

      const progress = clamp(
        -rect.top / range,
        0,
        1,
      );

      const cards = cardRefs.current;
      const count = cards.length;

      if (!count) return;

      /*
       * Satu putaran penuh.
       *
       * Contoh:
       * 0     = card pertama di depan
       * 0.25  = card kedua mulai ke depan
       * 0.50  = card ketiga
       * 0.75  = card keempat
       * 1.00  = kembali ke card pertama
       */
      const rotationProgress = progress * count;

      const vw = window.innerWidth;
      const mobile = vw < 640;

      /*
       * Radius dibuat cukup besar agar card yang sedang
       * berpindah dapat terlihat sebentar di samping.
       */
      const radiusX = mobile
        ? Math.min(vw * 0.48, 190)
        : Math.min(vw * 0.31, 440);

      const radiusZ = mobile
        ? Math.min(vw * 0.22, 120)
        : Math.min(vw * 0.16, 220);

      const step = (Math.PI * 2) / count;

      cards.forEach((card, index) => {
        if (!card) return;

        const angle = (index - rotationProgress) * step;

        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        /*
         * X = gerakan kiri / kanan
         */
        const x = sin * radiusX;

        /*
         * Z = kedalaman.
         *
         * cos = 1  -> paling depan
         * cos = -1 -> paling belakang
         */
        const z = (cos - 1) * radiusZ;

        /*
         * Nilai depth:
         * 1 = depan
         * 0 = belakang
         */
        const depth = (cos + 1) / 2;

        /*
         * Card di sisi mendapatkan rotasi.
         * Card yang sudah di depan kembali menghadap viewer.
         */
        const rotateY = sin * (mobile ? 24 : 34);

        /*
         * Sedikit scale berdasarkan posisi.
         */
        const scale =
          0.82 +
          Math.pow(depth, 1.35) * 0.18;

        /*
         * Card belakang masih tetap terlihat.
         * Ini penting supaya saat scroll card tidak
         * langsung menghilang.
         */
        const opacity =
          0.16 +
          Math.pow(depth, 1.35) * 0.84;

        /*
         * Blur tipis pada card yang jauh.
         */
        const blur =
          depth < 0.25
            ? 1.8
            : depth < 0.55
              ? 0.7
              : 0;

        /*
         * Card depan mendapatkan sedikit lift.
         */
        const y =
          depth > 0.7
            ? -(depth - 0.7) * 10
            : 0;

        card.style.transform = `
          translate3d(
            ${x.toFixed(2)}px,
            ${y.toFixed(2)}px,
            ${z.toFixed(2)}px
          )
          rotateY(${rotateY.toFixed(2)}deg)
          scale(${scale.toFixed(3)})
        `;

        card.style.opacity = opacity.toFixed(3);

        card.style.filter = `
          blur(${blur.toFixed(2)}px)
        `;

        /*
         * Card paling depan selalu berada di atas.
         */
        card.style.zIndex = String(
          Math.round(depth * 1000),
        );

        /*
         * Hanya card depan yang menerima interaction.
         */
        card.style.pointerEvents =
          depth > 0.72
            ? "auto"
            : "none";

        /*
         * Custom properties untuk hologram.
         */
        card.style.setProperty(
          "--card-depth",
          depth.toFixed(3),
        );

        card.style.setProperty(
          "--card-angle",
          `${(sin * 100).toFixed(2)}%`,
        );

        card.style.setProperty(
          "--holo-strength",
          (
            0.35 +
            depth * 0.65
          ).toFixed(3),
        );

        card.style.setProperty(
          "--holo-shift",
          `${(sin * 55).toFixed(2)}%`,
        );
      });
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener(
      "scroll",
      onScroll,
      { passive: true },
    );

    window.addEventListener(
      "resize",
      onScroll,
    );

    return () => {
      window.removeEventListener(
        "scroll",
        onScroll,
      );

      window.removeEventListener(
        "resize",
        onScroll,
      );

      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [reducedMotion]);

  /*
   * Mouse hologram.
   */
  const handlePointerMove = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect =
      e.currentTarget.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left) / rect.width) * 100;

    const y =
      ((e.clientY - rect.top) / rect.height) * 100;

    e.currentTarget.style.setProperty(
      "--mouse-x",
      `${x}%`,
    );

    e.currentTarget.style.setProperty(
      "--mouse-y",
      `${y}%`,
    );
  };

  const handlePointerLeave = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    e.currentTarget.style.removeProperty(
      "--mouse-x",
    );

    e.currentTarget.style.removeProperty(
      "--mouse-y",
    );
  };

  return (
    <section
      ref={sectionRef}
      id="features"
      className="features-section"
    >
      {/* =========================
          HEADER
      ========================== */}
      <div className="container-page">
        <div className="features-heading">
          <h1
            className="rise-in text-blue-600"
            style={
              {
                fontFamily: "var(--font-inter)",
                fontSize:
                  "clamp(2.5rem, 6.5vw, 5.75rem)",
                fontWeight: 800,
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
                "--rise-delay": "170ms",
              } as React.CSSProperties
            }
          >
            Keunggulan
            <br />
            SynapEd
          </h1>

          <p className="features-heading__desc">
            Pembelajaran yang dirancang sistematis,
            mudah dipahami, dan relevan untuk
            kebutuhan belajar masa kini.
          </p>
        </div>
      </div>

      {/* =========================
          3D CARD TRACK
      ========================== */}
      <div
        ref={trackRef}
        className="features-track"
      >
        <div className="features-stage">
          <div className="cards-stack">
            {STAGE_CARDS.map((feat, index) => (
              <div
                key={feat.number}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className="feature-card"
                onMouseMove={
                  reducedMotion
                    ? undefined
                    : handlePointerMove
                }
                onMouseLeave={
                  reducedMotion
                    ? undefined
                    : handlePointerLeave
                }
              >
                {/* holographic foil */}
                <span
                  className="feature-card__foil"
                  aria-hidden="true"
                />

                {/* moving rainbow reflection */}
                <span
                  className="feature-card__rainbow"
                  aria-hidden="true"
                />

                {/* glossy reflection */}
                <span
                  className="feature-card__gloss"
                  aria-hidden="true"
                />

                {/* grain */}
                <span
                  className="feature-card__grain"
                  aria-hidden="true"
                />

                <div className="feature-card__content">
                  <div className="feature-card__top">
                    <span className="feature-card__number">
                      {feat.number}
                    </span>

                    <span className="feature-card__label">
                      {feat.label}
                    </span>
                  </div>

                  <div className="feature-card__middle">
                    <h2 className="feature-card__title">
                      {feat.title}
                    </h2>

                    <p className="feature-card__desc">
                      {feat.desc}
                    </p>
                  </div>

                  <div className="feature-card__bottom">
                    <span>
                      SynapEd
                    </span>

                    <span className="feature-card__arrow">
                      ↗
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}