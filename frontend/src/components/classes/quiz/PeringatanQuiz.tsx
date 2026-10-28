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
const LAMA_SIRENE_MS = 2000;

/** Kunci "sudah ditampilkan" per peringatan - muat ulang halaman tak mengulang sirene yang sama. */
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

/** Sirene 2 detik: dua nada bergantian (880/620 Hz) dengan gelombang gergaji, volume dijaga. */
function bunyikanSirene(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
  gain.gain.setValueAtTime(0.35, t0 + LAMA_SIRENE_MS / 1000 - 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + LAMA_SIRENE_MS / 1000);
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  for (let i = 0; i < 8; i++) osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 620, t0 + i * 0.25);
  osc.connect(gain);
  osc.start(t0);
  osc.stop(t0 + LAMA_SIRENE_MS / 1000);
}

/**
 * Peringatan layar penuh untuk siswa yang belum mengerjakan quiz. Memoll
 * /api/classes/quiz-alert selagi tab terlihat; ada peringatan baru → bilah
 * selebar layar berdenyut + sirene 2 detik. Peramban boleh menahan suara sebelum
 * pengguna menyentuh halaman: bila begitu, sirene dibunyikan pada sentuhan pertama
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
      bunyikanSirene(ctx);
      return true;
    } catch {
      return true; // tanpa suara pun peringatan visual tetap tampil
    }
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

  // Sirene saat peringatan muncul
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
        <p className="text-[12px] font-bold uppercase tracking-[0.5em] text-[#fff]/60">Peringatan dari pengajar</p>
        <h2 id="peringatan-quiz-judul" className="mt-6 text-[clamp(44px,11vw,150px)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#fff]">
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
