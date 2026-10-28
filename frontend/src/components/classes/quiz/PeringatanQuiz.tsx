"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

interface Peringatan {
  quizId: string;
  at: string;
  title: string;
}

const JEDA_POLL_MS = 8000;
const LAMA_ALARM_MS = 2000;

/** Kunci "sudah ditampilkan" per peringatan - muat ulang halaman tak mengulang alarm yang sama. */
const kunciLihat = (quizId: string) => `synaped_quiz_alert_${quizId}`;

function sudahDilihat(p: Peringatan): boolean {
  try {
    return window.localStorage.getItem(kunciLihat(p.quizId)) === p.at;
  } catch {
    return false;
  }
}

function tandaiDilihat(p: Peringatan) {
  try {
    window.localStorage.setItem(kunciLihat(p.quizId), p.at);
  } catch {
    /* penyimpanan diblokir: paling buruk peringatan tampil lagi saat muat ulang */
  }
}

/**
 * Alarm 2 detik: beep persegi keras 1000/1400 Hz bergantian, 8 denyut (250 ms) seperti alarm
 * kebakaran. Tiap denyut punya tepi naik-turun singkat supaya tak berdetak di speaker.
 */
function bunyikanAlarm(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = "square";
  const kunci = ctx.createGain();
  kunci.gain.setValueAtTime(0, t0);
  const denyut = 0.25;
  for (let i = 0; i < LAMA_ALARM_MS / 1000 / denyut; i++) {
    const t = t0 + i * denyut;
    osc.frequency.setValueAtTime(i % 2 === 0 ? 1000 : 1400, t);
    kunci.gain.setValueAtTime(0, t);
    kunci.gain.linearRampToValueAtTime(1, t + 0.01);
    kunci.gain.setValueAtTime(1, t + denyut * 0.8);
    kunci.gain.linearRampToValueAtTime(0, t + denyut * 0.8 + 0.01);
  }
  osc.connect(kunci);
  kunci.connect(master);
  osc.start(t0);
  osc.stop(t0 + LAMA_ALARM_MS / 1000);
  try {
    navigator.vibrate?.([250, 100, 250, 100, 250, 100, 250]);
  } catch {
    /* perangkat tanpa getar */
  }
}

/**
 * Peringatan layar penuh untuk siswa yang belum mengerjakan quiz. Memoll
 * /api/classes/quiz-alert selagi tab terlihat; ada peringatan baru → bilah
 * selebar layar berdenyut + alarm 2 detik. Peramban boleh menahan suara sebelum
 * pengguna menyentuh halaman: bila begitu, alarm dibunyikan pada sentuhan pertama
 * di atas peringatan (selama layarnya masih ada).
 */
export default function PeringatanQuiz({ classId, basePath }: { classId: string; basePath: string }) {
  const [aktif, setAktif] = useState<Peringatan | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sudahBunyiRef = useRef(false);

  const coba = useCallback(async (): Promise<boolean> => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return true;
      const ctx = (ctxRef.current ??= new Ctor());
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") return false;
      bunyikanAlarm(ctx);
      return true;
    } catch {
      return true; // tanpa suara pun peringatan visual tetap tampil
    }
  }, []);

  // Peramban menahan suara sampai ada gestur: buka konteks audio pada sentuhan pertama di halaman,
  // supaya alarm dari peringatan yang datang sendiri nanti langsung berbunyi.
  useEffect(() => {
    const buka = () => {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = (ctxRef.current ??= new Ctor());
        if (ctx.state === "suspended") void ctx.resume();
      } catch {
        /* tanpa audio */
      }
    };
    window.addEventListener("pointerdown", buka, { once: true });
    window.addEventListener("keydown", buka, { once: true });
    return () => {
      window.removeEventListener("pointerdown", buka);
      window.removeEventListener("keydown", buka);
    };
  }, []);

  // Poll
  useEffect(() => {
    let batal = false;
    async function periksa() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/classes/quiz-alert?class=${encodeURIComponent(classId)}`, { cache: "no-store" });
        if (!res.ok || batal) return;
        const data = (await res.json()) as { alert: Peringatan | null };
        if (data.alert && !sudahDilihat(data.alert)) {
          tandaiDilihat(data.alert);
          sudahBunyiRef.current = false;
          setAktif(data.alert);
        }
      } catch {
        /* jaringan putus: coba lagi di putaran berikutnya */
      }
    }
    void periksa();
    const id = setInterval(periksa, JEDA_POLL_MS);
    document.addEventListener("visibilitychange", periksa);
    return () => {
      batal = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", periksa);
    };
  }, [classId]);

  // Alarm saat peringatan muncul
  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    void coba().then((ok) => {
      if (!batal && ok) sudahBunyiRef.current = true;
    });
    return () => {
      batal = true;
    };
  }, [aktif, coba]);

  // Esc menutup
  useEffect(() => {
    if (!aktif) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAktif(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktif]);

  if (!aktif) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="peringatan-quiz-judul"
      className="keep-white fixed inset-0 z-[300] flex flex-col justify-between overflow-hidden bg-[#050505]/95 backdrop-blur-sm"
      onPointerDown={() => {
        if (!sudahBunyiRef.current) void coba().then((ok) => (sudahBunyiRef.current = ok));
      }}
    >
      <div className="peringatan-bilah h-4 w-full bg-rust-700 sm:h-6" aria-hidden="true" />

      <div className="container-page flex flex-1 flex-col items-center justify-center text-center">
        <h2 id="peringatan-quiz-judul" className="text-[clamp(44px,11vw,150px)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#fff]">
          Ayo kerjakan
          <br />
          quiz sekarang
        </h2>
        <p className="mt-8 max-w-[52ch] text-[clamp(15px,1.6vw,20px)] leading-[1.7] text-[#fff]/75">
          Kamu belum mengerjakan <strong className="font-semibold text-[#fff]">{aktif.title}</strong>. Pengajar menunggu jawabanmu.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${basePath}/quiz/${aktif.quizId}`}
            onClick={() => setAktif(null)}
            className="bg-blue-600 px-10 py-4 text-[15px] font-semibold tracking-[0.04em] text-[#fff] transition-colors hover:bg-blue-700"
          >
            Kerjakan sekarang
          </Link>
          <button
            type="button"
            onClick={() => setAktif(null)}
            className="bg-[#fff]/10 px-8 py-4 text-[15px] font-semibold tracking-[0.04em] text-[#fff] transition-colors hover:bg-[#fff]/20"
          >
            Nanti
          </button>
        </div>
      </div>

      <div className="peringatan-bilah h-4 w-full bg-rust-700 sm:h-6" aria-hidden="true" />
    </div>,
    document.body,
  );
}
