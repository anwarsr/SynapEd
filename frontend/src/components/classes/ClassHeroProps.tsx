"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Benda melayang di hero /kelas, mengikuti kursor.
 *
 * Meniru mekanisme Hero.tsx: posisi kursor dinormalkan ke -1..1 terhadap pusat
 * hero, lalu dikalikan pengali kedalaman yang berbeda per benda — itulah yang
 * memberi kesan lapisan, bukan gambar yang bergeser bersama.
 *
 * Dimatikan di bawah 900px lewat `hidden lg:block` pada pembungkusnya: di layar
 * sempit benda-benda ini menutupi judulnya. Gerakannya juga dimatikan saat
 * prefers-reduced-motion — animate-float-bob-* sudah diurus globals.css, tapi
 * transform yang mengikuti kursor harus dihentikan di sini.
 */

interface Benda {
  src: string;
  posisi: string;
  lebar: string;
  bob: string;
  /** Pengali kedalaman: makin besar, makin "dekat" ke pembaca. */
  dx: number;
  dy: number;
  /** Rotasi dasar, ditambah mouse.x * putar. */
  miring: number;
  putar: number;
  /** Jeda masuk, supaya benda tidak muncul serentak. */
  jeda: number;
}

const BENDA: readonly Benda[] = [
  {
    src: "/images/book.png",
    jeda: 240,
    posisi: "left-[12%] top-[30%]",
    lebar: "w-[clamp(80px,9vw,140px)]",
    bob: "animate-float-bob-left",
    dx: 24,
    dy: 15,
    miring: -8,
    putar: 6,
  },
  {
    src: "/images/ruler.png",
    jeda: 340,
    posisi: "right-[7%] top-[22%]",
    lebar: "w-[clamp(92px,11vw,168px)]",
    bob: "animate-float-bob-right",
    dx: 32,
    dy: 19,
    miring: 12,
    putar: 6,
  },
  {
    src: "/images/bottle.png",
    jeda: 440,
    posisi: "right-[21%] top-[64%]",
    lebar: "w-[clamp(68px,7.5vw,118px)]",
    bob: "animate-float-bob-left",
    dx: 40,
    dy: 24,
    miring: -10,
    putar: 6,
  },
];

export default function ClassHeroProps({ heroId }: { heroId: string }) {
  const reduced = useReducedMotion();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) return;

    const hero = document.getElementById(heroId);
    if (!hero) return;

    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      setMouse({
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      });
    };

    const onLeave = () => setMouse({ x: 0, y: 0 });

    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", onLeave);
    return () => {
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
    };
  }, [heroId, reduced]);

  return (
    <div aria-hidden="true" className="pointer-events-none select-none hidden lg:block">
      {BENDA.map((b) => (
        // Tiga lapis, masing-masing satu tugas. Menumpuknya di satu elemen
        // tidak bisa: .rise-in berakhir dengan `transform: none` dan
        // animation-fill-mode forwards, jadi ia MENIMPA transform sebaris —
        // parallax-nya diam selamanya tanpa satu pun galat.
        <div
          key={b.src}
          className={`absolute ${b.posisi} rise-in`}
          style={{ "--rise-delay": `${b.jeda}ms` } as React.CSSProperties}
        >
          <div
            style={{
              transform: `translate(${mouse.x * b.dx}px, ${mouse.y * b.dy}px) rotate(${mouse.x * b.putar + b.miring}deg)`,
              transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className={b.bob}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt="" className={`${b.lebar} h-auto drop-shadow-2xl`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
