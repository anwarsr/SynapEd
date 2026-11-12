"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Defs, LG, Penutup, RG, Saklar, mati, n1, r, type LatarProps } from "./LatarBersama";

/** Istana Kerajaan (Premium). Pilar menjulang sampai langit-langit, takhta di atas panggung yang dinaiki permadani, jendela kaca patri bertirai. */

const WARNA_KONFETI = ["#F2C14E", "#E56B5D", "#6BA7D8", "#6BE0A8", "#F28CB8"];

/** Koordinat panggung & permadani dalam persen layar (x) dan persen tinggi layar (y); y dipetakan ke kotak svg yang mulai di 55%. */
const Y = (pct: number) => (((pct - 55) / 45) * 100).toFixed(2);
const poligon = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(2)},${Y(y)}`).join(" ");

/**
 * Tepi permadani (y, setengah lebar): di lantai menyempit ke arah takhta mengikuti perspektif, tetapi di BIDANG TEGAK anak tangga
 * (tanjakan) tepinya lurus vertikal, lalu kembali menyempit di injakan. Itulah yang membuat garis emas permadani menekuk di tiap tangga.
 */
const TEPI: [number, number][] = [
  [57.5, 7.8],
  [58.5, 8.2],
  [61.5, 8.2],
  [63.5, 9.1],
  [66.5, 9.1],
  [100, 20],
];
const sisi = (extra: number, kiri: boolean): [number, number][] => TEPI.map(([y, h]) => [kiri ? 50 - h - extra : 50 + h + extra, y]);
/**
 * Lantai marmer berperspektif sebagai poligon svg datar (BUKAN transform 3D CSS: lapisan 3D dilukis di atas permadani walau z-index lebih
 * rendah). Baris rapat di dekat cakrawala dan merenggang ke arah penonton; kolom menyempit ke titik hilang di atas cakrawala.
 */
const LANTAI_GELAP = (() => {
  const K = 9;
  const J = 18;
  const yv = -45;
  const u = (k: number) => 1 / (1 + 0.5 * (K - k));
  const s = (k: number) => ((u(k) - u(0)) / (1 - u(0))) * 100;
  const xAt = (xb: number, y: number) => 50 + ((xb - 50) * (y - yv)) / (100 - yv);
  let d = "";
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < J; j++) {
      if ((j + k) % 2) continue;
      const xa = 50 + (j - J / 2) * 9;
      const xb = xa + 9;
      const y0 = s(k);
      const y1 = s(k + 1);
      d += `M${xAt(xa, y0).toFixed(2)} ${y0.toFixed(2)}L${xAt(xb, y0).toFixed(2)} ${y0.toFixed(2)}L${xAt(xb, y1).toFixed(2)} ${y1.toFixed(2)}L${xAt(xa, y1).toFixed(2)} ${y1.toFixed(2)}Z`;
    }
  }
  return d;
})();
const kelilingPermadani = (extra: number): [number, number][] => [...sisi(extra, true), ...[...sisi(extra, false)].reverse()];

function Pilar({ x }: { x: string }) {
  return (
    <div className="pointer-events-none absolute top-0 z-[1] flex w-[clamp(34px,4.4vw,58px)] flex-col" style={{ left: x, bottom: "35%", transform: "translateX(-50%)" }}>
      <svg viewBox="0 0 60 46" className="block w-full shrink-0 overflow-visible" strokeLinejoin="round">
        <path d="M0 0h60v9H0z" fill="url(#lt-i-emas-h)" stroke="#7A5208" strokeWidth="0.9" />
        <path d="M5 9h50c0 6-4 10-8 12 4 3 6 9 6 15H7c0-6 2-12 6-15-4-2-8-6-8-12z" fill="url(#lt-i-emas-h)" stroke="#7A5208" strokeWidth="0.9" />
        <path d="M8 46C8 34 15 28 22 30 24 23 36 23 38 30 45 28 52 34 52 46z" fill="#E8B84A" stroke="#7A5208" strokeWidth="0.9" />
      </svg>
      <div className="relative -mt-px mx-[10%] min-h-0 flex-1" style={{ background: "linear-gradient(90deg,#9A6A14,#F6D27A 28%,#E8B84A 52%,#B9831F 82%,#8A5A0E)" }}>
        <div aria-hidden="true" className="absolute inset-y-0 left-[14%] w-[8%] bg-white/25 blur-[2px]" />
      </div>
      <svg viewBox="0 0 60 26" className="-mt-px block w-full shrink-0 overflow-visible" strokeLinejoin="round">
        <path d="M10 0h40v6H10z" fill="url(#lt-i-emas-h)" stroke="#7A5208" strokeWidth="0.9" />
        <path d="M4 6h52v8H4z" fill="url(#lt-i-emas-h)" stroke="#7A5208" strokeWidth="0.9" />
        <path d="M0 14h60v10H0z" fill="#D9A63A" stroke="#7A5208" strokeWidth="0.9" />
        <ellipse cx="30" cy="25" rx="30" ry="2.4" fill="#000" fillOpacity="0.3" />
      </svg>
    </div>
  );
}

/**
 * Tirai beludru: digantung pada tongkat bercincin di atas jendela, tiap sisi berkumpul di simpul pengikat lalu melebar jatuh sampai
 * ambang. Lipatan = pita-pita selang-seling terang/gelap yang mengikuti lengkung tirai (bukan garis tipis), plus bayangan di pangkal & ujung.
 */
const TIRAI: [number, number, number][] = [
  [10, 8, 44],
  [60, 12, 43],
  [112, 25, 42],
  [150, 13, 45],
  [190, 5, 47],
  [214, 3, 48],
];
const tirai = (y: number): [number, number] => {
  for (let i = 0; i < TIRAI.length - 1; i++) {
    const [y0, a0, b0] = TIRAI[i];
    const [y1, a1, b1] = TIRAI[i + 1];
    if (y >= y0 && y <= y1) {
      const s = (1 - Math.cos(Math.PI * ((y - y0) / (y1 - y0)))) / 2;
      return [a0 + (a1 - a0) * s, b0 + (b1 - b0) * s];
    }
  }
  return [TIRAI[TIRAI.length - 1][1], TIRAI[TIRAI.length - 1][2]];
};
const LIPATAN = [0, 0.15, 0.3, 0.46, 0.62, 0.78, 0.92, 1];
const KAIN_YS = Array.from({ length: 26 }, (_, i) => 10 + i * 8.16);
const bentukTirai = (kiri: boolean) => {
  const x = (v: number) => (kiri ? v : 160 - v);
  const pts = (u: number) =>
    KAIN_YS.map((y) => {
      const [a, b] = tirai(y);
      return `${n1(x(a + (b - a) * u))} ${n1(y)}`;
    });
  return {
    garis: `M${pts(0).join("L")}L${[...pts(1)].reverse().join("L")}Z`,
    lajur: LIPATAN.slice(0, -1).map((u0, i) => `M${pts(u0).join("L")}L${[...pts(LIPATAN[i + 1])].reverse().join("L")}Z`),
  };
};
const TIRAI_BENTUK = [bentukTirai(true), bentukTirai(false)];

function Tirai({ kiri }: { kiri: boolean }) {
  const b = TIRAI_BENTUK[kiri ? 0 : 1];
  const x = (v: number) => (kiri ? v : 160 - v);
  return (
    <g>
      <path d={b.garis} fill="url(#lt-i-kain)" />
      {b.lajur.map((d, i) => (
        <path key={i} d={d} fill={i % 2 ? "#6F92E0" : "#0F1E4A"} fillOpacity={i % 2 ? 0.2 : 0.3} style={{ filter: "blur(0.7px)" }} />
      ))}
      <path d={b.garis} fill="url(#lt-i-kain-bayang)" />
      <path d={`M${n1(x(tirai(204)[0]))} 204L${n1(x(tirai(204)[1]))} 204L${n1(x(tirai(214)[1]))} 214L${n1(x(tirai(214)[0]))} 214Z`} fill="#F2C14E" fillOpacity="0.9" />
      <path d={`M${x(23)} 111Q${x(33)} 119 ${x(44)} 111`} fill="none" stroke="#7A5208" strokeWidth="4.6" strokeLinecap="round" />
      <path d={`M${x(23)} 111Q${x(33)} 119 ${x(44)} 111`} fill="none" stroke="#F2C14E" strokeWidth="2.8" strokeLinecap="round" />
      <path d={`M${x(43)} 114v9`} stroke="#B9831F" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M${x(43)} 122c-3 0-4 3-4 7 0 3 2 5 4 5s4-2 4-5c0-4-1-7-4-7z`} fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.7" />
    </g>
  );
}

/** Jendela lengkung kaca patri di balik tirai: bingkai batu bersambung ambang, mawar & petak berwarna berkawat timah. */
function Jendela({ uid, x }: { uid: string; x: string }) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute z-[1] hidden skew-x-[-22deg] blur-[7px] sm:block" style={{ left: `calc(${x} + 1vw)`, top: "63%", width: "7vw", height: "26%", background: "linear-gradient(180deg,rgba(190,215,255,0.28),transparent)" }} />
      <svg viewBox="0 0 160 226" aria-hidden="true" className="pointer-events-none absolute top-[24%] z-[1] hidden w-[clamp(100px,11.5vw,150px)] overflow-visible sm:block" style={{ left: x }} strokeLinejoin="round">
        <defs>
          <clipPath id={`${uid}-kaca`}>
            <path d="M44 206V82C44 50 60 32 80 32s36 18 36 50v124z" />
          </clipPath>
        </defs>
        {/* bingkai batu: lengkung bersusun batu baji, bibir bergaris cahaya, batu kunci menonjol */}
        <path d="M36 212V78C36 42 56 22 80 22s44 20 44 56v134z" fill="url(#lt-i-batu)" stroke="#6B5E48" strokeWidth="1.4" />
        <path d="M40 210V80C40 46 58 27 80 27s40 19 40 53v130z" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.4" />
        {[20, 40, 60, 80, 100, 120, 140, 160].map((d) => {
          const a = (d * Math.PI) / 180;
          return <path key={d} d={`M${n1(80 + Math.cos(a) * 37)} ${n1(82 - Math.sin(a) * 51)}L${n1(80 + Math.cos(a) * 44)} ${n1(82 - Math.sin(a) * 59)}`} stroke="#7E705A" strokeOpacity="0.55" strokeWidth="0.9" />;
        })}
        <path d="M71 21h18l-2.4 13H73.4z" fill="#EDE3CC" stroke="#6B5E48" strokeWidth="1.1" />
        <path d="M44 206V82C44 50 60 32 80 32s36 18 36 50v124z" fill="#2E58A8" />
        <g clipPath={`url(#${uid}-kaca)`}>
          <rect x="44" y="32" width="72" height="174" fill="url(#lt-i-langit)" />
          {[
            [44, 104, 36, 36, "#F2C14E"],
            [80, 104, 36, 36, "#D9473F"],
            [44, 140, 36, 36, "#3FC98A"],
            [80, 140, 36, 36, "#F2C14E"],
            [44, 176, 36, 30, "#D9473F"],
            [80, 176, 36, 30, "#6FA0E8"],
          ].map(([a, b, c, d, f], i) => (
            <g key={i}>
              <rect x={a as number} y={b as number} width={c as number} height={d as number} fill={f as string} fillOpacity="0.84" />
              <rect x={(a as number) + 1.5} y={(b as number) + 1.5} width={(c as number) - 3} height={(d as number) - 3} fill="url(#lt-i-kaca-kilau)" />
            </g>
          ))}
          <circle cx="80" cy="70" r="20" fill="#F2C14E" fillOpacity="0.85" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <path key={k} d={`M80 70L${n1(80 + Math.cos((k * Math.PI) / 4) * 20)} ${n1(70 + Math.sin((k * Math.PI) / 4) * 20)}A20 20 0 0 1 ${n1(80 + Math.cos(((k + 1) * Math.PI) / 4) * 20)} ${n1(70 + Math.sin(((k + 1) * Math.PI) / 4) * 20)}Z`} fill={["#D9473F", "#3FC98A", "#6FA0E8", "#F6F0E2"][k % 4]} fillOpacity="0.8" />
          ))}
          <path d="M44 32h72L44 134z" fill="#fff" fillOpacity="0.1" />
          <path d="M70 206L116 150V206z" fill="#fff" fillOpacity="0.06" />
          {/* kedalaman ceruk: bayangan di sisi dalam bingkai */}
          <path d="M44 206V82C44 50 60 32 80 32s36 18 36 50v124" fill="none" stroke="#000" strokeOpacity="0.38" strokeWidth="6" />
        </g>
        {/* ambang batu bertumpuk dengan bayangan di bawahnya */}
        <rect x="32" y="221" width="96" height="5" rx="2" fill="#000" fillOpacity="0.28" style={{ filter: "blur(2px)" }} />
        <path d="M30 206h100l4 6H26z" fill="#E6DAC0" stroke="#6B5E48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M26 212h108v9H26z" fill="#BFB090" stroke="#6B5E48" strokeWidth="1.1" />
        <path d="M26 212h108" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
        <Tirai kiri />
        <Tirai kiri={false} />
        <path d="M0 8H160" stroke="#6A430A" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M0 7H160" stroke="#F2C14E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="8" r="5" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.9" />
        <circle cx="158" cy="8" r="5" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.9" />
      </svg>
    </>
  );
}

/** Lampu gantung kristal berlilin: rantai, tiang tengah bermahkota, dua tingkat lengan melengkung bercawan, tetesan kristal & untaian manik. */
function Lampu({ gelap }: { gelap: boolean }) {
  const lengan: [number, number][] = [[20, 146], [48, 150], [112, 150], [140, 146]];
  const atas: [number, number][] = [[56, 112], [104, 112]];
  const lilin: [number, number][] = [...lengan, ...atas];
  return (
    <svg viewBox="0 0 160 222" className="block w-full overflow-visible" strokeLinejoin="round" strokeLinecap="round">
      <path d="M80 0V98" stroke="#7A5208" strokeWidth="5.4" strokeDasharray="8 3" />
      <path d="M80 0V98" stroke="#F2C14E" strokeWidth="3.2" strokeDasharray="8 3" />
      <ellipse cx="80" cy="100" rx="10" ry="7" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="1" />
      <path d="M80 106C70 112 72 124 76 132C72 140 72 150 78 160L82 160C88 150 88 140 84 132C88 124 90 112 80 106Z" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="1" />
      {[...lengan.map(([x, y]) => [80, 158, x, y] as const), ...atas.map(([x, y]) => [80, 128, x, y] as const)].map(([x0, y0, x, y], i) => (
        <g key={i}>
          <path d={`M${x0} ${y0}Q${(x0 + x) / 2} ${y0 + 22} ${x} ${y}`} fill="none" stroke="#7A5208" strokeWidth="6" />
          <path d={`M${x0} ${y0}Q${(x0 + x) / 2} ${y0 + 22} ${x} ${y}`} fill="none" stroke="url(#lt-i-emas)" strokeWidth="3.4" />
        </g>
      ))}
      {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => (
        <circle key={t} cx={n1(20 + 120 * t)} cy={n1(146 + 25 * 2 * t * (1 - t) * 1.0)} r="2.2" fill="#DCEBFF" stroke="#8FA9D0" strokeWidth="0.6" />
      ))}
      {[34, 56, 80, 104, 126].map((x, i) => {
        const t = (x - 20) / 120;
        const y = 146 + 50 * t * (1 - t);
        const len = [10, 14, 18, 14, 10][i];
        return (
          <g key={x}>
            <path d={`M${x} ${y}v4`} stroke="#8FA9D0" strokeWidth="0.8" />
            <path d={`M${x} ${y + 4}C${x - 4} ${y + 4 + len * 0.5} ${x - 4} ${y + 4 + len} ${x} ${y + 4 + len + 2}C${x + 4} ${y + 4 + len} ${x + 4} ${y + 4 + len * 0.5} ${x} ${y + 4}Z`} fill="url(#lt-i-kristal)" stroke="#8FA9D0" strokeWidth="0.8" />
            <path d={`M${x - 1.4} ${y + 7}v${len * 0.5}`} stroke="#fff" strokeOpacity="0.85" strokeWidth="1" />
          </g>
        );
      })}
      <circle cx="80" cy="186" r="6" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="1" />
      <path d="M80 191l-4 12h8z" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.9" />
      {lilin.map(([x, y], i) => (
        <g key={i}>
          {!gelap && <circle cx={x} cy={y - 24} r="17" fill="url(#lt-i-api)" />}
          <path d={`M${x - 5.4} ${y}h10.8l-2 5.4h-6.8z`} fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.9" />
          <rect x={x - 3.2} y={y - 17} width="6.4" height="17.4" rx="1.4" fill="#F6EEDA" stroke="#BDB09A" strokeWidth="0.8" />
          <ellipse cx={x} cy={y - 24} rx="3.6" ry="6.6" fill={gelap ? "#7A6A55" : "url(#lt-i-nyala)"} className={gelap ? undefined : "lt-lilin"} style={{ animationDelay: `${i * 0.18}s` }} />
        </g>
      ))}
    </svg>
  );
}

export function Istana(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const [konfeti, setKonfeti] = useState(0);
  const sentuh = () => {
    setKonfeti((n) => n + 1);
    p.bisik("Hormat kepada Yang Mulia!");
    p.onTakhta?.();
    setTimeout(() => setKonfeti(0), 9500);
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <LG id="lt-i-emas" s={[[0, "#FFE9A0"], [0.45, "#F2B72B"], [1, "#B57A0E"]]} />
        <LG id="lt-i-emas-h" h s={[[0, "#A8760E"], [0.3, "#FFE08A"], [0.6, "#E8B84A"], [1, "#9A6A12"]]} />
        <LG id="lt-i-beludru" s={[[0, "#A52B3E"], [1, "#5A1220"]]} />
        <LG id="lt-i-batu" s={[[0, "#E3D8C2"], [1, "#B5A688"]]} />
        <LG id="lt-i-kain" h s={[[0, "#1B3478"], [0.35, "#3A5CB8"], [0.7, "#2A4A9E"], [1, "#14264E"]]} />
        <LG id="lt-i-kain-bayang" s={[[0, "#000", 0.28], [0.12, "#000", 0], [0.8, "#000", 0], [1, "#000", 0.38]]} />
        <LG id="lt-i-bayang-t" s={[[0, "#000", 0.25], [0.3, "#000", 0], [1, "#000", 0.3]]} />
        <LG id="lt-i-langit" s={[[0, "#9CC0F5"], [1, "#4E78C8"]]} />
        <LG id="lt-i-kaca-kilau" s={[[0, "#fff", 0.3], [0.5, "#fff", 0.04], [1, "#000", 0.22]]} />
        <LG id="lt-i-kristal" s={[[0, "#F2F8FF"], [1, "#A9C4EA"]]} />
        <LG id="lt-i-nyala" s={[[0, "#FFB43A"], [0.6, "#FFE27A"], [1, "#FFFFFF"]]} />
        <RG id="lt-i-api" s={[[0, "#FFD27A", 0.5], [1, "#FFD27A", 0]]} />
        <LG id="lt-i-takhta" h s={[[0, "#9A6A12"], [0.22, "#F6D27A"], [0.5, "#D9A63A"], [0.8, "#F0C45A"], [1, "#8A5A0E"]]} />
        <RG id="lt-i-bantal" cx={0.4} cy={0.3} s={[[0, "#C23A52"], [0.7, "#8E1B34"], [1, "#5A1220"]]} />
      </Defs>
      <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: "linear-gradient(180deg,#8F2438,#7A1E34 60%,#661A2E)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[62%]" style={{ background: "radial-gradient(ellipse at 50% 38%,rgba(255,200,120,0.14),transparent 55%),radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(20,4,10,0.45))" }} />
      {/* panel dinding bawah berbingkai emas */}
      <div aria-hidden="true" className="absolute inset-x-0 top-[53%] h-[9%] border-t-[3px] border-[#F2C14E]" style={{ background: "linear-gradient(180deg,#4E1020,#40101A)" }}>
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg,transparent 0 118px,rgba(242,193,78,0.5) 118px 120px)" }} />
      </div>
      {/* balok langit-langit */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-[2] h-[5%] border-b-[3px] border-[#F2C14E]" style={{ background: "linear-gradient(180deg,#2A0A14,#4A1424)" }}>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#2B2233]/70" />
      </div>
      <Jendela uid="lt-i-w0" x="5%" />
      <Jendela uid="lt-i-w1" x="82%" />
      {/* lantai marmer BERPERSPEKTIF: kotak menyempit ke cakrawala dan melebar ke arah penonton */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-[62%] overflow-hidden" style={{ background: "#EFE6D5" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={LANTAI_GELAP} fill="#C8BBA2" />
        </svg>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(80,40,50,0.45),rgba(80,40,50,0.1) 45%,transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(105deg,transparent 28%,rgba(255,255,255,0.14) 40%,transparent 52%,rgba(255,255,255,0.08) 70%,transparent 80%)" }} />
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 top-[62%] h-[3px] bg-[#2B2233]" />
      {/* panggung dua anak tangga yang DINAIKI permadani (satu bidang perspektif; tepi permadani menekuk di tiap tangga) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[55%] z-[2] h-[45%] w-full overflow-visible">
        <polygon points={poligon([[33.5, 63.5], [66.5, 63.5], [67.2, 66.5], [32.8, 66.5]])} fill="#C9B07A" stroke="#7A6038" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points={poligon([[34.5, 61.5], [65.5, 61.5], [66.5, 63.5], [33.5, 63.5]])} fill="#EADCB6" stroke="#7A6038" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points={poligon([[38, 58.5], [62, 58.5], [62.6, 61.5], [37.4, 61.5]])} fill="#C9B07A" stroke="#7A6038" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points={poligon([[39, 57], [61, 57], [62, 58.5], [38, 58.5]])} fill="#EFE2BE" stroke="#7A6038" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points={poligon(kelilingPermadani(1.1))} fill="#F2C14E" stroke="#7A5208" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <polygon points={poligon(kelilingPermadani(0))} fill="#A8223F" strokeLinejoin="round" />
        {[
          [58.5, 61.5, 8.2],
          [63.5, 66.5, 9.1],
        ].map(([ya, yb, h]) => (
          <polygon key={ya} points={poligon([[50 - h, ya], [50 + h, ya], [50 + h, yb], [50 - h, yb]])} fill="#000" fillOpacity="0.3" />
        ))}
        {[
          [58.5, 8.2],
          [63.5, 9.1],
        ].map(([y, h]) => (
          <path key={y} d={`M${(50 - h - 1.1).toFixed(2)} ${Y(y)}H${(50 + h + 1.1).toFixed(2)}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <Pilar x="22%" />
      <Pilar x="78%" />
      {/* takhta di atas anak tangga teratas */}
      <div className="absolute left-1/2 z-[3] w-[clamp(130px,17vw,220px)] -translate-x-1/2" style={{ bottom: `${(100 - 57.9).toFixed(1)}%` }}>
        <button type="button" disabled={!benda} aria-label="Takhta: hormat" onClick={sentuh} className={cn("block w-full cursor-pointer", mati)}>
          <svg viewBox="0 -8 200 246" className="block w-full overflow-visible" strokeLinejoin="round" strokeLinecap="round">
            <ellipse cx="100" cy="235" rx="82" ry="4.4" fill="#000" fillOpacity="0.32" style={{ filter: "blur(2px)" }} />
            {/* sandaran: bingkai emas bermahkota lengkung ogee, panel beludru bertatah kancing */}
            <path d="M42 234V86C42 62 54 48 66 42C72 32 84 24 100 12C116 24 128 32 134 42C146 48 158 62 158 86V234Z" fill="url(#lt-i-takhta)" />
            <path d="M54 232V90C54 70 64 58 76 52C84 44 92 38 100 30C108 38 116 44 124 52C136 58 146 70 146 90V232Z" fill="url(#lt-i-beludru)" />
            <path d="M54 232V90C54 70 64 58 76 52C84 44 92 38 100 30C108 38 116 44 124 52C136 58 146 70 146 90V232Z" fill="url(#lt-i-bayang-t)" />
            {[
              [88, 90],
              [112, 90],
              [76, 112],
              [100, 112],
              [124, 112],
              [88, 134],
              [112, 134],
              [76, 156],
              [100, 156],
              [124, 156],
              [88, 178],
              [112, 178],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r="5.4" fill="#3A0A16" fillOpacity="0.4" />
                <circle cx={x} cy={y} r="2.6" fill="url(#lt-i-emas)" />
              </g>
            ))}
            {/* hiasan puncak: bunga lili emas */}
            <path d="M100 -6C93 2 93 10 100 17C107 10 107 2 100 -6Z" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.8" />
            <path d="M100 14C91 8 80 10 80 19C86 17 93 19 100 23C107 19 114 17 120 19C120 10 109 8 100 14Z" fill="url(#lt-i-emas)" stroke="#7A5208" strokeWidth="0.8" />
            {/* sandaran tangan: tiang emas selebar dudukan, alas beludru di atasnya, berdiri langsung di injakan */}
            <path d="M28 166c-8 0-12 6-12 12v56h30v-56c0-6-4-12-18-12z" fill="url(#lt-i-takhta)" stroke="#7A5208" strokeWidth="0.9" />
            <path d="M172 166c8 0 12 6 12 12v56h-30v-56c0-6 4-12 18-12z" fill="url(#lt-i-takhta)" stroke="#7A5208" strokeWidth="0.9" />
            <path d="M12 158h38c5 0 8 3 8 7s-3 7-8 7H12c-5 0-8-3-8-7s3-7 8-7z" fill="url(#lt-i-beludru)" stroke="#3E1018" strokeWidth="0.9" />
            <path d="M150 158h38c5 0 8 3 8 7s-3 7-8 7h-38c-5 0-8-3-8-7s3-7 8-7z" fill="url(#lt-i-beludru)" stroke="#3E1018" strokeWidth="0.9" />
            {/* dudukan berbantal; rok emas di bawahnya menempel ke lantai panggung */}
            <path d="M46 196h108c6 0 10 4 10 10v20H36v-20c0-6 4-10 10-10z" fill="url(#lt-i-bantal)" stroke="#3E1018" strokeWidth="0.9" />
            <path d="M36 224h128v10H36z" fill="url(#lt-i-takhta)" stroke="#7A5208" strokeWidth="0.9" />
            <path d="M36 224h128" stroke="#FFE9A0" strokeOpacity="0.6" strokeWidth="1.4" />
          </svg>
        </button>
      </div>
      {/* lampu gantung kristal (saklar) dan kembarannya yang hanya hiasan */}
      <Saklar {...p} kelas="absolute left-[32%] top-0 block w-[clamp(86px,10vw,128px)]" label="Lampu gantung istana">
        <Lampu gelap={p.gelap} />
      </Saklar>
      <div aria-hidden="true" className="pointer-events-none absolute left-[61%] top-0 z-[26] w-[clamp(86px,10vw,128px)]">
        <Lampu gelap={p.gelap} />
      </div>
      {/* hujan konfeti: muncul pelan dari atas, jatuh berayun sambil berputar, mendarat di lantai, lalu memudar perlahan */}
      {konfeti > 0 &&
        Array.from({ length: 40 }, (_, i) => {
          const total = 6.5 + r(i, 24) * 2.6;
          return (
            <span
              key={`${konfeti}-${i}`}
              aria-hidden="true"
              className="lt-jatuh pointer-events-none absolute z-[24] block"
              style={{ left: `${(r(i, 23) * 100).toFixed(1)}%`, animationDuration: `${total.toFixed(1)}s`, animationDelay: `${(r(i, 25) * 1.2).toFixed(2)}s`, ["--lan" as string]: `${(66 + r(i, 30) * 28).toFixed(0)}vh` }}
            >
              <i
                className="lt-kibas block"
                style={{
                  width: 8 + r(i, 28) * 5,
                  height: 12 + r(i, 29) * 6,
                  background: WARNA_KONFETI[i % 5],
                  boxShadow: "0 0 0 1px rgba(43,34,51,0.45)",
                  animationDuration: `${(total * 0.72).toFixed(1)}s`,
                  ["--dx" as string]: `${(18 + r(i, 26) * 26).toFixed(0)}px`,
                  ["--rot" as string]: `${((r(i, 27) - 0.5) * 80).toFixed(0)}deg`,
                }}
              />
            </span>
          );
        })}
      <Penutup gelap={p.gelap} warna="#1B0510" />
    </div>
  );
}
