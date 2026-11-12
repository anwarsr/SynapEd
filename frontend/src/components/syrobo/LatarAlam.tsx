"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AwanLembut, BintangLaut, Defs, G, LG, Lantai, Penutup, RG, Saklar, mati, n1, r, type LatarProps } from "./LatarBersama";

/** Taman Bunga & Pantai Senja. Unsur alam (langit, rumput, laut, pasir) digambar bergradasi lembut tanpa garis tinta tebal. */

// ───────────────────────── TAMAN BUNGA ─────────────────────────
const PAGAR =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='80' viewBox='0 0 30 80'><rect x='-2' y='30' width='34' height='6' fill='%23D9CBAA' stroke='%238A7C64' stroke-width='1.4'/><rect x='-2' y='56' width='34' height='6' fill='%23D9CBAA' stroke='%238A7C64' stroke-width='1.4'/><path d='M4 78V18l11-10 11 10v60z' fill='%23F4EBD6' stroke='%238A7C64' stroke-width='1.6' stroke-linejoin='round'/><path d='M8 78V20l7-7' fill='none' stroke='%23fff' stroke-opacity='.55' stroke-width='1.6'/></svg>\")";

/** Helai rumput halus (garis tipis) tersebar rapat; makin ke bawah makin tinggi (perspektif). Tiga lapis warna. */
const RUMPUT = (() => {
  const mk = (n: number, seed: number) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = r(i, seed);
      const b = r(i, seed + 1);
      const c = r(i, seed + 2);
      const x = a * 1000;
      const y = 6 + Math.pow(b, 0.85) * 370;
      const h = 7 + (y / 380) * 26 + c * 7;
      const dx = (c - 0.5) * h * 0.9;
      d += `M${n1(x)} ${n1(y)}q${n1(dx * 0.25)} ${n1(-h * 0.55)} ${n1(dx)} ${n1(-h)}`;
    }
    return d;
  };
  return [
    { d: mk(420, 50), c: "#2F7A2A", o: 0.5 },
    { d: mk(380, 60), c: "#4E9F3C", o: 0.7 },
    { d: mk(260, 70), c: "#A4DC62", o: 0.8 },
  ];
})();

const PETAL: [string, string][] = [
  ["#E85D5D", "#B83A3A"],
  ["#F5C342", "#C99412"],
  ["#B27CE0", "#8450B5"],
  ["#F28CB8", "#C75A8C"],
  ["#FFFFFF", "#C2C9D4"],
  ["#FF9A4D", "#D06A1E"],
];
const UCAP_BUNGA = ["Bunganya mekar!", "Kupu-kupu datang!", "Wangi sekali.", "Taman yang ceria.", "Cantik sekali!"];

/** Bunga kecil tapi banyak: tersebar acak di rumput, makin dekat (makin rendah di layar) makin besar. */
const BUNGA_KECIL = Array.from({ length: 18 }, (_, i) => {
  const b = 14 + r(i, 41) * 21;
  return { x: 4 + r(i, 40) * 92, b, w: 2 + ((35 - b) / 21) * 1.8, k: Math.floor(r(i, 42) * 6), awal: r(i, 43) < 0.55 };
}).sort((a, c) => c.b - a.b);

const WARNA_KUPU = ["#F2C14E", "#F28CB8", "#6BA7D8", "#E56B5D", "#B58AE6"];

function Kupu({ warna, arah }: { warna: string; arah: number }) {
  return (
    <span aria-hidden="true" className="lt-kupu pointer-events-none absolute left-1/2 top-[8%] z-[3] -ml-[18px] block w-9" style={{ ["--arah" as string]: String(arah) }}>
      <span className="lt-hentak block">
        <svg viewBox="0 0 44 32" className="block w-full overflow-visible" {...G} strokeWidth={2.2}>
          <g className="lt-sayap" style={{ transformOrigin: "22px 16px" }}>
            <path d="M22 15C10 0 0 6 4 17c3 7 14 6 18-2z" fill={warna} />
            <path d="M22 15C34 0 44 6 40 17c-3 7-14 6-18-2z" fill={warna} />
            <path d="M22 17C14 19 10 29 16 30c5 0 7-6 6-13zM22 17C30 19 34 29 28 30c-5 0-7-6-6-13z" fill={warna} />
          </g>
          <path d="M22 8v18M22 8l-4-6M22 8l4-6" fill="none" />
        </svg>
      </span>
    </span>
  );
}

export function Taman(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const [buka, setBuka] = useState(() => BUNGA_KECIL.map((b) => b.awal));
  const [pop, setPop] = useState(() => BUNGA_KECIL.map(() => 0));
  const [kupu, setKupu] = useState<{ id: number; i: number }[]>([]);
  const [bibit, setBibit] = useState(0);
  const urut = useRef(0);
  // Awan diacak ulang tiap kunjungan, tetapi baru setelah terpasang (render server harus sama dengan klien).
  useEffect(() => {
    const t = setTimeout(() => setBibit(Math.floor(Math.random() * 9000) + 1), 0);
    return () => clearTimeout(t);
  }, []);
  const awan =
    bibit === 0
      ? []
      : Array.from({ length: 8 }, (_, i) => {
          const q = (s: number) => r(i + bibit * 0.37, s);
          const durasi = 70 + q(3) * 150;
          return { jenis: Math.floor(q(1) * 4) as 0 | 1 | 2 | 3, top: 4 + q(2) * 30, durasi, tunda: -q(4) * durasi, skala: 0.75 + q(5) * 0.4, o: 0.7 + q(6) * 0.3 };
        });
  const sentuh = (i: number) => {
    setBuka((m) => m.map((v, k) => (k === i ? true : v)));
    setPop((m) => m.map((v, k) => (k === i ? v + 1 : v)));
    const id = ++urut.current;
    setKupu((k) => [...k.slice(-4), { id, i }]);
    setTimeout(() => setKupu((k) => k.filter((x) => x.id !== id)), 6600);
    p.bisik(UCAP_BUNGA[(i + id) % UCAP_BUNGA.length]);
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <filter id="lt-t-kabur" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id="lt-t-kabur-jauh">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <LG id="lt-t-h1" s={[[0, "#B7D9BC"], [1, "#8FC59C"]]} />
        <LG id="lt-t-h2" s={[[0, "#97D082"], [1, "#6CB35A"]]} />
        <LG id="lt-t-h3" s={[[0, "#74BC58"], [1, "#4F9B3E"]]} />
      </Defs>
      {/* langit bergradasi halus + cahaya matahari di sudut */}
      <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: "radial-gradient(circle at 84% 10%,rgba(255,250,214,0.75),transparent 30%),linear-gradient(180deg,#4FA6E0 0%,#7DC2EC 32%,#BCE3F3 66%,#EAF3DF 100%)" }} />
      {awan.map((a, i) => (
        <div key={i} className="pointer-events-none absolute left-0" style={{ top: `${a.top}%`, transform: `scale(${a.skala.toFixed(2)})`, transformOrigin: "0 0", opacity: a.o }}>
          <AwanLembut jenis={a.jenis} filterId="lt-t-kabur" style={{ animationDuration: `${a.durasi.toFixed(0)}s`, animationDelay: `${a.tunda.toFixed(0)}s` }} />
        </div>
      ))}
      {/* bukit berlapis dengan kabut udara (makin jauh makin pucat) */}
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[30%] h-[34%] w-full">
        <path d="M0 96C100 40 230 30 340 70S560 110 680 62 880 20 1000 56V200H0z" fill="url(#lt-t-h1)" filter="url(#lt-t-kabur-jauh)" />
        <path d="M0 132C130 78 270 84 400 118S660 142 790 96 940 80 1000 98V200H0z" fill="url(#lt-t-h2)" />
        <path d="M0 176C160 128 300 150 450 162S740 134 880 142 970 158 1000 156V200H0z" fill="url(#lt-t-h3)" />
      </svg>
      {/* pagar kayu di tepi taman */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[37%] h-[9%]" style={{ backgroundImage: PAGAR, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }} />
      <Lantai garis={false} bayang="rgba(20,60,15,0.4)" style={{ background: "linear-gradient(180deg,#7CC055 0%,#62AF44 30%,#4A9A38 100%)" }} />
      {/* bercak cahaya matahari di rumput */}
      {[
        { l: "8%", t: "70%", w: "34%", h: "10%" },
        { l: "52%", t: "78%", w: "40%", h: "12%" },
        { l: "24%", t: "88%", w: "30%", h: "9%" },
      ].map((b, i) => (
        <div key={i} aria-hidden="true" className="pointer-events-none absolute rounded-[50%] bg-[#E6FF9A]/25 blur-[22px]" style={{ left: b.l, top: b.t, width: b.w, height: b.h }} />
      ))}
      {/* ribuan helai rumput halus */}
      <svg viewBox="0 0 1000 380" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[62%] h-[38%] w-full">
        {RUMPUT.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={l.c} strokeOpacity={l.o} strokeWidth="1.3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* bunga liar mungil (hiasan) */}
      {Array.from({ length: 44 }, (_, i) => (
        <span key={i} aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ left: `${(2 + r(i, 45) * 96).toFixed(1)}%`, top: `${(66 + r(i, 46) * 32).toFixed(1)}%`, width: 3 + r(i, 47) * 3, height: 3 + r(i, 47) * 3, background: ["#FFFFFF", "#FFF3A8", "#F7B6D2", "#D2B6F2"][i % 4], boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }} />
      ))}
      {/* bunga yang bisa disentuh: kuncup -> mekar, kupu-kupu terbang dari kelopaknya */}
      {BUNGA_KECIL.map((b, i) => {
        const [terang, tua] = PETAL[b.k];
        return (
          <div key={i} className="absolute z-[2]" style={{ left: `${b.x.toFixed(2)}%`, bottom: `${b.b.toFixed(2)}%`, width: `max(20px, ${b.w.toFixed(2)}vw)`, transform: "translateX(-50%)" }}>
            <button type="button" disabled={!benda} aria-label={`Bunga ${i + 1}`} onClick={() => sentuh(i)} className={cn("block w-full cursor-pointer", mati)}>
              <span key={pop[i]} className={cn("block", pop[i] > 0 && "lt-pop")}>
                <svg viewBox="0 0 40 84" className="block w-full overflow-visible">
                  <ellipse cx="20" cy="82" rx="9" ry="2.6" fill="#1F4A18" fillOpacity="0.3" />
                  <path d="M20 82C18 66 22 50 20 34" fill="none" stroke="#3E8A3A" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M19.5 66C13 66 8 62 6 56c7-1 12 3 13.5 10z" fill="#4FA043" />
                  <path d="M20.5 52C27 52 32 48 34 42c-7-1-12 3-13.5 10z" fill="#5DB04C" />
                  <g style={{ transformOrigin: "20px 26px", transform: buka[i] ? "scale(1)" : "scale(0.5)", transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1)" }}>
                    {[0, 60, 120, 180, 240, 300].map((a) => (
                      <ellipse key={a} cx="20" cy="14" rx="5.2" ry="8.4" transform={`rotate(${a} 20 26)`} fill={terang} stroke={tua} strokeWidth="0.9" />
                    ))}
                    <circle cx="20" cy="26" r="4.8" fill="#F2C94C" stroke="#B8901A" strokeWidth="0.9" />
                    <circle cx="18.6" cy="24.6" r="1" fill="#fff" fillOpacity="0.7" />
                  </g>
                </svg>
              </span>
            </button>
            {kupu.filter((k) => k.i === i).map((k) => (
              <Kupu key={k.id} warna={WARNA_KUPU[(i + k.id) % 5]} arah={b.x < 50 ? 1 : -1} />
            ))}
          </div>
        );
      })}
      {/* tiang lentera taman: tiangnya berdiri di tanah, lenteranya = saklar */}
      <div className="absolute z-[2] w-[clamp(38px,4.6vw,60px)]" style={{ right: "12%", bottom: "36%" }}>
        <svg viewBox="0 0 60 190" className="block w-full overflow-visible" {...G}>
          <ellipse cx="30" cy="188" rx="18" ry="5" fill="#2B2233" fillOpacity="0.25" stroke="none" />
          <path d="M30 186V56" strokeWidth="5" />
          <path d="M20 186h20" strokeWidth="5" />
        </svg>
        <Saklar {...p} kelas="absolute left-0 top-0 block w-full" label="Lentera taman">
          <svg viewBox="0 0 60 58" className="block w-full overflow-visible" {...G}>
            <path d="M8 22L30 4l22 18z" fill="#6E4A35" />
            <path d="M14 22h32l-4 26H18z" fill={p.gelap ? "#8E8672" : "#F2C14E"} />
            {!p.gelap && <path d="M22 28h16l-2 14H24z" fill="#FFF3A8" stroke="none" />}
            <path d="M14 50h32v6H14z" fill="#6E4A35" strokeWidth="2.4" />
          </svg>
        </Saklar>
      </div>
      {p.gelap &&
        Array.from({ length: 16 }, (_, i) => (
          <span key={i} aria-hidden="true" className="lt-kunang pointer-events-none absolute z-[21] h-2 w-2 rounded-full bg-[#FFF3A8] shadow-[0_0_10px_4px_rgba(255,243,168,0.7)]" style={{ left: `${6 + r(i, 1) * 88}%`, top: `${34 + r(i, 2) * 52}%`, animationDelay: `${r(i, 3) * 4}s`, animationDuration: `${3.2 + r(i, 4) * 3}s` }} />
        ))}
      <Penutup gelap={p.gelap} warna="#0F1A3A" />
    </div>
  );
}

// ───────────────────────── PANTAI SENJA ─────────────────────────
/**
 * Pelepah kelapa: tulang daun melengkung (makin ke ujung makin menjuntai) dengan puluhan anak daun BERBENTUK BILAH runcing yang
 * menjuntai ke bawah, dua pelepah tua menggantung di bawah mahkota. Dihitung sekali; koordinat dibulatkan (aman untuk hidrasi).
 */
const PALEM = (() => {
  const fronds: [number, number, number, number][] = [
    [10, 118, 0.62, 0],
    [34, 112, 0.5, 1],
    [62, 96, 0.38, 0],
    [92, 78, 0.2, 1],
    [120, 96, 0.38, 0],
    [146, 112, 0.5, 1],
    [170, 118, 0.62, 0],
    [-18, 70, 0.95, 2],
    [198, 70, 0.95, 2],
  ];
  return fronds.map(([deg, len, droop, nada]) => {
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = -Math.sin(a);
    const p1 = [ux * len * 0.5, uy * len * 0.5 - len * 0.16];
    const p2 = [ux * len, uy * len + droop * len];
    const B = (t: number) => [2 * (1 - t) * t * p1[0] + t * t * p2[0], 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
    const T = (t: number) => [2 * (1 - t) * p1[0] + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * p1[1] + 2 * t * (p2[1] - p1[1])];
    let rib = "M0 0";
    for (let k = 1; k <= 14; k++) {
      const [x, y] = B(k / 14);
      rib += `L${n1(x)} ${n1(y)}`;
    }
    let sa = "";
    let sb = "";
    for (let k = 1; k <= 24; k++) {
      const t = 0.07 + k * 0.038;
      const [x, y] = B(t);
      const [tx, ty] = T(t);
      const tl = Math.hypot(tx, ty) || 1;
      const tux = tx / tl;
      const tuy = ty / tl;
      const lf = (30 - t * 20) * (len / 110) * (0.88 + ((k * 37) % 7) / 28);
      for (const s of [1, -1]) {
        const ang = ((74 - t * 26) * Math.PI) / 180 * s;
        let dx = tux * Math.cos(ang) - tuy * Math.sin(ang);
        let dy = tux * Math.sin(ang) + tuy * Math.cos(ang) + 0.62 + t * 0.4;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const bx = tux * 1.5;
        const by = tuy * 1.5;
        const seg = `M${n1(x - bx)} ${n1(y - by)}L${n1(x + dx * lf)} ${n1(y + dy * lf)}L${n1(x + bx)} ${n1(y + by)}Z`;
        if (s === 1) sa += seg;
        else sb += seg;
      }
    }
    return { rib, sa, sb, nada };
  });
})();
const DAUN: [string, string][] = [
  ["#3E7D36", "#52994A"],
  ["#356F2F", "#4A8C42"],
  ["#8A8A3A", "#A39A44"],
];

/** Payung: tujuh panel berselang-seling, rusuk melengkung dari puncak ke tepi bergerigi. */
const PAYUNG = (() => {
  const n = 7;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const th = Math.PI - (i / n) * Math.PI;
    return [100 + 92 * Math.cos(th), 88 + 11 * Math.sin(th)] as const;
  });
  const ctl = (px: number, py: number) => [100 + (px - 100) * 0.7, 24 + (py - 24) * 0.25] as const;
  return Array.from({ length: n }, (_, i) => {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const [c1x, c1y] = ctl(ax, ay);
    const [c2x, c2y] = ctl(bx, by);
    return `M100 16Q${n1(c1x)} ${n1(c1y)} ${n1(ax)} ${n1(ay)}Q${n1((ax + bx) / 2)} ${n1((ay + by) / 2 + 10)} ${n1(bx)} ${n1(by)}Q${n1(c2x)} ${n1(c2y)} 100 16Z`;
  });
})();

/** Satu lapis ombak lembut: gelombang sinus berisi (bukan garis), digeser horizontal sejauh tepat dua periode supaya mulus tanpa putus. */
function Gelombang({ top, tinggi, warna, durasi, balik = false }: { top: string; tinggi: string; warna: string; durasi: string; balik?: boolean }) {
  return (
    <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true" className="lt-ayun pointer-events-none absolute left-0 w-[200%]" style={{ top, height: tinggi, animationDuration: durasi, animationDirection: balik ? "reverse" : "normal" }}>
      <path d="M0 10Q12.5 1 25 10T50 10T75 10T100 10T125 10T150 10T175 10T200 10V20H0Z" fill={warna} />
    </svg>
  );
}

export function Pantai(p: LatarProps) {
  // Menekan MATAHARI = tidur: matahari tenggelam, bulan terbit, langit berganti malam.
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <RG id="lt-p-kerang" cx={0.5} cy={0.8} s={[[0, "#FFF1E6"], [0.6, "#F6C9B8"], [1, "#D9958A"]]} />
        <LG id="lt-p-batang" h s={[[0, "#6B4528"], [0.45, "#B07A4E"], [1, "#7A5232"]]} />
        <LG id="lt-p-kanopi" h s={[[0, "#fff", 0.26], [0.5, "#fff", 0], [1, "#000", 0.3]]} />
        <RG id="lt-p-matahari" s={[[0, "#FFFDF0"], [0.42, "#FFEFB5"], [0.82, "#FFC56A"], [1, "#FF9F4D"]]} />
        <RG id="lt-p-bulan" cx={0.4} cy={0.38} s={[[0, "#FFFFFF"], [0.6, "#EEF0F6"], [1, "#BFC6D8"]]} />
      </Defs>
      {/* langit: siang-senja dan malam saling melebur */}
      <div className="absolute inset-x-0 top-0 h-[47%]" style={{ background: "linear-gradient(180deg,#3E3A8E 0%,#7B4FA2 20%,#C5589A 40%,#F2806F 60%,#FFB070 80%,#FFD89E 100%)" }} />
      <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-[47%] transition-opacity duration-[2800ms]", p.gelap ? "opacity-100" : "opacity-0")} style={{ background: "linear-gradient(180deg,#060A22 0%,#0F1944 38%,#1F2C66 68%,#3A4682 100%)" }} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-[47%] transition-opacity duration-[2800ms]", p.gelap ? "opacity-100" : "opacity-0")}>
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} className="syrobo-bintang absolute rounded-full bg-[#F6F0D8]" style={{ left: `${(r(i, 80) * 100).toFixed(1)}%`, top: `${(r(i, 81) * 85).toFixed(1)}%`, width: 1.5 + r(i, 82) * 2, height: 1.5 + r(i, 82) * 2, animationDelay: `${(r(i, 83) * 3).toFixed(1)}s` }} />
        ))}
      </div>
      {/* awan memanjang yang disinari matahari terbenam (memudar saat malam) */}
      <div className={cn("transition-opacity duration-[2800ms]", p.gelap ? "opacity-0" : "opacity-100")}>
        {[
          { t: 9, w: 34, h: 3.2, c: "rgba(255,170,150,0.55)", d: "140s", dl: "-40s" },
          { t: 20, w: 26, h: 2.4, c: "rgba(255,206,160,0.6)", d: "180s", dl: "-120s" },
          { t: 30, w: 38, h: 2.8, c: "rgba(120,70,150,0.45)", d: "160s", dl: "-80s" },
        ].map((a, i) => (
          <div key={i} aria-hidden="true" className="lt-awan pointer-events-none absolute rounded-[50%] blur-[7px]" style={{ top: `${a.t}%`, width: `${a.w}vw`, height: `${a.h}vh`, background: a.c, animationDuration: a.d, animationDelay: a.dl }} />
        ))}
      </div>
      {/* kabut cakrawala */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[36%] h-[14%]" style={{ background: "linear-gradient(180deg,transparent,rgba(255,200,140,0.5),transparent)", opacity: p.gelap ? 0.25 : 1, transition: "opacity 2.8s ease-in-out" }} />
      {/* halo lembut: hangat untuk matahari, dingin untuk bulan (tanpa tepi keras) */}
      <div aria-hidden="true" className="pointer-events-none absolute rounded-full transition-opacity duration-[2800ms]" style={{ left: "calc(37% - 17vmin)", bottom: "calc(53% - 14vmin)", width: "48vmin", height: "48vmin", background: "radial-gradient(closest-side,rgba(255,226,160,0.7),rgba(255,170,100,0.34) 38%,rgba(255,150,90,0.1) 62%,transparent 80%)", opacity: p.gelap ? 0 : 1 }} />
      <div aria-hidden="true" className="pointer-events-none absolute rounded-full transition-opacity duration-[2800ms]" style={{ left: "calc(37% - 15vmin)", bottom: "calc(53% - 12vmin)", width: "44vmin", height: "44vmin", background: "radial-gradient(closest-side,rgba(200,215,255,0.5),rgba(150,175,235,0.2) 45%,transparent 78%)", opacity: p.gelap ? 1 : 0 }} />
      {/* matahari / bulan = saklar tidur. Berada DI BELAKANG laut: yang satu tenggelam ke balik cakrawala, yang lain terbit dari baliknya (berurutan, pelan) */}
      <div className="absolute" style={{ left: "37%", bottom: "calc(53% - 5vmin)", width: "14vmin", height: "14vmin" }}>
        <Saklar {...p} z="z-0" kelas="relative block h-full w-full rounded-full" label={p.gelap ? "Bulan: bangunkan" : "Matahari: tidurkan"}>
          <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ backgroundImage: "radial-gradient(circle at 50% 46%,#FFFDF0 0%,#FFEFB5 42%,#FFC56A 82%,#FF9F4D 100%)", boxShadow: "0 0 5vmin 1.5vmin rgba(255,196,120,0.55)", transform: p.gelap ? "translateY(115%)" : "translateY(0)", opacity: p.gelap ? 0.2 : 1, transition: `transform 2800ms cubic-bezier(0.45,0,0.4,1) ${p.gelap ? 0 : 900}ms, opacity 2800ms ease-in-out ${p.gelap ? 0 : 900}ms` }} />
          <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ backgroundImage: "radial-gradient(circle at 38% 36%,#FFFFFF 0%,#EEF0F6 55%,#BFC6D8 100%)", boxShadow: "0 0 4vmin 1vmin rgba(190,205,255,0.4)", transform: p.gelap ? "translateY(0)" : "translateY(115%)", opacity: p.gelap ? 1 : 0.2, transition: `transform 2800ms cubic-bezier(0.45,0,0.4,1) ${p.gelap ? 900 : 0}ms, opacity 2800ms ease-in-out ${p.gelap ? 900 : 0}ms` }}>
            <i className="absolute left-[24%] top-[26%] h-[16%] w-[16%] rounded-full bg-[#9AA3BD]/35" />
            <i className="absolute left-[58%] top-[44%] h-[22%] w-[22%] rounded-full bg-[#9AA3BD]/30" />
            <i className="absolute left-[30%] top-[62%] h-[11%] w-[11%] rounded-full bg-[#9AA3BD]/30" />
            <i className="absolute left-[62%] top-[18%] h-[9%] w-[9%] rounded-full bg-[#9AA3BD]/28" />
          </span>
        </Saklar>
      </div>
      {/* laut: warna cakrawala memantulkan langit lalu menua ke biru; ombak = gelombang berisi bertumpuk */}
      <div className="absolute inset-x-0 top-[47%] h-[15%] overflow-hidden" style={{ background: "linear-gradient(180deg,#F09A7C 0%,#B26F95 22%,#486FA6 55%,#274F85 100%)" }}>
        <div aria-hidden="true" className={cn("absolute inset-0 transition-opacity duration-[2800ms]", p.gelap ? "opacity-100" : "opacity-0")} style={{ background: "linear-gradient(180deg,#1B2A5E 0%,#17306A 35%,#112250 100%)" }} />
        {/* pantulan matahari/bulan: kabut cahaya lembut yang melebar ke bawah, tanpa garis */}
        <div aria-hidden="true" className="absolute top-0 h-full transition-opacity duration-[2800ms]" style={{ left: "calc(37% + 7vmin)", width: "16vmin", transform: "translateX(-50%)", background: "radial-gradient(ellipse 50% 100% at 50% 0%,rgba(255,214,140,0.75),rgba(255,180,110,0.28) 55%,transparent 80%)", filter: "blur(5px)", opacity: p.gelap ? 0 : 1 }} />
        <div aria-hidden="true" className="absolute top-0 h-full transition-opacity duration-[2800ms]" style={{ left: "calc(37% + 7vmin)", width: "13vmin", transform: "translateX(-50%)", background: "radial-gradient(ellipse 50% 100% at 50% 0%,rgba(210,222,255,0.55),rgba(150,175,235,0.18) 55%,transparent 80%)", filter: "blur(5px)", opacity: p.gelap ? 1 : 0 }} />
        <Gelombang top="38%" tinggi="36%" warna="rgba(40,86,150,0.28)" durasi="19s" balik />
        <Gelombang top="62%" tinggi="40%" warna="rgba(16,44,98,0.38)" durasi="14s" />
      </div>
      {/* pasir: basah gelap di tepi air, makin kering makin terang */}
      <Lantai garis={false} bayang="rgba(120,80,40,0.25)" style={{ background: "linear-gradient(180deg,#B8976A 0%,#D6B885 7%,#E8C98F 28%,#F1D9A8 100%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[62%] opacity-[0.2]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.36  0 0 0 0 0.2  0 0 0 0.9 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")" }} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 bottom-0 top-[62%] transition-opacity duration-[2800ms]", p.gelap ? "opacity-100" : "opacity-0")} style={{ background: "linear-gradient(180deg,rgba(20,30,80,0.45),rgba(20,30,80,0.25))" }} />
      {/* peralihan laut -> pasir: pita gradasi berkabur (tanpa tepi keras, tanpa buih putih) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[59.6%] h-[6.4%]" style={{ background: "linear-gradient(180deg,rgba(39,79,133,0) 0%,#3A6592 14%,#6E86A0 34%,#A5977E 54%,#BFA074 76%,rgba(184,151,106,0) 100%)", filter: p.gelap ? "brightness(0.45) saturate(0.85)" : "none", transition: "filter 2.8s ease-in-out", maskImage: "linear-gradient(180deg,transparent,#000 22%,#000 70%,transparent)", WebkitMaskImage: "linear-gradient(180deg,transparent,#000 22%,#000 70%,transparent)" }} />
      {/* kerang & bintang laut tersebar (tanpa bayangan) */}
      {[
        { x: 13, y: 82, k: 0 },
        { x: 33, y: 93, k: 1 },
        { x: 44, y: 81, k: 1 },
        { x: 87, y: 91, k: 0 },
        { x: 58, y: 97, k: 0 },
        { x: 24, y: 70, k: 2 },
      ].map((k, i) => (
        <div key={i} aria-hidden="true" className="pointer-events-none absolute" style={{ left: `${k.x}%`, top: `${k.y}%`, transform: `rotate(${(i - 2) * 17}deg)` }}>
          {k.k === 0 ? (
            <svg viewBox="0 0 30 30" className="w-[clamp(18px,2.4vw,32px)]">
              <path d="M15 25C4 23 1 13 4 9C8 3 22 3 26 9C29 13 26 23 15 25Z" fill="url(#lt-p-kerang)" stroke="#B9786C" strokeWidth="0.8" />
              <path d="M15 24L5 10M15 24L9 6M15 24L15 4M15 24L21 6M15 24L25 10" fill="none" stroke="#B9786C" strokeOpacity="0.6" strokeWidth="0.9" />
              <path d="M11 26h8l-1 3h-6z" fill="#E9B79F" stroke="#B9786C" strokeWidth="0.7" />
            </svg>
          ) : k.k === 1 ? (
            <BintangLaut kelas="w-[clamp(20px,2.8vw,38px)]" />
          ) : (
            <svg viewBox="0 0 30 30" className="w-[clamp(18px,2.4vw,32px)]">
              <path d="M6 22C2 14 8 4 17 5c8 1 10 8 7 13-1 4-5 7-9 7-3 0-6-1-9-3z" fill="url(#lt-p-kerang)" stroke="#B9786C" strokeWidth="0.8" />
              <path d="M17 5c-4 2-5 8-1 12 3 3 7 2 8-1M16 11c2-1 4 0 4 3" fill="none" stroke="#B9786C" strokeOpacity="0.7" strokeWidth="0.9" />
            </svg>
          )}
        </div>
      ))}
      {/* pohon kelapa: batang meruncing berbuku, pelepah berbilah menjuntai */}
      <div className="pointer-events-none absolute left-[16%] z-[1] w-[clamp(130px,16vw,215px)] max-sm:left-[30%] max-sm:w-[50vw]" style={{ bottom: "34%" }}>
        <svg viewBox="-10 -70 240 380" className="block w-full overflow-visible">
          <ellipse cx="98" cy="302" rx="44" ry="7" fill="#3A2A18" fillOpacity="0.28" style={{ filter: "blur(4px)" }} />
          <path d="M86 300C88 224 98 150 106 72L120 72C112 150 108 224 112 300Z" fill="url(#lt-p-batang)" stroke="#5A3A22" strokeWidth="1" strokeLinejoin="round" />
          {Array.from({ length: 17 }, (_, i) => {
            const y = 290 - i * 13;
            const t = (300 - y) / 228;
            const xl = 86 + 20 * t;
            const xr = 112 + 8 * t;
            return <path key={i} d={`M${n1(xl)} ${y}Q${n1((xl + xr) / 2)} ${y + 5} ${n1(xr)} ${y}`} fill="none" stroke="#4A2E18" strokeOpacity={0.5 - i * 0.012} strokeWidth="1.5" />;
          })}
          <g transform="translate(112 68)">
            {PALEM.map((f, i) => (
              <g key={i}>
                <path d={f.sa} fill={DAUN[f.nada][0]} />
                <path d={f.sb} fill={DAUN[f.nada][1]} />
                <path d={f.rib} stroke="#35552A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              </g>
            ))}
          </g>
          {[
            [106, 76],
            [120, 79],
            [113, 86],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7.4" fill="#7A5230" stroke="#4A2E18" strokeWidth="1" />
              <ellipse cx={x - 2} cy={y - 2.4} rx="2.6" ry="1.8" fill="#C79A64" fillOpacity="0.7" />
            </g>
          ))}
        </svg>
      </div>
      {/* handuk pantai terbentang di pasir (tidak bersinggungan dengan tiang payung) */}
      <svg viewBox="0 0 220 84" aria-hidden="true" className="pointer-events-none absolute w-[clamp(130px,17vw,220px)]" style={{ right: "26%", bottom: "13%" }}>
        <polygon points="40,10 192,10 218,70 12,70" fill="#000" fillOpacity="0.22" transform="translate(0 5)" style={{ filter: "blur(3px)" }} />
        {Array.from({ length: 7 }, (_, k) => {
          const x0 = 40 + k * 21.7;
          const x1 = 40 + (k + 1) * 21.7;
          const b0 = 12 + k * 29.4;
          const b1 = 12 + (k + 1) * 29.4;
          return <polygon key={k} points={`${n1(x0)},10 ${n1(x1)},10 ${n1(b1)},70 ${n1(b0)},70`} fill={k % 2 ? "#F6EAD2" : "#2F6FB5"} />;
        })}
        <path d="M12 70L218 70" stroke="#E9DDC4" strokeWidth="5" strokeDasharray="1.6 2.4" />
        <polygon points="40,10 192,10 218,70 12,70" fill="url(#lt-p-kanopi)" fillOpacity="0.4" />
      </svg>
      {/* payung pantai di barisan depan, DI ATAS robot (robot berjalan di belakangnya); bayangan simetris di pusat tiang */}
      <div className="pointer-events-none absolute z-[12] w-[clamp(150px,20vw,260px)] max-sm:w-[58vw]" style={{ right: "9%", bottom: "13%" }}>
        <svg viewBox="0 0 200 250" className="pointer-events-none block w-full overflow-visible">
          <ellipse cx="100" cy="240" rx="62" ry="9" fill="#5A3A18" fillOpacity="0.3" style={{ filter: "blur(5px)" }} />
          <ellipse cx="100" cy="239" rx="22" ry="4" fill="#5A3A18" fillOpacity="0.4" style={{ filter: "blur(2px)" }} />
          <path d="M100 238V20" stroke="#8D929B" strokeWidth="5" strokeLinecap="round" />
          <path d="M98.4 236V22" stroke="#D5D9DF" strokeWidth="1.6" strokeLinecap="round" />
          {PAYUNG.map((d, i) => (
            <path key={i} d={d} fill={i % 2 ? "#F6E9D0" : "#D9473F"} stroke="#7A2A24" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />
          ))}
          {PAYUNG.map((d, i) => (
            <path key={`s${i}`} d={d} fill="url(#lt-p-kanopi)" />
          ))}
          <circle cx="100" cy="15" r="3.4" fill="#C9CDD4" stroke="#8D929B" strokeWidth="0.8" />
        </svg>
      </div>
      <Penutup gelap={p.gelap} warna="#1B1440" />
    </div>
  );
}
