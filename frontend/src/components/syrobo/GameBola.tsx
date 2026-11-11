"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { gambarBola, siapkanBola } from "./bolaGambar";
import { gambarLatar, siapkanLatar, temaUntuk } from "./bolaLatar";
import PanelSuara from "./PanelSuara";
import { SuaraGame, bacaPengaturan, simpanPengaturan, type PengaturanSuara } from "./suaraGame";
import {
  GARIS_Y,
  LEBAR,
  RADIUS,
  SPAWN_Y,
  TINGGI,
  WARNA,
  duniaBolaBaru,
  jatuhkan,
  jepitX,
  langkahBola,
  NAMA,
  type DuniaBola,
} from "@/lib/syrobo/game/bolaFisika";

/**
 * Game "Bola Gabung" (gaya fruit merge, objeknya bola): jatuhkan bola ke wadah; dua bola SATU tingkat yang bersentuhan lebur
 * jadi bola tingkat berikutnya. Jangan sampai tumpukan melewati garis terlalu lama. Fisika di `bolaFisika.ts` (murni, diuji);
 * berkas ini hanya menggambar (kanvas 2D bergaya stiker, sama dengan Tanjakan Robo) dan membaca kendali:
 *  - Desktop: gerakkan mouse (atau ← → / A D) untuk membidik; klik atau Spasi / ↓ menjatuhkan; R ulang; Esc/P jeda.
 *    Tanpa tombol di layar (hanya baris petunjuk) supaya bersih.
 *  - Ponsel: geser jari untuk membidik, lepaskan untuk menjatuhkan; hanya tombol Keluar & Jeda kecil di pojok.
 * Tidak memberi poin SyRobo (hanya hiburan); rekor skor disimpan di perangkat.
 */

const INK = "#2B2233";
const KUNCI_REKOR = "synaped_syrobo_bola_rekor";
const DT = 1 / 120;
const KEY_KIRI = new Set(["ArrowLeft", "a", "A"]);
const KEY_KANAN = new Set(["ArrowRight", "d", "D"]);
const KEY_JATUH = new Set([" ", "Spacebar", "ArrowDown", "s", "S", "Enter"]);

function bacaRekor(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_REKOR));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Bola kecil untuk chip "Berikut": kanvas mungil dengan gambar yang sama seperti di wadah. */
function BolaMini({ n }: { n: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sisi = 40;
    cv.width = sisi * dpr;
    cv.height = sisi * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sisi, sisi);
    gambarBola(ctx, sisi / 2, sisi / 2, 17, n);
  }, [n]);
  return <canvas ref={ref} className="h-8 w-8 kecil:h-6 kecil:w-6" aria-hidden="true" />;
}

interface Percik {
  x: number;
  y: number;
  vx: number;
  vy: number;
  umur: number;
  maks: number;
  warna: string;
  r: number;
  cincin?: boolean;
}

type Fase = "siap" | "main" | "jeda" | "selesai";
interface Hud {
  skor: number;
  rekor: number;
  rekorBaru: boolean;
  berikut: number;
  tertinggi: number;
  fase: Fase;
}

/** Skor disetor ke saldo Bola Gabung (1.000 skor = 1 bintang setelah DITUKAR di Toko; server membatasi jatah harian bersama). */
export default function GameBola({ onKeluar, onSetor }: { onKeluar: () => void; onSetor?: (koin: number) => void }) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const dunia = useRef<DuniaBola>(duniaBolaBaru());
  const fase = useRef<Fase>("siap");
  const rekor = useRef(0);
  const bidik = useRef(LEBAR / 2);
  const tekan = useRef(false);
  const tombol = useRef({ kiri: false, kanan: false });
  const percik = useRef<Percik[]>([]);
  /** Letak wadah di layar (px CSS): dipakai menggambar dan memetakan sentuhan. */
  const tata = useRef({ skala: 1, x0: 0, y0: 0 });
  /** Dunia yang skornya sudah disetor: satu permainan hanya disetor sekali (selesai, ulang, atau keluar). */
  const disetor = useRef<DuniaBola | null>(null);
  const setorRef = useRef(onSetor);
  const suara = useRef<SuaraGame | null>(null);
  const [peng, setPeng] = useState<PengaturanSuara>(() => bacaPengaturan());
  const ubahMusik = useRef<() => void>(() => undefined);
  const ubahEfek = useRef<() => void>(() => undefined);
  const ulangRef = useRef<() => void>(() => undefined);
  const jedaRef = useRef<() => void>(() => undefined);
  const jatuhRef = useRef<() => void>(() => undefined);
  const setorRef2 = useRef<() => void>(() => undefined);

  const [hud, setHud] = useState<Hud>({ skor: 0, rekor: 0, rekorBaru: false, berikut: 0, tertinggi: 0, fase: "siap" });
  const [potret, setPotret] = useState(false);

  const setFase = useCallback((f: Fase) => {
    fase.current = f;
    setHud((h) => ({ ...h, fase: f }));
  }, []);

  const setor = useCallback(() => {
    const d = dunia.current;
    if (disetor.current === d) return;
    disetor.current = d;
    if (d.skor > 0) setorRef.current?.(d.skor);
  }, []);

  const ulang = useCallback(() => {
    setor();
    dunia.current = duniaBolaBaru();
    percik.current = [];
    bidik.current = LEBAR / 2;
    fase.current = "siap";
    setHud({ skor: 0, rekor: rekor.current, rekorBaru: false, berikut: dunia.current.berikut, tertinggi: 0, fase: "siap" });
  }, [setor]);

  useEffect(() => {
    setorRef.current = onSetor;
    setorRef2.current = setor;
    ulangRef.current = ulang;
    jedaRef.current = () => {
      if (fase.current === "main") setFase("jeda");
      else if (fase.current === "jeda") setFase("main");
    };
    jatuhRef.current = () => {
      if (fase.current === "siap") setFase("main");
      if (fase.current !== "main") return;
      if (jatuhkan(dunia.current, bidik.current)) suara.current?.jatuh();
    };
  }, [ulang, setFase, onSetor, setor]);

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

  // Rekor + layar tegak.
  useEffect(() => {
    rekor.current = bacaRekor();
    setHud((h) => ({ ...h, rekor: rekor.current, berikut: dunia.current.berikut }));
    const cek = () => setPotret(window.innerHeight > window.innerWidth * 1.1);
    cek();
    window.addEventListener("resize", cek);
    return () => window.removeEventListener("resize", cek);
  }, []);

  // Papan ketik.
  useEffect(() => {
    const sasaran = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const turun = (e: KeyboardEvent) => {
      if (sasaran(e)) return;
      if (KEY_KIRI.has(e.key) || KEY_KANAN.has(e.key) || KEY_JATUH.has(e.key)) e.preventDefault();
      if (KEY_KIRI.has(e.key)) tombol.current.kiri = true;
      else if (KEY_KANAN.has(e.key)) tombol.current.kanan = true;
      else if (KEY_JATUH.has(e.key) && !e.repeat) jatuhRef.current();
      else if ((e.key === "m" || e.key === "M") && !e.repeat) ubahMusik.current();
      else if ((e.key === "n" || e.key === "N") && !e.repeat) ubahEfek.current();
      else if ((e.key === "r" || e.key === "R") && !e.repeat) ulangRef.current();
      else if ((e.key === "Escape" || e.key === "p" || e.key === "P") && !e.repeat) jedaRef.current();
    };
    const naik = (e: KeyboardEvent) => {
      if (KEY_KIRI.has(e.key)) tombol.current.kiri = false;
      else if (KEY_KANAN.has(e.key)) tombol.current.kanan = false;
    };
    const lepas = () => {
      tombol.current = { kiri: false, kanan: false };
      if (fase.current === "main") setFase("jeda");
    };
    window.addEventListener("keydown", turun);
    window.addEventListener("keyup", naik);
    window.addEventListener("blur", lepas);
    return () => {
      window.removeEventListener("keydown", turun);
      window.removeEventListener("keyup", naik);
      window.removeEventListener("blur", lepas);
    };
  }, [setFase]);

  // Putaran utama: fisika langkah tetap + gambar.
  useEffect(() => {
    const cv = kanvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    siapkanBola();
    suara.current = new SuaraGame("bola", bacaPengaturan());
    const bukaSuara = () => suara.current?.buka();
    window.addEventListener("pointerdown", bukaSuara);
    window.addEventListener("keydown", bukaSuara);
    // lukis suasana latar lain di sela waktu luang supaya peralihan nanti tak tersendat
    const pemanasan = [250, 700, 1150].map((ms, i) => window.setTimeout(() => siapkanLatar(cv.clientWidth, cv.clientHeight, i + 1), ms));
    let id = 0;
    let akum = 0;
    let terakhir = performance.now();
    let hudT = 0;
    let waktu = 0;
    // latar berganti suasana seiring bola terbesar yang dicapai; peralihan memudar 1,2 dtk
    const latar = { dari: 0, ke: 0, p: 1 };
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

      // bidikan dari papan ketik
      const geser = (tombol.current.kanan ? 1 : 0) - (tombol.current.kiri ? 1 : 0);
      if (geser !== 0) bidik.current += geser * 190 * dt;
      bidik.current = jepitX(d.sekarang, bidik.current);

      if (fase.current === "main" && !d.selesai) {
        akum += dt;
        let n = 0;
        while (akum >= DT && n < 8) {
          langkahBola(d, DT);
          akum -= DT;
          n++;
          if (d.selesai) break;
        }
        if (n >= 8) akum = 0;
        waktu += dt;

        for (const kuat of d.dentum) suara.current?.dentum(kuat);
        d.dentum.length = 0;
        for (const e of d.efek) suara.current?.gabung(e.n);
        for (const e of d.efek) {
          if (hemat) break;
          percik.current.push({ x: e.x, y: e.y, vx: 0, vy: 0, umur: 0, maks: 0.45, warna: WARNA[e.n], r: RADIUS[e.n], cincin: true });
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
            const v = 80 + Math.random() * 120;
            percik.current.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, umur: 0, maks: 0.5, warna: i % 2 ? "#FBF1DA" : WARNA[e.n], r: 2.5 + Math.random() * 3 });
          }
        }
        d.efek = [];

        if (d.selesai) {
          const baru = d.skor > rekor.current;
          if (baru) {
            rekor.current = d.skor;
            try {
              localStorage.setItem(KUNCI_REKOR, String(d.skor));
            } catch {
              /* diabaikan */
            }
          }
          fase.current = "selesai";
          setorRef2.current();
          suara.current?.selesai();
          if (baru) setTimeout(() => suara.current?.rekor(), 900);
          setHud({ skor: d.skor, rekor: rekor.current, rekorBaru: baru, berikut: d.berikut, tertinggi: d.tertinggi, fase: "selesai" });
        }
      }
      d.efek = [];
      suara.current?.atur(fase.current === "main");

      for (const p of percik.current) {
        p.umur += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
      }
      percik.current = percik.current.filter((p) => p.umur < p.maks);

      hudT += dt;
      if (hudT > 0.12 && fase.current === "main") {
        hudT = 0;
        setHud((h) => (h.skor === d.skor && h.berikut === d.berikut && h.tertinggi === d.tertinggi ? h : { ...h, skor: d.skor, berikut: d.berikut, tertinggi: d.tertinggi }));
      }

      // ── gambar ──
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;
      const dpr = cv.width / w;
      const atas = w / h > 1.3 ? 10 : 80;
      const bawah = w / h > 1.3 ? 10 : 38;
      const skala = Math.max(0.3, Math.min((h - atas - bawah) / TINGGI, (w - 20) / LEBAR));
      const x0 = (w - LEBAR * skala) / 2;
      const y0 = atas + Math.max(0, (h - atas - bawah - TINGGI * skala) / 2);
      tata.current = { skala, x0, y0 };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sasaran = temaUntuk(d.tertinggi);
      if (sasaran !== latar.ke) {
        // peralihan baru: tema yang sedang terlihat jadi dasar
        if (latar.p >= 0.5) latar.dari = latar.ke;
        latar.ke = sasaran;
        latar.p = 0;
      }
      if (latar.p < 1) {
        latar.p = hemat ? 1 : Math.min(1, latar.p + dt / 1.2);
        if (latar.p >= 1) latar.dari = latar.ke;
      }
      gambarLatar(ctx, w, h, latar.dari, latar.ke, latar.p, now / 1000);
      ctx.setTransform(dpr * skala, 0, 0, dpr * skala, dpr * x0, dpr * y0);

      // wadah: kaca dengan dinding tebal bergaya stiker
      const bahaya = d.bola.some((b) => b.diam > 0.5);
      ctx.beginPath();
      ctx.roundRect(0, 0, LEBAR, TINGGI, 14);
      ctx.fillStyle = "rgba(255,248,235,0.5)";
      ctx.fill();
      // bidang di atas garis (zona jatuh) sedikit lebih terang
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(0, 0, LEBAR, GARIS_Y);

      // garis batas
      ctx.save();
      ctx.setLineDash([9, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = bahaya ? (Math.floor(now / 160) % 2 ? "#D9473B" : "rgba(217,71,59,0.35)") : "rgba(217,71,59,0.55)";
      ctx.beginPath();
      ctx.moveTo(0, GARIS_Y);
      ctx.lineTo(LEBAR, GARIS_Y);
      ctx.stroke();
      ctx.restore();

      // bola di tangan + panduan jatuh
      if (!d.selesai && fase.current !== "selesai") {
        const bx = bidik.current;
        ctx.save();
        ctx.setLineDash([3, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(43,34,51,0.3)";
        ctx.beginPath();
        ctx.moveTo(bx, SPAWN_Y + RADIUS[d.sekarang]);
        ctx.lineTo(bx, TINGGI);
        ctx.stroke();
        ctx.restore();
        gambarBola(ctx, bx, SPAWN_Y, RADIUS[d.sekarang], d.sekarang, d.jeda > 0 ? 0.35 : 1);
      }

      for (const b of d.bola) gambarBola(ctx, b.x, b.y, b.r, b.n, 1, b.sudut);

      // percikan penggabungan
      for (const p of percik.current) {
        const a = 1 - p.umur / p.maks;
        ctx.globalAlpha = Math.max(0, a);
        if (p.cincin) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 + (1 - a) * 0.55), 0, Math.PI * 2);
          ctx.lineWidth = 4 * a + 1;
          ctx.strokeStyle = "#FBF1DA";
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * a + 0.5, 0, Math.PI * 2);
          ctx.fillStyle = p.warna;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // bingkai wadah di atas bola (sisi kiri/kanan/bawah)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, TINGGI - 14);
      ctx.quadraticCurveTo(0, TINGGI, 14, TINGGI);
      ctx.lineTo(LEBAR - 14, TINGGI);
      ctx.quadraticCurveTo(LEBAR, TINGGI, LEBAR, TINGGI - 14);
      ctx.lineTo(LEBAR, 0);
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.stroke();
      void waktu;
    };
    id = requestAnimationFrame(bingkai);
    return () => {
      cancelAnimationFrame(id);
      pemanasan.forEach((x) => window.clearTimeout(x));
      window.removeEventListener("pointerdown", bukaSuara);
      window.removeEventListener("keydown", bukaSuara);
      suara.current?.tutup();
      suara.current = null;
      ro.disconnect();
    };
  }, []);

  /** Posisi x dunia dari koordinat layar. */
  function keDunia(clientX: number): number {
    const cv = kanvas.current;
    if (!cv) return LEBAR / 2;
    const rect = cv.getBoundingClientRect();
    const { skala, x0 } = tata.current;
    return (clientX - rect.left - x0) / skala;
  }

  function onDown(e: React.PointerEvent) {
    tekan.current = true;
    bidik.current = jepitX(dunia.current.sekarang, keDunia(e.clientX));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    // mouse selalu membidik saat melayang; sentuhan hanya selagi jari menempel
    if (e.pointerType === "mouse" || tekan.current) bidik.current = jepitX(dunia.current.sekarang, keDunia(e.clientX));
  }
  function onUp(e: React.PointerEvent) {
    if (!tekan.current) return;
    tekan.current = false;
    bidik.current = jepitX(dunia.current.sekarang, keDunia(e.clientX));
    jatuhRef.current();
  }

  const STIKER = "border-[2.5px] border-[#2B2233] shadow-[3px_3px_0_#2B2233]";
  const TOMBOL = cn(
    "rounded-lg border-[2.5px] border-[#2B2233] bg-[#F6E3C0] px-3 py-1.5 text-sm font-extrabold text-[#2B2233] shadow-[2px_2px_0_#2B2233]",
    "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  );

  function keluar() {
    setor();
    onKeluar();
  }

  return (
    <div
      className="keep-white fixed inset-0 z-[80] select-none overflow-hidden bg-[#F4C9B8] text-[#2B2233] [background-image:radial-gradient(circle_at_20%_15%,#FBE3D6,transparent_55%),radial-gradient(circle_at_85%_85%,#E9B3A4,transparent_50%)]"
      style={{ touchAction: "none" }}
    >
      <canvas ref={kanvas} className="absolute inset-0 h-full w-full" aria-label="Game Bola Gabung" role="img" />
      {/* lapisan sentuh/mouse untuk membidik & menjatuhkan */}
      <div className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (tekan.current = false)} />

      {/* HUD atas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-3 sm:p-4 kecil:p-1.5">
        <div className={cn("pointer-events-auto -rotate-1 rounded-xl bg-[#FBF1DA] px-3.5 py-2 kecil:rounded-lg kecil:px-2 kecil:py-1", STIKER)}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60 kecil:text-[8px]">Skor</p>
          <p className="text-3xl font-extrabold leading-none tabular-nums kecil:text-xl">{hud.skor}</p>
          <p className="mt-1 text-[11px] font-bold text-[#2B2233]/65 kecil:mt-0.5 kecil:text-[9px]">Rekor {Math.max(hud.rekor, hud.skor)}</p>
        </div>

        {/* Berikut: tengah atas di layar tegak; di layar lebar pindah ke bawah kartu skor supaya tak menutupi zona jatuh. */}
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 [@media(min-aspect-ratio:13/10)]:left-3 [@media(min-aspect-ratio:13/10)]:top-[7.5rem] [@media(min-aspect-ratio:13/10)]:translate-x-0 kecil:top-2 [@media(min-aspect-ratio:13/10)]:kecil:top-[5.2rem]">
        <div className={cn("pointer-events-none flex items-center gap-2 rounded-xl bg-[#FBF1DA] px-3 py-1.5 kecil:gap-1 kecil:rounded-lg kecil:px-2 kecil:py-1", STIKER)} aria-label={`Berikutnya ${NAMA[hud.berikut]}`}>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2B2233]/60 kecil:text-[8px]">Berikut</span>
          <BolaMini n={hud.berikut} />
        </div>
        </div>

        <div className="pointer-events-auto flex flex-col gap-2 kecil:gap-1">
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
          <PanelSuara
            peng={peng}
            onMusik={pasangMusik}
            onEfek={pasangEfek}
            tombolClass={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}
          />
        </div>
      </div>

      {/* Petunjuk desktop (hanya teks) */}
      <p className="pointer-events-none absolute bottom-3 right-3 hidden max-w-[16rem] rounded-lg bg-[#FBF1DA]/90 px-3 py-1.5 text-xs font-bold leading-relaxed pointer-fine:block">
        Mouse / ← → bidik · Klik / Spasi jatuhkan · M musik · N efek · R ulang · Esc jeda
      </p>
      {potret && hud.fase === "main" && <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-lg bg-[#FBF1DA]/90 px-3 py-1 text-[11px] font-bold pointer-fine:hidden">Geser untuk membidik, lepas untuk menjatuhkan</p>}

      {/* Siap */}
      {hud.fase === "siap" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 kecil:p-3">
          <div className={cn("max-w-sm rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[300px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-lg">Bola Gabung</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2B2233]/80 kecil:mt-1 kecil:text-[11px]">
              Jatuhkan bola ke wadah. Dua bola <strong>sejenis</strong> yang bersentuhan lebur jadi bola yang lebih besar. Jangan biarkan tumpukan melewati garis merah terlalu lama!
            </p>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60 kecil:mt-1.5 kecil:text-[10px]">
              <span className="pointer-fine:hidden">Ketuk / geser untuk mulai</span>
              <span className="hidden pointer-fine:inline">Klik atau Spasi untuk mulai</span>
            </p>
          </div>
        </div>
      )}

      {/* Jeda */}
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

      {/* Selesai */}
      {hud.fase === "selesai" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2B2233]/40 p-6 kecil:p-3">
          <div className={cn("w-full max-w-xs -rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[260px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-base">Wadah penuh!</h2>
            <p className="mt-3 text-4xl font-extrabold tabular-nums kecil:mt-1 kecil:text-2xl">{hud.skor}</p>
            <p className="mt-1 text-sm font-bold text-[#2B2233]/70 kecil:text-xs">Terbesar: {NAMA[hud.tertinggi]}</p>
            {onSetor && hud.skor > 0 && <p className="mt-2 text-xs font-bold text-[#2B2233]/70">{hud.skor} skor masuk saldo Bola Gabung. Tukar 1.000 skor = 1 bintang di Toko, tab Koin Game.</p>}
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
