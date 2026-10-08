"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const STEPS = ["Materi", "Kursus", "Latihan", "Penilaian", "Sertifikat"] as const;

/** Lama animasi intro dan lama layar terangkat keluar (ms) — selaras dengan
 *  --intro-duration / --intro-exit di globals.css. */
const INTRO_MS = 2800;
const EXIT_MS = 680;
/** Jeda menikmati tampilan akhir (logo + tagline) sebelum layar terangkat. */
const HOLD_MS = 700;
// Kunci baru: kunci lama sempat terisi oleh versi yang bermasalah.
const SEEN_KEY = "synaped_intro_seen_v2";

/**
 * Layar pembuka — tampil sekali per sesi tab, saat website pertama dibuka.
 * Alurnya meniru intro nomu.store (lihat `.intro-*` di globals.css).
 *
 * Dirender terlihat sejak HTML server. Penanda "sudah tampil" baru ditulis
 * SETELAH animasi selesai: di mode dev React menjalankan efek dua kali, dan
 * penanda yang ditulis di awal membuat putaran kedua mengira intro sudah
 * pernah tampil lalu membuangnya — itulah sebabnya dulu intro tidak muncul.
 */
export default function SplashLoader() {
  const [phase, setPhase] = useState<"wait" | "play" | "leave" | "gone">("wait");

  useEffect(() => {
    let skip = false;
    try {
      skip =
        sessionStorage.getItem(SEEN_KEY) === "1" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // Penyimpanan diblokir: tampilkan saja.
    }

    if (skip) {
      const t = setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(t);
    }

    const root = document.documentElement;
    root.style.overflow = "hidden";
    // Animasi CSS ditahan (paused) sampai hidrasi selesai, lalu diputar dari
    // awal bersamaan dengan timer ini. Kalau dibiarkan jalan sejak HTML
    // dicat, di dev (hidrasi lambat) layar terangkat di tengah animasi dan
    // yang terlihat cuma kata pertama.
    const play = setTimeout(() => setPhase("play"), 0);
    const leave = setTimeout(() => setPhase("leave"), INTRO_MS + HOLD_MS);
    const gone = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // abaikan
      }
      root.style.overflow = "";
      setPhase("gone");
    }, INTRO_MS + HOLD_MS + EXIT_MS);

    return () => {
      clearTimeout(play);
      clearTimeout(leave);
      clearTimeout(gone);
      root.style.overflow = "";
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className="intro-loader"
      data-started={phase !== "wait"}
      data-leaving={phase === "leave"}
      style={{ "--intro-duration": `${INTRO_MS}ms`, "--intro-exit": `${EXIT_MS}ms` } as React.CSSProperties}
    >
      <div className="intro-rise" />
      <div className="intro-grid" />

      <div className="intro-stage">
        <div className="intro-word-window">
          <span className="intro-word intro-word-a">
            TAHU<span>.</span>
          </span>
          <span className="intro-word intro-word-b">
            BISA<span>.</span>
          </span>
        </div>

        <div className="intro-brand">
          <Image
            src="/images/logotext.png"
            alt=""
            width={667}
            height={667}
            className="intro-logo"
            priority
          />
          <span className="intro-tagline">
            <span>Dari tahu,</span>
            <span>menjadi bisa.</span>
          </span>
        </div>

        <span className="intro-corner intro-corner-tl" />
        <span className="intro-corner intro-corner-tr" />
        <span className="intro-corner intro-corner-bl" />
        <span className="intro-corner intro-corner-br" />
      </div>

      <div className="intro-pipeline">
        {STEPS.map((label, i) => (
          <div key={label} style={{ "--step": i } as React.CSSProperties}>
            <div className="intro-rail">
              <span />
            </div>
            <div className="intro-step">
              <span>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
