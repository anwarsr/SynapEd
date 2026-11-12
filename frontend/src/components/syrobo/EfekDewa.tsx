"use client";
import type { CSSProperties, ReactNode } from "react";
import type { MakananDewaId } from "@/lib/syrobo/syroboRules";

/**
 * Efek khusus tiap MAKANAN DEWA pada robot: aura berwarna + partikel bertema yang bergerak khas (spiral cahaya, tetes madu & lebah
 * yang mengitari, kelopak persik jatuh, bara & uap naga, bulan-bulan kecil mengorbit, dst). Dua tingkat: `kuat` = ledakan sesaat
 * saat dimakan (partikel lebih banyak + cincin cahaya), tanpa `kuat` = aura tenang yang menyala selama bar kenyang beku (24 jam).
 * Hanya tampilan (CSS `.dewa-*` di globals.css); hemat gerak mematikan animasinya.
 */

type Bentuk = "titik" | "bintang" | "tetes" | "kelopak" | "bulan" | "apel" | "lebah" | "api" | "anggur" | "butir";
type Gerak = "naik" | "jatuh" | "orbit" | "spiral" | "kedip";

interface Lapisan {
  bentuk: Bentuk;
  gerak: Gerak;
  jumlah: number;
  warna: string;
  warna2: string;
  /** Ukuran dasar (px). */
  ukuran: number;
}
interface Cfg {
  aura: string;
  cincin: string;
  lapisan: Lapisan[];
}

const CFG: Record<MakananDewaId, Cfg> = {
  // Ambrosia: pusaran cahaya emas yang naik berputar + bintang kecil
  ambrosia: { aura: "255,210,90", cincin: "#FFE08A", lapisan: [{ bentuk: "bintang", gerak: "spiral", jumlah: 7, warna: "#FFD76A", warna2: "#FFF6CF", ukuran: 13 }, { bentuk: "titik", gerak: "naik", jumlah: 8, warna: "#FFE9A8", warna2: "#FFD76A", ukuran: 6 }] },
  // Nektar: tetes merah muda berkilau naik seperti gelembung manis
  nektar: { aura: "255,150,195", cincin: "#FFB3D2", lapisan: [{ bentuk: "tetes", gerak: "naik", jumlah: 9, warna: "#FF8DBA", warna2: "#FFD1E3", ukuran: 12 }, { bentuk: "bintang", gerak: "kedip", jumlah: 5, warna: "#FFF0F6", warna2: "#FFC4DC", ukuran: 9 }] },
  // Apel Emas: apel-apel emas mengorbit robot
  apelEmas: { aura: "255,196,70", cincin: "#F2C14E", lapisan: [{ bentuk: "apel", gerak: "orbit", jumlah: 5, warna: "#F2C14E", warna2: "#E39A1B", ukuran: 17 }, { bentuk: "titik", gerak: "kedip", jumlah: 7, warna: "#FFE9A8", warna2: "#FFD76A", ukuran: 5 }] },
  // Anggur Dewa: gelembung ungu dan tandan anggur melayang naik
  anggurDewa: { aura: "150,100,210", cincin: "#B58AE6", lapisan: [{ bentuk: "anggur", gerak: "naik", jumlah: 6, warna: "#8B5CC4", warna2: "#C9A3F0", ukuran: 15 }, { bentuk: "titik", gerak: "spiral", jumlah: 6, warna: "#C9A3F0", warna2: "#8B5CC4", ukuran: 6 }] },
  // Madu Surgawi: lebah mengitari + tetes madu jatuh
  madu: { aura: "245,178,30", cincin: "#F5B21E", lapisan: [{ bentuk: "lebah", gerak: "orbit", jumlah: 4, warna: "#F5B21E", warna2: "#2B2233", ukuran: 16 }, { bentuk: "tetes", gerak: "jatuh", jumlah: 6, warna: "#F5B21E", warna2: "#FFD96B", ukuran: 11 }] },
  // Persik Abadi: kelopak persik jatuh pelan
  persikAbadi: { aura: "255,160,140", cincin: "#FFB3A5", lapisan: [{ bentuk: "kelopak", gerak: "jatuh", jumlah: 10, warna: "#FF9B8A", warna2: "#FFD0C6", ukuran: 14 }, { bentuk: "titik", gerak: "kedip", jumlah: 5, warna: "#FFE6DF", warna2: "#FF9B8A", ukuran: 5 }] },
  // Nasi Langit: butir-butir putih jatuh seperti bintang jatuh
  nasiLangit: { aura: "190,215,255", cincin: "#DCE9FF", lapisan: [{ bentuk: "butir", gerak: "jatuh", jumlah: 11, warna: "#F3F8FF", warna2: "#B9D4FF", ukuran: 11 }, { bentuk: "bintang", gerak: "kedip", jumlah: 5, warna: "#FFFFFF", warna2: "#B9D4FF", ukuran: 9 }] },
  // Kue Bulan: bulan sabit kecil mengorbit pelan di bawah cahaya perak
  kueBulan: { aura: "255,236,170", cincin: "#FFF1BF", lapisan: [{ bentuk: "bulan", gerak: "orbit", jumlah: 4, warna: "#FFE9A8", warna2: "#FFF8DC", ukuran: 18 }, { bentuk: "bintang", gerak: "kedip", jumlah: 6, warna: "#FFFBE8", warna2: "#FFE9A8", ukuran: 8 }] },
  // Sup Naga: bara api naik + uap abu-abu
  supNaga: { aura: "255,100,60", cincin: "#FF7B45", lapisan: [{ bentuk: "api", gerak: "naik", jumlah: 8, warna: "#FF6A3D", warna2: "#FFC15A", ukuran: 14 }, { bentuk: "titik", gerak: "spiral", jumlah: 5, warna: "#D9D2D0", warna2: "#B9B0AE", ukuran: 9 }] },
  // Roti Bintang: bintang-bintang berkelap-kelip di sekeliling robot
  rotiBintang: { aura: "255,215,120", cincin: "#FFE08A", lapisan: [{ bentuk: "bintang", gerak: "kedip", jumlah: 9, warna: "#FFD76A", warna2: "#FFFFFF", ukuran: 15 }, { bentuk: "bintang", gerak: "orbit", jumlah: 3, warna: "#FFF3C4", warna2: "#FFD76A", ukuran: 11 }] },
};

function Gambar({ b, w, w2 }: { b: Bentuk; w: string; w2: string }): ReactNode {
  const g = { stroke: "#2B2233", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  switch (b) {
    case "titik":
      return <circle cx="12" cy="12" r="6" fill={w} />;
    case "bintang":
      return <path d="M12 2l2.7 6.6 7.1.6-5.4 4.6 1.7 7L12 17.2 5.9 20.8l1.7-7L2.2 9.2l7.1-.6z" fill={w} stroke={w2} strokeWidth={1.2} strokeLinejoin="round" />;
    case "tetes":
      return <path d="M12 2C12 2 5 11 5 15a7 7 0 0014 0C19 11 12 2 12 2z" fill={w} stroke={w2} strokeWidth={1.4} />;
    case "kelopak":
      return <path d="M12 3C18 8 18 16 12 21 6 16 6 8 12 3z" fill={w} stroke={w2} strokeWidth={1.4} />;
    case "bulan":
      return <path d="M16 3A10 10 0 1021 16 8 8 0 1116 3z" fill={w} stroke={w2} strokeWidth={1.2} />;
    case "apel":
      return (
        <>
          <path d="M12 7C6 5 3 10 4 14c1 5 5 7 8 6 3 1 7-1 8-6 1-4-2-9-8-7z" fill={w} {...g} />
          <path d="M12 7c0-2 1-4 3-5" stroke="#2B2233" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M8 11c-1 1-1 3 0 4" stroke="#FFF3C4" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      );
    case "lebah":
      return (
        <>
          <ellipse cx="8" cy="7" rx="4.5" ry="3" fill="#EAF6FF" stroke="#2B2233" strokeWidth={1.1} />
          <ellipse cx="15" cy="6" rx="4.5" ry="3" fill="#EAF6FF" stroke="#2B2233" strokeWidth={1.1} />
          <ellipse cx="12" cy="14" rx="7" ry="5" fill={w} {...g} />
          <path d="M9 9.5v9M13 9.2v9.6" stroke={w2} strokeWidth={2.2} />
        </>
      );
    case "api":
      return <path d="M12 2c2 6 7 8 6 14a6 6 0 01-12 0c0-4 3-5 3-8 1 1 2 1 3-6z" fill={w} stroke={w2} strokeWidth={1.4} strokeLinejoin="round" />;
    case "anggur":
      return (
        <>
          <circle cx="8" cy="9" r="4.4" fill={w} {...g} />
          <circle cx="16" cy="9" r="4.4" fill={w} {...g} />
          <circle cx="12" cy="16" r="4.4" fill={w} {...g} />
          <circle cx="7" cy="8" r="1.2" fill={w2} />
        </>
      );
    case "butir":
      return <ellipse cx="12" cy="12" rx="4" ry="8" fill={w} stroke={w2} strokeWidth={1.4} transform="rotate(25 12 12)" />;
  }
}

/** Nilai acak deterministik (tanpa Math.random saat render: hasilnya stabil antar render). */
const acak = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  // dibulatkan supaya render server & klien identik (tak ada hydration mismatch)
  return Math.round((v - Math.floor(v)) * 1000) / 1000;
};

export default function EfekDewa({ id, kuat = false }: { id: MakananDewaId; kuat?: boolean }) {
  const cfg = CFG[id];
  return (
    <div aria-hidden="true" className={`dewa-efek pointer-events-none absolute inset-0 overflow-visible ${kuat ? "dewa-kuat" : ""}`} style={{ "--aura": cfg.aura, "--cincin": cfg.cincin } as CSSProperties}>
      <span className="dewa-aura" />
      {kuat && <span className="dewa-cincin" />}
      {kuat && <span className="dewa-cincin dewa-cincin-2" />}
      {cfg.lapisan.map((l, li) =>
        Array.from({ length: Math.round(l.jumlah * (kuat ? 1.8 : 1)) }, (_, i) => {
          const a = acak(i, li * 7 + 1);
          const b = acak(i, li * 7 + 2);
          const c = acak(i, li * 7 + 3);
          const gaya = {
            "--x": `${8 + a * 84}%`,
            "--dx": `${(b - 0.5) * 60}px`,
            "--d": `${(c * 3.2).toFixed(2)}s`,
            "--t": `${(2.6 + b * 2.4).toFixed(2)}s`,
            "--s": `${(l.ukuran * (0.7 + a * 0.6)).toFixed(1)}px`,
            "--a": `${Math.round(a * 360)}deg`,
            "--rad": `${58 + b * 34}px`,
            "--y": `${12 + c * 70}%`,
          } as CSSProperties;
          return (
            <span key={`${li}-${i}`} className={`dewa-p dewa-${l.gerak}`} style={gaya}>
              <svg viewBox="0 0 24 24" width="100%" height="100%" className="block overflow-visible">
                <Gambar b={l.bentuk} w={l.warna} w2={l.warna2} />
              </svg>
            </span>
          );
        }),
      )}
    </div>
  );
}
