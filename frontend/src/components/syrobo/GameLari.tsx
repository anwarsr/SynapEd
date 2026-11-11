"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import PanelSuara from "./PanelSuara";
import { koinLari, latarLari, rintanganLari, robotLari } from "./lariGambar";
import { SuaraGame, bacaPengaturan, simpanPengaturan, type PengaturanSuara } from "./suaraGame";
import {
  DASH_JEDA,
  H,
  PX,
  SKOR_PER_BINTANG,
  TANAH,
  W,
  duniaLariBaru,
  langkahLari,
  skorBulat,
  type DuniaLari,
} from "@/lib/syrobo/game/lariFisika";

/**
 * Game "Lari Robo" (endless runner): robot berlari makin cepat, melewati rintangan tanpa henti. Tiap 100 skor = 1 poin bintang
 * (skor disetor jadi koin game 1:1 lewat `onSetor`; 100 koin = 1 bintang di Toko, jatah harian sama dengan game lain). Fisika di
 * `lariFisika.ts` (murni, diuji); berkas ini hanya menggambar (kanvas 2D bergaya stiker) dan membaca kendali:
 *  - Desktop: Spasi / W / ↑ loncat (tahan = lebih tinggi), Shift dash (kebal sesaat, menghancurkan rintangan), Ctrl / ↓ menunduk.
 *  - Ponsel: tombol LONCAT (kanan), TUNDUK dan DASH (kiri), dipakai dengan multi-sentuh.
 */

const INK = "#2B2233";
const KUNCI_REKOR = "synaped_syrobo_lari_rekor";
const DT = 1 / 120;
const KEY_LONCAT = new Set([" ", "Spacebar", "ArrowUp"]);
const KEY_TUNDUK = new Set(["Control", "ArrowDown"]);
const KEY_DASH = new Set(["Shift"]);

function bacaRekor(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_REKOR));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

type Fase = "siap" | "main" | "jeda" | "selesai";
interface Hud {
  skor: number;
  rekor: number;
  rekorBaru: boolean;
  fase: Fase;
  koin: number;
  /** Isi ulang dash 0..1 (1 = siap). */
  dash: number;
}
interface Serpih {
  x: number;
  y: number;
  vx: number;
  vy: number;
  umur: number;
  maks: number;
  r: number;
  warna: string;
}

// ───────────────────────── komponen ─────────────────────────
export default function GameLari({ onKeluar, onSetor }: { onKeluar: () => void; onSetor?: (koin: number) => void }) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const dunia = useRef<DuniaLari>(duniaLariBaru());
  const fase = useRef<Fase>("siap");
  const rekor = useRef(0);
  const kendali = useRef({ loncatKey: false, loncatTombol: false, tundukKey: false, tundukTombol: false, dashKey: false, dashTombol: false });
  const serpih = useRef<Serpih[]>([]);
  const suara = useRef<SuaraGame | null>(null);
  const disetor = useRef<DuniaLari | null>(null);
  const setorRef = useRef<() => void>(() => undefined);
  const ulangRef = useRef<() => void>(() => undefined);
  const jedaRef = useRef<() => void>(() => undefined);
  const ubahMusik = useRef<() => void>(() => undefined);
  const ubahEfek = useRef<() => void>(() => undefined);
  const bintangPopup = useRef(0);

  const [hud, setHud] = useState<Hud>({ skor: 0, rekor: 0, rekorBaru: false, fase: "siap", koin: 0, dash: 1 });
  const [peng, setPeng] = useState<PengaturanSuara>(() => bacaPengaturan());
  const [potret, setPotret] = useState(false);
  const [tombolOn, setTombolOn] = useState({ loncat: false, tunduk: false, dash: false });

  const setFase = useCallback((f: Fase) => {
    fase.current = f;
    setHud((h) => ({ ...h, fase: f }));
  }, []);

  /** Skor run ini disetor jadi koin game SEKALI (selesai, ulang, atau keluar): 100 skor = 100 koin = 1 bintang. */
  const setor = useCallback(() => {
    const d = dunia.current;
    if (disetor.current === d) return;
    disetor.current = d;
    setorRef.current();
  }, []);

  const setorSkor = useRef(onSetor);
  useEffect(() => {
    setorSkor.current = onSetor;
    setorRef.current = () => {
      const k = skorBulat(dunia.current);
      if (k > 0) setorSkor.current?.(k);
    };
  }, [onSetor]);

  const ulang = useCallback(() => {
    setor();
    dunia.current = duniaLariBaru();
    serpih.current = [];
    bintangPopup.current = 0;
    fase.current = "siap";
    setHud({ skor: 0, rekor: rekor.current, rekorBaru: false, fase: "siap", koin: 0, dash: 1 });
  }, [setor]);

  useEffect(() => {
    ulangRef.current = ulang;
    jedaRef.current = () => {
      if (fase.current === "main") setFase("jeda");
      else if (fase.current === "jeda") setFase("main");
    };
  }, [ulang, setFase]);

  const pasangMusik = useCallback((b: boolean) => {
    suara.current?.setMusik(b);
    setPeng((p) => {
      const n = { ...p, musik: b };
      simpanPengaturan(n);
      return n;
    });
  }, []);
  const pasangEfek = useCallback((b: boolean) => {
    suara.current?.setEfek(b);
    setPeng((p) => {
      const n = { ...p, efek: b };
      simpanPengaturan(n);
      return n;
    });
  }, []);
  useEffect(() => {
    ubahMusik.current = () => pasangMusik(!(suara.current?.pengaturan.musik ?? true));
    ubahEfek.current = () => pasangEfek(!(suara.current?.pengaturan.efek ?? true));
  }, [pasangMusik, pasangEfek]);

  // Rekor, layar penuh & kunci orientasi (upaya terbaik), deteksi layar tegak.
  useEffect(() => {
    rekor.current = bacaRekor();
    setHud((h) => ({ ...h, rekor: rekor.current }));
    try {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch {
      /* diabaikan */
    }
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      void o.lock?.("landscape").catch(() => undefined);
    } catch {
      /* diabaikan */
    }
    const cek = () => setPotret(window.innerHeight > window.innerWidth * 1.1);
    cek();
    window.addEventListener("resize", cek);
    return () => {
      window.removeEventListener("resize", cek);
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      } catch {
        /* diabaikan */
      }
      try {
        (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
      } catch {
        /* diabaikan */
      }
    };
  }, []);

  // Papan ketik.
  useEffect(() => {
    const sasaran = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const mulaiJikaSiap = () => {
      if (fase.current === "siap") setFase("main");
    };
    const turun = (e: KeyboardEvent) => {
      if (sasaran(e)) return;
      const k = kendali.current;
      if (KEY_LONCAT.has(e.key) || (e.key === "w" || e.key === "W") && !e.ctrlKey) {
        e.preventDefault();
        k.loncatKey = true;
        mulaiJikaSiap();
      } else if (KEY_DASH.has(e.key)) {
        k.dashKey = true;
        mulaiJikaSiap();
      } else if (KEY_TUNDUK.has(e.key) || ((e.key === "s" || e.key === "S") && !e.ctrlKey)) {
        if (e.key === "ArrowDown") e.preventDefault();
        k.tundukKey = true;
        mulaiJikaSiap();
      } else if ((e.key === "m" || e.key === "M") && !e.repeat) ubahMusik.current();
      else if ((e.key === "n" || e.key === "N") && !e.repeat) ubahEfek.current();
      else if ((e.key === "r" || e.key === "R") && !e.repeat && !e.ctrlKey) ulangRef.current();
      else if ((e.key === "Escape" || e.key === "p" || e.key === "P") && !e.repeat) jedaRef.current();
      setTombolOn({ loncat: k.loncatKey || k.loncatTombol, tunduk: k.tundukKey || k.tundukTombol, dash: k.dashKey || k.dashTombol });
    };
    const naik = (e: KeyboardEvent) => {
      const k = kendali.current;
      if (KEY_LONCAT.has(e.key) || e.key === "w" || e.key === "W") k.loncatKey = false;
      else if (KEY_DASH.has(e.key)) k.dashKey = false;
      else if (KEY_TUNDUK.has(e.key) || e.key === "s" || e.key === "S") k.tundukKey = false;
      setTombolOn({ loncat: k.loncatKey || k.loncatTombol, tunduk: k.tundukKey || k.tundukTombol, dash: k.dashKey || k.dashTombol });
    };
    const lepasSemua = () => {
      kendali.current = { loncatKey: false, loncatTombol: false, tundukKey: false, tundukTombol: false, dashKey: false, dashTombol: false };
      setTombolOn({ loncat: false, tunduk: false, dash: false });
      if (fase.current === "main") setFase("jeda");
    };
    window.addEventListener("keydown", turun);
    window.addEventListener("keyup", naik);
    window.addEventListener("blur", lepasSemua);
    return () => {
      window.removeEventListener("keydown", turun);
      window.removeEventListener("keyup", naik);
      window.removeEventListener("blur", lepasSemua);
    };
  }, [setFase]);

  // Putaran utama: fisika langkah tetap + gambar + suara.
  useEffect(() => {
    const cv = kanvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    suara.current = new SuaraGame("lari", bacaPengaturan());
    const bukaSuara = () => suara.current?.buka();
    window.addEventListener("pointerdown", bukaSuara);
    window.addEventListener("keydown", bukaSuara);
    let id = 0;
    let akum = 0;
    let terakhir = performance.now();
    let hudT = 0;
    let waktu = 0;
    let getar = 0;
    let debuT = 0;
    let bintangSebelum = 0;
    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ukur = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(cv);

    const bingkai = (now: number) => {
      id = requestAnimationFrame(bingkai);
      const dt = Math.min(0.05, (now - terakhir) / 1000);
      terakhir = now;
      const d = dunia.current;
      const k = kendali.current;

      if (fase.current === "main" && !d.selesai) {
        akum += dt;
        let n = 0;
        const m = { loncat: k.loncatKey || k.loncatTombol, tunduk: k.tundukKey || k.tundukTombol, dash: k.dashKey || k.dashTombol };
        while (akum >= DT && n < 8) {
          langkahLari(d, m, DT);
          akum -= DT;
          n++;
          if (d.selesai) break;
        }
        if (n >= 8) akum = 0;
        waktu += dt;
        for (const b of d.bunyi) {
          if (b.n === "loncat") suara.current?.loncat();
          else if (b.n === "mendarat") {
            suara.current?.mendarat(b.k);
            if (!hemat) for (let i = 0; i < 5; i++) serpih.current.push({ x: PX + d.jarak, y: TANAH, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 40, umur: 0, maks: 0.4, r: 2.5 + Math.random() * 2, warna: "#CFC0A8" });
          } else if (b.n === "dash") suara.current?.dash();
          else if (b.n === "koin") suara.current?.koin();
          else if (b.n === "hancur") {
            suara.current?.hancur();
            if (!hemat) for (let i = 0; i < 12; i++) serpih.current.push({ x: PX + d.jarak + 30, y: TANAH - 30 - Math.random() * 40, vx: 60 + Math.random() * 220, vy: -80 - Math.random() * 160, umur: 0, maks: 0.7, r: 3 + Math.random() * 3, warna: i % 2 ? "#6BD3F0" : "#C98A4B" });
          } else if (b.n === "mati") {
            suara.current?.tabrak();
            getar = 0.35;
          }
        }
        d.bunyi.length = 0;
        const bintang = Math.floor(d.skor / SKOR_PER_BINTANG);
        if (bintang > bintangSebelum) {
          bintangSebelum = bintang;
          bintangPopup.current = 1.6;
          suara.current?.bensin();
        }
        if (d.selesai) {
          const skorAkhir = skorBulat(d);
          const baru = skorAkhir > rekor.current;
          if (baru) {
            rekor.current = skorAkhir;
            try {
              localStorage.setItem(KUNCI_REKOR, String(skorAkhir));
            } catch {
              /* diabaikan */
            }
          }
          fase.current = "selesai";
          setorRef.current();
          disetor.current = d;
          if (baru) setTimeout(() => suara.current?.rekor(), 700);
          setHud({ skor: skorAkhir, rekor: rekor.current, rekorBaru: baru, fase: "selesai", koin: d.koin, dash: 1 });
        }
      }
      suara.current?.atur(fase.current === "main");

      for (const p of serpih.current) {
        p.umur += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
      }
      serpih.current = serpih.current.filter((p) => p.umur < p.maks);
      if (!hemat && fase.current === "main" && d.tanah && !d.selesai) {
        debuT += dt;
        if (debuT > (d.dashSisa > 0 ? 0.03 : 0.09)) {
          debuT = 0;
          serpih.current.push({ x: PX + d.jarak - 8, y: TANAH - 1, vx: -60 - Math.random() * 80 - d.v * 0.1, vy: -14 - Math.random() * 30, umur: 0, maks: 0.45, r: 2 + Math.random() * 2.4, warna: d.dashSisa > 0 ? "#9BEBFF" : "#B79AA8" });
        }
      }
      getar = Math.max(0, getar - dt);
      bintangPopup.current = Math.max(0, bintangPopup.current - dt);

      hudT += dt;
      if (hudT > 0.1 && fase.current === "main") {
        hudT = 0;
        const s = skorBulat(d);
        const dashIsi = Math.round((1 - d.dashJeda / DASH_JEDA) * 20) / 20;
        setHud((h) => (h.skor === s && h.koin === d.koin && h.dash === dashIsi ? h : { ...h, skor: s, koin: d.koin, dash: dashIsi }));
      }

      // ── gambar ──
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;
      const dpr = cv.width / w;
      const vw = w / h < 1.1 ? 520 : W;
      const skala = Math.max(0.3, Math.min(w / vw, (h - 8) / H));
      const x0 = (w - vw * skala) / 2;
      const y0 = Math.max(0, (h - H * skala) / 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#6F4F3C";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#F3C9A5";
      ctx.fillRect(0, 0, w, y0 + 2);
      const gx = getar > 0 ? (Math.random() - 0.5) * 8 * (getar / 0.35) : 0;
      ctx.setTransform(dpr * skala, 0, 0, dpr * skala, dpr * (x0 + gx), dpr * y0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, -400, vw, H + 400 + 400);
      ctx.clip();

      latarLari(ctx, vw, d.jarak, waktu);
      const sx = d.jarak; // dunia x - sx = x layar
      for (const o of d.rintangan) {
        if (o.hancur || o.x - sx > vw + 80 || o.x + o.w - sx < -80) continue;
        rintanganLari(ctx, o, sx, waktu);
      }
      for (const c of d.koinList) {
        if (c.ambil || c.x - sx > vw + 40 || c.x - sx < -40) continue;
        koinLari(ctx, c.x - sx, c.y, waktu);
      }
      robotLari(ctx, PX, d.y, d, waktu);
      for (const p of serpih.current) {
        ctx.globalAlpha = Math.max(0, 1 - p.umur / p.maks);
        ctx.fillStyle = p.warna;
        ctx.beginPath();
        ctx.arc(p.x - sx, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // popup bintang
      if (bintangPopup.current > 0) {
        const a = Math.min(1, bintangPopup.current);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#FBF1DA";
        ctx.beginPath();
        ctx.roundRect(PX - 40, 40 - (1.6 - bintangPopup.current) * 20, 120, 30, 10);
        ctx.fill();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = "800 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`+1 bintang!`, PX + 20, 61 - (1.6 - bintangPopup.current) * 20);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };
    id = requestAnimationFrame(bingkai);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("pointerdown", bukaSuara);
      window.removeEventListener("keydown", bukaSuara);
      suara.current?.tutup();
      suara.current = null;
    };
  }, []);

  /** Pedal ponsel: satu pasang penangan untuk ketiga tombol (kuncinya di `data-kunci`), dibuat sekali lewat useCallback. */
  const sinkronTombol = useCallback(() => {
    const k = kendali.current;
    setTombolOn({ loncat: k.loncatKey || k.loncatTombol, tunduk: k.tundukKey || k.tundukTombol, dash: k.dashKey || k.dashTombol });
  }, []);
  const pedalBawah = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const kunci = e.currentTarget.dataset.kunci as "loncatTombol" | "tundukTombol" | "dashTombol";
      kendali.current[kunci] = true;
      if (fase.current === "siap") setFase("main");
      sinkronTombol();
    },
    [setFase, sinkronTombol],
  );
  const pedalNaik = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const kunci = e.currentTarget.dataset.kunci as "loncatTombol" | "tundukTombol" | "dashTombol";
      kendali.current[kunci] = false;
      sinkronTombol();
    },
    [sinkronTombol],
  );
  const cegahMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const STIKER = "border-[2.5px] border-[#2B2233] shadow-[3px_3px_0_#2B2233]";
  const TOMBOL = cn(
    "rounded-lg border-[2.5px] border-[#2B2233] bg-[#F6E3C0] px-3 py-1.5 text-sm font-extrabold text-[#2B2233] shadow-[2px_2px_0_#2B2233]",
    "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  );
  const PEDAL = "flex select-none items-center justify-center rounded-2xl border-[3px] border-[#2B2233] font-extrabold text-[#2B2233] shadow-[3px_3px_0_#2B2233] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none touch-none";

  function keluar() {
    setor();
    onKeluar();
  }

  const bintangRun = Math.floor(hud.skor / SKOR_PER_BINTANG);
  const kemajuan = (hud.skor % SKOR_PER_BINTANG) / SKOR_PER_BINTANG;

  return (
    <div className="keep-white fixed inset-0 z-[80] select-none overflow-hidden bg-[#F3C9A5] text-[#2B2233]" style={{ touchAction: "none" }}>
      <canvas ref={kanvas} className="absolute inset-0 h-full w-full" aria-label="Game Lari Robo" role="img" />

      {/* HUD kiri atas */}
      <div className="pointer-events-none absolute left-0 top-0 p-3 sm:p-4 kecil:p-1.5">
        <div className={cn("-rotate-1 rounded-xl bg-[#FBF1DA] px-3.5 py-2 kecil:rounded-lg kecil:px-2 kecil:py-1", STIKER)}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60 kecil:text-[8px]">Skor</p>
          <p className="text-3xl font-extrabold leading-none tabular-nums kecil:text-xl">{hud.skor}</p>
          <p className="mt-1 text-[11px] font-bold text-[#2B2233]/65 kecil:mt-0.5 kecil:text-[9px]">Rekor {Math.max(hud.rekor, hud.skor)}</p>
          <div className="mt-1.5 flex items-center gap-1.5 kecil:mt-1">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 kecil:h-3 kecil:w-3" aria-hidden="true">
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#F2C14E" stroke="#2B2233" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-extrabold tabular-nums kecil:text-[9px]">×{bintangRun}</span>
            <span className="relative h-2 w-16 overflow-hidden rounded-full border-2 border-[#2B2233] bg-[#E8D9B8] kecil:h-1.5 kecil:w-10">
              <span className="absolute inset-y-0 left-0 bg-[#F0903A]" style={{ width: `${Math.round(kemajuan * 100)}%` }} />
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 kecil:mt-0.5">
            <span className="w-4 text-center text-[9px] font-extrabold kecil:w-3 kecil:text-[7px]">DASH</span>
            <span className="relative h-2 w-16 overflow-hidden rounded-full border-2 border-[#2B2233] bg-[#E8D9B8] kecil:h-1.5 kecil:w-10">
              <span className={cn("absolute inset-y-0 left-0", hud.dash >= 1 ? "bg-[#4DBBE0]" : "bg-[#9AA9B4]")} style={{ width: `${Math.round(hud.dash * 100)}%` }} />
            </span>
          </div>
        </div>
      </div>

      {/* tombol atas kanan */}
      <div className="pointer-events-auto absolute right-0 top-0 flex flex-col gap-2 p-3 sm:p-4 kecil:gap-1 kecil:p-1.5">
        <button type="button" onClick={keluar} aria-label="Keluar dari game" className={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 pointer-fine:hidden kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}>
          <svg viewBox="0 0 16 16" className="h-6 w-6 kecil:h-4 kecil:w-4" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
        <button type="button" onClick={() => jedaRef.current()} aria-label="Jeda" className={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 pointer-fine:hidden kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}>
          <svg viewBox="0 0 16 16" className="h-5 w-5 kecil:h-3.5 kecil:w-3.5" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2.5" width="3.4" height="11" rx="1" />
            <rect x="9.6" y="2.5" width="3.4" height="11" rx="1" />
          </svg>
        </button>
        <PanelSuara peng={peng} onMusik={pasangMusik} onEfek={pasangEfek} tombolClass={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")} />
      </div>

      {/* kendali ponsel (desktop: hanya petunjuk) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-6 kecil:p-2">
        <div className="pointer-events-none flex flex-col items-start gap-2 pointer-fine:invisible kecil:gap-1.5">
          <button type="button" aria-label="Dash" data-kunci="dashTombol" onPointerDown={pedalBawah} onPointerUp={pedalNaik} onPointerCancel={pedalNaik} onContextMenu={cegahMenu} className={cn(PEDAL, "pointer-events-auto h-16 w-24 bg-[#6BD3F0] text-base kecil:h-11 kecil:w-16 kecil:text-xs", tombolOn.dash && "translate-x-[2px] translate-y-[2px] shadow-none")}>
            DASH
          </button>
          <button type="button" aria-label="Menunduk" data-kunci="tundukTombol" onPointerDown={pedalBawah} onPointerUp={pedalNaik} onPointerCancel={pedalNaik} onContextMenu={cegahMenu} className={cn(PEDAL, "pointer-events-auto h-16 w-24 bg-[#F6E3C0] text-base kecil:h-11 kecil:w-16 kecil:text-xs", tombolOn.tunduk && "translate-x-[2px] translate-y-[2px] shadow-none")}>
            TUNDUK
          </button>
        </div>
        <p className="mb-2 hidden rounded-lg bg-[#FBF1DA]/90 px-3 py-1 text-xs font-bold pointer-fine:block">Spasi / ↑ loncat · Shift dash · Ctrl / ↓ menunduk · M musik · N efek · R ulang · Esc jeda</p>
        <button type="button" aria-label="Loncat" data-kunci="loncatTombol" onPointerDown={pedalBawah} onPointerUp={pedalNaik} onPointerCancel={pedalNaik} onContextMenu={cegahMenu} className={cn(PEDAL, "pointer-events-auto h-32 w-32 bg-[#F0903A] text-xl pointer-fine:invisible kecil:h-24 kecil:w-24 kecil:text-base", tombolOn.loncat && "translate-x-[2px] translate-y-[2px] shadow-none")}>
          LONCAT
        </button>
      </div>

      {potret && hud.fase === "main" && <p className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-fit rounded-lg bg-[#FBF1DA]/90 px-3 py-1 text-[11px] font-bold pointer-fine:hidden">Putar ke layar lebar agar lebih nyaman</p>}

      {hud.fase === "siap" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 kecil:p-3">
          <div className={cn("max-w-sm rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[320px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-lg">Lari Robo</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2B2233]/80 kecil:mt-1 kecil:text-[11px]">
              Loncati peti dan duri, menunduk di bawah drone, dan <strong>DASH</strong> menembus tembok energi. Tiap <strong>100 skor = 1 bintang</strong>.
            </p>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60 kecil:mt-1.5 kecil:text-[10px]">
              <span className="pointer-fine:hidden">Ketuk LONCAT untuk mulai</span>
              <span className="hidden pointer-fine:inline">Tekan Spasi untuk mulai</span>
            </p>
          </div>
        </div>
      )}

      {hud.fase === "jeda" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2B2233]/35 p-6 kecil:p-3">
          <div className={cn("w-full max-w-xs rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[240px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-lg">Jeda</h2>
            <div className="mt-4 flex flex-col gap-2 kecil:mt-2 kecil:gap-1.5">
              <button type="button" onClick={() => setFase("main")} className={cn(TOMBOL, "bg-[#F0903A] py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Lanjut
              </button>
              <button type="button" onClick={() => ulang()} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Mulai ulang
              </button>
              <button type="button" onClick={keluar} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {hud.fase === "selesai" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2B2233]/40 p-6 kecil:p-3">
          <div className={cn("w-full max-w-xs -rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[260px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-base">Tertabrak!</h2>
            <p className="mt-3 text-4xl font-extrabold tabular-nums kecil:mt-1 kecil:text-2xl">{hud.skor}</p>
            <p className="mt-1 text-sm font-bold text-[#2B2233]/70 kecil:text-xs">{Math.floor(hud.skor / SKOR_PER_BINTANG)} bintang dari lari ini</p>
            {onSetor && hud.skor > 0 && <p className="mt-2 text-xs font-bold text-[#2B2233]/70">{hud.skor} skor masuk saldo Lari Robo. Tukar 100 skor = 1 bintang di Toko, tab Koin Game.</p>}
            {hud.rekorBaru ? <p className="mt-2 text-sm font-extrabold text-[#2F6F4A]">Rekor baru!</p> : <p className="mt-2 text-xs font-bold text-[#2B2233]/60">Rekor {hud.rekor}</p>}
            <div className="mt-4 flex flex-col gap-2 kecil:mt-2 kecil:gap-1.5">
              <button type="button" onClick={() => ulang()} className={cn(TOMBOL, "bg-[#F0903A] py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Main lagi
              </button>
              <button type="button" onClick={keluar} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
