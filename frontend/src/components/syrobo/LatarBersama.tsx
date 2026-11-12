"use client";
import { cn } from "@/lib/cn";
import { TINTA } from "./IkonSyrobo";

/** Bagian bersama adegan latar Main Room (lihat SyroboLatar.tsx untuk aturan penempatan & gerak). */

export interface LatarProps {
  gelap: boolean;
  ubahGelap: (g: boolean) => void;
  bisik: (teks: string) => void;
  login: boolean;
  /** Hanya Istana: takhta disentuh (robot bercahaya + suara dikerjakan induk). */
  onTakhta?: () => void;
}

/** Garis tinta untuk benda buatan (prop). Unsur alam (rumput, langit, laut) sengaja TANPA garis tebal. */
export const G = { stroke: TINTA, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const mati = "disabled:pointer-events-none";

/** Nilai acak deterministik (render stabil, tanpa Math.random saat render). */
export const r = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  // dibulatkan: Math.sin Node (server) dan peramban bisa beda di digit terakhir -> hydration mismatch pada atribut style
  return Math.round((v - Math.floor(v)) * 1000) / 1000;
};
/** Pembulatan 1 desimal untuk koordinat yang dihitung (aman dari beda digit terakhir antara server dan klien). */
export const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export const SERAT =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.2  0 0 0 0.9 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")";

export function Penutup({ gelap, warna = "#151033" }: { gelap: boolean; warna?: string }) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: SERAT }} />
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-[20] transition-opacity duration-700", gelap ? "opacity-[0.58]" : "opacity-0")} style={{ background: warna }} />
    </>
  );
}

/** Lantai: bayangan sambungan dinding-lantai; garis tinta tebal di tepi atas hanya untuk adegan bergaya stiker (`garis`). */
export function Lantai({ kelas, style, bayang = "rgba(43,34,51,0.28)", garis = true }: { kelas?: string; style?: React.CSSProperties; bayang?: string; garis?: boolean }) {
  return (
    <>
      <div aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 top-[62%]", garis && "border-t-[4px] border-[#2B2233]", kelas)} style={style} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[62%] h-[6%]" style={{ background: `linear-gradient(180deg,${bayang},transparent)` }} />
    </>
  );
}

/** Tombol saklar bertema: selalu bisa ditekan selama sudah masuk. Pemanggil mengisi posisi lewat `kelas`; `z` = lapisan (dinding = rendah). */
export function Saklar({ gelap, ubahGelap, bisik, login, kelas, label, z = "z-[26]", children }: LatarProps & { kelas: string; label: string; z?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={!login}
      onClick={() => {
        ubahGelap(!gelap);
        bisik(gelap ? "Lampu menyala." : "Lampu padam.");
      }}
      aria-pressed={gelap}
      aria-label={gelap ? "Nyalakan lampu" : "Padamkan lampu"}
      title={label}
      className={cn("cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95", z, kelas, mati)}
    >
      {children}
    </button>
  );
}

/** Wadah defs tak terlihat (lebar 0, BUKAN display:none supaya gradasi/filter tetap terpakai peramban). */
export function Defs({ children }: { children: React.ReactNode }) {
  return (
    <svg width="0" height="0" aria-hidden="true" className="pointer-events-none absolute">
      <defs>{children}</defs>
    </svg>
  );
}

export function LG({ id, h, s }: { id: string; h?: boolean; s: [number, string, number?][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={h ? 1 : 0} y2={h ? 0 : 1}>
      {s.map(([o, c, a], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
      ))}
    </linearGradient>
  );
}

export function RG({ id, s, cx = 0.5, cy = 0.5 }: { id: string; s: [number, string, number?][]; cx?: number; cy?: number }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r="0.5">
      {s.map(([o, c, a], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
      ))}
    </radialGradient>
  );
}

/** Awan lembut: gumpalan lingkaran berbayang dengan tepi dikaburkan (filter `filterId` didefinisikan adegannya). 4 jenis ukuran/bentuk. */
const AWAN_LEBAR = ["clamp(70px,8vw,110px)", "clamp(110px,14vw,190px)", "clamp(160px,22vw,300px)", "clamp(190px,27vw,380px)"];
const AWAN_BOLA: Record<number, [number, number, number][]> = {
  0: [[50, 60, 22], [76, 50, 28], [104, 58, 22], [128, 62, 16]],
  1: [[40, 62, 24], [70, 48, 30], [104, 42, 34], [138, 52, 28], [164, 64, 20]],
  2: [[30, 66, 22], [58, 50, 28], [90, 34, 34], [124, 40, 32], [154, 54, 28], [178, 66, 18]],
};
export function AwanLembut({ jenis, filterId, warna = "#fff", bayang = "#C9D9EA", kelas, style }: { jenis: 0 | 1 | 2 | 3; filterId: string; warna?: string; bayang?: string; kelas?: string; style?: React.CSSProperties }) {
  const bola = AWAN_BOLA[jenis];
  const min = bola ? Math.min(...bola.map(([x, , rad]) => x - rad)) : 0;
  const maks = bola ? Math.max(...bola.map(([x, , rad]) => x + rad)) : 0;
  return (
    <svg viewBox="0 0 200 90" aria-hidden="true" className={cn("lt-awan pointer-events-none absolute overflow-visible", kelas)} style={{ width: AWAN_LEBAR[jenis], ...style }}>
      <g filter={`url(#${filterId})`}>
        {bola ? (
          <>
            <g fill={bayang}>
              {bola.map(([x, y, rad], i) => (
                <circle key={i} cx={x} cy={y + 7} r={rad} />
              ))}
              <ellipse cx={(min + maks) / 2} cy={76} rx={(maks - min) / 2} ry={11} />
            </g>
            <g fill={warna}>
              {bola.map(([x, y, rad], i) => (
                <circle key={i} cx={x} cy={y} r={rad} />
              ))}
              <ellipse cx={(min + maks) / 2} cy={72} rx={(maks - min) / 2} ry={11} />
            </g>
          </>
        ) : (
          <g fill={warna} fillOpacity="0.85">
            <ellipse cx="60" cy="52" rx="52" ry="7" />
            <ellipse cx="116" cy="44" rx="72" ry="6" />
            <ellipse cx="152" cy="56" rx="42" ry="5" />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Bintang segi-lima dengan lengan membulat (bintang laut). Warna lengan + jalur terang + titik tekstur. */
export function BintangLaut({ kelas, style, warna = "#E8704A", terang = "#F7A27C", gelap = "#B8482A" }: { kelas?: string; style?: React.CSSProperties; warna?: string; terang?: string; gelap?: string }) {
  const pts: string[] = [];
  const dots: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? 26 : 10.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${n1(32 + Math.cos(a) * rad)} ${n1(32 + Math.sin(a) * rad)}`);
  }
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    for (const f of [0.3, 0.52, 0.74]) dots.push([32 + Math.cos(a) * 26 * f, 32 + Math.sin(a) * 26 * f]);
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none", kelas)} style={style}>
      <path d={`M${pts.join("L")}Z`} fill={warna} stroke={warna} strokeWidth="5" strokeLinejoin="round" />
      <path d={`M${pts.join("L")}Z`} fill="none" stroke={gelap} strokeOpacity="0.5" strokeWidth="1.2" strokeLinejoin="round" transform="translate(0 1.2)" />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        return <path key={k} d={`M32 32L${n1(32 + Math.cos(a) * 24)} ${n1(32 + Math.sin(a) * 24)}`} stroke={terang} strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />;
      })}
      {dots.map(([x, y], i) => (
        <circle key={i} cx={n1(x)} cy={n1(y)} r="1.5" fill={terang} />
      ))}
      <circle cx="32" cy="32" r="4.2" fill={gelap} fillOpacity="0.55" />
    </svg>
  );
}
