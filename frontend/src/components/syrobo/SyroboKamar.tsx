"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { TINTA } from "./IkonSyrobo";

/**
 * Kamar SyRobo: satu adegan penuh layar, digambar tangan (garis tinta, warna datar hangat, serat kertas halus).
 * Benda-bendanya bisa disentuh:
 *   - lampu gantung  → menyalakan/memadamkan lampu (kamar gelap, robot mengantuk);
 *   - jendela        → bintang jatuh melintas;
 *   - tanaman        → bergoyang, daun gugur;
 *   - buku           → tips belajar acak;
 *   - jam            → jam sekarang (WIB).
 * Ucapan benda disampaikan lewat `bisik` (toast induk), bukan state di sini, supaya satu tempat untuk pesan.
 */

const TIPS = [
  "Istirahat 5 menit setiap 25 menit belajar.",
  "Tulis ulang dengan kata-katamu sendiri.",
  "Coba jelaskan materi ke orang lain.",
  "Tidur cukup bikin ingatan lebih awet.",
  "Mulai dari soal yang paling kamu hindari.",
  "Satu bab kecil lebih baik daripada nol.",
];

function jamWib(): string {
  return new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
}

const G = { stroke: TINTA, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default function SyroboKamar({
  gelap,
  ubahGelap,
  bisik,
  login = true,
}: {
  login?: boolean;
  gelap: boolean;
  ubahGelap: (g: boolean) => void;
  bisik: (teks: string) => void;
}) {
  const [meteor, setMeteor] = useState(0);
  const [goyang, setGoyang] = useState(0);
  const [daun, setDaun] = useState(0);
  // Benda kamar hanya bisa disentuh bila SUDAH masuk DAN lampu menyala; lampunya sendiri tetap bisa ditekan (selama sudah masuk)
  // supaya kamar bisa dinyalakan lagi. Tamu tak bisa menyentuh apa pun (penunjuk menembus ke dinding).
  const benda = login && !gelap;
  const mati = "disabled:pointer-events-none";

  return (
    <div aria-hidden={false} className="absolute inset-0 overflow-hidden">
      {/* dinding: wallpaper garis halus + panel kayu bawah */}
      <div className="absolute inset-x-0 top-0 h-[62%] [background:repeating-linear-gradient(90deg,#5A8E8C_0_44px,#538589_44px_88px)]" />
      <div className="absolute inset-x-0 top-0 h-[62%] opacity-40 [background:radial-gradient(circle_at_20px_20px,rgba(255,255,255,0.22)_2px,transparent_2.5px)] [background-size:44px_44px]" />
      <div className="absolute inset-x-0 top-[46%] h-[16%] bg-[#8A5F44] [background-image:repeating-linear-gradient(90deg,transparent_0_96px,rgba(43,34,51,0.28)_96px_99px)]" />
      <div className="absolute inset-x-0 top-[45%] h-3 border-y-[3px] border-[#2B2233] bg-[#A67654]" />
      {/* lantai kayu */}
      <div className="absolute inset-x-0 bottom-0 top-[62%] border-t-[4px] border-[#2B2233] bg-[#BE8A5B] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(43,34,51,0.3)_150px_153px),repeating-linear-gradient(0deg,transparent_0_62px,rgba(43,34,51,0.16)_62px_64px)]" />
      <div className="absolute inset-x-0 top-[62%] h-[10%] [background:linear-gradient(180deg,rgba(43,34,51,0.28),transparent)]" />

      {/* karpet bundar */}
      <div className="absolute bottom-[7%] left-1/2 h-[24%] w-[58%] min-w-[300px] -translate-x-1/2 rounded-[50%] border-[3px] border-[#2B2233] bg-[#C95F4A] shadow-[0_6px_0_rgba(43,34,51,0.25)]">
        <div className="absolute inset-[7%] rounded-[50%] border-[3px] border-dashed border-[#F6E3C0]/80" />
        <div className="absolute inset-[20%] rounded-[50%] border-[3px] border-[#2B2233]/60 bg-[#D97A5F]" />
      </div>

      {/* jendela + tirai */}
      <button
        type="button"
        disabled={!benda}
        onClick={() => {
          setMeteor((n) => n + 1);
          bisik("Bintang jatuh! Buat permintaan.");
        }}
        aria-label="Jendela: lihat bintang jatuh"
        className={cn("group absolute left-[7%] top-[23%] z-[2] w-[clamp(128px,17vw,220px)] cursor-pointer transition-transform duration-300 hover:-rotate-1 active:scale-[0.98]", mati)}
      >
        <svg viewBox="0 0 160 200" className="block w-full overflow-visible" {...G}>
          <rect x="22" y="14" width="116" height="156" rx="5" fill="#26335B" />
          <clipPath id="syrobo-jendela">
            <rect x="22" y="14" width="116" height="156" rx="5" />
          </clipPath>
          <g clipPath="url(#syrobo-jendela)" stroke="none">
            <circle cx="104" cy="52" r="15" fill="#F6E3C0" />
            <circle cx="111" cy="47" r="13" fill="#26335B" />
            {[[44, 40], [70, 70], [52, 106], [96, 98], [118, 130], [36, 140], [84, 36]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.8" fill="#F6E3C0" className="syrobo-bintang" style={{ animationDelay: `${i * 420}ms` }} />
            ))}
            {meteor > 0 && <path key={meteor} d="M0 0l26 12" stroke="#fff" strokeWidth="3" className="syrobo-meteor" />}
            <path d="M22 150c20-14 40-10 58-4s40 10 58-2v30H22z" fill="#1B2547" />
          </g>
          <rect x="14" y="8" width="132" height="168" rx="7" fill="none" strokeWidth="6" />
          <path d="M80 14v156M22 92h116" strokeWidth="5" />
          <rect x="6" y="170" width="148" height="12" rx="4" fill="#F1E6CF" />
          {/* tirai */}
          <path d="M2 4c14 0 22 2 28 6 2 60-4 110-10 156H2z" fill="#E0A458" />
          <path d="M158 4c-14 0-22 2-28 6-2 60 4 110 10 156h18z" fill="#E0A458" />
          <path d="M12 16c3 50 1 96-3 146M22 20c1 40 0 90-2 140M148 16c-3 50-1 96 3 146M138 20c-1 40 0 90 2 140" strokeWidth="2" opacity=".35" />
        </svg>
      </button>

      {/* bingkai foto (hiasan) */}
      <svg viewBox="0 0 100 70" className="pointer-events-none absolute left-[36%] top-[17%] hidden w-[clamp(70px,9vw,120px)] -rotate-3 md:block" {...G}>
        <rect x="4" y="4" width="92" height="62" fill="#F1E6CF" />
        <rect x="12" y="12" width="76" height="46" fill="#9DC7C0" strokeWidth="2.4" />
        <path d="M12 50l18-18 14 12 14-14 30 22v6H12z" fill="#5C9A5F" strokeWidth="2.4" />
        <circle cx="70" cy="24" r="6" fill="#F2C14E" strokeWidth="2.4" />
      </svg>
      <svg viewBox="0 0 70 90" className="pointer-events-none absolute left-[46%] top-[21%] hidden w-[clamp(46px,6vw,80px)] rotate-2 lg:block" {...G}>
        <rect x="4" y="4" width="62" height="82" fill="#F1E6CF" />
        <rect x="12" y="12" width="46" height="66" fill="#E8A9A0" strokeWidth="2.4" />
        <path d="M22 70c0-20 6-32 13-32s13 12 13 32z" fill="#2B2233" strokeWidth="2" />
        <circle cx="35" cy="30" r="8" fill="#F6D2B0" strokeWidth="2.4" />
      </svg>

      {/* lampu gantung (tombol lampu) */}
      <button
        type="button"
        disabled={!login}
        onClick={() => {
          ubahGelap(!gelap);
          bisik(gelap ? "Lampu menyala." : "Lampu padam.");
        }}
        aria-pressed={gelap}
        aria-label={gelap ? "Nyalakan lampu" : "Padamkan lampu"}
        className={cn("syrobo-lampu absolute right-[21%] top-0 z-[26] flex cursor-pointer flex-col items-center", mati)}
      >
        <span className="block h-[13vh] min-h-[64px] w-[3px] bg-[#2B2233]" />
        <svg viewBox="0 0 90 60" className="block w-[clamp(64px,8vw,96px)] overflow-visible" {...G}>
          <path d="M45 2v10M20 56l8-40h34l8 40z" fill="#F2C14E" />
          <path d="M30 24h30M26 40h38" strokeWidth="2" opacity=".4" />
        </svg>
      </button>

      {/* rak + benda di atasnya: alas tiap benda MENEMPEL di papan (viewBox dipangkas pas, -mb menutup garis papan) */}
      <div className="absolute right-[4%] top-[27%] z-[2] w-[clamp(180px,24vw,320px)]">
        <div className="flex items-end justify-around px-2">
          <button
            type="button"
            aria-label="Tanaman"
            disabled={!benda}
            onClick={() => {
              setGoyang((n) => n + 1);
              setDaun((n) => n + 1);
              bisik("Tanamannya segar!");
            }}
            className={cn("relative -mb-[2px] cursor-pointer", mati)}
          >
            <svg viewBox="0 0 60 78" className="block h-auto w-[clamp(44px,5.6vw,72px)]" fill="none" stroke={TINTA} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <g key={goyang} className={goyang > 0 ? "syrobo-goyangan" : undefined}>
                {/* batang melengkung */}
                <path d="M30 54C29 44 31 34 30 22" fill="none" />
                {/* daun berpasangan, makin ke atas makin kecil; urat daun searah batang */}
                <path d="M30 46C23 46 14 43 11 35 20 33 28 38 30 46z" fill="#5C9A5F" />
                <path d="M30 40C37 40 46 37 49 29 40 27 32 32 30 40z" fill="#6FAF6B" />
                <path d="M30 33C24 33 17 30 15 23 23 22 29 26 30 33z" fill="#5C9A5F" />
                <path d="M30 27C35 27 42 24 44 18 37 17 32 21 30 27z" fill="#6FAF6B" />
                <path d="M30 22C26 17 26 10 30 5 34 10 34 17 30 22z" fill="#7FBF76" />
              </g>
              {/* pot: bibir + badan menyempit ke bawah, tanah di dalam bibir */}
              <path d="M12 54h36v6H12z" fill="#C0674A" />
              <path d="M15 60h30l-3 16H18z" fill="#C0674A" />
              <path d="M16 54h28" stroke="#8A3F2A" strokeWidth="1.5" opacity=".5" />
            </svg>
            {daun > 0 && <span key={daun} aria-hidden="true" className="syrobo-daun absolute left-1/2 top-[30%] block h-3 w-2 rounded-[60%_0_60%_0] border-2 border-[#2B2233] bg-[#7FB069]" />}
          </button>
          <button type="button" aria-label="Buku: tips belajar" disabled={!benda} onClick={() => bisik(TIPS[Math.floor(Math.random() * TIPS.length)])} className={cn("-mb-[2px] cursor-pointer transition-transform duration-200 hover:-translate-y-1 active:scale-95", mati)}>
            <svg viewBox="0 0 80 62" className="block h-auto w-[clamp(56px,7vw,92px)]" {...G}>
              <rect x="5" y="14" width="14" height="46" rx="2" fill="#E56B5D" />
              <rect x="19" y="8" width="13" height="52" rx="2" fill="#6BA7D8" />
              <rect x="32" y="18" width="12" height="42" rx="2" fill="#F2C14E" />
              <path d="M49 60l8-42 12 3-7 39z" fill="#7FB069" />
              <path d="M8 24h8M22 18h7M35 28h6" strokeWidth="2" opacity=".5" />
            </svg>
          </button>
          <button type="button" aria-label="Jam" disabled={!benda} onClick={() => bisik(`Sekarang pukul ${jamWib()} WIB.`)} className={cn("-mb-[2px] cursor-pointer transition-transform duration-200 hover:-translate-y-1 active:scale-95", mati)}>
            <svg viewBox="0 0 64 68" className="block h-auto w-[clamp(44px,5.4vw,70px)]" fill="none" stroke={TINTA} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              {/* lonceng kecil di atas, kaki di bawah: semuanya di dalam kotak gambar */}
              <circle cx="16" cy="12" r="6" fill="#F2C14E" />
              <circle cx="48" cy="12" r="6" fill="#F2C14E" />
              <path d="M32 6v4" />
              <circle cx="32" cy="38" r="22" fill="#F1E6CF" />
              <circle cx="32" cy="38" r="17" fill="none" strokeWidth="1.5" opacity=".35" />
              {/* penanda jam 12, 3, 6, 9 */}
              <path d="M32 24v3M46 38h-3M32 52v-3M18 38h3" strokeWidth="2" />
              {/* jarum */}
              <path d="M32 38V29M32 38l7 4" strokeWidth="3" />
              <circle cx="32" cy="38" r="1.6" fill={TINTA} stroke="none" />
              <path d="M18 57l-4 8M46 57l4 8" />
            </svg>
          </button>
        </div>
        <div className="h-3 border-[3px] border-[#2B2233] bg-[#8A5F44]" />
        <div className="mx-4 flex justify-between">
          <span className="h-4 w-3 border-x-[3px] border-b-[3px] border-[#2B2233] bg-[#6E4A35]" />
          <span className="h-4 w-3 border-x-[3px] border-b-[3px] border-[#2B2233] bg-[#6E4A35]" />
        </div>
      </div>

      {/* serat kertas: membuat gambar terasa dicetak, bukan render mulus */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.2  0 0 0 0.9 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* lampu padam: kamar meredup */}
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-[20] bg-[#151033] transition-opacity duration-700", gelap ? "opacity-[0.58]" : "opacity-0")} />
    </div>
  );
}
