"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Peluncur asisten AI berwujud robot (tanpa lingkaran latar).
 *
 *  - SERET untuk memindahkannya ke mana saja (posisi diingat di perangkat ini).
 *  - TAHAN lama (± setengah detik) atau klik kanan → pilihan gerakan:
 *    "Diam" (BAWAAN) atau "Bergerak".
 *  - Mode bergerak: robot HANYUT pelan secara kontinu - arah dan kecepatannya
 *    berubah halus (kadang berhenti sejenak), selalu di dalam layar, dengan
 *    gelembung ajakan ngobrol berkalimat acak. Berhenti selama chat/menu terbuka.
 *  - Klik/ketuk singkat membuka-menutup chat (lewat `onToggle`).
 *
 * KENAPA GERAKNYA MULUS: posisi ditulis langsung ke `transform` lewat
 * requestAnimationFrame (tanpa render React per bingkai, tanpa transisi
 * left/top), dan robot bergerak terus dengan kemudi yang diperhalus - bukan
 * lompat ke titik tujuan lalu berhenti. Gelembung & menu menjadi anak dari
 * pembungkus yang bergerak itu, jadi otomatis ikut tanpa dihitung ulang.
 *
 * Hemat gerak: dipaksa "diam", tanpa gelembung. Satu-satunya animasi bawaan
 * robot hanyalah mata yang berkedip.
 */

const SIZE = 64;
const MARGIN = 8;
const PRESS_MS = 550;
const MOVE_THRESHOLD = 6;
/** Robot hanya berkeliaran di sekitar titik asalnya (px) - tak pernah menjauh ke tengah layar. */
const RADIUS_JELAJAH = 64;
const POS_KEY = "synaped_chat_pos";
const MODE_KEY = "synaped_chat_mode";

export type RobotMode = "diam" | "gerak";
export interface RobotPos {
  x: number;
  y: number;
}

const KALIMAT = [
  "Halo! Ada yang bisa kubantu?",
  "Bingung pilih kursus? Tanya aku!",
  "Mau tahu cara dapat sertifikat?",
  "Aku bisa bantu jelaskan materi pelajaranmu.",
  "Butuh teman belajar? Aku di sini!",
  "Klik aku kalau mau ngobrol.",
  "Sudah belajar hari ini?",
  "Penasaran soal pembayaran kursus? Tanya saja.",
  "Tahan aku lama-lama untuk atur gerakanku.",
  "Seret aku kalau aku menghalangi!",
];

function acak<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jepit(p: RobotPos): RobotPos {
  const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return { x: Math.min(maxX, Math.max(MARGIN, p.x)), y: Math.min(maxY, Math.max(MARGIN, p.y)) };
}

/** Selisih sudut terpendek a→b dalam (-π, π]. */
function selisihSudut(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

interface Sisi {
  kanan: boolean;
  bawah: boolean;
}

export default function ChatRobot({
  open,
  onToggle,
  onPos,
}: {
  open: boolean;
  onToggle: () => void;
  /** Dipanggil saat posisi robot "mengendap" (selesai diseret/berjalan, resize, dimuat). */
  onPos: (p: RobotPos) => void;
}) {
  const [siap, setSiap] = useState(false);
  const [mode, setMode] = useState<RobotMode>("diam");
  const [hemat, setHemat] = useState(false);
  const [menu, setMenu] = useState<Sisi | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubble] = useState<{ teks: string; sisi: Sisi } | null>(null);
  // Kejutan: ketuk 3x cepat memunculkan gelembung ajakan follow Instagram.
  const [salam, setSalam] = useState<{ sisi: Sisi } | null>(null);
  const ketukRef = useRef<number[]>([]);
  const salamTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<RobotPos>({ x: 0, y: 0 });
  const drag = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    long: boolean;
    timer: ReturnType<typeof setTimeout> | undefined;
  } | null>(null);

  /** Tulis posisi langsung ke DOM (tanpa render React). */
  function terapkan(p: RobotPos) {
    posRef.current = p;
    const el = wrapRef.current;
    if (el) el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`;
  }

  /** Separuh layar mana robot berada → ke mana menu/gelembung membuka. */
  function sisiSekarang(): Sisi {
    const p = posRef.current;
    return {
      kanan: p.x + SIZE / 2 > window.innerWidth / 2,
      bawah: p.y + SIZE / 2 > window.innerHeight / 2,
    };
  }

  function simpanPos(p: RobotPos) {
    try {
      localStorage.setItem(
        POS_KEY,
        JSON.stringify({
          fx: p.x / Math.max(1, window.innerWidth - SIZE),
          fy: p.y / Math.max(1, window.innerHeight - SIZE),
        }),
      );
    } catch {
      // abaikan
    }
  }

  // Muat posisi & mode tersimpan SETELAH mount (HTML server tak tahu ukuran layar).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let fx = 1;
      let fy = 1;
      let m: RobotMode = "diam";
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (raw) {
          const o = JSON.parse(raw) as { fx?: number; fy?: number };
          if (typeof o.fx === "number") fx = o.fx;
          if (typeof o.fy === "number") fy = o.fy;
        }
        if (localStorage.getItem(MODE_KEY) === "gerak") m = "gerak";
      } catch {
        // penyimpanan diblokir: pakai bawaan
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const awal = jepit({
        x: fx * (window.innerWidth - SIZE),
        y: fy * (window.innerHeight - SIZE),
      });
      terapkan(awal);
      setHemat(reduce);
      setMode(reduce ? "diam" : m);
      setSiap(true);
      onPos(awal);
    });
    return () => cancelAnimationFrame(raf);
    // Hanya sekali saat mount; onPos stabil (useCallback di induk).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layar berubah ukuran → jepit ulang supaya robot tak hilang di luar layar.
  useEffect(() => {
    const onResize = () => {
      const baru = jepit(posRef.current);
      terapkan(baru);
      onPos(baru);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [onPos]);

  // ── Mode bergerak: hanyut kontinu dengan kemudi yang diperhalus ─────────────
  const aktifBergerak = mode === "gerak" && !open && !menu && !dragging && !hemat && siap;

  useEffect(() => {
    if (!aktifBergerak) return;

    // Titik asal = tempat robot berada saat mode bergerak mulai (atau habis diseret).
    const rumah = { ...posRef.current };
    let theta = Math.random() * Math.PI * 2; // arah sekarang
    let tujuanTheta = theta; // arah yang dituju
    let kecepatan = 0; // px/dtk
    let tujuanKec = 0;
    let raf = 0;
    let terakhir = performance.now();
    let ganti = performance.now() + 600;

    const bingkai = (now: number) => {
      raf = requestAnimationFrame(bingkai);
      const dt = Math.min((now - terakhir) / 1000, 0.05);
      terakhir = now;

      // Tiap 2-4,5 dtk pilih arah & kecepatan baru (30%: berhenti sejenak)
      if (now >= ganti) {
        tujuanTheta = Math.random() * Math.PI * 2;
        tujuanKec = Math.random() < 0.3 ? 0 : 10 + Math.random() * 16;
        ganti = now + 2000 + Math.random() * 2500;
      }

      // Jauh dari titik asal → arahkan perlahan PULANG (bukan ke tengah layar).
      // Di dalam radius jelajah ia bebas hanyut; lewat 70% radius mulai berbalik.
      const p = posRef.current;
      const jarak = Math.hypot(p.x - rumah.x, p.y - rumah.y);
      const jauh = jarak > RADIUS_JELAJAH * 0.7;
      if (jauh) {
        tujuanTheta = Math.atan2(rumah.y - p.y, rumah.x - p.x);
        if (tujuanKec < 10) tujuanKec = 12;
      }

      // Kemudi & kecepatan diperhalus (eksponensial) → tak ada patah
      theta += selisihSudut(theta, tujuanTheta) * Math.min(1, dt * (jauh ? 2.4 : 1.1));
      kecepatan += (tujuanKec - kecepatan) * Math.min(1, dt * 1.4);

      if (kecepatan > 0.15) {
        let nx = p.x + Math.cos(theta) * kecepatan * dt;
        let ny = p.y + Math.sin(theta) * kecepatan * dt;
        // pagar keras di tepi lingkaran jelajah (jaga-jaga bila kemudi terlambat)
        const dx = nx - rumah.x;
        const dy = ny - rumah.y;
        const dd = Math.hypot(dx, dy);
        if (dd > RADIUS_JELAJAH) {
          nx = rumah.x + (dx / dd) * RADIUS_JELAJAH;
          ny = rumah.y + (dy / dd) * RADIUS_JELAJAH;
        }
        terapkan(jepit({ x: nx, y: ny }));
      }
    };

    raf = requestAnimationFrame(bingkai);
    return () => {
      cancelAnimationFrame(raf);
      // Berhenti (chat/menu dibuka, mode diam, ...): laporkan titik terakhirnya.
      onPos(posRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifBergerak]);

  useEffect(() => () => clearTimeout(salamTimer.current), []);

  function tampilSalam() {
    setBubble(null);
    setSalam({ sisi: sisiSekarang() });
    clearTimeout(salamTimer.current);
    salamTimer.current = setTimeout(() => setSalam(null), 6000);
  }

  // ── Gelembung ajakan ngobrol, kalimat acak ──────────────────────────────────
  useEffect(() => {
    if (!aktifBergerak) return;
    let tunggu: ReturnType<typeof setTimeout>;
    let tutup: ReturnType<typeof setTimeout>;

    const tampil = () => {
      setBubble({ teks: acak(KALIMAT), sisi: sisiSekarang() });
      tutup = setTimeout(() => {
        setBubble(null);
        tunggu = setTimeout(tampil, 6000 + Math.random() * 5000);
      }, 4600);
    };

    tunggu = setTimeout(tampil, 3500 + Math.random() * 3000);
    return () => {
      clearTimeout(tunggu);
      clearTimeout(tutup);
    };
  }, [aktifBergerak]);

  // ── Menu pilihan: tutup bila klik di luar / Escape ──────────────────────────
  useEffect(() => {
    if (!menu) return;
    const luar = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    // Jeda agar pointerdown yang MEMBUKA menu tak langsung menutupnya.
    const t = setTimeout(() => document.addEventListener("pointerdown", luar), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  function pilihMode(m: RobotMode) {
    setMode(m);
    setMenu(null);
    if (m === "diam") setBubble(null);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // abaikan
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setMenu(null);

    const p = posRef.current;
    const d = {
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      moved: false,
      long: false,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    d.timer = setTimeout(() => {
      if (!d.moved) {
        d.long = true;
        setMenu(sisiSekarang());
      }
    }, PRESS_MS);
    drag.current = d;
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      d.moved = true;
      clearTimeout(d.timer);
      setDragging(true);
      setBubble(null);
    }
    if (d.moved) terapkan(jepit({ x: d.origX + dx, y: d.origY + dy }));
  }

  function selesaiTekan(e: React.PointerEvent<HTMLButtonElement>, batal: boolean) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    clearTimeout(d.timer);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // sudah dilepas
    }

    if (d.moved) {
      setDragging(false);
      simpanPos(posRef.current);
      onPos(posRef.current);
    } else if (!d.long && !batal) {
      // Tiga ketukan dalam 1 detik = kejutan; ketukan ketiga TIDAK membuka/menutup
      // chat (dua ketukan sebelumnya sudah saling membatalkan, jadi keadaan chat
      // kembali seperti semula).
      const now = performance.now();
      ketukRef.current = [...ketukRef.current.filter((t) => now - t < 1000), now];
      if (ketukRef.current.length >= 3) {
        ketukRef.current = [];
        tampilSalam();
      } else {
        onToggle();
      }
    }
  }

  // Menu & gelembung menempel pada robot: di atasnya bila robot di separuh bawah,
  // di bawahnya bila di atas; rata kanan/kiri menurut separuh layar robot.
  const kelasSisi = (s: Sisi) => cn(s.kanan ? "right-0" : "left-0", s.bawah ? "bottom-full mb-2" : "top-full mt-2");

  // Gelembung bicara: sedikit digeser menjauhi tepi robot (right-3 = ke kiri bila
  // robot di kanan), sudut yang menghadap robot dibuat lancip, dan ekor segitiga
  // kecil menempel di sudut itu - supaya terbaca sebagai balon bicara sungguhan.
  const kelasBalon = (sd: Sisi) =>
    cn(
      "bg-white px-4 py-2.5 text-left text-sm font-medium leading-snug text-paper shadow-lift",
      sd.kanan ? "right-3" : "left-3",
      sd.bawah ? "bottom-full mb-3" : "top-full mt-3",
      "rounded-2xl",
      sd.bawah ? (sd.kanan ? "rounded-br-none" : "rounded-bl-none") : sd.kanan ? "rounded-tr-none" : "rounded-tl-none",
    );
  const ekor = (sd: Sisi) => (
    <span
      aria-hidden="true"
      className={cn(
        "absolute h-3 w-3 bg-white",
        sd.kanan ? "right-0" : "left-0",
        sd.bawah ? "top-full" : "bottom-full",
        sd.bawah
          ? sd.kanan
            ? "[clip-path:polygon(0_0,100%_0,100%_100%)]"
            : "[clip-path:polygon(0_0,100%_0,0_100%)]"
          : sd.kanan
            ? "[clip-path:polygon(0_100%,100%_100%,100%_0)]"
            : "[clip-path:polygon(0_100%,100%_100%,0_0)]",
      )}
    />
  );

  const tampilBubble = bubble !== null && aktifBergerak && !salam;

  return (
    <div
      ref={wrapRef}
      className={cn("fixed left-0 top-0 z-[60] h-16 w-16 will-change-transform", !siap && "invisible")}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => selesaiTekan(e, false)}
        onPointerCancel={(e) => selesaiTekan(e, true)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(sisiSekarang());
        }}
        // Pencet lewat papan ketik (Enter/Spasi) tak melewati pointer; klik
        // mouse/sentuh sudah ditangani pointer-up (detail > 0), jadi jangan dobel.
        onClick={(e) => {
          if (e.detail === 0) onToggle();
        }}
        aria-label={open ? "Tutup Asisten SynapEd" : "Buka Asisten SynapEd (tahan untuk atur gerakan, seret untuk memindahkan)"}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-16 w-16 touch-none select-none items-center justify-center",
          "transition-transform duration-200 ease-out-soft hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <RobotFace />
      </button>

      {/* Gelembung ajakan */}
      {tampilBubble && bubble && (
        <button
          type="button"
          onClick={() => {
            setBubble(null);
            onToggle();
          }}
          className={cn(
            "absolute w-max max-w-[min(230px,calc(100vw-1rem))] animate-[robot-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)]",
            kelasBalon(bubble.sisi),
          )}
        >
          {bubble.teks}
          {ekor(bubble.sisi)}
        </button>
      )}

      {/* Kejutan ketuk 3x: ajakan follow Instagram (bisa diketuk, membuka profilnya) */}
      {salam && (
        <a
          href="https://www.instagram.com/nndulgha_/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setSalam(null)}
          className={cn(
            "absolute w-max max-w-[min(230px,calc(100vw-1rem))] animate-[robot-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)]",
            kelasBalon(salam.sisi),
          )}
        >
          Jangan lupa follow instagram @nndulgha_ ya
          {ekor(salam.sisi)}
        </a>
      )}

      {/* Menu pilihan gerakan */}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Gerakan asisten"
          className={cn("absolute w-44 bg-paper-card p-1.5 shadow-lift animate-[robot-pop_220ms_ease-out]", kelasSisi(menu))}
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Gerakan asisten</p>
          {(
            [
              { id: "diam", label: "Diam", ket: "Tetap di tempat" },
              { id: "gerak", label: "Bergerak", ket: "Hanyut pelan & menyapa" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={mode === o.id}
              disabled={hemat && o.id === "gerak"}
              onClick={() => pilihMode(o.id)}
              className={cn(
                "flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors duration-150 disabled:opacity-40",
                mode === o.id ? "bg-blue-600 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="text-sm font-semibold">{o.label}</span>
              <span className={cn("text-[11.5px]", mode === o.id ? "text-white/80" : "text-white/45")}>{o.ket}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Kepala robot, tanpa lingkaran latar: kepala besar berbentuk kotak membulat,
 * antena, dua mata yang berkedip, pipi, dan senyum. Bayangan lembut menjaga
 * kepala putih tetap terbaca di atas latar apa pun.
 */
function RobotFace() {
  return (
    <svg
      className="h-16 w-16 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {/* antena */}
      <path d="M32 14V7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="3.4" fill="#F3CF86" />
      {/* telinga */}
      <rect x="2.5" y="30" width="5.5" height="14" rx="2.75" fill="#BBD5FF" />
      <rect x="56" y="30" width="5.5" height="14" rx="2.75" fill="#BBD5FF" />
      {/* kepala */}
      <rect x="7" y="14" width="50" height="42" rx="15" fill="#fff" />
      {/* layar wajah */}
      <rect x="13" y="20" width="38" height="30" rx="11" fill="#0F2A44" />
      {/* mata */}
      <ellipse className="robot-eye" cx="23.5" cy="33" rx="4.2" ry="5" fill="#8DB8FF" />
      <ellipse className="robot-eye" cx="40.5" cy="33" rx="4.2" ry="5" fill="#8DB8FF" />
      {/* senyum */}
      <path d="M26 42.5c2.2 2.8 9.8 2.8 12 0" stroke="#8DB8FF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
