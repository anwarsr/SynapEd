"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ruangan SyRobo selain kamar utama: dapur (menu Makan), kamar mandi (Mandi), ruang ganti (Baju) dan toko (Toko).
 *
 * Gaya SAMA dengan kamar utama (`SyroboKamar`): garis tinta tebal `#2B2233`, warna datar hangat, dinding + panel kayu + lis, lantai
 * berbatas tinta, karpet bundar bergaris, serat kertas. Di dalam gaya itu tiap benda digarap lebih rinci seperti ilustrasi
 * buatan tangan: bentuk bernalar (piring bulat bergelang, roti utuh, apel setangkup), detail yang punya fungsi (engsel, baut,
 * lipatan kain, anyaman), dan sedikit ketidaksempurnaan yang disengaja - tanpa garis hiasan acak.
 *
 * ATURAN PENEMPATAN: benda lantai menapak di `PIJAK` (sedikit di bawah garis dinding-lantai supaya terbaca berdiri DI lantai) dan
 * bayangannya digambar DI DALAM svg-nya (elips tepat di bawah kaki, `Alas`); benda meja berdiri di `MEJA`/`KASIR`; benda dinding
 * digantung pada braket/paku/pelat yang tergambar. Gerak lewat CSS `.rg-*` (globals.css) yang dipicu `key` berganti.
 */

export type JenisRuangan = "dapur" | "mandi" | "ganti" | "toko";

/** Garis dinding-lantai (persen dari bawah) dan titik pijak benda lantai. */
const LANTAI = 38;
const PIJAK = LANTAI - 5;
const TEPI = "#2B2233";
const G = { stroke: TEPI, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Bayangan kontak di lantai: elips di bawah kaki, bagian dari gambar bendanya. */
function Alas({ cx, cy, rx, ry = 6 }: { cx: number; cy: number; rx: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={TEPI} fillOpacity=".24" stroke="none" />;
}

/** Gambar satu benda. */
function Gbr({ vb, children, className }: { vb: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={vb} className={cn("block w-full overflow-visible", className)} {...G}>
      {children}
    </svg>
  );
}

interface BendaProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Posisi mutlak (bawaan). `false` = mengalir di dalam wadah (benda di atas rak). */
  abs?: boolean;
}

function Benda({ label, onClick, children, pressed, className, style, abs = true }: BendaProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      style={style}
      className={cn(abs && "absolute", "z-[2] cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]", className)}
    >
      {children}
    </button>
  );
}

/** Hiasan tak interaktif. */
function Hias({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div aria-hidden="true" style={style} className={cn("pointer-events-none absolute", className)}>
      {children}
    </div>
  );
}

const SERAT = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.2  0 0 0 0.9 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")",
} as const;

/** Dinding atas (wallpaper bergaris) dan lantai tiap ruangan; konstruksi sama dengan kamar utama. */
const LATAR: Record<JenisRuangan, { dinding: string; lantai: string }> = {
  dapur: {
    dinding: "[background:repeating-linear-gradient(90deg,#E2C58A_0_44px,#DCBC7C_44px_88px)]",
    lantai: "bg-[#D9CBB0] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.3)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.16)_62px_64px)]",
  },
  mandi: {
    dinding: "[background:repeating-linear-gradient(90deg,#8FC6CF_0_44px,#86BDC6_44px_88px)]",
    lantai: "bg-[#BFD9E3] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.26)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.14)_62px_64px)]",
  },
  ganti: {
    dinding: "[background:repeating-linear-gradient(90deg,#B98FA6_0_44px,#B0869D_44px_88px)]",
    lantai: "bg-[#BE8A5B] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.3)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.16)_62px_64px)]",
  },
  toko: {
    dinding: "[background:repeating-linear-gradient(90deg,#9CCBA0_0_44px,#93C297_44px_88px)]",
    lantai: "bg-[#D8B98A] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.3)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.16)_62px_64px)]",
  },
};

export default function SyroboRuangan({ jenis, bisik }: { jenis: JenisRuangan; bisik: (teks: string) => void }) {
  const l = LATAR[jenis];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-[62%]", l.dinding)} />
      <div className="absolute inset-x-0 top-0 h-[62%] opacity-40 [background:radial-gradient(circle_at_20px_20px,rgba(255,255,255,0.22)_2px,transparent_2.5px)] [background-size:44px_44px]" />
      <div className="absolute inset-x-0 top-[46%] h-[16%] bg-[#8A5F44] [background-image:repeating-linear-gradient(90deg,transparent_0_96px,rgba(43,34,51,0.28)_96px_99px)]" />
      <div className="absolute inset-x-0 top-[45%] h-3 border-y-[3px] border-[#2B2233] bg-[#A67654]" />
      <div className={cn("absolute inset-x-0 bottom-0 top-[62%] border-t-[4px] border-[#2B2233]", l.lantai)} />
      <div className="absolute inset-x-0 top-[62%] h-[10%] [background:linear-gradient(180deg,rgba(43,34,51,0.28),transparent)]" />

      {jenis === "dapur" && <Dapur bisik={bisik} />}
      {jenis === "mandi" && <KamarMandi bisik={bisik} />}
      {jenis === "ganti" && <RuangGanti bisik={bisik} />}
      {jenis === "toko" && <Toko bisik={bisik} />}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={SERAT} />
    </div>
  );
}

/* ───────────────────── bahan gambar bersama ───────────────────── */

/** Apel SETANGKUP (kiri-kanan sama): lekuk di atas, tangkai, satu daun, kilap di sisi kiri. Selalu merah. */
function Apel({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={2.2}>
      <path d="M0 -11C-5 -18 -18 -16 -19 -2C-20 12 -10 20 -4 18C-2 17.500 2 17.500 4 18C10 20 20 12 19 -2C18 -16 5 -18 0 -11Z" fill="#C9473B" />
      <path d="M-10 6C-6 14 6 14 10 6C6 11 -6 11 -10 6Z" fill="#9E3128" stroke="none" />
      <path d="M0 -11C0 -15 1 -18 3 -21" fill="none" />
      <path d="M3 -17C8 -23 16 -21 16 -15C11 -13 6 -14 3 -17Z" fill="#6F9E58" strokeWidth={1.8} />
      <path d="M-12 -5C-13 0 -11 5 -8 8" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth={2.4} />
    </g>
  );
}

/** Gantungan baju kayu: leher berkait yang melingkar di palang, bahu melandai. Titik (0,0) = pusat palang. */
function Gantungan({ x, y, lebar = 36 }: { x: number; y: number; lebar?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeWidth={2}>
      <path d="M0 16V9C0 1 10 -1 11 6" fill="none" strokeWidth={3} />
      <path d={`M0 16Q${-lebar * 0.45} 22 ${-lebar} 31Q${-lebar - 5} 34 ${-lebar} 35H${lebar}Q${lebar + 5} 34 ${lebar} 31Q${lebar * 0.45} 22 0 16Z`} fill="#B98255" />
    </g>
  );
}

/** Kaos berleher bulat, lengan pendek; warna & warna kerahnya diberikan. Pusat di x=0, leher di y=26. */
function Kaos({ warna, kerah }: { warna: string; kerah: string }) {
  return (
    <g strokeWidth={2}>
      <path d="M-14 26L-34 32L-47 56L-35 64L-29 54L-28 112Q0 118 28 112L29 54L35 64L47 56L34 32L14 26Q0 36 -14 26Z" fill={warna} />
      <path d="M-15 25Q0 39 15 25" fill="none" strokeWidth={6.500} stroke="#2B2233" />
      <path d="M-15 25Q0 39 15 25" fill="none" strokeWidth={3.500} stroke={kerah} />
    </g>
  );
}

/* ───────────────────────── DAPUR ───────────────────────── */

const MENU_DAPUR = ["Sup hangat siap disajikan!", "Wanginya enak sekali.", "Jangan lupa cuci tangan dulu.", "Hmm, kurang garam sedikit."];
/** Permukaan meja dapur (persen dari bawah). */
const MEJA = LANTAI + 17;

function Dapur({ bisik }: { bisik: (t: string) => void }) {
  const [api, setApi] = useState(false);
  const [kulkas, setKulkas] = useState(false);
  const [roti, setRoti] = useState(0);
  const [tutup, setTutup] = useState(0);
  const [gelas, setGelas] = useState(0);
  return (
    <>
      {/* jendela berdaun dua: langit dengan matahari & awan, bukit, pegangan; ambang berpot tanaman; tirai terikat tali */}
      <Hias className="left-[36%] w-[clamp(124px,15.500vw,208px)] max-sm:left-[34%] max-sm:w-[26vw]" style={{ bottom: `${MEJA + 12}%` }}>
        <Gbr vb="0 0 190 220">
          <defs>
            <clipPath id="rg-klipJendela">
              <rect x="28" y="28" width="134" height="150" />
            </clipPath>
          </defs>
          <rect x="16" y="16" width="158" height="170" rx="4" fill="#EFE7D6" />
          <g clipPath="url(#rg-klipJendela)">
            <rect x="28" y="28" width="134" height="150" fill="#BFE3F0" />
            <circle cx="136" cy="56" r="14" fill="#FFE08A" strokeWidth={2} />
            <path d="M44 66c-8 0-10-10-2-12 2-8 14-8 16-1 8-1 10 9 3 13z" fill="#fff" strokeWidth={2} />
            <path d="M92 90c-7 0-9-9-2-11 2-7 12-7 14-1 7-1 9 8 2 12z" fill="#fff" strokeWidth={2} />
            <path d="M28 132c20-16 36-12 54-4s34 6 52-6 20-8 28-4v60H28z" fill="#8FB07A" strokeWidth={2} />
            <path d="M28 150c24-12 44-6 66 0s46 4 68-8v36H28z" fill="#6F9E58" strokeWidth={2} />
            <path d="M52 46L82 28M52 86L100 28M92 100l40-40" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth={6} />
          </g>
          <rect x="89" y="28" width="12" height="150" fill="#EFE7D6" stroke="none" />
          <rect x="28" y="97" width="134" height="12" fill="#EFE7D6" stroke="none" />
          <rect x="78" y="94" width="5" height="18" rx="2.500" fill="#C48A2E" strokeWidth={2} />
          <rect x="107" y="94" width="5" height="18" rx="2.500" fill="#C48A2E" strokeWidth={2} />
          <rect x="8" y="182" width="174" height="14" rx="3" fill="#A67654" />
          <rect x="4" y="8" width="182" height="7" rx="3.500" fill="#8A5F44" />
          <circle cx="6" cy="11" r="5" fill="#C48A2E" />
          <circle cx="184" cy="11" r="5" fill="#C48A2E" />
          <path d="M126 182l3-20h26l3 20z" fill="#C0674A" />
          <rect x="124" y="158" width="34" height="7" rx="2" fill="#B05A3E" />
          <path d="M141 158c-8-10-18-10-20-18 10 0 18 6 20 18zM141 158c8-12 16-12 22-22-12 2-20 10-22 22zM141 158c0-12 0-22 2-30 4 8 4 20-2 30z" fill="#6F9E58" strokeWidth={2} />
        </Gbr>
      </Hias>

      {/* lampu gantung */}
      <Hias className="left-[26%] top-0 w-[clamp(60px,7vw,92px)]">
        <Gbr vb="0 0 80 150">
          <rect x="38" y="0" width="4" height="74" fill={TEPI} stroke="none" />
          <path d="M14 104c0-20 12-32 26-32s26 12 26 32z" fill="#C48A2E" />
        </Gbr>
      </Hias>

      {/* lemari dapur: dari pijakan sampai permukaan meja */}
      <Hias className="left-[2%] w-[58%] max-sm:w-[64%]" style={{ bottom: `${PIJAK}%`, height: `${MEJA - PIJAK}%` }}>
        <div className="relative h-full w-full border-[3px] border-[#2B2233] bg-[#9A6B43]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="absolute top-[9%] h-[72%] w-[22%] border-[3px] border-[#2B2233] bg-[#A97B52]" style={{ left: `${i * 25 + 1.5}%` }}>
              <span className="absolute inset-[12%] border-2 border-[#2B2233]/35" />
              <span className="absolute right-[12%] top-[14%] h-5 w-1.5 rounded-full border-2 border-[#2B2233] bg-[#E2C66B]" />
            </span>
          ))}
          <span className="absolute inset-x-0 bottom-0 h-[9%] border-t-[3px] border-[#2B2233] bg-[#3A2519]" />
        </div>
      </Hias>
      <Hias className="left-[1%] w-[60%] max-sm:w-[66%] border-[3px] border-[#2B2233] bg-[#E4DDCD]" style={{ bottom: `${MEJA - 1.5}%`, height: "2.5%" }} />
      <Hias className="left-[1.5%] w-[59%] max-sm:w-[65%] h-[2%] [background:linear-gradient(180deg,rgba(43,34,51,0.28),transparent)]" style={{ bottom: `${MEJA - 3.5}%` }} />
      <Hias
        className="left-[1.5%] w-[59%] max-sm:w-[65%] bg-[#EDE5D3] [background-image:linear-gradient(rgba(43,34,51,0.2)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(43,34,51,0.2)_1.5px,transparent_1.5px)] [background-size:34px_34px]"
        style={{ bottom: `${MEJA + 1}%`, height: "11%" }}
      />

      {/* kompor tanam + panci */}
      <Benda
        label={api ? "Kompor: matikan api" : "Kompor: nyalakan api"}
        pressed={api}
        onClick={() => {
          setApi((a) => !a);
          setTutup((n) => n + 1);
          bisik(api ? "Api dimatikan." : MENU_DAPUR[Math.floor(Math.random() * MENU_DAPUR.length)]);
        }}
        className="left-[5%] w-[clamp(150px,19vw,250px)] max-sm:left-[3%] max-sm:w-[34vw]"
        style={{ bottom: `${MEJA}%` }}
      >
        <Gbr vb="0 0 170 140">
          <rect x="18" y="116" width="134" height="22" rx="3" fill="#4B4F57" />
          <rect x="18" y="116" width="134" height="6" fill="#6B707A" stroke="none" />
          <ellipse cx="56" cy="127" rx="9" ry="4" fill="#1E1F23" stroke="none" />
          <ellipse cx="114" cy="127" rx="9" ry="4" fill="#1E1F23" stroke="none" />
          <g key={tutup} className={api ? "rg-tutup" : undefined}>
            <rect x="28" y="64" width="18" height="10" rx="5" fill="#8E99A8" />
            <rect x="124" y="64" width="18" height="10" rx="5" fill="#8E99A8" />
            <path d="M42 56h86v50c0 6-4 10-10 10H52c-6 0-10-4-10-10z" fill="#D3DCE6" />
            <path d="M52 66v34" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth={3} />
            <path d="M38 56c0-10 8-14 47-14s47 4 47 14z" fill="#D3DCE6" />
            <rect x="79" y="35" width="12" height="9" rx="4" fill={TEPI} stroke="none" />
          </g>
          {api && (
            <g fill="none" stroke="#F6EFE3" strokeWidth="4" strokeOpacity=".85" className="rg-uap">
              <path d="M60 30c-5-6 4-10-1-18" />
              <path d="M82 24c-5-6 4-10-1-18" />
              <path d="M104 30c-5-6 4-10-1-18" />
            </g>
          )}
          {api && (
            <g className="rg-api" stroke="none">
              <path d="M50 118c-4-8 0-13 2-19 2 5 7 8 6 13 3-2 4-4 3-8 6 5 4 14-3 14z" fill="#F2842B" />
              <path d="M52 118c-2-5 0-7 1-10 1 3 3 5 3 7 0 2-1 3-2 3z" fill="#FFD36B" />
            </g>
          )}
        </Gbr>
      </Benda>

      {/* pemanggang roti: dua irisan roti UTUH yang sudah matang naik penuh dari lubangnya lalu turun lagi */}
      <Benda
        label="Pemanggang roti"
        onClick={() => {
          setRoti((n) => n + 1);
          bisik("Ting! Roti panggangnya matang.");
        }}
        className="left-[38%] w-[clamp(74px,9vw,118px)] max-sm:left-[40%] max-sm:w-[17vw]"
        style={{ bottom: `${MEJA}%` }}
      >
        <Gbr vb="0 0 100 107">
          <g key={roti} className={roti > 0 ? "rg-roti-utuh" : undefined}>
            {[19, 55].map((x) => (
              <g key={x}>
                {/* irisan roti: kulit, bagian dalam, dua tonjolan atas, bekas panggang */}
                <path d={`M${x} 92V70C${x - 5} 60 ${x - 1} 52 ${x + 9} 54C${x + 12} 50 ${x + 20} 50 ${x + 24} 54C${x + 32} 52 ${x + 32} 62 ${x + 27} 70V92Z`} fill="#B7782E" />
                <path d={`M${x + 4} 90V71C${x + 1} 64 ${x + 3} 59 ${x + 9} 60C${x + 12} 57 ${x + 18} 57 ${x + 21} 60C${x + 26} 59 ${x + 27} 65 ${x + 23} 71V90Z`} fill={roti > 0 ? "#D9A04E" : "#EBCB8C"} strokeWidth={1.4} />
                {roti > 0 && <path d={`M${x + 8} 68H${x + 19}M${x + 8} 75H${x + 19}M${x + 8} 82H${x + 19}`} fill="none" strokeWidth={1.800} stroke="#9A6420" strokeOpacity=".7" />}
              </g>
            ))}
          </g>
          <rect x="8" y="64" width="84" height="40" rx="10" fill="#D3DCE6" />
          <rect x="22" y="62" width="22" height="5" rx="2.500" fill={TEPI} stroke="none" />
          <rect x="54" y="62" width="22" height="5" rx="2.500" fill={TEPI} stroke="none" />
          <path d="M16 74C16 70 20 69 26 69" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth={3} />
          <rect x="88" y="72" width="8" height="14" rx="3" fill="#8E99A8" />
          <circle cx="76" cy="90" r="4.500" fill="#C9473B" />
          <rect x="16" y="102" width="12" height="5" rx="2" fill="#4B4F57" stroke="none" />
          <rect x="72" y="102" width="12" height="5" rx="2" fill="#4B4F57" stroke="none" />
        </Gbr>
      </Benda>

      {/* talenan + pisau di atasnya + gelas */}
      <Hias className="left-[49%] w-[clamp(64px,7.5vw,100px)] max-sm:hidden" style={{ bottom: `${MEJA}%` }}>
        <Gbr vb="0 0 100 26">
          <rect x="4" y="10" width="92" height="14" rx="5" fill="#A67654" />
          <path d="M26 9l44-3 3 4-44 3z" fill="#D3DCE6" strokeWidth={2} />
          <rect x="68" y="6" width="22" height="5" rx="2.500" fill="#5A3A24" strokeWidth={2} />
        </Gbr>
      </Hias>
      <Benda
        label="Gelas"
        onClick={() => {
          setGelas((n) => n + 1);
          bisik("Klining! Gelasnya berdenting.");
        }}
        className="left-[57%] w-[clamp(26px,3vw,40px)] max-sm:left-[59%] max-sm:w-[6vw]"
        style={{ bottom: `${MEJA}%` }}
      >
        <Gbr vb="0 0 36 52">
          <g key={gelas} className={gelas > 0 ? "rg-goyang" : undefined}>
            <path d="M6 4h24l-3 44c0 2-2 3-4 3h-10c-2 0-4-1-4-3z" fill="#CFEAF2" />
            <path d="M8.500 24h19l-1.500 24H9.500z" fill="#8FC3E6" opacity=".75" stroke="none" />
          </g>
        </Gbr>
      </Benda>

      {/* kulkas: berdiri di lantai pada empat kaki dengan bayangan tepat di bawahnya */}
      <Benda
        label={kulkas ? "Kulkas: tutup" : "Kulkas: buka"}
        pressed={kulkas}
        onClick={() => {
          setKulkas((k) => !k);
          bisik(kulkas ? "Kulkas ditutup." : "Isinya buah, susu, telur, dan sup dingin.");
        }}
        className="right-[4%] w-[clamp(124px,14.500vw,196px)] max-sm:right-[2%] max-sm:w-[28vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 124 262">
          <Alas cx={62} cy={259} rx={56} ry={6} />
          <rect x="16" y="246" width="14" height="14" rx="2" fill="#2F2A26" />
          <rect x="94" y="246" width="14" height="14" rx="2" fill="#2F2A26" />
          <rect x="10" y="4" width="104" height="248" rx="8" fill="#CDD6E0" />
          {/* bagian dalam (kosong) saat pintu terbuka */}
          {kulkas && (
            <g strokeWidth={2}>
              <rect x="18" y="12" width="88" height="232" rx="4" fill="#F7F3E8" />
              <rect x="18" y="68" width="88" height="5" fill="#BFD9E3" />
              <rect x="18" y="124" width="88" height="5" fill="#BFD9E3" />
              <rect x="18" y="182" width="88" height="5" fill="#BFD9E3" />
            </g>
          )}
          {/* pintu: pegangan berbaut, pengatur suhu, stiker/magnet/catatan, kisi di bawah */}
          <g style={{ transformOrigin: "10px 120px", transform: kulkas ? "scaleX(0.2)" : "scaleX(1)", transition: "transform 420ms cubic-bezier(.3,.9,.3,1)" }}>
            <rect x="10" y="4" width="104" height="248" rx="8" fill="#D3DCE6" />
            <rect x="10" y="88" width="104" height="6" fill="#9EA8B3" />
            <rect x="16" y="10" width="92" height="74" rx="5" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <rect x="16" y="98" width="92" height="146" rx="5" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <rect x="96" y="26" width="9" height="46" rx="4.500" fill="#8E99A8" />
            <rect x="93" y="30" width="6" height="6" rx="1" fill="#5F6A78" strokeWidth={1.400} />
            <rect x="93" y="62" width="6" height="6" rx="1" fill="#5F6A78" strokeWidth={1.400} />
            <rect x="96" y="108" width="9" height="62" rx="4.500" fill="#8E99A8" />
            <rect x="93" y="114" width="6" height="6" rx="1" fill="#5F6A78" strokeWidth={1.400} />
            <rect x="93" y="158" width="6" height="6" rx="1" fill="#5F6A78" strokeWidth={1.400} />
            <circle cx="28" cy="24" r="6" fill="#F4EBD8" strokeWidth={1.800} />
            <path d="M28 24L31 20" fill="none" strokeWidth={1.600} />
            <g transform="rotate(-4 50 122)">
              <rect x="30" y="112" width="26" height="26" fill="#F7E27A" strokeWidth={1.600} />
              <path d="M34 120H52M34 126H48M34 132H44" fill="none" strokeWidth={1.600} strokeOpacity=".6" />
            </g>
            <g transform="rotate(3 76 150)">
              <rect x="62" y="136" width="26" height="30" fill="#FBF7EC" strokeWidth={1.600} />
              <path d="M68 156V146l6-4 6 4v10z" fill="#B24F45" strokeWidth={1.600} />
            </g>
            <Apel x={75} y={134} s={0.42} />
            <circle cx="46" cy="112" r="5" fill="#6397C8" strokeWidth={1.600} />
            <path d="M24 226h76M24 232h76M24 238h76" fill="none" strokeWidth={1.600} strokeOpacity=".45" />
          </g>
        </Gbr>
      </Benda>

      {/* karpet bundar */}
      <Hias className="left-[16%] w-[34%]" style={{ bottom: "7%", height: "9%" }}>
        <div className="relative h-full w-full rounded-[50%] border-[3px] border-[#2B2233] bg-[#C95F4A] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
          <div className="absolute inset-[8%] rounded-[50%] border-[3px] border-dashed border-[#F6E3C0]/80" />
        </div>
      </Hias>
    </>
  );
}

/* ───────────────────────── KAMAR MANDI ───────────────────────── */

function KamarMandi({ bisik }: { bisik: (t: string) => void }) {
  const [handuk, setHanduk] = useState(0);
  const [wastafel, setWastafel] = useState(0);
  const [kilauM, setKilauM] = useState(0);
  const [bak, setBak] = useState(0);
  return (
    <>
      {/* ── bak mandi sederhana, tampak dari samping: bibir, badan melengkung, dua kaki ── */}
      <Benda
        label="Bak mandi"
        onClick={() => {
          setBak((n) => n + 1);
          bisik("Bak mandinya bersih dan siap dipakai.");
        }}
        className="left-[4%] w-[clamp(280px,36vw,480px)] max-sm:left-[2%] max-sm:w-[58vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 340 130">
          <Alas cx={170} cy={127} rx={150} ry={6} />
          <g key={bak} className={bak > 0 ? "rg-pantul" : undefined}>
            <rect x="52" y="104" width="22" height="20" rx="4" fill="#C48A2E" />
            <rect x="266" y="104" width="22" height="20" rx="4" fill="#C48A2E" />
            <path d="M14 34H326V66C326 98 298 112 262 112H78C42 112 14 98 14 66Z" fill="#F1E6CF" />
            <rect x="6" y="22" width="328" height="16" rx="8" fill="#F8F2E4" />
          </g>
        </Gbr>
      </Benda>

      {/* ── meja wastafel: lemari berpintu + permukaan marmer berbak cuci + keran tuas; cermin digantung di atasnya ── */}
      <div className="absolute left-[49%] z-[2] w-[clamp(120px,14vw,188px)] aspect-[150/360] max-sm:left-[64%] max-sm:w-[32vw]" style={{ bottom: `${PIJAK}%` }}>
        <Gbr vb="0 0 150 360" className="pointer-events-none absolute inset-0 h-full">
          <defs>
            <clipPath id="rg-klipCerminMandi">
              <rect x="35" y="25" width="80" height="128" rx="4" />
            </clipPath>
          </defs>
          <Alas cx={75} cy={357} rx={66} ry={6} />
          {/* cermin: bingkai kayu, digantung kawat dari paku */}
          <circle cx="75" cy="3" r="3.500" fill="#8E99A8" />
          <path d="M75 4L40 22M75 4l35 18" fill="none" strokeWidth={1.800} />
          <rect x="22" y="14" width="106" height="152" rx="9" fill="#A67654" />
          <rect x="30" y="20" width="90" height="138" rx="6" fill="#CFEAF2" />
          {/* kilatan cahaya DIPOTONG di dalam kaca (tidak menyentuh bingkai kayu) */}
          <g clipPath="url(#rg-klipCerminMandi)" stroke="none">
            <path d="M40 30L56 26H66L44 150H40Z" fill="#fff" fillOpacity=".5" />
            <path d="M74 26h7L64 150h-6Z" fill="#fff" fillOpacity=".28" />
            <g key={kilauM} className={kilauM > 0 ? "rg-sapu" : "opacity-0"}>
              <path d="M0 0h14l-22 126h-14z" fill="#fff" fillOpacity=".6" transform="translate(36 26)" />
            </g>
          </g>
          {/* meja wastafel: kaki-tendang, badan lemari berpintu, permukaan marmer */}
          <rect x="8" y="324" width="134" height="30" fill="#3A2519" />
          <rect x="10" y="238" width="130" height="90" fill="#A67654" />
          <rect x="16" y="246" width="56" height="74" fill="#B98255" strokeWidth={2} />
          <rect x="78" y="246" width="56" height="74" fill="#B98255" strokeWidth={2} />
          <rect x="22" y="252" width="44" height="62" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
          <rect x="84" y="252" width="44" height="62" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
          <circle cx="62" cy="284" r="3.500" fill="#E2C66B" strokeWidth={2} />
          <circle cx="88" cy="284" r="3.500" fill="#E2C66B" strokeWidth={2} />
          <path d="M4 222H146L140 240H10Z" fill="#F1E6CF" />
          {/* keran leher angsa: dudukan, pipa melengkung berujung penyaring */}
          <rect x="68" y="204" width="14" height="18" rx="4" fill="#D3DCE6" />
          <path d="M75 206V186Q75 168 58 168Q44 168 44 182V190" fill="none" strokeWidth={10} stroke="#2B2233" />
          <path d="M75 206V186Q75 168 58 168Q44 168 44 182V190" fill="none" strokeWidth={5.500} stroke="#D3DCE6" />
          <rect x="39" y="188" width="10" height="9" rx="2.500" fill="#9EA8B3" strokeWidth={2} />
          {/* sabun pompa & gelas sikat gigi */}
          <path d="M16 222v-22h18v22z" fill="#F0C6B4" />
          <rect x="21" y="188" width="8" height="12" rx="2" fill="#B24F45" strokeWidth={1.800} />
          <path d="M22 188V182h12v-4" fill="none" strokeWidth={2.400} />
          <path d="M112 222l-2-24h20l-2 24z" fill="#CFEAF2" />
          <g key={wastafel} className={wastafel > 0 ? "rg-gelembung" : "opacity-0"} fill="none" stroke="#fff" strokeWidth={2}>
            <circle cx="75" cy="214" r="5" />
          </g>
        </Gbr>
        <button
          type="button"
          aria-label="Cermin"
          onClick={() => {
            setKilauM((n) => n + 1);
            bisik("Kamu tampan sekali!");
          }}
          className="absolute left-[12%] top-[2%] h-[44%] w-[76%] cursor-pointer"
        />
        <button
          type="button"
          aria-label="Wastafel"
          onClick={() => {
            setWastafel((n) => n + 1);
            bisik("Cuci tangan dulu, ya.");
          }}
          className="absolute bottom-0 left-[4%] top-[50%] w-[92%] cursor-pointer"
        />
      </div>

      {/* handuk pada batang berbraket di dinding */}
      <Benda
        label="Handuk"
        onClick={() => {
          setHanduk((n) => n + 1);
          bisik("Handuknya lembut dan wangi.");
        }}
        className="w-[clamp(70px,8vw,108px)] max-sm:hidden"
        style={{ left: "37%", bottom: `${LANTAI + 24}%` }}
      >
        <Gbr vb="0 0 100 130">
          <rect x="4" y="2" width="10" height="18" rx="2" fill="#D3DCE6" />
          <rect x="86" y="2" width="10" height="18" rx="2" fill="#D3DCE6" />
          <rect x="8" y="7" width="84" height="7" rx="3.500" fill="#D3DCE6" />
          <g key={handuk} className={handuk > 0 ? "rg-ayun" : undefined} style={{ transformOrigin: "50px 12px" }}>
            <path d="M22 8H78V46H22Z" fill="#D98F82" strokeWidth={2.400} />
            <path d="M18 14H82V112C72 119 62 106 50 112S28 119 18 112Z" fill="#E6A99B" />
          </g>
        </Gbr>
      </Benda>

      {/* keset kaki bundar */}
      <Hias className="left-[10%] w-[28%]" style={{ bottom: "6%", height: "7%" }}>
        <div className="relative h-full w-full rounded-[50%] border-[3px] border-[#2B2233] bg-[#E4D4A8] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
          <div className="absolute inset-[10%] rounded-[50%] border-[3px] border-dashed border-[#8A5F44]/70" />
        </div>
      </Hias>
    </>
  );
}

/* ───────────────────────── RUANG GANTI ───────────────────────── */

const KATA_GANTI = ["Cocok sekali!", "Warna ini cerah.", "Coba topi yang lain juga.", "Wah, bergaya!"];

/** Kotak topi bulat: tutup bersabuk pita, badan bermotif. Dipakai bertumpuk. */
function KotakBulat({ cx, y, rx, tinggi, badan, tutup, motif }: { cx: number; y: number; rx: number; tinggi: number; badan: string; tutup: string; motif: "garis" | "bintik" | "polos" }) {
  const ry = rx * 0.2;
  const atas = y;
  const bawah = y + tinggi;
  return (
    <g>
      <path d={`M${cx - rx} ${atas}V${bawah}A${rx} ${ry} 0 0 0 ${cx + rx} ${bawah}V${atas}`} fill={badan} />
      {motif === "garis" && <path d={`M${cx - rx * 0.5} ${atas + 4}V${bawah + 2}M${cx} ${atas + 4}V${bawah + ry}M${cx + rx * 0.5} ${atas + 4}V${bawah + 2}`} fill="none" strokeWidth={2} strokeOpacity=".45" />}
      {motif === "bintik" && (
        <g fill="#F4EBD8" stroke="none">
          {[-0.6, -0.2, 0.25, 0.65].map((f, i) => (
            <circle key={i} cx={cx + rx * f} cy={atas + tinggi * (0.35 + (i % 2) * 0.3)} r={2.6} />
          ))}
        </g>
      )}
      <path d={`M${cx - rx} ${atas}A${rx} ${ry} 0 0 0 ${cx + rx} ${atas}`} fill="none" strokeWidth={2} strokeOpacity=".5" />
      <ellipse cx={cx} cy={atas} rx={rx} ry={ry} fill={tutup} />
    </g>
  );
}

function RuangGanti({ bisik }: { bisik: (t: string) => void }) {
  const [kilau, setKilau] = useState(0);
  const [gantung, setGantung] = useState(0);
  const [lemari, setLemari] = useState(false);
  const [kotak, setKotak] = useState(0);
  return (
    <>
      {/* tirai: tongkat dipasang ke dinding, kain menjuntai sampai lantai */}
      <Hias className="left-0 top-0 w-[clamp(58px,7vw,96px)] max-sm:w-[6vw]" style={{ height: `${100 - LANTAI}%` }}>
        <svg viewBox="0 0 80 400" preserveAspectRatio="none" className="block h-full w-full" {...G}>
          <rect x="0" y="6" width="74" height="8" rx="4" fill="#8A5F44" />
          <circle cx="74" cy="10" r="6" fill="#C48A2E" />
          <path d="M0 14h66c4 120 6 250-4 382H0z" fill="#9C3F44" />
          <path d="M14 18c3 120 4 250 0 376M32 18c3 120 3 250 0 376M50 18c3 120 3 250-1 376" fill="none" strokeWidth={2} strokeOpacity=".3" />
        </svg>
      </Hias>

      {/* cermin berdiri: kilatan DIPOTONG tepat oleh kaca (clipPath) sehingga tak melebihi cermin */}
      <Benda
        label="Cermin besar"
        onClick={() => {
          setKilau((n) => n + 1);
          bisik(KATA_GANTI[Math.floor(Math.random() * KATA_GANTI.length)]);
        }}
        className="left-[9%] w-[clamp(120px,14vw,190px)] max-sm:left-[6%] max-sm:w-[23vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 120 304">
          <defs>
            <clipPath id="rg-klipCerminGanti">
              <rect x="24" y="20" width="72" height="212" rx="6" />
            </clipPath>
          </defs>
          <Alas cx={60} cy={300} rx={56} ry={6} />
          <rect x="4" y="30" width="10" height="266" rx="3" fill="#8A5F44" />
          <rect x="106" y="30" width="10" height="266" rx="3" fill="#8A5F44" />
          <rect x="0" y="290" width="28" height="12" rx="3" fill="#5B3A24" />
          <rect x="92" y="290" width="28" height="12" rx="3" fill="#5B3A24" />
          <rect x="4" y="264" width="112" height="8" rx="3" fill="#8A5F44" />
          <rect x="14" y="8" width="92" height="236" rx="14" fill="#A67654" />
          <rect x="24" y="20" width="72" height="212" rx="6" fill="#CFEAF2" />
          <path d="M32 40c10-8 20-12 32-10" fill="none" stroke="#fff" strokeWidth={6} strokeOpacity=".7" />
          <g clipPath="url(#rg-klipCerminGanti)">
            <g key={kilau} className={kilau > 0 ? "rg-sapu" : "opacity-0"} stroke="none">
              <path d="M-20 0h18l-26 232h-18z" fill="#fff" fillOpacity=".7" transform="translate(30 14)" />
            </g>
          </g>
          <circle cx="9" cy="120" r="6" fill="#C48A2E" />
          <circle cx="111" cy="120" r="6" fill="#C48A2E" />
        </Gbr>
      </Benda>

      {/* gantungan pakaian beroda: tiga kaos warna-warni pada gantungan kayu */}
      <Benda
        label="Gantungan baju"
        onClick={() => {
          setGantung((n) => n + 1);
          bisik("Bajunya bergoyang-goyang.");
        }}
        className="left-[26%] w-[clamp(220px,27vw,350px)] max-sm:left-[30%] max-sm:w-[38vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 290 290">
          <Alas cx={145} cy={284} rx={132} ry={6} />
          <path d="M26 20L14 266M264 20l12 246" fill="none" stroke="#8E99A8" strokeWidth={5} />
          <rect x="12" y="258" width="266" height="8" rx="4" fill="#8E99A8" />
          <rect x="16" y="14" width="258" height="8" rx="4" fill="#B9C1CB" />
          <circle cx="16" cy="276" r="8" fill="#2F2A26" />
          <circle cx="274" cy="276" r="8" fill="#2F2A26" />
          <circle cx="16" cy="276" r="3" fill="#8E99A8" strokeWidth={1.400} />
          <circle cx="274" cy="276" r="3" fill="#8E99A8" strokeWidth={1.400} />
          <g key={gantung} className={gantung > 0 ? "rg-ayun" : undefined} style={{ transformOrigin: "145px 18px" }}>
            <g transform="translate(70 18) scale(0.8)">
              <Gantungan x={0} y={0} lebar={24} />
              <Kaos warna="#C9473B" kerah="#8F2F27" />
            </g>
            <g transform="translate(145 18) scale(0.8)">
              <Gantungan x={0} y={0} lebar={24} />
              <Kaos warna="#E8B847" kerah="#B8862B" />
            </g>
            <g transform="translate(220 18) scale(0.8)">
              <Gantungan x={0} y={0} lebar={24} />
              <Kaos warna="#6F9E58" kerah="#4A7A3A" />
            </g>
          </g>
        </Gbr>
      </Benda>

      {/* kotak topi bulat bertumpuk; tutup teratas melompat dan memperlihatkan topi jerami di dalamnya */}
      <Benda
        label="Kotak topi"
        onClick={() => {
          setKotak((n) => n + 1);
          bisik("Plop! Tutup kotak topinya terbuka: ada topi jerami.");
        }}
        className="left-[56%] w-[clamp(100px,12vw,160px)] max-sm:hidden"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 140 190">
          <Alas cx={70} cy={186} rx={62} ry={6} />
          <KotakBulat cx={70} y={128} rx={56} tinggi={52} badan="#5E8EBE" tutup="#6D9BC9" motif="garis" />
          <KotakBulat cx={70} y={84} rx={44} tinggi={36} badan="#D98BA3" tutup="#E39CB2" motif="bintik" />
          {/* kotak teratas: badan, topi di dalam, lalu tutup yang melompat */}
          <path d="M34 46V76A36 7 0 0 0 106 76V46" fill="#E8B847" />
          <path d="M46 46C44 34 54 28 70 28S96 34 94 46Z" fill="#E4C97C" strokeWidth={2} />
          <path d="M46 42H94" fill="none" stroke="#C9473B" strokeWidth={5} />
          <ellipse cx="70" cy="46" rx="36" ry="7" fill="#F2D878" strokeWidth={2} />
          <g key={kotak} className={kotak > 0 ? "rg-lompat" : undefined}>
            <ellipse cx="70" cy="46" rx="38" ry="8" fill="#F0C94E" />
            <ellipse cx="70" cy="42" rx="30" ry="6" fill="#F4D870" strokeWidth={2} />
            <path d="M70 36c-6-8-16-6-14 0 2 5 10 5 14 0zM70 36c6-8 16-6 14 0-2 5-10 5-14 0z" fill="#B24F45" strokeWidth={2} />
            <circle cx="70" cy="37" r="3" fill="#8F2F27" strokeWidth={1.800} />
          </g>
        </Gbr>
      </Benda>

      {/* lemari dua pintu: isi rapi saat dibuka (gantungan pakaian, tumpukan lipatan, sepatu, laci) */}
      <Benda
        label={lemari ? "Lemari: tutup" : "Lemari: buka"}
        pressed={lemari}
        onClick={() => {
          setLemari((k) => !k);
          bisik(lemari ? "Lemari ditutup." : "Wah, rapi sekali isinya.");
        }}
        className="right-[3%] w-[clamp(140px,17vw,230px)] max-sm:right-[2%] max-sm:w-[28vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 0 150 310">
          <Alas cx={75} cy={307} rx={68} ry={6} />
          <rect x="14" y="290" width="18" height="18" rx="3" fill="#3B2619" />
          <rect x="118" y="290" width="18" height="18" rx="3" fill="#3B2619" />
          <rect x="6" y="4" width="138" height="290" rx="8" fill="#8A5F44" />
          <rect x="14" y="12" width="122" height="274" rx="4" fill="#3B2619" />
          {lemari && <rect x="14" y="12" width="122" height="274" rx="4" fill="#5A4030" stroke="none" />}
          <g style={{ transformOrigin: "6px 150px", transform: lemari ? "scaleX(0.18)" : "scaleX(1)", transition: "transform 420ms cubic-bezier(.3,.9,.3,1)" }}>
            <rect x="6" y="4" width="70" height="290" rx="8" fill="#A67654" />
            <rect x="14" y="14" width="54" height="270" rx="4" fill="#B98255" strokeWidth={2} />
            <rect x="22" y="24" width="38" height="110" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <rect x="22" y="146" width="38" height="130" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <circle cx="66" cy="152" r="4.500" fill="#E2C66B" />
          </g>
          <g style={{ transformOrigin: "144px 150px", transform: lemari ? "scaleX(0.18)" : "scaleX(1)", transition: "transform 420ms cubic-bezier(.3,.9,.3,1)" }}>
            <rect x="74" y="4" width="70" height="290" rx="8" fill="#A67654" />
            <rect x="82" y="14" width="54" height="270" rx="4" fill="#B98255" strokeWidth={2} />
            <rect x="90" y="24" width="38" height="110" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <rect x="90" y="146" width="38" height="130" fill="none" strokeWidth={1.600} strokeOpacity=".4" />
            <circle cx="84" cy="152" r="4.500" fill="#E2C66B" />
          </g>
        </Gbr>
      </Benda>

      {/* karpet bundar */}
      <Hias className="left-[8%] w-[34%]" style={{ bottom: "6%", height: "8%" }}>
        <div className="relative h-full w-full rounded-[50%] border-[3px] border-[#2B2233] bg-[#6E8A7A] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
          <div className="absolute inset-[8%] rounded-[50%] border-[3px] border-dashed border-[#F6E3C0]/80" />
        </div>
      </Hias>
    </>
  );
}

/* ───────────────────────── TOKO ───────────────────────── */

/** Permukaan meja kasir (persen dari bawah). */
const KASIR = LANTAI + 16;

function Toko({ bisik }: { bisik: (t: string) => void }) {
  const [laci, setLaci] = useState(0);
  const [buka, setBuka] = useState(true);
  const [lonceng, setLonceng] = useState(0);
  const [stoples, setStoples] = useState(0);
  const [peti, setPeti] = useState(0);
  return (
    <>
      {/* kanopi */}
      <svg aria-hidden="true" viewBox="0 0 400 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[clamp(26px,5vh,44px)] w-full" {...G}>
        <path d="M0 0h400v22q-12 18-25 0-12 18-25 0-12 18-25 0-12 18-25 0-12 18-25 0-12 18-25 0-12 18-25 0-12 18-25 0z" fill="#B24F45" />
      </svg>

      {/* dua rak dinding: barang berdiri DI ATAS papan, ukurannya sedang; papan ditopang dua braket */}
      {[
        { bawah: 82, isi: "atas" as const },
        { bawah: 66, isi: "bawah" as const },
      ].map((r) => (
        <div key={r.bawah} className="absolute left-[3%] z-[2] flex w-[34%] flex-col max-sm:w-[62%]" style={{ bottom: `${r.bawah}%` }}>
          <div className="flex items-end justify-around px-3">
            {r.isi === "atas" ? (
              <>
                {/* stoples permen: kaca, tutup logam berkenop, permen bungkus warna-warni, label */}
                <Benda
                  abs={false}
                  label="Stoples permen"
                  onClick={() => {
                    setStoples((n) => n + 1);
                    bisik("Stoples permen. Manis sekali!");
                  }}
                  className="w-[clamp(44px,4.800vw,64px)]"
                >
                  <Gbr vb="0 0 64 84">
                    <g key={stoples} className={stoples > 0 ? "rg-goyang" : undefined}>
                      <rect x="14" y="4" width="36" height="9" rx="4" fill="#C48A2E" />
                      <circle cx="32" cy="3" r="3.500" fill="#E2B04E" strokeWidth={2} />
                      <path d="M12 13H52V20Q58 24 58 34V68Q58 80 46 80H18Q6 80 6 68V34Q6 24 12 20Z" fill="#CFEAF2" />
                      <g strokeWidth={1.800}>
                        <circle cx="20" cy="66" r="6" fill="#C9473B" />
                        <circle cx="34" cy="68" r="6" fill="#E8B847" />
                        <circle cx="46" cy="64" r="6" fill="#6F9E58" />
                        <circle cx="27" cy="54" r="6" fill="#D98BA3" />
                        <circle cx="41" cy="52" r="6" fill="#5E8EBE" />
                      </g>
                      <rect x="16" y="30" width="32" height="14" rx="2" fill="#F4EBD8" strokeWidth={1.800} />
                      <path d="M22 37h20" fill="none" strokeWidth={1.800} />
                    </g>
                  </Gbr>
                </Benda>
                {/* kaleng biskuit: kaleng biru bertutup, gambar biskuit */}
                <Benda abs={false} label="Kaleng biskuit" onClick={() => bisik("Kaleng biskuit renyah.")} className="w-[clamp(52px,5.600vw,76px)]">
                  <Gbr vb="0 0 76 70">
                    <rect x="6" y="8" width="64" height="10" rx="3" fill="#4A76A3" />
                    <rect x="9" y="18" width="58" height="50" rx="3" fill="#5E8EBE" />
                    <circle cx="38" cy="43" r="14" fill="#E4B873" />
                    <path d="M31 38l2 2M40 34l2 2M44 44l2 2M34 49l2 2M38 42l2 2" fill="none" strokeWidth={2.200} />
                    <path d="M12 24v38" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth={3} />
                  </Gbr>
                </Benda>
              </>
            ) : (
              <>
                {/* kotak kado: kotak berpita dengan simpul */}
                <Benda abs={false} label="Kotak kado" onClick={() => bisik("Kotak kado cantik untuk hadiah.")} className="w-[clamp(46px,5vw,68px)]">
                  <Gbr vb="0 0 68 66">
                    <rect x="8" y="26" width="52" height="38" rx="2" fill="#5E8EBE" />
                    <rect x="4" y="18" width="60" height="12" rx="2" fill="#4A76A3" />
                    <rect x="30" y="18" width="8" height="46" fill="#E8B847" strokeWidth={2} />
                    <path d="M34 18C28 4 14 6 18 14C22 20 32 18 34 18ZM34 18C40 4 54 6 50 14C46 20 36 18 34 18Z" fill="#E8B847" strokeWidth={2} />
                    <circle cx="34" cy="18" r="3.500" fill="#C9A22C" strokeWidth={1.800} />
                  </Gbr>
                </Benda>
                {/* tumpukan buku: punggung buku, judul, tepi halaman */}
                <Benda abs={false} label="Tumpukan buku" onClick={() => bisik("Buku-buku belajar, diskon hari ini.")} className="w-[clamp(56px,6.200vw,84px)]">
                  <Gbr vb="0 0 84 62">
                    <rect x="4" y="40" width="74" height="20" rx="2" fill="#6F9E58" />
                    <rect x="74" y="42" width="6" height="16" fill="#F4EBD8" strokeWidth={1.600} />
                    <rect x="8" y="46" width="30" height="8" fill="#F4EBD8" strokeWidth={1.400} />
                    <rect x="10" y="22" width="68" height="18" rx="2" fill="#B24F45" />
                    <rect x="74" y="24" width="6" height="14" fill="#F4EBD8" strokeWidth={1.600} />
                    <path d="M16 28h26M16 34h18" fill="none" stroke="#F4EBD8" strokeWidth={2.200} />
                    <rect x="6" y="6" width="70" height="16" rx="2" fill="#E8B847" />
                    <rect x="72" y="8" width="6" height="12" fill="#F4EBD8" strokeWidth={1.600} />
                    <circle cx="20" cy="14" r="3.500" fill="#B24F45" strokeWidth={1.600} />
                  </Gbr>
                </Benda>
                {/* toples kopi: kaca berisi biji kopi, tutup gabus, label */}
                <Benda abs={false} label="Toples kopi" onClick={() => bisik("Biji kopi, wangi sekali.")} className="w-[clamp(38px,4.200vw,56px)]">
                  <Gbr vb="0 0 56 76">
                    <rect x="12" y="2" width="32" height="10" rx="3" fill="#C9A26B" />
                    <path d="M10 12H46V20L50 28V66Q50 74 42 74H14Q6 74 6 66V28L10 20Z" fill="#CFEAF2" />
                    <path d="M7 38H49V66Q49 73 42 73H14Q7 73 7 66Z" fill="#5B3A24" strokeWidth={2} />
                    <g fill="#3B2619" strokeWidth={1.200}>
                      <ellipse cx="18" cy="48" rx="4" ry="2.800" />
                      <ellipse cx="30" cy="46" rx="4" ry="2.800" />
                      <ellipse cx="38" cy="56" rx="4" ry="2.800" />
                      <ellipse cx="22" cy="60" rx="4" ry="2.800" />
                    </g>
                    <rect x="14" y="22" width="28" height="12" rx="2" fill="#F4EBD8" strokeWidth={1.800} />
                  </Gbr>
                </Benda>
              </>
            )}
          </div>
          <div className="relative -mt-[1px] h-[12px] border-[3px] border-[#2B2233] bg-[#A67654]" />
          <div className="pointer-events-none relative h-[20px]">
            {["12%", "84%"].map((x) => (
              <svg key={x} viewBox="0 0 24 20" className="absolute -top-[1px] h-[21px] w-[24px]" style={{ left: x }} {...G}>
                <path d="M2 0H22L2 18Z" fill="#8A5F44" />
              </svg>
            ))}
          </div>
        </div>
      ))}

      {/* meja kasir */}
      <Hias className="left-[7%] w-[40%] max-sm:left-[4%] max-sm:w-[50%] border-[3px] border-[#2B2233] bg-[#A87647]" style={{ bottom: `${PIJAK}%`, height: `${KASIR - PIJAK}%` }}>
        <span className="absolute inset-x-0 bottom-0 h-[8%] border-t-[3px] border-[#2B2233] bg-[#3A2519]" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="absolute top-[12%] h-[70%] w-[22%] border-[3px] border-[#2B2233] bg-[#B98255]" style={{ left: `${i * 25 + 1.5}%` }} />
        ))}
      </Hias>
      <Hias className="left-[6%] w-[42%] max-sm:left-[3%] max-sm:w-[52%] border-[3px] border-[#2B2233] bg-[#E4DDCD]" style={{ bottom: `${KASIR - 1.5}%`, height: "2.5%" }} />
      <Hias className="left-[6.500%] w-[41%] max-sm:left-[3.500%] max-sm:w-[51%] h-[2%] [background:linear-gradient(180deg,rgba(43,34,51,0.28),transparent)]" style={{ bottom: `${KASIR - 3.500}%` }} />

      {/* mesin kasir */}
      <Benda
        label="Mesin kasir"
        onClick={() => {
          setLaci((n) => n + 1);
          bisik("Ting! Terima kasih sudah berbelanja.");
        }}
        className="left-[12%] w-[clamp(96px,10vw,132px)] max-sm:left-[9%] max-sm:w-[22vw]"
        style={{ bottom: `${KASIR}%` }}
      >
        <Gbr vb="0 0 140 110">
          <g key={laci} className={laci > 0 ? "rg-laci" : undefined}>
            <rect x="14" y="70" width="112" height="38" rx="5" fill="#D3DCE6" />
            <rect x="26" y="84" width="88" height="10" rx="3" fill="#4B4F57" stroke="none" />
          </g>
          <path d="M22 72l8-40h80l8 40z" fill="#D3DCE6" />
          <rect x="42" y="10" width="56" height="26" rx="4" fill="#1B3347" />
          <text x="70" y="29" textAnchor="middle" fontSize="15" fontWeight="800" fill="#8DD6FF" stroke="none" fontFamily="sans-serif">
            Rp 0
          </text>
          <g fill="#E8B847">
            <circle cx="48" cy="54" r="4" />
            <circle cx="64" cy="54" r="4" />
            <circle cx="80" cy="54" r="4" />
            <circle cx="96" cy="54" r="4" />
          </g>
          {laci > 0 && (
            <g key={`k${laci}`} className="rg-koin" stroke="none">
              <circle cx="58" cy="62" r="6" fill="#E8B847" />
              <circle cx="84" cy="64" r="5" fill="#E8B847" />
            </g>
          )}
        </Gbr>
      </Benda>

      {/* keranjang apel anyaman: pegangan melengkung, badan anyaman, tiga apel merah setangkup */}
      <Benda
        label="Keranjang apel"
        onClick={() => {
          setPeti((n) => n + 1);
          bisik("Apelnya segar, baru dipetik.");
        }}
        className="left-[54%] w-[clamp(124px,14.500vw,196px)] max-sm:left-[57%] max-sm:w-[17vw]"
        style={{ bottom: `${PIJAK}%` }}
      >
        <Gbr vb="0 218 150 124">
          <Alas cx={75} cy={337} rx={62} ry={6} />
          <g key={peti} className={peti > 0 ? "rg-pantul" : undefined}>
            <path d="M26 282C26 242 50 228 75 228S124 242 124 282" fill="none" strokeWidth={9} stroke="#2B2233" />
            <path d="M26 282C26 242 50 228 75 228S124 242 124 282" fill="none" strokeWidth={4.500} stroke="#C9A26B" />
            <Apel x={47} y={276} s={1.1} />
            <Apel x={103} y={276} s={1.1} />
            <Apel x={75} y={278} s={1.1} />
            <path d="M14 290H136L128 332Q126 336 120 336H30Q24 336 22 332Z" fill="#C9A26B" />
            <g fill="none" strokeWidth={1.800} strokeOpacity=".55">
              <path d="M17 304H133M19 318H131" />
              <path d="M34 290V334M52 290V334M70 290V334M88 290V334M106 290V334M122 290V334" />
            </g>
            <rect x="10" y="284" width="130" height="10" rx="5" fill="#B88A4C" />
          </g>
        </Gbr>
      </Benda>

      {/* pintu kaca: bingkai berdiri di lantai; lonceng menggantung dari braket di kusen atas; papan menggantung pada kait di kaca */}
      <div className="absolute right-[3%] z-[2] w-[clamp(130px,16vw,215px)] aspect-[140/326] max-sm:right-[2%] max-sm:w-[24vw]" style={{ bottom: `${PIJAK}%` }}>
        <Gbr vb="0 0 140 326" className="pointer-events-none absolute inset-0 h-full">
          <Alas cx={70} cy={323} rx={62} ry={6} />
          <rect x="8" y="14" width="124" height="306" rx="6" fill="#A67654" />
          <rect x="20" y="26" width="100" height="282" rx="3" fill="#CFEAF2" />
          <rect x="20" y="160" width="100" height="7" fill="#B98255" />
          <path d="M30 44c8-8 18-12 30-10" fill="none" stroke="#fff" strokeWidth={5} strokeOpacity=".55" />
          <rect x="106" y="150" width="7" height="40" rx="3.500" fill="#C48A2E" />
        </Gbr>
        <button
          type="button"
          aria-label="Lonceng pintu"
          onClick={() => {
            setLonceng((n) => n + 1);
            bisik("Kring kring! Ada pelanggan masuk.");
          }}
          className="absolute left-[34%] top-[-11%] w-[32%] cursor-pointer"
        >
          <Gbr vb="0 0 60 80">
            <rect x="6" y="0" width="48" height="8" fill="#8A5F44" />
            <rect x="27" y="4" width="6" height="12" fill="#8A5F44" />
            <g key={lonceng} className={lonceng > 0 ? "rg-ayun" : undefined} style={{ transformOrigin: "30px 14px" }}>
              <path d="M12 52c0-16 7-30 18-30s18 14 18 30c4 2 6 4 6 7H6c0-3 2-5 6-7z" fill="#E2B847" />
              <circle cx="30" cy="64" r="5.500" fill="#B8862B" />
            </g>
          </Gbr>
        </button>
        <button
          type="button"
          aria-label={buka ? "Papan: balik jadi TUTUP" : "Papan: balik jadi BUKA"}
          onClick={() => {
            setBuka((b) => !b);
            bisik(buka ? "Toko ditutup. (Hanya papannya, kok.)" : "Toko buka!");
          }}
          className="absolute left-[18%] top-[24%] w-[64%] cursor-pointer"
        >
          <Gbr vb="0 0 130 92">
            <circle cx="65" cy="4" r="4" fill="#8E99A8" />
            <g key={`p${buka}`} className="rg-ayun" style={{ transformOrigin: "65px 6px" }}>
              <path d="M65 8L36 28M65 8l29 20" fill="none" strokeWidth={2} />
              <rect x="10" y="26" width="110" height="58" rx="6" fill={buka ? "#F0E4CB" : "#B24F45"} />
              <text x="65" y="64" textAnchor="middle" fontSize="25" fontWeight="800" fill={buka ? "#2F6F4A" : "#F4EBD8"} stroke="none" fontFamily="sans-serif">
                {buka ? "BUKA" : "TUTUP"}
              </text>
            </g>
          </Gbr>
        </button>
      </div>

      {/* keset pintu */}
      <Hias className="right-[3%] w-[16%]" style={{ bottom: "5%", height: "6%" }}>
        <div className="relative h-full w-full rounded-[50%] border-[3px] border-[#2B2233] bg-[#6B4A32] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
          <div className="absolute inset-[10%] rounded-[50%] border-[3px] border-dashed border-[#F6E3C0]/70" />
        </div>
      </Hias>
    </>
  );
}
