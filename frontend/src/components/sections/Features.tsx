"use client";

import { useEffect, useRef } from "react";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const STAGE_CARDS = [0, 1, 3, 4].map((i) => ({
  title: features[i].title,
  desc: features[i].desc,
}));

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  // Target goyangan (dari posisi kursor) & nilai yang di-ease tiap frame —
  // supaya kartu paling depan "bergoyang" halus mengikuti kursor, bukan
  // melompat instan ke posisi kursor.
  const wobbleTarget = useRef({ x: 0, y: 0 });
  const wobbleCurrent = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);
  const frontIndexRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;

    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;

    let scrollRaf = 0;
    let wobbleRaf = 0;

    const applyTransforms = () => {
      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const range = Math.max(rect.height - vh, 1);
      const progress = clamp(-rect.top / range, 0, 1);

      const cards = cardRefs.current;
      const count = cards.length;
      if (!count) return;

      const rotationProgress = progress * count;
      const vw = window.innerWidth;
      const mobile = vw < 640;

      // Radius diperbesar & kartu diperkecil dibanding versi sebelumnya —
      // supaya kartu di posisi samping punya cukup jarak dan tidak lagi
      // bertabrakan/bertumpuk dengan kartu depan di tengah putaran.
      const radiusX = mobile ? Math.min(vw * 0.78, 300) : Math.min(vw * 0.34, 480);
      const radiusZ = mobile ? Math.min(vw * 0.3, 160) : Math.min(vw * 0.18, 240);
      const step = (Math.PI * 2) / count;

      let frontIndex = 0;
      let frontDepth = -1;

      cards.forEach((card, index) => {
        if (!card) return;
        const angle = (index - rotationProgress) * step;
        const depth = (Math.cos(angle) + 1) / 2;
        if (depth > frontDepth) {
          frontDepth = depth;
          frontIndex = index;
        }
      });
      frontIndexRef.current = frontIndex;

      cards.forEach((card, index) => {
        if (!card) return;

        const angle = (index - rotationProgress) * step;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const x = sin * radiusX;
        const z = (cos - 1) * radiusZ;
        const depth = (cos + 1) / 2;
        const rotateY = sin * (mobile ? 22 : 32);
        // Kurva lebih curam (pow 1.6, skala/opacity minimum lebih rendah)
        // supaya kartu yang belum di depan jelas "mundur" — bukan cuma
        // sedikit lebih kecil — jadi tidak terbaca sebagai tabrakan.
        const scale = 0.74 + Math.pow(depth, 1.6) * 0.26;
        const opacity = 0.1 + Math.pow(depth, 1.6) * 0.9;
        const blur = depth < 0.3 ? 2.2 : depth < 0.6 ? 0.8 : 0;
        const y = depth > 0.7 ? -(depth - 0.7) * 10 : 0;

        const isFront = index === frontIndex;
        const wobbleRotX = isFront ? wobbleCurrent.current.y * -8 : 0;
        const wobbleRotY = isFront ? wobbleCurrent.current.x * 8 : 0;

        card.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${wobbleRotX.toFixed(2)}deg) rotateY(${(rotateY + wobbleRotY).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur ? `blur(${blur.toFixed(2)}px)` : "";
        card.style.zIndex = String(Math.round(depth * 1000));
        card.style.pointerEvents = depth > 0.72 ? "auto" : "none";
        card.style.setProperty("--holo-strength", (0.35 + depth * 0.65).toFixed(3));
        card.style.setProperty("--holo-shift", `${(sin * 55).toFixed(2)}%`);
        card.style.setProperty("--content-shift", `${(sin * 14).toFixed(2)}px`);
      });
    };

    const onScroll = () => {
      if (!scrollRaf) {
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          applyTransforms();
        });
      }
    };

    // Loop goyangan: hanya berjalan selagi kursor ada di atas panggung,
    // atau selagi nilainya masih mengeja balik menuju 0 — bukan loop
    // rAF permanen yang jalan terus tanpa alasan.
    const easeWobble = () => {
      wobbleCurrent.current.x = lerp(wobbleCurrent.current.x, wobbleTarget.current.x, 0.12);
      wobbleCurrent.current.y = lerp(wobbleCurrent.current.y, wobbleTarget.current.y, 0.12);
      applyTransforms();

      const settled =
        Math.abs(wobbleCurrent.current.x - wobbleTarget.current.x) < 0.001 &&
        Math.abs(wobbleCurrent.current.y - wobbleTarget.current.y) < 0.001;

      if (hovering.current || !settled) {
        wobbleRaf = requestAnimationFrame(easeWobble);
      } else {
        wobbleRaf = 0;
      }
    };

    const handleMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      wobbleTarget.current = {
        x: clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
        y: clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
      };
      hovering.current = true;
      if (!wobbleRaf) wobbleRaf = requestAnimationFrame(easeWobble);

      // Titik terang mengikuti kursor hanya pada kartu yang sedang di
      // depan — kartu di belakang tidak menerima pointer event sama sekali.
      const front = cardRefs.current[frontIndexRef.current];
      if (front) {
        const fr = front.getBoundingClientRect();
        front.style.setProperty("--mouse-x", `${((e.clientX - fr.left) / fr.width) * 100}%`);
        front.style.setProperty("--mouse-y", `${((e.clientY - fr.top) / fr.height) * 100}%`);
      }
    };

    const handleLeave = () => {
      hovering.current = false;
      wobbleTarget.current = { x: 0, y: 0 };
      if (!wobbleRaf) wobbleRaf = requestAnimationFrame(easeWobble);
      cardRefs.current.forEach((card) => {
        card?.style.removeProperty("--mouse-x");
        card?.style.removeProperty("--mouse-y");
      });
    };

    applyTransforms();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    stage.addEventListener("mousemove", handleMove);
    stage.addEventListener("mouseleave", handleLeave);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      stage.removeEventListener("mousemove", handleMove);
      stage.removeEventListener("mouseleave", handleLeave);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      if (wobbleRaf) cancelAnimationFrame(wobbleRaf);
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="features" className="py-28">
      <div className="container-page">
        {/* Judul + subjudul di kanan atas, dengan jarak yang lega di
            antara keduanya. */}
        <div className="flex flex-col items-end text-right">
          <h1
            className="rise-in text-blue-600"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
              "--rise-delay": "170ms",
            } as React.CSSProperties}
          >
            Keunggulan
            <br />
            SynapEd
          </h1>

          <p
            className="rise-in mt-8 max-w-md text-base leading-relaxed text-ink-muted md:text-lg"
            style={{ "--rise-delay": "260ms" } as React.CSSProperties}
          >
            Pembelajaran yang dirancang sistematis, mudah dipahami, dan relevan untuk kebutuhan
            belajar masa kini.
          </p>
        </div>
      </div>

      {/* Panggung kartu — tetap di tengah layar meski judul di atas
          bergeser ke kanan; jaraknya ke judul sengaja dipepetkan. */}
      <div ref={trackRef} className="features-track relative mt-8">
        <div ref={stageRef} className="features-stage">
          <div className="cards-stack">
            {STAGE_CARDS.map((feat, index) => (
              <div
                key={feat.title}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className="feature-card"
              >
                <span className="feature-card__foil" aria-hidden="true" />
                <span className="feature-card__rainbow" aria-hidden="true" />
                <span className="feature-card__gloss" aria-hidden="true" />
                <span className="feature-card__grain" aria-hidden="true" />

                <div className="feature-card__content relative z-10 flex h-full flex-col justify-start p-9 max-sm:p-6">
                  <h2
                    className="text-blue-600"
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "clamp(1.75rem, 3.6vw, 2.75rem)",
                      fontWeight: 900,
                      lineHeight: 0.98,
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {feat.title}
                  </h2>

                  <p
                    className="mt-4 max-w-[30ch] text-[0.9375rem] leading-relaxed text-ink-muted"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
