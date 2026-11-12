"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SERAT, mati } from "./LatarBersama";

/**
 * Ruang Game (menu Games). Gaya KARTUN yang sama dengan ruangan lain (`SyroboRuangan`) dan kamar utama: garis tinta tebal `#2B2233`, warna
 * datar hangat, wallpaper bergaris + panel kayu + lis, lantai berbatas tinta, serat kertas. Di dalam gaya itu tiap benda digarap seperti
 * ilustrasi buatan tangan: bentuk bernalar (TV tabung dengan antena & lubang pengeras suara, kartrid bertakik & berlabel, kantong kacang
 * dengan satu lipatan di tempat ia benar-benar melipat), sedikit miring & tak simetris yang disengaja, bayangan kontak di bawah tiap benda,
 * dan TANPA garis hiasan acak atau gradasi neon. Fitur sentuh: TV (ganti permainan di layar), kantong kacang (empuk), piala (berkilau).
 */

const TEPI = "#2B2233";
const G = { stroke: TEPI, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Alas({ cx, cy, rx, ry = 6 }: { cx: number; cy: number; rx: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={TEPI} fillOpacity=".24" stroke="none" />;
}

function Gbr({ vb, children, className }: { vb: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={vb} className={cn("block w-full overflow-visible", className)} {...G}>
      {children}
    </svg>
  );
}

const ALIEN_A = ["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"];
const ALIEN_B = ["00100000100", "10010001001", "10111111101", "11101110111", "11111111111", "01111111110", "00100000100", "01000000010"];
const piksel = (baris: string[], x0: number, y0: number, s: number) =>
  baris
    .flatMap((b, y) => [...b].map((c, x) => (c === "1" ? `M${x0 + x * s} ${y0 + y * s}h${s}v${s}h-${s}z` : "")))
    .join("");

const PESAN_TV = ["Pong klasik! Pantulkan terus bolanya.", "Awas, alien datang!", "Layar uji. Tekan lagi untuk ganti permainan."];

/** Isi layar TV (koordinat 110 x 88), tanpa garis tepi: tiga mode yang bergantian saat TV disentuh. */
function IsiLayar({ modus }: { modus: number }) {
  if (modus === 0)
    return (
      <>
        <rect width="110" height="88" fill="#16262C" />
        <path d="M55 4V84" stroke="#6E9A88" strokeWidth="2" strokeDasharray="4 4" />
        <rect className="lt-pong-p" x="6" y="8" width="4" height="18" fill="#E8F6EA" />
        <rect className="lt-pong-p" x="100" y="8" width="4" height="18" fill="#E8F6EA" style={{ animationDelay: "-0.5s" }} />
        <g className="lt-pong-x">
          <g className="lt-pong-y">
            <rect x="12" y="14" width="5" height="5" fill="#fff" />
          </g>
        </g>
        <path d="M34 8h3v8h-3zM40 8h3v8h-3zM70 8h3v8h-3z" fill="#6E9A88" />
      </>
    );
  if (modus === 1)
    return (
      <>
        <rect width="110" height="88" fill="#141A44" />
        {[
          [12, 10],
          [90, 18],
          [70, 6],
          [28, 34],
          [98, 40],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="2" height="2" fill="#F6E3C0" />
        ))}
        <path className="lt-fa" d={piksel(ALIEN_A, 38, 18, 3)} fill="#6BE0A8" />
        <path className="lt-fb" d={piksel(ALIEN_B, 38, 18, 3)} fill="#6BE0A8" />
        <rect y="78" width="110" height="3" fill="#4FB07A" />
        <path d="M50 76l5-8 5 8z" fill="#F2C14E" />
      </>
    );
  return (
    <>
      {["#ECECEC", "#E6D84A", "#4AD6D6", "#4AD64A", "#D64AD6", "#D64A4A", "#4A4AD6"].map((c, i) => (
        <rect key={i} x={i * (110 / 7)} y="0" width={110 / 7 + 0.5} height="62" fill={c} />
      ))}
      {["#4A4AD6", "#111", "#D64AD6", "#111", "#4AD6D6", "#111", "#ECECEC"].map((c, i) => (
        <rect key={i} x={i * (110 / 7)} y="62" width={110 / 7 + 0.5} height="26" fill={c} />
      ))}
    </>
  );
}

/**
 * Lampu hias: satu untaian kabel DIPAKU di dinding (paku di kedua ujung + dua titik tengah) sehingga tak lagi terlihat menembus keluar
 * layar. Tiap bohlam bersocket menggantung tepat di bawah kabel (posisi dihitung dari kurva kuadrat tiap ayunan) dan berkedip bergantian.
 */
const LAMPU = (() => {
  const jangkar = [2, 34, 66, 98];
  const sag = 8;
  const titik: { x: number; y: number; w: string }[] = [];
  for (let i = 0; i < jangkar.length - 1; i++) {
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const x = jangkar[i] + (jangkar[i + 1] - jangkar[i]) * t;
      titik.push({ x, y: 3 + 4 * sag * t * (1 - t), w: ["#F2C14E", "#F28CB8", "#6BE0A8", "#6BA7D8"][(i * 4 + Math.round(t * 5)) % 4] });
    }
  }
  const kabel = jangkar.map((a, i) => (i === 0 ? `M${a} 3` : `Q${((jangkar[i - 1] + a) / 2).toFixed(1)} ${3 + sag * 2} ${a} 3`)).join("");
  return { jangkar, titik, kabel };
})();

/** Satu piala di rak; `jenis` menentukan bentuk & logamnya. Tinggi alasnya sama supaya semuanya berdiri di papan. */
function Piala({ jenis }: { jenis: "emas" | "perak" | "perunggu" | "bintang" | "plakat" }) {
  if (jenis === "bintang")
    return (
      <Gbr vb="0 0 40 50">
        <path d="M20 4l4.200 8.800 9.600 1.200-7 6.600 1.800 9.600L20 25.400 11.400 30.200l1.800-9.600-7-6.600 9.600-1.200z" fill="#F2C14E" />
        <rect x="17" y="30" width="6" height="12" fill="#E0A82E" />
        <path d="M10 42h20v8H10z" fill="#8A5F44" />
        <rect x="14" y="44" width="12" height="3" fill="#F2C14E" strokeWidth="1.800" />
      </Gbr>
    );
  if (jenis === "plakat")
    return (
      <Gbr vb="0 0 40 53">
        <path d="M6 6h28v20c0 9-8 14-14 17-6-3-14-8-14-17z" fill="#6BA7D8" />
        <path d="M20 13l2.400 5 5.400.7-4 3.800 1 5.400-4.800-2.600-4.800 2.600 1-5.400-4-3.800 5.400-.7z" fill="#FFF3C4" strokeWidth="1.800" />
        <rect x="16" y="43" width="8" height="4" fill="#E0A82E" />
        <path d="M10 47h20v6H10z" fill="#8A5F44" />
      </Gbr>
    );
  const w = { emas: ["#F2C14E", "#E0A82E"], perak: ["#D6DBE3", "#B0B7C3"], perunggu: ["#DE9A5E", "#B8703E"] }[jenis];
  return (
    <Gbr vb="0 0 40 53">
      <path d="M8 6h24v13c0 8-5 13-12 13S8 27 8 19z" fill={w[0]} />
      <path d="M8 10H3c0 8 3 11 7 12M32 10h5c0 8-3 11-7 12" fill="none" />
      <rect x="17" y="32" width="6" height="9" fill={w[1]} />
      <path d="M12 41h16v4H12z" fill={w[1]} />
      <path d="M9 45h22v8H9z" fill="#8A5F44" />
      <path d="M14 13c-1 3-1 6 1 9" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.600" />
    </Gbr>
  );
}

const JENIS_PIALA = ["perunggu", "emas", "perak", "bintang", "plakat"] as const;
const LEBAR_PIALA = [13, 19, 14, 14, 13];

export default function RuangGame({ bisik }: { bisik: (teks: string) => void }) {
  const [modus, setModus] = useState(0);
  const [empuk, setEmpuk] = useState([0, 0]);
  const [piala, setPiala] = useState({ n: 0, i: 0 });
  const tekanTv = () => {
    const baru = (modus + 1) % 3;
    setModus(baru);
    bisik(PESAN_TV[baru]);
  };
  const tekanEmpuk = (i: number) => {
    setEmpuk((e) => e.map((v, k) => (k === i ? v + 1 : v)));
    bisik(["Empuk sekali!", "Pas buat rebahan."][i]);
  };
  const tekanPiala = (i: number) => {
    setPiala((p) => ({ n: p.n + 1, i }));
    bisik(["Juara ketiga, tetap membanggakan!", "Juara satu! Kilaunya bagus.", "Juara kedua, hebat!", "Bintang turnamen!", "Plakat penghargaan."][i]);
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* dinding: wallpaper bergaris + titik halus, panel kayu bawah ber-lis, lantai berbatas tinta (konstruksi sama dengan ruangan lain) */}
      <div className="absolute inset-x-0 top-0 h-[62%] [background:repeating-linear-gradient(90deg,#9A90D8_0_44px,#9187CF_44px_88px)]" />
      <div className="absolute inset-x-0 top-0 h-[62%] opacity-40 [background:radial-gradient(circle_at_20px_20px,rgba(255,255,255,0.22)_2px,transparent_2.5px)] [background-size:44px_44px]" />
      <div className="absolute inset-x-0 top-[46%] h-[16%] bg-[#8A5F44] [background-image:repeating-linear-gradient(90deg,transparent_0_96px,rgba(43,34,51,0.28)_96px_99px)]" />
      <div className="absolute inset-x-0 top-[45%] h-3 border-y-[3px] border-[#2B2233] bg-[#A67654]" />
      <div className="absolute inset-x-0 bottom-0 top-[62%] border-t-[4px] border-[#2B2233] bg-[#C99A66] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.3)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.16)_62px_64px)]" />
      <div className="absolute inset-x-0 top-[62%] h-[10%] [background:linear-gradient(180deg,rgba(43,34,51,0.28),transparent)]" />
      {/* karpet bundar bergaris putus-putus, seperti di kamar utama */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[72%] h-[22%] w-[56%] -translate-x-1/2 rounded-[50%] border-[3px] border-[#2B2233] bg-[#C4623F] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
        <div className="absolute inset-[9%] rounded-[50%] border-[3px] border-dashed border-[#F6E3C0]/85 bg-[#7FA37A]" />
        <div className="absolute inset-[34%] rounded-[50%] border-[3px] border-[#2B2233] bg-[#F2C14E]" />
      </div>
      {/* lampu hias: kabel dipaku di dinding, bohlam bersocket menggantung & berkedip bergantian */}
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[11%] h-[9%] w-full">
        <path d={LAMPU.kabel} fill="none" stroke={TEPI} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {LAMPU.jangkar.map((x) => (
        <span key={x} aria-hidden="true" className="pointer-events-none absolute z-[1] block h-[10px] w-[10px] -translate-x-1/2 rounded-full border-[2.5px] border-[#2B2233] bg-[#B8AE96]" style={{ left: `${x}%`, top: `calc(${(11 + (3 / 20) * 9).toFixed(2)}% - 5px)` }} />
      ))}
      {LAMPU.titik.map((b, i) => (
        <span key={i} aria-hidden="true" className="lt-kerlip pointer-events-none absolute z-[1] block w-[13px] -translate-x-1/2" style={{ left: `${b.x.toFixed(1)}%`, top: `calc(${(11 + (b.y / 20) * 9).toFixed(2)}% + 1px)`, ["--glow" as string]: b.w, animationDelay: `${(((i * 5) % 8) * 0.2).toFixed(1)}s` }}>
          <svg viewBox="0 0 14 24" className="block w-full overflow-visible" {...G} strokeWidth={1.8}>
            <rect x="4" y="0" width="6" height="6" rx="1.500" fill="#5B4A68" />
            <path d="M7 6C1.500 6 1 12 3.500 16.500 5 19.500 5.500 23 7 23s2-3.500 3.500-6.500C13 12 12.500 6 7 6z" fill={b.w} />
            <ellipse cx="5" cy="12" rx="1.300" ry="2.600" fill="#fff" fillOpacity="0.7" stroke="none" />
          </svg>
        </span>
      ))}
      {/* poster tempel: pita perekat di sudut, sedikit miring seperti ditempel tangan */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[40%] top-[24%] w-[clamp(60px,7vw,92px)] max-sm:hidden" style={{ transform: "rotate(-2.4deg)" }}>
        <Gbr vb="0 0 80 104">
          <rect x="3" y="3" width="76" height="98" fill="#4B3D86" />
          <rect x="9" y="9" width="64" height="86" fill="#2F2762" strokeWidth="2.2" />
          <path d={piksel(ALIEN_A, 14, 28, 4.4)} fill="#6BE0A8" stroke="none" />
          <rect x="16" y="72" width="48" height="6" fill="#F2C14E" strokeWidth="2" />
          <rect x="24" y="82" width="32" height="4" fill="#F28CB8" strokeWidth="1.8" />
          <rect x="-8" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(-24 3 0)" />
          <rect x="70" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(24 77 0)" />
        </Gbr>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute left-[49%] top-[21%] w-[clamp(70px,8.4vw,112px)] max-sm:hidden" style={{ transform: "rotate(1.8deg)" }}>
        <Gbr vb="0 0 100 80">
          <rect x="3" y="3" width="94" height="74" fill="#FBF6EA" />
          <rect x="10" y="10" width="80" height="48" fill="#9CCFE8" strokeWidth="2.2" />
          <circle cx="66" cy="26" r="7.5" fill="#FFE08A" strokeWidth="2" />
          <path d="M10 58L32 30l15 18 12-12 31 22z" fill="#6F9570" strokeWidth="2.2" />
          <rect x="-8" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(-24 3 0)" />
          <rect x="88" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(24 97 0)" />
        </Gbr>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute left-[86%] top-[28%] w-[clamp(52px,6vw,80px)] max-sm:hidden" style={{ transform: "rotate(2.6deg)" }}>
        <Gbr vb="0 0 70 90">
          <rect x="3" y="3" width="64" height="84" fill="#F2C14E" />
          <rect x="9" y="9" width="52" height="72" fill="#F7D777" strokeWidth="2.2" />
          <path d="M16 56c0-12 6-18 12-18h14c6 0 12 6 12 18 0 6-3 8-7 6l-6-3H29l-6 3c-4 2-7 0-7-6z" fill="#3A2A55" strokeWidth="2.2" />
          <path d="M25 46v8M21 50h8" stroke="#F7D777" strokeWidth="2.4" />
          <circle cx="46" cy="48" r="2.2" fill="#E56B5D" stroke="none" />
          <circle cx="52" cy="53" r="2.2" fill="#6BA7D8" stroke="none" />
          <rect x="16" y="16" width="38" height="6" fill="#3A2A55" strokeWidth="2" />
          <rect x="-8" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(-24 3 0)" />
          <rect x="60" y="-3" width="18" height="9" fill="#F3E6C5" strokeWidth="2" transform="rotate(24 68 0)" />
        </Gbr>
      </div>
      {/* rak: papan bertopang dua siku, SEMUA isinya piala (disentuh = berkilau) */}
      <div className="absolute left-[61%] top-[12%] z-[2] w-[clamp(150px,20vw,270px)] max-sm:left-[44%] max-sm:top-[24%] max-sm:w-[50vw]">
        <Gbr vb="0 0 240 124" className="pointer-events-none">
          <path d="M40 96l-8 16h24zM200 96l8 16h-24z" fill="#8A5F44" />
          <rect x="6" y="88" width="228" height="12" rx="3" fill="#A67654" />
          <Alas cx={120} cy={116} rx={100} ry={5} />
        </Gbr>
        {JENIS_PIALA.map((j, i) => (
          <button key={j} type="button" aria-label={`Piala ${i + 1}: kilaukan`} onClick={() => tekanPiala(i)} className={cn("absolute bottom-[29%] cursor-pointer", mati)} style={{ left: `${(5 + i * 18.4).toFixed(1)}%`, width: `${LEBAR_PIALA[i]}%` }}>
            <Piala jenis={j} />
            {piala.n > 0 &&
              piala.i === i &&
              [
                [-4, 8],
                [34, 4],
                [18, -8],
              ].map(([x, y], k) => (
                <svg key={`${piala.n}-${k}`} viewBox="-8 -8 16 16" className="lt-kilau pointer-events-none absolute w-[40%] overflow-visible" style={{ left: `${x * 2}%`, top: `${y * 2}%`, animationDelay: `${k * 0.16}s` }}>
                  <path d="M0 -8L1.800 -1.800 8 0 1.800 1.800 0 8 -1.800 1.800 -8 0 -1.800 -1.800Z" fill="#FFF7C8" stroke={TEPI} strokeWidth="1.400" strokeLinejoin="round" />
                </svg>
              ))}
          </button>
        ))}
      </div>
      {/* lampu lantai: tiang tinta, kap krem */}
      <div aria-hidden="true" className="pointer-events-none absolute z-[2] w-[clamp(36px,4.4vw,58px)] max-sm:hidden" style={{ left: "31%", bottom: "33%" }}>
        <Gbr vb="0 0 60 270">
          <Alas cx={30} cy={262} rx={22} ry={5} />
          <ellipse cx="30" cy="258" rx="18" ry="6" fill="#8A5F44" />
          <path d="M30 252V58" strokeWidth="4" />
          <path d="M8 58L16 8h28l8 50z" fill="#F6E3B8" />
          <path d="M20 16c-2 10-3 22-3 36" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        </Gbr>
      </div>
      {/* kantong kacang: badan terkulai dengan simpul kain di puncak, bayangan bawah & sorot berupa BIDANG warna (bukan garis) */}
      <button type="button" aria-label="Kantong kacang: tekan" onClick={() => tekanEmpuk(0)} className={cn("absolute z-[2] w-[clamp(120px,17vw,220px)] cursor-pointer max-sm:left-[-4%]", mati)} style={{ left: "6%", bottom: "26%" }}>
        <span key={empuk[0]} className={cn("block origin-bottom", empuk[0] > 0 && "lt-empuk")}>
          <Gbr vb="0 0 200 156">
            <path d="M14 132C6 104 22 72 52 56C60 34 92 24 114 40C144 38 176 56 188 90C198 118 192 136 172 142C148 150 62 152 36 146C22 144 16 140 14 132Z" fill="#D8704A" />
            <ellipse cx="62" cy="76" rx="20" ry="13" fill="#F4A986" stroke="none" transform="rotate(-26 62 76)" />
            <g transform="rotate(-14 130 78)">
              <path d="M110 70c0-5 4-8 8-8h24c4 0 8 3 8 8 0 6-3 12-7 12-3 0-4-2-7-2h-12c-3 0-4 2-7 2-4 0-7-6-7-12z" fill="#EDE6D8" />
              <path d="M118 66v8M114 70h8" strokeWidth="2.400" />
              <circle cx="140" cy="68" r="2.400" fill="#E56B5D" strokeWidth="1.800" />
              <circle cx="146" cy="72" r="2.400" fill="#6BA7D8" strokeWidth="1.800" />
            </g>
          </Gbr>
        </span>
      </button>
      <button type="button" aria-label="Kantong kacang kecil: tekan" onClick={() => tekanEmpuk(1)} className={cn("absolute z-[2] w-[clamp(80px,11vw,150px)] cursor-pointer max-sm:hidden", mati)} style={{ left: "85%", bottom: "26%" }}>
        <span key={empuk[1]} className={cn("block origin-bottom", empuk[1] > 0 && "lt-empuk")}>
          <Gbr vb="0 0 200 156">
            <path d="M186 132C194 104 178 72 148 56C140 34 108 24 86 40C56 38 24 56 12 90C2 118 8 136 28 142C52 150 138 152 164 146C178 144 184 140 186 132Z" fill="#7FA37A" />
            <ellipse cx="138" cy="76" rx="20" ry="13" fill="#B4CDAE" stroke="none" transform="rotate(26 138 76)" />
          </Gbr>
        </span>
      </button>
      {/* TV tabung + konsol retro di atas lemari rendah; layar berganti permainan saat disentuh */}
      <div className="absolute left-[60%] z-[2] w-[clamp(170px,22vw,300px)] max-sm:left-[44%] max-sm:w-[54vw]" style={{ bottom: "34%" }}>
        <button type="button" aria-label="TV: ganti permainan" onClick={tekanTv} className={cn("relative block w-full cursor-pointer", mati)}>
          <Gbr vb="0 0 260 262">
            <Alas cx={130} cy={256} rx={122} ry={6} />
            <rect x="8" y="188" width="244" height="62" rx="5" fill="#B7804F" />
            <rect x="18" y="200" width="104" height="42" rx="3" fill="#A06B3F" strokeWidth="2.400" />
            <rect x="138" y="200" width="104" height="42" rx="3" fill="#A06B3F" strokeWidth="2.400" />
            <circle cx="70" cy="221" r="3.400" fill="#F2C14E" strokeWidth="2" />
            <circle cx="190" cy="221" r="3.400" fill="#F2C14E" strokeWidth="2" />
            <rect x="18" y="172" width="66" height="16" rx="3" fill="#D6CFBF" />
            <rect x="28" y="178" width="34" height="5" rx="1.500" fill="#3A3A44" strokeWidth="1.800" />
            <circle cx="72" cy="180" r="2.800" fill="#E54B4B" strokeWidth="1.800" />
            <path d="M150 62L124 22M168 62L196 28" />
            <circle cx="124" cy="22" r="3.600" fill="#D6CFBF" strokeWidth="2.400" />
            <circle cx="196" cy="28" r="3.600" fill="#D6CFBF" strokeWidth="2.400" />
            <rect x="92" y="58" width="158" height="130" rx="18" fill="#E6DAC0" />
            <rect x="102" y="68" width="120" height="98" rx="16" fill="#1A1A22" />
            <g transform="translate(107 76)" stroke="none" className="lt-layar">
              <clipPath id="rg-c-layar">
                <rect width="110" height="88" rx="13" />
              </clipPath>
              <g clipPath="url(#rg-c-layar)">
                <IsiLayar modus={modus} />
                <path d="M0 0H64L0 46Z" fill="#fff" fillOpacity="0.1" />
              </g>
            </g>
            <circle cx="236" cy="86" r="6" fill="#B8AE96" strokeWidth="2.400" />
            <circle cx="236" cy="108" r="6" fill="#B8AE96" strokeWidth="2.400" />
            {[130, 138, 146, 154].map((y) => (
              <path key={y} d={`M229 ${y}h14`} strokeWidth="2.400" />
            ))}
          </Gbr>
        </button>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: SERAT }} />
    </div>
  );
}
