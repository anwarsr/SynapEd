"use client";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";

const WORDS = ["Terverifikasi.", "Berkualitas.", "Praktis.", "Fleksibel."];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Empat dari enam fitur, dipilih agar terasa seperti satu narasi
 *  (kurikulum → belajar → praktik → akses) saat dibaca satu-per-satu
 *  di kartu bertumpuk — bukan sekadar daftar. */
const STAGE_CARDS = [0, 1, 3, 4].map((i, idx) => ({
  number: String(idx + 1).padStart(2, "0"),
  label: ["Kurikulum", "Pembelajaran", "Praktik", "Aksesibilitas"][idx],
  title: features[i].title,
  desc: features[i].desc,
}));

export default function Features() {
  const [typedText, setTypedText] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Kartu disusun pada satu LINGKARAN 3D (komidi putar) dan diputar penuh
    // 360° sepanjang scroll: kartu aktif berada di titik terdepan lingkaran,
    // sisanya terus mengorbit ke samping lalu ke BELAKANG kartu aktif —
    // makin ke belakang makin kecil (dimakan perspective) dan makin samar,
    // jadi terbaca sebagai satu putaran melingkar yang utuh, bukan kartu
    // yang saling lewat mendatar. Radiusnya sengaja kecil supaya orbitnya
    // rapat dan kartu belakang tetap membayang di balik kartu depan.
    // Semua dihitung ulang lewat ref DOM langsung (bukan setState) dan
    // di-drive event scroll + rAF, supaya scroll tetap 60fps.
    if (reducedMotion) return;

    const track = trackRef.current;
    if (!track) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const range = rect.height - vh;
      const progress = range > 0 ? clamp(-rect.top / range, 0, 1) : 0;

      const cards = cardRefs.current;
      const n = cards.length;
      // progress * n (bukan n-1) supaya lingkarannya menutup penuh 360°:
      // di ujung scroll kartu pertama kembali persis ke titik terdepan.
      const activeFloat = progress * n;
      const vw = window.innerWidth;
      const mobile = vw < 640;

      // Radius orbit — kecil supaya putarannya rapat dan kartu belakang
      // tetap membayang di balik kartu depan, bukan terlempar ke tepi layar.
      const radius = mobile ? Math.min(vw * 0.4, 180) : Math.min(vw * 0.26, 360);
      const tilt = mobile ? 20 : 32;
      const lag = mobile ? 8 : 16;
      const step = (2 * Math.PI) / n;

      cards.forEach((card, i) => {
        if (!card) return;

        // Sudut posisi kartu pada lingkaran. Trigonometri sudah periodik,
        // jadi tidak perlu dinormalkan saat activeFloat melewati n.
        const angle = (i - activeFloat) * step;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Lingkaran di bidang XZ: titik terdepan (cos = 1) adalah kartu
        // aktif, dan z digeser -radius supaya kartu aktif duduk di z = 0.
        const offsetX = sin * radius;
        const depth = (cos - 1) * radius;
        const front = (cos + 1) / 2; // 1 = paling depan, 0 = tepat di belakang

        // Miring maksimum saat kartu di sisi, tegak menghadap penonton saat
        // di depan maupun di belakang — supaya teksnya tak pernah terbalik.
        const rotateY = sin * tilt;

        card.style.transform = `translate3d(${offsetX.toFixed(1)}px, 0px, ${depth.toFixed(1)}px) rotateY(${rotateY.toFixed(2)}deg)`;
        card.style.opacity = (0.12 + 0.88 * Math.pow(front, 1.8)).toFixed(3);
        card.style.zIndex = String(Math.round(front * 100));
        card.style.pointerEvents = front > 0.85 ? "auto" : "none";
        card.style.setProperty("--content-shift", `${(sin * lag).toFixed(1)}px`);
        card.style.setProperty("--glare-shift", `${(sin * 70).toFixed(1)}%`);
        card.style.setProperty("--holo-strength", `${(0.45 + (1 - front) * 0.35).toFixed(2)}`);
      });
    };

    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  useEffect(() => {
    // Saat reduced-motion aktif, kata ditampilkan statis di bawah —
    // tidak ada timer maupun observer yang dipasang.
    if (reducedMotion) return;

    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const type = () => {
      const current = WORDS[wordIndex];
      if (isDeleting) {
        setTypedText(current.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          wordIndex = (wordIndex + 1) % WORDS.length;
        }
        timeoutId = setTimeout(type, 65);
      } else {
        setTypedText(current.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === current.length) {
          isDeleting = true;
          timeoutId = setTimeout(type, 2600);
        } else {
          timeoutId = setTimeout(type, 130);
        }
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          type();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [reducedMotion]);

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--holo-px", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--holo-py", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  const handlePointerLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty("--holo-px");
    e.currentTarget.style.removeProperty("--holo-py");
  };

  return (
    <section ref={sectionRef} id="features" className="py-28">
      <div className="container-page">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <p className="chapter-mark mb-5">
            <span>§04</span>
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Keunggulan</span>
          </p>

          <h2 className="t-h2 max-w-3xl">Kenapa harus SynapEd?</h2>

          <p className="t-h2 text-blue-700 mt-2 min-h-[1.2em]" aria-live="polite">
            {reducedMotion ? WORDS[0] : typedText}
            {!reducedMotion && (
              <span
                className="inline-block w-[2px] h-[0.85em] align-middle bg-blue-500 ml-1 animate-pulse"
                aria-hidden="true"
              />
            )}
          </p>

          <span className="rule-accent mt-6 mx-auto" aria-hidden="true" />

          <p className="t-body mt-6 max-w-2xl text-ink-muted">
            SynapEd menghadirkan pembelajaran dari berbagai bidang ilmu secara sistematis. Materi
            dirancang agar mudah dipahami oleh pelajar dan pemula tanpa memerlukan latar belakang khusus.
          </p>
        </Reveal>
      </div>

      <div ref={trackRef} className="features-track">
        <div className="features-stage">
          <div className="cards-stack">
            {STAGE_CARDS.map((feat, i) => (
              <div
                key={feat.number}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="feature-card"
                onMouseMove={reducedMotion ? undefined : handlePointerMove}
                onMouseLeave={reducedMotion ? undefined : handlePointerLeave}
              >
                <span className="feature-card__holo" aria-hidden="true" />
                <span className="feature-card__glare" aria-hidden="true" />
                <div className="feature-card__content">
                  <span className="feature-card__number">{feat.number}</span>

                  <div>
                    <p className="feature-card__label">{feat.label}</p>
                    <h3 className="feature-card__title">{feat.title}</h3>
                  </div>

                  <p className="feature-card__desc">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
