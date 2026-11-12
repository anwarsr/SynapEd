"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { BintangLaut, Defs, LG, Lantai, Penutup, RG, Saklar, mati, n1, r, type LatarProps } from "./LatarBersama";

/** Arcade Neon & Akuarium Laut. */

// ───────────────────────── ARCADE NEON ─────────────────────────
/** Pola piksel alien (11 x 8) dua bingkai: kaki bergantian. */
const ALIEN_A = ["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"];
const ALIEN_B = ["00100000100", "10010001001", "10111111101", "11101110111", "11111111111", "01111111110", "00100000100", "01000000010"];
const pikselPath = (baris: string[], x0: number, y0: number, s: number) =>
  baris
    .flatMap((b, y) => [...b].map((c, x) => (c === "1" ? `M${x0 + x * s} ${y0 + y * s}h${s}v${s}h-${s}z` : "")))
    .join("");

interface WarnaMesin {
  terang: string;
  sedang: string;
  gelap: string;
  samping: string;
}

/**
 * Mesin arcade tampak DEPAN (elevasi datar, tanpa sisi/3D): marquee, layar berkaca, panel kendali datar dengan tongkat & tombol yang
 * juga dilihat dari depan (bola di atas batang, tombol seperti silinder pendek), pintu koin, dan alas. Simetris kiri-kanan.
 */
function Mesin({ uid, w, layar, teks, kedip, jackpot, judul }: { uid: string; w: WarnaMesin; layar: string; teks?: string | number | null; kedip?: boolean; jackpot?: boolean; judul?: string }) {
  return (
    <svg viewBox="0 0 140 230" className="block w-full overflow-visible" style={{ filter: `drop-shadow(0 0 10px ${w.terang}55)` }}>
      <defs>
        <linearGradient id={`${uid}-d`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={w.gelap} />
          <stop offset="0.3" stopColor={w.sedang} />
          <stop offset="0.5" stopColor={w.terang} />
          <stop offset="0.7" stopColor={w.sedang} />
          <stop offset="1" stopColor={w.gelap} />
        </linearGradient>
        <linearGradient id={`${uid}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.4" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <pattern id={`${uid}-p`} width="4" height="3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#000" fillOpacity="0.28" />
        </pattern>
      </defs>
      {/* badan */}
      <rect x="24" y="14" width="92" height="214" fill={`url(#${uid}-d)`} stroke="#120A22" strokeWidth="1.5" />
      <rect x="24" y="14" width="92" height="214" fill={`url(#${uid}-v)`} />
      <path d="M24 14V228M116 14V228" stroke={w.terang} strokeOpacity="0.85" strokeWidth="1.6" />
      <rect x="24" y="50" width="6" height="64" fill={w.samping} fillOpacity="0.7" />
      <rect x="110" y="50" width="6" height="64" fill={w.samping} fillOpacity="0.7" />
      {/* marquee */}
      <rect x="20" y="8" width="100" height="34" fill="#150C2C" stroke="#120A22" strokeWidth="1.4" />
      <rect x="25" y="13" width="90" height="24" rx="2" fill={w.terang} fillOpacity="0.3" />
      {judul ? (
        <text x="70" y="31" textAnchor="middle" fontSize="15" fontWeight="900" letterSpacing="1.5" fill="#fff" style={{ filter: `drop-shadow(0 0 4px ${w.terang})` }}>
          {judul}
        </text>
      ) : (
        <path d="M34 21h22M34 29h32M84 21h22M90 29h16" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* layar */}
      <rect x="34" y="46" width="72" height="60" rx="4" fill="#0A0A1C" stroke="#05050F" strokeWidth="1.4" />
      <rect x="39" y="51" width="62" height="50" rx="3" fill={layar} />
      {teks == null ? (
        <>
          <path className="lt-fa" d={pikselPath(ALIEN_A, 50, 60, 3.6)} fill="#6BE0A8" />
          <path className="lt-fb" d={pikselPath(ALIEN_B, 50, 60, 3.6)} fill="#6BE0A8" />
          <path d="M50 94h40" stroke="#F6E3C0" strokeWidth="2" opacity="0.7" />
        </>
      ) : (
        <text className={kedip ? "lt-kedip" : undefined} x="70" y="82" textAnchor="middle" fontSize={jackpot ? 13 : 17} fontWeight="800" fill={jackpot ? "#2B2233" : "#F6E3C0"}>
          {teks}
        </text>
      )}
      <rect x="39" y="51" width="62" height="50" rx="3" fill={`url(#${uid}-p)`} />
      <path d="M39 51H84L39 90Z" fill="#fff" fillOpacity="0.09" />
      <rect x="39" y="51" width="62" height="50" rx="3" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="2" />
      {/* panel kendali DATAR: papan lurus; tongkat & tombol dilihat dari depan */}
      <rect x="16" y="114" width="108" height="28" fill={w.sedang} stroke="#120A22" strokeWidth="1.4" />
      <rect x="16" y="114" width="108" height="3" fill="#fff" fillOpacity="0.28" />
      <rect x="16" y="138" width="108" height="4" fill="#000" fillOpacity="0.3" />
      <rect x="45.4" y="102" width="5.2" height="12" rx="1.6" fill="#C9C9D6" stroke="#6A6A7A" strokeWidth="0.8" />
      <circle cx="48" cy="98" r="7" fill="#E54B4B" stroke="#7A1818" strokeWidth="1" />
      <circle cx="45.6" cy="95.4" r="2.4" fill="#fff" fillOpacity="0.65" />
      {[
        [80, "#F2C14E"],
        [95, "#6BE0FF"],
        [110, "#6BE08C"],
      ].map(([x, c]) => (
        <g key={String(x)}>
          <rect x={(x as number) - 5.6} y="107" width="11.2" height="7.4" rx="2.4" fill={c as string} stroke="#120A22" strokeWidth="0.9" />
          <rect x={(x as number) - 4} y="108.2" width="8" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
        </g>
      ))}
      {/* bagian bawah: pintu koin + alas */}
      <rect x="36" y="150" width="68" height="58" rx="2" fill={w.gelap} fillOpacity="0.55" stroke="#120A22" strokeWidth="1" />
      <rect x="56" y="158" width="28" height="36" rx="3" fill="#15152A" stroke="#05050F" strokeWidth="1.2" />
      <rect x="61" y="166" width="6" height="12" rx="1" fill="#FF5A5A" />
      <rect x="73" y="166" width="6" height="12" rx="1" fill="#F2C14E" />
      <rect x="61" y="183" width="18" height="5" rx="1" fill="#05050F" />
      <rect x="24" y="212" width="92" height="16" fill={w.gelap} stroke="#120A22" strokeWidth="1.2" />
    </svg>
  );
}

const WARNA_BIRU: WarnaMesin = { terang: "#6F9BFF", sedang: "#3F6FE0", gelap: "#243E94", samping: "#1E3482" };
const WARNA_PINK: WarnaMesin = { terang: "#FF6FC0", sedang: "#E2358F", gelap: "#8E1B5E", samping: "#7A1650" };
const WARNA_HIJAU: WarnaMesin = { terang: "#52D8A0", sedang: "#2F8F6B", gelap: "#175A40", samping: "#124A34" };

/**
 * Mesin berdiri DI lantai: alasnya persis di tepi bawah pembungkus, bayangan kontak gelap & ketat tepat di bawah alas, genangan cahaya neon
 * berwarna mesin yang menyebar di lantai di sekitarnya, dan pantulan samar (terbalik, makin ke bawah makin pudar) di lantai mengilap.
 */
function Berdiri({ glow, salinan, kelas, style, children }: { glow: string; salinan: React.ReactNode; kelas: string; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={cn("absolute", kelas)} style={style}>
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[96%] h-[26%] w-[210%] -translate-x-1/2 rounded-[50%] blur-[20px]" style={{ background: glow }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ transform: "translateY(100%) scaleY(-1)", opacity: 0.55, filter: "blur(1.6px)", maskImage: "linear-gradient(0deg,rgba(0,0,0,0.55),transparent 46%)", WebkitMaskImage: "linear-gradient(0deg,rgba(0,0,0,0.55),transparent 46%)" }}>
        {salinan}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute left-[2%] right-[2%] top-[98.5%] h-[3.4%] rounded-[50%] bg-black/70 blur-[3px]" />
      {children}
    </div>
  );
}

export function Arcade(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const [skor, setSkor] = useState(0);
  const [kilat, setKilat] = useState(0);
  const [jackpot, setJackpot] = useState(0);
  const main = () => {
    const tambah = 20 + Math.floor(Math.random() * 60);
    setKilat((n) => n + 1);
    if (skor + tambah >= 300) {
      setSkor(0);
      setJackpot((n) => n + 1);
      p.bisik("JACKPOT! Koin berhamburan!");
      setTimeout(() => setJackpot(0), 3000);
    } else {
      setSkor(skor + tambah);
      p.bisik(`Skor ${skor + tambah}. Terus!`);
    }
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* dinding bergradasi dengan cahaya neon yang menyebar lembut */}
      <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: "radial-gradient(ellipse at 38% 30%,rgba(255,79,216,0.28),transparent 42%),radial-gradient(ellipse at 74% 50%,rgba(91,224,255,0.2),transparent 46%),linear-gradient(180deg,#120826 0%,#221050 55%,#321672 100%)" }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-[47%] h-[4px] bg-[#FF4FD8] shadow-[0_0_18px_5px_rgba(255,79,216,0.55)]" />
      {/* papan neon ARCADE */}
      <div className="lt-neon absolute left-[27%] top-[21%] rounded-xl border-[3px] border-[#FF4FD8] bg-[#2A0F4A]/40 px-5 py-2 text-[clamp(22px,4vw,52px)] font-black tracking-[0.2em] text-[#FF8BE8] shadow-[0_0_26px_5px_rgba(255,79,216,0.6),inset_0_0_18px_rgba(255,79,216,0.45)]">ARCADE</div>
      <Lantai garis={false} bayang="rgba(255,79,216,0.3)" style={{ background: "linear-gradient(180deg,#2A1A5C 0%,#17102F 60%,#0D0820 100%)", backgroundImage: "conic-gradient(rgba(255,255,255,0.05) 25%,transparent 0 50%,rgba(255,255,255,0.05) 0 75%,transparent 0),linear-gradient(180deg,#2A1A5C 0%,#17102F 60%,#0D0820 100%)", backgroundSize: "88px 88px,100% 100%" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[62%]" style={{ background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.06) 42%,transparent 54%,rgba(255,79,216,0.06) 70%,transparent 82%)" }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-[62%] h-[3px] bg-[#FF4FD8] shadow-[0_0_14px_3px_rgba(255,79,216,0.7)]" />
      {/* mesin samping kiri dan kanan (tampak depan), berdiri di lantai */}
      <Berdiri kelas="pointer-events-none z-[1] w-[clamp(84px,10.5vw,138px)]" style={{ left: "24%", bottom: "35%" }} glow="rgba(63,111,224,0.5)" salinan={<Mesin uid="ar-a2" w={WARNA_BIRU} layar="#10304A" />}>
        <Mesin uid="ar-a" w={WARNA_BIRU} layar="#10304A" />
      </Berdiri>
      <Berdiri kelas="pointer-events-none z-[1] hidden w-[clamp(84px,10.5vw,138px)] sm:block" style={{ left: "80%", bottom: "35%" }} glow="rgba(47,160,115,0.5)" salinan={<Mesin uid="ar-c2" w={WARNA_HIJAU} layar="#3A1A56" judul="PLAY" />}>
        <Mesin uid="ar-c" w={WARNA_HIJAU} layar="#3A1A56" judul="PLAY" />
      </Berdiri>
      {/* mesin utama: dimainkan */}
      <Berdiri kelas="z-[2] w-[clamp(110px,14vw,185px)]" style={{ left: "61%", bottom: "36%" }} glow="rgba(226,53,143,0.55)" salinan={<Mesin uid="ar-b2" w={WARNA_PINK} layar="#1D2B6B" judul="GAME" />}>
        <button type="button" disabled={!benda} aria-label="Mesin arcade: main" onClick={main} className={cn("block w-full cursor-pointer", mati)}>
          <div key={kilat} className={kilat > 0 ? "lt-kilat" : undefined}>
            <Mesin uid="ar-b" w={WARNA_PINK} layar={jackpot ? "#F2C14E" : "#1D2B6B"} teks={jackpot ? "JACKPOT" : skor > 0 ? skor : null} jackpot={jackpot > 0} judul="GAME" />
          </div>
        </button>
        {jackpot > 0 &&
          Array.from({ length: 16 }, (_, i) => (
            <span key={i} aria-hidden="true" className="lt-koin pointer-events-none absolute z-[3] block h-[14px] w-[14px]" style={{ left: "50%", top: "80%", animationDelay: `${r(i, 17) * 0.45}s`, ["--dx" as string]: `${(r(i, 18) - 0.5) * 300}px` }}>
              <i className="lt-putar block h-full w-full rounded-full border-2 border-[#2B2233] bg-[#F2C14E] shadow-[inset_0_0_0_2px_#FFE79A]" style={{ animationDelay: `${r(i, 19) * 0.4}s` }} />
            </span>
          ))}
      </Berdiri>
      {/* papan OPEN tergantung dua rantai = saklar */}
      <div className="absolute right-[24%] top-0 z-[26] flex flex-col items-center">
        <div className="flex h-[clamp(96px,14vh,140px)] w-full justify-between px-4" aria-hidden="true">
          <i className="block h-full w-[3px] bg-[#2B2233]" />
          <i className="block h-full w-[3px] bg-[#2B2233]" />
        </div>
        <Saklar {...p} kelas="block" label="Papan neon OPEN">
          <span className={cn("lt-neon block rounded-lg border-[3px] px-4 py-1 text-[clamp(14px,2vw,26px)] font-black tracking-widest", p.gelap ? "border-[#5A4A7A] text-[#5A4A7A]" : "border-[#5BE0FF] text-[#9BEEFF] shadow-[0_0_18px_4px_rgba(91,224,255,0.65)]")}>{p.gelap ? "CLOSED" : "OPEN"}</span>
        </Saklar>
      </div>
      <Penutup gelap={p.gelap} warna="#0A0620" />
    </div>
  );
}

// ───────────────────────── AKUARIUM LAUT ─────────────────────────
type Jenis = "badut" | "biru" | "kuning" | "teal";
interface IkanSpec {
  jenis: Jenis;
  y: string;
  w: number;
  durasi: string;
  tunda: string;
  ke: 1 | -1;
  goyang: string;
  ekor: string;
}
const IKAN: IkanSpec[] = [
  { jenis: "badut", y: "24%", w: 92, durasi: "28s", tunda: "-6s", ke: 1, goyang: "2.6s", ekor: "0.5s" },
  { jenis: "biru", y: "36%", w: 112, durasi: "36s", tunda: "-20s", ke: -1, goyang: "3.1s", ekor: "0.45s" },
  { jenis: "kuning", y: "47%", w: 84, durasi: "24s", tunda: "-11s", ke: 1, goyang: "2.2s", ekor: "0.6s" },
  { jenis: "teal", y: "53%", w: 130, durasi: "31s", tunda: "-2s", ke: -1, goyang: "2.8s", ekor: "0.46s" },
  { jenis: "badut", y: "42%", w: 64, durasi: "40s", tunda: "-30s", ke: -1, goyang: "2.4s", ekor: "0.4s" },
];
const BADAN: Record<Jenis, string> = {
  badut: "M22 28C30 8 62 4 84 20C93 26 93 30 84 36C62 52 30 48 22 28Z",
  biru: "M22 28C26 4 66 -2 86 22C92 28 90 32 84 36C66 58 26 52 22 28Z",
  kuning: "M24 28C24 6 56 -2 76 12C90 20 90 36 76 44C56 58 24 50 24 28Z",
  teal: "M18 28C30 12 62 8 86 22C92 26 92 30 86 34C62 48 30 44 18 28Z",
};
const MATA: Record<Jenis, [number, number]> = { badut: [75, 25], biru: [77, 25], kuning: [76, 25], teal: [79, 27] };
const WARNA_SIRIP: Record<Jenis, string> = { badut: "#E2561A", biru: "#1B3F96", kuning: "#F2B21E", teal: "#E86A8A" };

/** Ikan digambar MENGHADAP KANAN (mata di kanan, ekor di kiri). Yang berenang ke kiri dibalik di lapis sendiri, jadi selalu maju dengan kepala di depan. Tanpa garis tepi: bentuk dibangun dari warna, gradasi, dan corak. */
function BadanIkan({ jenis, ekor }: { jenis: Jenis; ekor: string }) {
  const sirip = WARNA_SIRIP[jenis];
  const [ex, ey] = MATA[jenis];
  return (
    <>
      <g className="lt-ekor" style={{ animationDuration: ekor }}>
        <path d="M30 28L6 8C12 22 12 34 6 48z" fill={jenis === "biru" ? "#FFD23F" : sirip} fillOpacity="0.92" />
      </g>
      <path d={jenis === "kuning" ? "M34 8C40 -6 62 -6 70 6z" : "M38 12C44 -2 62 -2 68 9z"} fill={sirip} fillOpacity="0.92" />
      <path d={BADAN[jenis]} fill={`url(#lt-g-${jenis})`} />
      <g clipPath={`url(#lt-c-${jenis})`}>
        {jenis === "badut" && (
          <>
            <rect x="38" y="0" width="9" height="56" fill="#fff" stroke="#1B1B1B" strokeWidth="1.3" />
            <rect x="58" y="0" width="7" height="56" fill="#fff" stroke="#1B1B1B" strokeWidth="1.3" />
            <rect x="77" y="0" width="4" height="56" fill="#fff" stroke="#1B1B1B" strokeWidth="1.3" />
          </>
        )}
        {jenis === "biru" && <path d="M34 30C44 14 62 12 72 22C64 24 56 30 54 42C46 42 38 38 34 30Z" fill="#101A30" />}
        {jenis === "kuning" && <rect x="68.5" y="0" width="5" height="56" fill="#1B1B1B" />}
        {jenis === "teal" &&
          [0, 1, 2, 3, 4, 5].flatMap((row) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => <ellipse key={`${row}-${c}`} cx={28 + c * 8 + (row % 2) * 4} cy={16 + row * 6} rx="3.4" ry="2.6" fill="#1F7A68" fillOpacity="0.16" />))}
        <path d="M18 40C40 52 70 50 92 34L92 60L18 60Z" fill="#fff" fillOpacity="0.2" />
        <path d="M18 0C40 8 70 6 92 18L92 -4L18 -4Z" fill="#000" fillOpacity="0.16" />
      </g>
      <g className="lt-sirip">
        <path d="M52 34l-14 11 22 0z" fill={sirip} fillOpacity="0.9" />
      </g>
      <circle cx={ex} cy={ey} r="4.8" fill="#fff" />
      <circle cx={ex + 1.2} cy={ey + 0.2} r="2.7" fill="#111" />
      <circle cx={ex + 2} cy={ey - 1} r="0.9" fill="#fff" />
    </>
  );
}

function Ikan({ f }: { f: IkanSpec }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute z-[2]", f.ke > 0 ? "lt-renang-kanan" : "lt-renang-kiri")} style={{ top: f.y, animationDuration: f.durasi, animationDelay: f.tunda }}>
      <div style={{ transform: f.ke > 0 ? undefined : "scaleX(-1)" }}>
        <div className="lt-goyang" style={{ animationDuration: f.goyang }}>
          <svg viewBox="0 0 100 56" className="block overflow-visible" style={{ width: f.w }}>
            <BadanIkan jenis={f.jenis} ekor={f.ekor} />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Kawanan ikan kecil perak yang berenang rapat (tiap ekor punya goyang sendiri). */
function Kawanan({ y, durasi, tunda, ke }: { y: string; durasi: string; tunda: string; ke: 1 | -1 }) {
  const posisi: [number, number][] = [[0, 8], [28, 0], [26, 24], [56, 12], [54, 34], [84, 20]];
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute z-[2]", ke > 0 ? "lt-renang-kanan" : "lt-renang-kiri")} style={{ top: y, animationDuration: durasi, animationDelay: tunda }}>
      <div className="relative h-[60px] w-[130px]" style={{ transform: ke > 0 ? undefined : "scaleX(-1)" }}>
        {posisi.map(([x, yy], i) => (
          <div key={i} className="lt-goyang absolute" style={{ left: x, top: yy, animationDuration: `${(1.4 + (i % 3) * 0.4).toFixed(1)}s`, animationDelay: `-${(i * 0.3).toFixed(1)}s` }}>
            <svg viewBox="0 0 40 20" className="block w-[30px] overflow-visible">
              <path d="M9 10L1 4Q4 10 1 16z" fill="#8FB0D6" className="lt-ekor" style={{ animationDuration: "0.3s" }} />
              <path d="M8 10C12 3 26 3 32 9C35 10 35 11 32 12C26 17 12 17 8 10Z" fill="url(#lt-g-perak)" />
              <circle cx="28" cy="9" r="1.6" fill="#fff" />
              <circle cx="28.4" cy="9.1" r="0.8" fill="#111" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rumpun rumput laut: pita berlekuk meruncing, tiap pita bergoyang sendiri dari pangkalnya. Tanpa garis tepi/tulang daun: dibangun dari gradasi. */
const bilah = (h: number, amp: number, ph: number, wb: number) => {
  const N = 16;
  const L: string[] = [];
  const R: string[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const y = -h * t;
    const x = Math.sin(t * Math.PI * 1.7 + ph) * amp * t;
    const w = (wb * (1 - 0.85 * t) * (t < 0.05 ? 0.7 + 6 * t : 1)) / 2;
    L.push(`${n1(x - w)} ${n1(y)}`);
    R.push(`${n1(x + w)} ${n1(y)}`);
  }
  return `M${L.join("L")}L${R.reverse().join("L")}Z`;
};
const KELP = [1, 2, 3, 4].map((seed) =>
  Array.from({ length: 5 }, (_, i) => {
    const q = (s: number) => r(seed * 10 + i, s);
    return { bx: (i - 2) * 9 + (q(1) - 0.5) * 4, d: bilah(70 + q(2) * 60, 8 + q(3) * 12, q(4) * 6, 8 + q(5) * 4), dur: 3 + q(6) * 2.4, tunda: -q(7) * 4 };
  }),
);

/** Karang bercabang (rekursif, deterministik). */
interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  daun: boolean;
}
function karang(seed: number, len: number, w: number): Seg[] {
  const out: Seg[] = [];
  const rec = (s: number, x: number, y: number, ang: number, l: number, wd: number, depth: number) => {
    const x2 = x + Math.sin(ang) * l;
    const y2 = y - Math.cos(ang) * l;
    out.push({ x1: x, y1: y, x2, y2, w: wd, daun: depth === 0 });
    if (depth === 0) return;
    const n = depth >= 3 ? 2 : r(s, 1) > 0.55 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * (0.6 + r(s + i, 2) * 0.3);
      rec(s * 3 + i + 1, x2, y2, ang + da, l * (0.74 + r(s + i, 3) * 0.1), wd * 0.72, depth - 1);
    }
  };
  rec(seed, 0, 0, 0, len, w, 4);
  return out;
}
const KARANG = [karang(3, 26, 11), karang(5, 22, 9)];

/** Bayangan lembut di dasar air: lebar mengikuti benda, tepi dikaburkan dalam. */
const BAYANG = { fill: "#0B2442", fillOpacity: 0.38, style: { filter: "blur(4px)" } } as const;

/**
 * Ikan pancing (lampu): kulit gelap bercorak bintik, perut lebih pucat, kepala besar dengan rahang bawah menjorok dan gigi runcing
 * menerawang, mata berpendar, sirip berselaput, serta batang umpan yang melengkung ke depan dengan bola cahaya + sulur kecil.
 */
function IkanPancing({ gelap }: { gelap: boolean }) {
  const gigiAtas = Array.from({ length: 6 }, (_, k) => ({ x: 121 - k * 5.6, y: 52 + k * 1.5 }));
  const gigiBawah = Array.from({ length: 5 }, (_, k) => ({ x: 114 - k * 5.4, y: 69 + k * 1.1 }));
  return (
    <svg viewBox="-4 -26 160 120" className="block w-full overflow-visible">
      <defs>
        <linearGradient id="lt-l-pancing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4F3F6E" />
          <stop offset="0.55" stopColor="#2E2347" />
          <stop offset="1" stopColor="#171127" />
        </linearGradient>
        <linearGradient id="lt-l-sirip-p" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6A5A92" stopOpacity="0.2" />
          <stop offset="1" stopColor="#6A5A92" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id="lt-l-mata-p" cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#F4F9B0" />
          <stop offset="0.7" stopColor="#A8D45C" />
          <stop offset="1" stopColor="#5E8A2E" />
        </radialGradient>
        <radialGradient id="lt-l-esca">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor="#E8FFC8" />
          <stop offset="1" stopColor="#8CFFC0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!gelap && (
        <g className="lt-denyut">
          <circle cx="136" cy="-6" r="34" fill="url(#lt-l-esca)" fillOpacity="0.55" />
        </g>
      )}
      <g className="lt-ekor" style={{ animationDuration: "0.75s" }}>
        <path d="M36 56C24 48 12 40 2 32C8 48 8 62 2 78C14 72 26 66 38 62Z" fill="url(#lt-l-sirip-p)" />
      </g>
      <path d="M60 28C68 8 90 6 100 18C88 20 74 24 60 28Z" fill="url(#lt-l-sirip-p)" />
      <path d="M30 56C30 30 52 16 84 18C112 20 128 36 124 54L118 58C124 66 122 78 108 82C92 90 66 90 50 82C38 76 30 66 30 56Z" fill="url(#lt-l-pancing)" />
      <path d="M44 74C60 88 92 88 108 76C100 86 76 92 56 86C50 84 46 80 44 74Z" fill="#7A6A9A" fillOpacity="0.45" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={(44 + r(i, 90) * 70).toFixed(1)} cy={(30 + r(i, 91) * 46).toFixed(1)} r={(0.7 + r(i, 92) * 1.4).toFixed(1)} fill="#9C8CBC" fillOpacity={0.25 + r(i, 93) * 0.3} />
      ))}
      <path d="M126 52C118 60 104 64 88 62C92 72 104 76 116 70C124 66 128 60 126 52Z" fill="#0F0818" />
      <path d="M120 58C122 74 110 84 94 82L90 72C102 74 112 68 116 60Z" fill="#241A3A" />
      {gigiAtas.map((g, k) => (
        <path key={`a${k}`} d={`M${n1(g.x)} ${n1(g.y)}l-1.2 ${n1(7 - k * 0.4)}l3-6z`} fill="#F2F0EC" fillOpacity="0.92" />
      ))}
      {gigiBawah.map((g, k) => (
        <path key={`b${k}`} d={`M${n1(g.x)} ${n1(g.y)}l1 -${n1(6.4 - k * 0.3)}l2.6 6z`} fill="#F2F0EC" fillOpacity="0.9" />
      ))}
      <circle cx="102" cy="38" r="8.4" fill="#0C0814" />
      <circle cx="102" cy="38" r="7.2" fill="url(#lt-l-mata-p)" />
      <ellipse cx="103" cy="38.4" rx="2.6" ry="4.6" fill="#08060E" />
      <circle cx="100" cy="35" r="1.6" fill="#fff" fillOpacity="0.9" />
      <path d="M72 62C60 60 52 70 56 82C64 80 72 74 72 62Z" fill="url(#lt-l-sirip-p)" className="lt-sirip" />
      <path d="M86 20C86 -6 108 -18 134 -10" fill="none" stroke="#6F5F8E" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M86 20C86 -6 108 -18 134 -10" fill="none" stroke="#9C8CBC" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
      {!gelap && <path d="M136 -8l9 -7M136 -8l10 3M136 -8l6 9" stroke="#CFFFE0" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />}
      <circle cx="136" cy="-8" r="7" fill={gelap ? "#6E7A66" : "url(#lt-l-esca)"} />
      <circle cx="136" cy="-8" r="3.6" fill={gelap ? "#8A9684" : "#FFFFFF"} />
    </svg>
  );
}

export function Laut(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const [peti, setPeti] = useState(0);
  const terbuka = peti % 2 === 1;
  const buka = () => {
    setPeti((n) => n + 1);
    p.bisik(terbuka ? "Peti hartanya ditutup lagi." : "Peti hartanya terbuka! Berkilau sekali.");
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <LG id="lt-g-badut" s={[[0, "#FF9A3C"], [1, "#E2561A"]]} />
        <LG id="lt-g-biru" s={[[0, "#4C93F0"], [1, "#1E4DB0"]]} />
        <LG id="lt-g-kuning" s={[[0, "#FFE15A"], [1, "#F2A81E"]]} />
        <LG id="lt-g-teal" s={[[0, "#7DF0D8"], [1, "#2FA38D"]]} />
        <LG id="lt-g-perak" s={[[0, "#E3EEF8"], [1, "#7E9CC0"]]} />
        <LG id="lt-l-kelp" s={[[0, "#5CC470"], [1, "#145A30"]]} />
        <RG id="lt-l-batu" cx={0.35} cy={0.28} s={[[0, "#B4B6BE"], [0.6, "#767882"], [1, "#464852"]]} />
        <LG id="lt-l-emas" s={[[0, "#FFE680"], [0.5, "#F2B72B"], [1, "#B57A0E"]]} />
        <LG id="lt-l-kayu" s={[[0, "#B87F4A"], [1, "#7A4A26"]]} />
        <LG id="lt-l-beludru" s={[[0, "#9A2A3A"], [1, "#5A1220"]]} />
        <RG id="lt-l-otak" cx={0.4} cy={0.3} s={[[0, "#FAC27A"], [0.7, "#D9803A"], [1, "#A85A22"]]} />
        {(Object.keys(BADAN) as Jenis[]).map((j) => (
          <clipPath key={j} id={`lt-c-${j}`}>
            <path d={BADAN[j]} />
          </clipPath>
        ))}
      </Defs>
      {/* air: gradasi halus dari permukaan terang ke dasar yang gelap */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#8FE0EC 0%,#4DB6DA 18%,#2A88C4 44%,#1C60A0 72%,#123E76 100%)" }} />
      {/* permukaan air dilihat dari bawah: pita terang bergelombang + kilau yang berdenyut */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[11%]" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.6),rgba(255,255,255,0.18) 55%,transparent)", filter: "blur(2px)" }} />
      {[6, 24, 42, 60, 78, 92].map((x, i) => (
        <div key={i} aria-hidden="true" className="lt-denyut pointer-events-none absolute top-0 rounded-[50%] bg-white/45 blur-[16px]" style={{ left: `${x - 6}%`, width: `${14 + (i % 3) * 5}%`, height: `${4 + (i % 2) * 3}%`, animationDelay: `${i * 0.7}s`, animationDuration: `${3 + i * 0.5}s` }} />
      ))}
      {/* sorot cahaya dari permukaan: berkas miring dari kiri atas, lebar & terang berbeda-beda, tepinya kabur */}
      {[
        { x: 4, w: 7, o: 0.55, s: -17 },
        { x: 17, w: 14, o: 0.38, s: -17 },
        { x: 36, w: 9, o: 0.5, s: -17 },
        { x: 52, w: 16, o: 0.32, s: -17 },
        { x: 72, w: 8, o: 0.46, s: -17 },
        { x: 88, w: 12, o: 0.3, s: -17 },
      ].map((b, i) => (
        <div key={i} aria-hidden="true" className="pointer-events-none absolute top-0 h-[80%] origin-top" style={{ left: `${b.x}%`, width: `${b.w}%`, transform: `skewX(${b.s}deg)` }}>
          <div className="lt-sinar h-full w-full blur-[10px]" style={{ background: `linear-gradient(180deg,rgba(255,255,255,${b.o}),rgba(255,255,255,${b.o * 0.35}) 55%,transparent)`, animationDelay: `-${i * 1.6}s`, animationDuration: `${7 + i}s` }} />
        </div>
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} className="lt-gelembung pointer-events-none absolute rounded-full border border-white/70 bg-white/15" style={{ left: `${r(i, 16) * 100}%`, width: 6 + r(i, 17) * 12, height: 6 + r(i, 17) * 12, animationDelay: `-${r(i, 18) * 12}s`, animationDuration: `${9 + r(i, 19) * 7}s`, ["--dx" as string]: `${(r(i, 20) - 0.5) * 36}px` }} />
      ))}
      {IKAN.map((f, i) => (
        <Ikan key={i} f={f} />
      ))}
      <Kawanan y="31%" durasi="34s" tunda="-14s" ke={1} />
      <Lantai garis={false} bayang="rgba(14,50,100,0.55)" style={{ background: "linear-gradient(180deg,#A58C62 0%,#CDB27E 12%,#DCC592 40%,#D2BA86 100%)" }} />
      {/* cahaya yang jatuh ke dasar: bercak kaustik berdenyut */}
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} aria-hidden="true" className="lt-denyut pointer-events-none absolute rounded-[50%] bg-[#FFFBD2]/40 blur-[12px]" style={{ left: `${(4 + r(i, 95) * 88).toFixed(1)}%`, top: `${(65 + r(i, 96) * 28).toFixed(1)}%`, width: `${(7 + r(i, 97) * 9).toFixed(1)}%`, height: `${(2.4 + r(i, 98) * 3).toFixed(1)}%`, animationDelay: `${(r(i, 99) * 3).toFixed(1)}s`, animationDuration: `${(2.4 + r(i, 94) * 2).toFixed(1)}s` }} />
      ))}
      {/* kerikil di dasar */}
      {[
        [12, 84, 22],
        [28, 93, 16],
        [46, 88, 26],
        [63, 96, 18],
        [80, 86, 20],
        [92, 94, 14],
      ].map(([x, y, w], i) => (
        <span key={i} aria-hidden="true" className="pointer-events-none absolute rounded-[50%]" style={{ left: `${x}%`, top: `${y}%`, width: w, height: w * 0.55, background: "radial-gradient(circle at 35% 30%,#CDB88E,#8F7A52)", boxShadow: "0 3px 5px rgba(11,36,66,0.35)" }} />
      ))}
      <BintangLaut kelas="absolute left-[38%] top-[84%] w-[clamp(28px,3.4vw,46px)]" style={{ transform: "rotate(-14deg)", filter: "drop-shadow(0 3px 3px rgba(11,36,66,0.4))" }} />
      <BintangLaut kelas="absolute left-[72%] top-[90%] w-[clamp(22px,2.6vw,36px)]" warna="#F0A14A" terang="#FFD08A" gelap="#B8661E" style={{ transform: "rotate(24deg)", filter: "drop-shadow(0 3px 3px rgba(11,36,66,0.4))" }} />
      {/* batu-batu dasar laut berlumut */}
      {[
        { x: 8, b: 33, w: "clamp(70px,9vw,120px)", d: "M4 56C2 40 10 22 28 16C40 6 62 8 74 20C90 26 98 42 94 56Z" },
        { x: 84, b: 32, w: "clamp(56px,7vw,92px)", d: "M2 58C0 44 14 34 24 30C30 14 50 8 64 16C74 12 88 22 90 34C98 40 98 52 96 58Z" },
        { x: 52, b: 34, w: "clamp(34px,4vw,54px)", d: "M4 56C2 42 12 30 30 28C42 18 66 22 76 34C92 38 96 50 92 56Z" },
      ].map((b, i) => (
        <svg key={i} viewBox="0 0 100 62" aria-hidden="true" className="pointer-events-none absolute z-[1] overflow-visible" style={{ left: `${b.x}%`, bottom: `${b.b}%`, width: b.w }}>
          <ellipse cx="50" cy="57.5" rx="47" ry="4.6" {...BAYANG} />
          <path d={b.d} fill="url(#lt-l-batu)" />
          <ellipse cx="38" cy="26" rx="20" ry="9" fill="#fff" fillOpacity="0.18" style={{ filter: "blur(4px)" }} />
          <path d="M8 52C16 44 28 46 34 52z" fill="#5FA06A" fillOpacity="0.7" style={{ filter: "blur(0.6px)" }} />
          <path d="M60 52C68 46 80 46 90 52z" fill="#4F9060" fillOpacity="0.65" style={{ filter: "blur(0.6px)" }} />
        </svg>
      ))}
      {/* rumput laut berpita: bergoyang dari pangkalnya yang tertanam di pasir */}
      {[
        { x: 4, w: "clamp(48px,5.6vw,78px)", k: 0 },
        { x: 18, w: "clamp(42px,4.8vw,66px)", k: 1 },
        { x: 70, w: "clamp(44px,5vw,70px)", k: 2 },
        { x: 90, w: "clamp(50px,5.8vw,80px)", k: 3 },
      ].map((c, i) => (
        <svg key={i} viewBox="-34 -140 68 146" aria-hidden="true" className="pointer-events-none absolute z-[1] overflow-visible" style={{ left: `${c.x}%`, bottom: "35%", width: c.w }}>
          <ellipse cx="0" cy="2" rx="21" ry="3" {...BAYANG} />
          {KELP[c.k].map((b, j) => (
            <g key={j} transform={`translate(${b.bx.toFixed(1)} 0)`}>
              <g className="lt-helai" style={{ animationDuration: `${b.dur.toFixed(1)}s`, animationDelay: `${b.tunda.toFixed(1)}s` }}>
                <path d={b.d} fill="url(#lt-l-kelp)" fillOpacity="0.95" />
              </g>
            </g>
          ))}
        </svg>
      ))}
      {/* terumbu karang: bercabang + karang otak */}
      {[
        { x: 25, w: "clamp(84px,10.5vw,138px)", k: 0, c: "#E8604C", t: "#FFB29E" },
        { x: 40, w: "clamp(56px,7vw,92px)", k: 1, c: "#C45AA0", t: "#F0A8DA" },
      ].map((kr, i) => (
        <svg key={i} viewBox="-70 -120 140 124" aria-hidden="true" className="pointer-events-none absolute z-[1] overflow-visible" style={{ left: `${kr.x}%`, bottom: `${34 + i * 0.6}%`, width: kr.w }}>
          <ellipse cx="0" cy="2" rx="15" ry="3" {...BAYANG} />
          {KARANG[kr.k].map((s, j) => (
            <g key={j}>
              <path d={`M${n1(s.x1)} ${n1(s.y1)}L${n1(s.x2)} ${n1(s.y2)}`} stroke={kr.c} strokeWidth={s.w.toFixed(1)} strokeLinecap="round" fill="none" />
              {s.daun && (
                <>
                  <circle cx={n1(s.x2)} cy={n1(s.y2)} r={(s.w * 0.75).toFixed(1)} fill={kr.t} />
                  <circle cx={n1(s.x2)} cy={n1(s.y2)} r={(s.w * 0.25).toFixed(1)} fill={kr.c} />
                </>
              )}
            </g>
          ))}
        </svg>
      ))}
      <svg viewBox="0 0 80 44" aria-hidden="true" className="pointer-events-none absolute left-[63%] z-[1] w-[clamp(60px,8vw,104px)] overflow-visible" style={{ bottom: "34%" }}>
        <ellipse cx="40" cy="41.5" rx="38" ry="4" {...BAYANG} />
        <path d="M4 42C4 18 20 4 40 4s36 14 36 38z" fill="url(#lt-l-otak)" />
        {[[22, 30, 5], [34, 24, 4], [48, 28, 5], [58, 36, 4], [28, 38, 3.4], [44, 36, 3.6], [38, 14, 3.6], [52, 18, 3.2]].map(([x, y, rad], k) => (
          <ellipse key={k} cx={x} cy={y} rx={rad} ry={rad * 0.7} fill="#7A3E12" fillOpacity="0.26" style={{ filter: "blur(0.8px)" }} />
        ))}
        <ellipse cx="28" cy="14" rx="14" ry="6" fill="#fff" fillOpacity="0.22" style={{ filter: "blur(3px)" }} />
      </svg>
      {/* peti harta: tutup/terbuka, emas menyembul dari balik bibir peti */}
      <div className="absolute z-[2] w-[clamp(90px,11.5vw,150px)]" style={{ right: "14%", bottom: "32%" }}>
        <button type="button" disabled={!benda} aria-label="Peti harta: buka atau tutup" onClick={buka} className={cn("block w-full cursor-pointer", mati)}>
          <svg viewBox="0 -30 130 140" className="block w-full overflow-visible">
            <ellipse cx="65" cy="106" rx="57" ry="4.6" {...BAYANG} />
            {terbuka && (
              <g key={`o-${peti}`}>
                <path d="M22 54L30 8h70l8 46z" fill="url(#lt-l-beludru)" />
                <path d="M18 56L28 4h74l10 52" fill="none" stroke="url(#lt-l-kayu)" strokeWidth="4.5" strokeLinejoin="round" />
                <g className="lt-gundukan">
                  <path d="M20 62C26 40 46 30 66 30s38 10 44 32z" fill="url(#lt-l-emas)" />
                  {[
                    [34, 50, 0.1], [48, 42, -0.2], [62, 36, 0.05], [76, 41, 0.3], [90, 48, -0.1], [102, 55, 0.2],
                    [42, 56, 0.35], [58, 50, -0.3], [72, 52, 0.1], [86, 57, -0.25], [28, 58, 0], [68, 44, -0.15],
                  ].map(([x, y, a], i) => (
                    <g key={i} className="lt-koin-muncul" style={{ animationDelay: `${(0.12 + i * 0.06).toFixed(2)}s`, transformOrigin: `${x}px ${y}px` }}>
                      <ellipse cx={x} cy={y} rx="8" ry="4.6" transform={`rotate(${(a * 40).toFixed(0)} ${x} ${y})`} fill="url(#lt-l-emas)" />
                      <ellipse cx={x - 1} cy={y - 1} rx="4.6" ry="2.2" transform={`rotate(${(a * 40).toFixed(0)} ${x} ${y})`} fill="#FFF0A8" fillOpacity="0.5" />
                    </g>
                  ))}
                  <g className="lt-koin-muncul" style={{ animationDelay: "0.55s", transformOrigin: "52px 30px" }}>
                    <path d="M52 22l6 4-2 8h-8l-2-8z" fill="#E0414E" />
                    <path d="M52 22l-2 6 6 0z" fill="#fff" fillOpacity="0.45" />
                  </g>
                  <g className="lt-koin-muncul" style={{ animationDelay: "0.62s", transformOrigin: "84px 34px" }}>
                    <path d="M84 27l5 3.4-1.6 6.6h-6.8l-1.6-6.6z" fill="#3FC98A" />
                  </g>
                  <g className="lt-koin-muncul" style={{ animationDelay: "0.7s", transformOrigin: "66px 28px" }}>
                    <circle cx="66" cy="26" r="6.6" fill="#F6F0E2" />
                    <circle cx="64" cy="24" r="2" fill="#fff" />
                  </g>
                </g>
                {[
                  [40, 30],
                  [92, 38],
                  [66, 14],
                  [24, 52],
                ].map(([x, y], i) => (
                  <path key={i} className="lt-kilau" d={`M${x} ${y - 8}L${x + 2} ${y - 2}L${x + 8} ${y}L${x + 2} ${y + 2}L${x} ${y + 8}L${x - 2} ${y + 2}L${x - 8} ${y}L${x - 2} ${y - 2}Z`} fill="#FFF7C8" style={{ animationDelay: `${(0.5 + i * 0.28).toFixed(2)}s`, transformOrigin: `${x}px ${y}px` }} />
                ))}
              </g>
            )}
            {/* badan peti: dinding depan menutupi pangkal tumpukan emas */}
            <path d="M12 60h106v44a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="url(#lt-l-kayu)" />
            <path d="M12 60h106v8H12z" fill="#A9703B" />
            <path d="M28 60h10v48H28zM92 60h10v48H92z" fill="#8A93A8" />
            {[34, 98].flatMap((x) => [68, 98].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#D5DAE8" />))}
            {terbuka ? (
              <rect x="56" y="72" width="18" height="18" rx="3" fill="#F2B72B" />
            ) : (
              <>
                <path d="M12 60C12 30 32 16 65 16s53 14 53 44z" fill="url(#lt-l-kayu)" />
                <path d="M28 60C28 36 34 22 38 20M92 60C92 36 90 22 86 20" fill="none" stroke="#8A93A8" strokeWidth="9" />
                <rect x="55" y="52" width="20" height="18" rx="3" fill="#F2B72B" />
                <circle cx="65" cy="60" r="2.6" fill="#3E2410" />
              </>
            )}
          </svg>
        </button>
        {peti > 0 &&
          Array.from({ length: 8 }, (_, i) => (
            <span key={`${peti}-${i}`} aria-hidden="true" className="lt-naik pointer-events-none absolute left-1/2 top-[20%] rounded-full border border-white/80 bg-white/20" style={{ width: 8 + r(i, 20) * 12, height: 8 + r(i, 20) * 12, ["--dx" as string]: `${(r(i, 21) - 0.5) * 80}px`, animationDelay: `${r(i, 22) * 0.4}s` }} />
          ))}
      </div>
      {/* kedalaman & vinyet: tepi layar menggelap lembut */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 38%,transparent 52%,rgba(6,28,64,0.38))" }} />
      {/* ikan pancing = lampu: berenang di tempat sambil menggoyang umpan bercahaya */}
      <div className="absolute left-[34%] top-[19%] z-[26] w-[clamp(110px,13.5vw,180px)]">
        <div className="lt-goyang" style={{ animationDuration: "3.4s" }}>
          <Saklar {...p} kelas="block w-full" label="Ikan pancing">
            <IkanPancing gelap={p.gelap} />
          </Saklar>
        </div>
      </div>
      <Penutup gelap={p.gelap} warna="#030F2A" />
    </div>
  );
}
