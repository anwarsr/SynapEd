"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Defs, G, LG, Lantai, Penutup, RG, Saklar, mati, n1, r, type LatarProps } from "./LatarBersama";

/** Stasiun Angkasa & Pondok Salju. */

// ───────────────────────── STASIUN ANGKASA ─────────────────────────
// Fisika benda melayang (px, ditulis langsung ke transform tiap bingkai, tanpa render React): hanyut pelan dengan kecepatan jelajah,
// memantul lembut di dinding kabin, saling bertumbukan (massa ~ jari-jari^2), dan sentuhan memberi dorongan + putaran yang
// meredam mulus kembali ke kecepatan jelajah (bukan melompat balik ke posisi awal seperti animasi keyframe lama).
const BENDA = [
  { nama: "Helm", w: 78, x: 0.3, y: 0.3, ucap: "Wuuush!" },
  { nama: "Burger", w: 76, x: 0.45, y: 0.22, ucap: "Burgernya melayang~" },
  { nama: "Cangkir", w: 66, x: 0.6, y: 0.4, ucap: "Gravitasi nol!" },
  { nama: "Tabung oksigen", w: 46, x: 0.76, y: 0.3, ucap: "Hati-hati, tabung oksigen!" },
];
interface Fisika {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  vrDasar: number;
  jelajah: number;
}

/** Gambar tiap benda melayang (viewBox berbeda-beda, lebar diatur induknya). */
function GambarBenda({ i }: { i: number }) {
  if (i === 0)
    return (
      <svg viewBox="0 0 70 72" className="block w-full overflow-visible">
        <defs>
          <LG id="lt-a-helm" s={[[0, "#FFFFFF"], [0.6, "#E6EAF4"], [1, "#B9C2DA"]]} />
          <LG id="lt-a-visor" s={[[0, "#35508F"], [0.5, "#16224A"], [1, "#0A1030"]]} />
          <LG id="lt-a-cincin" h s={[[0, "#8A93AD"], [0.5, "#D5DAE8"], [1, "#7C86A2"]]} />
          <clipPath id="lt-a-kaca">
            <path d="M18 28c0-9 8-15 18-15s18 6 18 15v9c0 7-8 12-18 12s-18-5-18-12z" />
          </clipPath>
        </defs>
        <circle cx="9" cy="39" r="5.4" fill="url(#lt-a-cincin)" stroke="#6E7894" strokeWidth="1" />
        <circle cx="63" cy="39" r="5.4" fill="url(#lt-a-cincin)" stroke="#6E7894" strokeWidth="1" />
        <rect x="19" y="58" width="34" height="10" rx="3.4" fill="url(#lt-a-cincin)" stroke="#6E7894" strokeWidth="1" />
        <path d="M25 59v8M31 59v8M37 59v8M43 59v8M49 59v8" stroke="#6E7894" strokeOpacity="0.6" strokeWidth="0.9" />
        <path d="M10 38C10 16 22 4 36 4s26 12 26 34c0 12-6 20-14 24H24C16 58 10 50 10 38z" fill="url(#lt-a-helm)" stroke="#8E96B0" strokeWidth="1.2" />
        <path d="M16 20C20 12 28 7 36 7" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="29" y="2" width="14" height="6" rx="2.4" fill="url(#lt-a-cincin)" stroke="#6E7894" strokeWidth="0.9" />
        <path d="M18 28c0-9 8-15 18-15s18 6 18 15v9c0 7-8 12-18 12s-18-5-18-12z" fill="url(#lt-a-visor)" stroke="#5C6688" strokeWidth="1.6" />
        <path d="M23 24q7-7 17-5" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M44 41q4-2 6-6" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (i === 1)
    return (
      <svg viewBox="0 0 70 66" className="block w-full overflow-visible">
        <defs>
          <LG id="lt-a-roti-a" s={[[0, "#F6C46A"], [1, "#C98530"]]} />
          <LG id="lt-a-roti-b" s={[[0, "#E3A24E"], [1, "#B6701F"]]} />
        </defs>
        <path d="M8 50h54c0 8-6 12-14 12H22C14 62 8 58 8 50z" fill="url(#lt-a-roti-b)" stroke="#8A5214" strokeWidth="1.2" />
        <rect x="6" y="39" width="58" height="11" rx="5.5" fill="#5A3322" stroke="#3A1F12" strokeWidth="1.1" />
        {[14, 24, 34, 44, 54].map((x, k) => (
          <circle key={x} cx={x} cy={43 + (k % 2) * 3} r="1.1" fill="#7A4A32" />
        ))}
        <path d="M6 36h58l-3 6-8-4-7 8-7-8-9 7-8-7-8 6z" fill="#F6C945" stroke="#C99A1E" strokeWidth="1" strokeLinejoin="round" />
        <rect x="8" y="29" width="54" height="7.5" rx="3.7" fill="#D8412F" stroke="#9A2418" strokeWidth="1" />
        <path d="M5 30q5-6 10 0t10 0t10 0t10 0t10 0t10 0v4H5z" fill="#6DBF4A" stroke="#3F8A2A" strokeWidth="1" strokeLinejoin="round" />
        <path d="M6 27C6 9 20 3 35 3s29 6 29 24z" fill="url(#lt-a-roti-a)" stroke="#8A5214" strokeWidth="1.2" />
        <path d="M13 21C15 13 22 8 30 7" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.2" strokeLinecap="round" />
        {[
          [22, 14, 20],
          [34, 10, -10],
          [46, 14, 30],
          [28, 20, -30],
          [41, 20, 10],
          [53, 21, -20],
          [16, 22, 40],
        ].map(([x, y, a], k) => (
          <ellipse key={k} cx={x} cy={y} rx="2.6" ry="1.3" fill="#FFF3D6" stroke="#B88A3A" strokeWidth="0.5" transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </svg>
    );
  if (i === 2)
    return (
      <svg viewBox="0 0 64 64" className="block w-full overflow-visible">
        <defs>
          <LG id="lt-a-cangkir" h s={[[0, "#B8322B"], [0.35, "#F26B5E"], [0.7, "#D9473F"], [1, "#9A2620"]]} />
        </defs>
        <path d="M46 24c14-2 14 22 0 24" fill="none" stroke="#9A2620" strokeWidth="6.4" strokeLinecap="round" />
        <path d="M46 24c14-2 14 22 0 24" fill="none" stroke="#F26B5E" strokeWidth="3" strokeLinecap="round" />
        <path d="M10 14h38l-2 38c0 4-3 7-7 7H19c-4 0-7-3-7-7z" fill="url(#lt-a-cangkir)" stroke="#7C1E1A" strokeWidth="1.2" />
        <path d="M10 14h38v3.4H10z" fill="#FCE9E6" stroke="#7C1E1A" strokeWidth="1" strokeLinejoin="round" />
        <path d="M18 22l1.6 28" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
        <ellipse cx="29" cy="58" rx="13" ry="2" fill="#7C1E1A" fillOpacity="0.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 96" className="block w-full overflow-visible">
      <defs>
        <LG id="lt-a-tabung" h s={[[0, "#9AA6BE"], [0.4, "#F4F7FC"], [0.7, "#C3CCDD"], [1, "#8792AC"]]} />
        <LG id="lt-a-pita" h s={[[0, "#B8432F"], [0.4, "#F27A5E"], [1, "#A53A28"]]} />
        <clipPath id="lt-a-badan">
          <rect x="6" y="18" width="28" height="68" rx="14" />
        </clipPath>
      </defs>
      <path d="M20 8c12-8 22 2 16 14" fill="none" stroke="#2B2233" strokeWidth="3" strokeLinecap="round" />
      <rect x="15" y="9" width="10" height="12" rx="2" fill="#6B7385" stroke="#3E4558" strokeWidth="1" />
      <circle cx="20" cy="7" r="5" fill="#8F97AA" stroke="#3E4558" strokeWidth="1" />
      <path d="M16 7h8M20 3v8" stroke="#3E4558" strokeWidth="1.2" />
      <rect x="6" y="18" width="28" height="68" rx="14" fill="url(#lt-a-tabung)" stroke="#6E7894" strokeWidth="1.2" />
      <g clipPath="url(#lt-a-badan)">
        <rect x="4" y="46" width="32" height="12" fill="url(#lt-a-pita)" />
        <path d="M4 46h32M4 58h32" stroke="#7A2A1C" strokeOpacity="0.4" strokeWidth="0.8" />
      </g>
      <path d="M12 26v52" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="20" cy="86" rx="11" ry="2.2" fill="#6E7894" fillOpacity="0.6" />
      <circle cx="32" cy="14" r="5.2" fill="#fff" stroke="#3E4558" strokeWidth="1.1" />
      <path d="M32 14l2.6-2.4" stroke="#E54B4B" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Angkasa(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const panggung = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const fis = useRef<Fisika[]>([]);

  useEffect(() => {
    const st = panggung.current;
    if (!st) return;
    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fis.current = BENDA.map((b, i) => {
      const a = 0.9 + i * 1.7;
      const jelajah = 14 + i * 3;
      const vrDasar = (i % 2 ? 1 : -1) * (9 + i * 4);
      return { x: 0, y: 0, vx: Math.cos(a) * jelajah, vy: Math.sin(a) * jelajah * 0.8, rot: i * 37, vr: vrDasar, vrDasar, jelajah };
    });
    let mulai = false;
    let last = 0;
    let raf = 0;
    const langkah = (t: number) => {
      const W = st.clientWidth;
      const H = st.clientHeight;
      const sk = Math.min(1, W / 900);
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const S = fis.current;
      // lebar diatur dulu supaya tinggi (benda tinggi seperti tabung) terukur benar sebelum dipakai untuk tumbukan
      S.forEach((_, i) => {
        const el = els.current[i];
        if (el) el.style.width = `${BENDA[i].w * sk}px`;
      });
      if (!mulai) {
        S.forEach((s, i) => {
          s.x = BENDA[i].x * W;
          s.y = BENDA[i].y * H;
        });
        mulai = true;
      }
      const rad = S.map((_, i) => {
        const el = els.current[i];
        return el ? Math.max(el.offsetWidth, el.offsetHeight) * 0.36 : BENDA[i].w * 0.4;
      });
      const minX = 0.04 * W;
      const maxX = 0.96 * W;
      const minY = Math.max(0.2 * H, 110);
      const maxY = 0.57 * H;
      S.forEach((s, i) => {
        const R = rad[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vr * dt;
        if (s.x < minX + R) {
          s.x = minX + R;
          s.vx = Math.abs(s.vx) * 0.85;
        } else if (s.x > maxX - R) {
          s.x = maxX - R;
          s.vx = -Math.abs(s.vx) * 0.85;
        }
        if (s.y < minY + R) {
          s.y = minY + R;
          s.vy = Math.abs(s.vy) * 0.85;
        } else if (s.y > maxY - R) {
          s.y = maxY - R;
          s.vy = -Math.abs(s.vy) * 0.85;
        }
      });
      for (let i = 0; i < S.length; i++) {
        for (let j = i + 1; j < S.length; j++) {
          const a = S[i];
          const b = S[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const jarak = Math.hypot(dx, dy) || 0.001;
          const min = rad[i] + rad[j];
          if (jarak >= min) continue;
          const nx = dx / jarak;
          const ny = dy / jarak;
          const ma = rad[i] * rad[i];
          const mb = rad[j] * rad[j];
          const tumpang = min - jarak;
          a.x -= nx * tumpang * (mb / (ma + mb));
          a.y -= ny * tumpang * (mb / (ma + mb));
          b.x += nx * tumpang * (ma / (ma + mb));
          b.y += ny * tumpang * (ma / (ma + mb));
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const impuls = (-(1 + 0.9) * rel) / (1 / ma + 1 / mb);
            a.vx -= (impuls * nx) / ma;
            a.vy -= (impuls * ny) / ma;
            b.vx += (impuls * nx) / mb;
            b.vy += (impuls * ny) / mb;
            a.vr += (nx - ny) * 20;
            b.vr -= (nx - ny) * 20;
          }
        }
      }
      const redam = Math.exp(-0.8 * dt);
      const redamPutar = 1 - Math.exp(-1.1 * dt);
      S.forEach((s, i) => {
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > s.jelajah) {
          const baru = Math.max(s.jelajah, sp * redam);
          s.vx *= baru / sp;
          s.vy *= baru / sp;
        } else if (sp < s.jelajah * 0.6) {
          const a = Math.atan2(s.vy, s.vx) || 0.5;
          s.vx = Math.cos(a) * s.jelajah * 0.6;
          s.vy = Math.sin(a) * s.jelajah * 0.6;
        }
        s.vr += (s.vrDasar - s.vr) * redamPutar;
        const el = els.current[i];
        if (el) {
          el.style.transform = `translate(${s.x - el.offsetWidth / 2}px, ${s.y - el.offsetHeight / 2}px) rotate(${s.rot}deg)`;
          el.style.opacity = "1";
        }
      });
      if (!hemat) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dorong = (i: number, e: React.MouseEvent) => {
    const st = panggung.current;
    const s = fis.current[i];
    if (!st || !s) return;
    const k = st.getBoundingClientRect();
    let dx = s.x - (e.clientX - k.left);
    let dy = s.y - (e.clientY - k.top);
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = i % 2 ? 1 : -1;
      dy = -0.4;
    } else {
      dx /= d;
      dy /= d;
    }
    const kuat = 230 / Math.sqrt(BENDA[i].w / 64);
    s.vx += dx * kuat;
    s.vy += dy * kuat;
    s.vr += (dx >= 0 ? 1 : -1) * 170;
    p.bisik(BENDA[i].ucap);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <LG id="lt-a-dinding" s={[[0, "#1B2247"], [0.6, "#262F5C"], [1, "#2D3868"]]} />
        <LG id="lt-a-cincin2" h s={[[0, "#7C86A8"], [0.5, "#C4CBE0"], [1, "#6E789C"]]} />
        <RG id="lt-a-planet" cx={0.34} cy={0.3} s={[[0, "#F6B26B"], [0.55, "#D9753E"], [1, "#7A3A2E"]]} />
        <clipPath id="lt-a-bulat">
          <circle cx="100" cy="100" r="78" />
        </clipPath>
      </Defs>
      <div className="absolute inset-x-0 top-0 h-[62%]" style={{ background: "linear-gradient(180deg,#1B2247,#262F5C 60%,#2D3868)" }} />
      {/* sambungan panel dinding bersekrup */}
      {[12, 30, 48, 66, 84].map((x) => (
        <div key={x} aria-hidden="true" className="absolute top-0 h-[62%] w-[3px] bg-[#141A3A]/70" style={{ left: `${x}%` }}>
          {[12, 34, 56, 78].map((y) => (
            <span key={y} className="absolute -left-[3px] h-[8px] w-[8px] rounded-full bg-[#3A4578]" style={{ top: `${y}%` }} />
          ))}
        </div>
      ))}
      <div aria-hidden="true" className="absolute inset-x-0 top-[55%] h-[7%] border-y-[3px] border-[#2B2233] bg-[#2C3668]" />
      {/* jendela bundar ke luar angkasa: planet bercincin + bintang berkelip */}
      <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute left-[22%] top-[17%] w-[clamp(120px,19vw,240px)] overflow-visible">
        <circle cx="100" cy="100" r="95" fill="#111833" fillOpacity="0.5" transform="translate(3 5)" style={{ filter: "blur(4px)" }} />
        <circle cx="100" cy="100" r="94" fill="url(#lt-a-cincin2)" stroke="#2B2233" strokeWidth="2.4" />
        <circle cx="100" cy="100" r="78" fill="#070B22" />
        <g clipPath="url(#lt-a-bulat)">
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} className="syrobo-bintang" cx={26 + r(i, 5) * 148} cy={26 + r(i, 6) * 148} r={i % 4 === 0 ? 2.2 : 1.3} fill="#F6E3C0" style={{ animationDelay: `${r(i, 7) * 3}s` }} />
          ))}
          <circle cx="142" cy="148" r="54" fill="url(#lt-a-planet)" />
          <path d="M96 138c24-8 54-6 92 4v9c-36-8-66-8-92 5z" fill="#B8603A" fillOpacity="0.55" />
          <path d="M112 118c16-6 32-6 52 0-8 8-30 10-52 0z" fill="#F6C48A" fillOpacity="0.5" />
          <path d="M88 160c10 14 28 22 50 22" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="18" />
        </g>
        <circle cx="100" cy="100" r="78" fill="none" stroke="#2B2233" strokeWidth="3" />
        <path d="M44 56C56 38 76 28 98 26" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="4" strokeLinecap="round" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <circle key={i} cx={n1(100 + Math.cos(a) * 86)} cy={n1(100 + Math.sin(a) * 86)} r="3.4" fill="#CFD6EE" stroke="#2B2233" strokeWidth="1.6" />;
        })}
      </svg>
      {/* konsol dinding: layar osiloskop dengan garis penyapu yang menggambar sinyal dari kiri ke kanan lalu memudar */}
      <div className="pointer-events-none absolute right-[8%] top-[27%] hidden aspect-[240/130] w-[clamp(170px,21vw,270px)] md:block">
        <svg viewBox="0 0 240 130" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" {...G} strokeWidth={2.6}>
          <rect x="4" y="4" width="232" height="122" rx="10" fill="#323C6B" />
          <rect x="14" y="14" width="132" height="72" rx="7" fill="#0A0E24" strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} className="lt-kedip" cx={166 + i * 17} cy="30" r="6" fill={["#6BE0A8", "#F2C14E", "#E56B5D", "#6BA7D8"][i]} strokeWidth="2.2" style={{ animationDelay: `${i * 0.35}s`, animationDuration: `${1.2 + i * 0.4}s` }} />
          ))}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path d={`M${160 + i * 24} 52v36`} strokeWidth="5" stroke="#161C3C" />
              <rect x={154 + i * 24} y={58 + ((i * 17) % 22)} width="12" height="9" rx="2" fill="#CFD6EE" strokeWidth="2" />
            </g>
          ))}
          <path d="M18 98h120M18 106h120M18 114h80" strokeWidth="2.2" opacity="0.4" />
        </svg>
        <div className="absolute overflow-hidden rounded-[5px]" style={{ left: "6.1%", top: "11.5%", width: "54.2%", height: "54.6%", background: "#06120F" }}>
          <svg viewBox="0 0 128 70" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
            {[14, 28, 42, 56].map((y) => (
              <path key={y} d={`M0 ${y}H128`} stroke="#2E6B52" strokeOpacity="0.35" strokeWidth="0.6" />
            ))}
            {[16, 32, 48, 64, 80, 96, 112].map((x) => (
              <path key={x} d={`M${x} 0V70`} stroke="#2E6B52" strokeOpacity="0.35" strokeWidth="0.6" />
            ))}
            <g className="lt-pudar">
              <path d="M0 42L14 42L18 38L22 46L26 42L40 42L44 14L48 62L52 42L66 42L72 36L78 48L84 42L98 42L102 24L106 56L110 42L128 42" fill="none" stroke="#6BF0B0" strokeOpacity="0.28" strokeWidth="4.4" strokeLinejoin="round" />
              <path d="M0 42L14 42L18 38L22 46L26 42L40 42L44 14L48 62L52 42L66 42L72 36L78 48L84 42L98 42L102 24L106 56L110 42L128 42" fill="none" stroke="#8FFFC6" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          </svg>
          <div aria-hidden="true" className="absolute inset-0" style={{ background: "repeating-linear-gradient(180deg,rgba(0,0,0,0.28) 0 1px,transparent 1px 3px)" }} />
          <div aria-hidden="true" className="lt-tutup absolute inset-y-0 left-0 w-full" style={{ background: "#06120F", borderLeft: "2px solid #9CFFD0", boxShadow: "-8px 0 14px 2px rgba(80,255,170,0.4)" }} />
        </div>
      </div>
      <Lantai kelas="bg-[#5B6489] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(20,26,56,0.5)_150px_153px),repeating-linear-gradient(0deg,transparent_0_70px,rgba(20,26,56,0.32)_70px_72px)]" bayang="rgba(20,26,56,0.4)" />
      {/* jalur peringatan di kaki dinding */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[calc(62%+4px)] h-[2.4%] border-b-[3px] border-[#2B2233]" style={{ background: "repeating-linear-gradient(135deg,#F2C14E 0 14px,#2B2233 14px 28px)" }} />
      {/* saklar lampu kabin menempel di dinding: BERADA DI BAWAH benda melayang (benda lewat di depannya, tidak menembus di belakangnya) */}
      <Saklar {...p} kelas="absolute right-[9%] top-[47%] block" z="z-[1]" label="Panel lampu kabin">
        <svg viewBox="0 0 60 80" className="block w-[clamp(36px,4.4vw,58px)]" {...G}>
          <rect x="6" y="4" width="48" height="72" rx="6" fill="#323C6B" />
          <rect x="22" y="16" width="16" height="48" rx="8" fill="#161C3C" strokeWidth="2.4" />
          <circle cx="30" cy={p.gelap ? 52 : 28} r="9" fill={p.gelap ? "#E56B5D" : "#6BE0A8"} className="transition-all duration-300" />
        </svg>
      </Saklar>
      {/* benda melayang: fisika nyata, sentuh untuk mendorong. Di depan dinding & saklar, di belakang robot. */}
      <div ref={panggung} className={cn("pointer-events-none absolute inset-0 z-[3]", p.gelap && "brightness-[0.6]")}>
        {BENDA.map((b, i) => (
          <button
            key={b.nama}
            ref={(el) => {
              els.current[i] = el;
            }}
            type="button"
            disabled={!benda}
            aria-label={`${b.nama}: dorong`}
            onClick={(e) => dorong(i, e)}
            className={cn("pointer-events-auto absolute left-0 top-0 cursor-pointer opacity-0", mati)}
            style={{ width: b.w }}
          >
            <GambarBenda i={i} />
          </button>
        ))}
      </div>
      <Penutup gelap={p.gelap} warna="#07091C" />
    </div>
  );
}

// ───────────────────────── PONDOK SALJU ─────────────────────────
/** Pohon cemara bertingkat: tepi bergerigi, salju bertengger di tiap tingkat (salinan lebih kecil di puncak tingkatnya). */
function Cemara({ x, y, s, gelap = "#143D2B", terang = "#1F5A3E" }: { x: number; y: number; s: number; gelap?: string; terang?: string }) {
  const tingkat = (cy: number, w: number, h: number) => {
    const kanan: [number, number][] = [[0.42, 0.4], [0.3, 0.46], [0.74, 0.78], [0.58, 0.84], [1, 1]];
    const bawah: [number, number][] = [[0.72, 0.9], [0.44, 1], [0.16, 0.92], [-0.16, 1], [-0.44, 0.92], [-0.72, 1]];
    const pt = (px: number, py: number) => `${n1(px * w)} ${n1(cy + py * h)}`;
    const kiri = [...kanan].reverse().map(([px, py]) => [-px, py] as [number, number]);
    return `M0 ${n1(cy)}L${kanan.map(([px, py]) => pt(px, py)).join("L")}L${bawah.map(([px, py]) => pt(px, py)).join("L")}L${kiri.slice(1).map(([px, py]) => pt(px, py)).join("L")}Z`;
  };
  const tiers: [number, number, number][] = [[-52, 22, 26], [-36, 27, 28], [-18, 31, 30], [2, 35, 32]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3.4" y="30" width="6.8" height="10" fill="#4A2E18" />
      {tiers.map(([cy, w, h], i) => (
        <g key={i}>
          <path d={tingkat(cy, w, h)} fill={i % 2 ? terang : gelap} />
          <path d={tingkat(cy, w, h)} fill="#EEF5FB" fillOpacity="0.92" transform={`translate(0 ${cy * 0.4 - 1}) scale(0.62 0.5) translate(0 ${cy * 0.4})`} />
        </g>
      ))}
    </g>
  );
}

/** Gelondongan dilihat dari ujung potongan: kulit gelap melingkar, lingkaran tahun, titik pusat, satu retakan kecil. */
function KayuUjung({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="15" fill="url(#lt-s-kulit)" stroke="#2E1A0E" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="12" fill="#D9B27A" />
      {[9.4, 6.6, 3.8].map((rad) => (
        <circle key={rad} cx={cx} cy={cy} r={rad} fill="none" stroke="#A9825A" strokeWidth="0.9" />
      ))}
      <circle cx={cx} cy={cy} r="1.3" fill="#7A5232" />
      <path d={`M${cx} ${cy}L${cx + 6} ${cy - 8}`} stroke="#8A6540" strokeOpacity="0.8" strokeWidth="0.8" />
    </g>
  );
}

export function Salju(p: LatarProps) {
  const benda = p.login && !p.gelap;
  const [kobar, setKobar] = useState(0);
  const lempar = () => {
    setKobar((n) => n + 1);
    p.bisik("Krak! Api berkobar, hangat sekali.");
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Defs>
        <LG id="lt-s-kulit" s={[[0, "#8C5A33"], [0.5, "#6B4226"], [1, "#4A2C18"]]} />
        <LG id="lt-s-langit" s={[[0, "#0A1540"], [0.55, "#223F86"], [1, "#6384BE"]]} />
        <LG id="lt-s-api" s={[[0, "#E5381B", 0.85], [0.45, "#FF8A1F"], [0.8, "#FFC93C"], [1, "#FFF2A8"]]} />
        <LG id="lt-s-inti" s={[[0, "#FFB43A", 0.9], [1, "#FFFFFF"]]} />
        <LG id="lt-s-bingkai" h s={[[0, "#8A5A3B"], [0.5, "#A87249"], [1, "#6E4A35"]]} />
        <LG id="lt-s-gunung" s={[[0, "#46619A"], [1, "#2E4478"]]} />
        <LG id="lt-s-salju" s={[[0, "#F2F8FD"], [1, "#BBD0E6"]]} />
        <RG id="lt-s-cahaya" s={[[0, "#FF9A3C", 0.55], [1, "#FF9A3C", 0]]} />
        <RG id="lt-s-bulan" s={[[0, "#FFF8D8"], [0.5, "#F6F0D0", 0.5], [1, "#F6F0D0", 0]]} />
      </Defs>
      <div className="absolute inset-x-0 top-0 h-[62%] bg-[#8A5A3B]" style={{ backgroundImage: "repeating-linear-gradient(180deg,transparent 0 60px,rgba(43,34,51,0.55) 60px 63px),repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 63px,rgba(255,255,255,0.05) 63px 126px)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[62%]" style={{ background: "radial-gradient(ellipse at 66% 100%,rgba(255,150,60,0.2),transparent 55%),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(20,10,5,0.35))" }} />
      {/* jendela ke malam bersalju: bingkai kayu bersekat, ambang berselimut salju, kaca berembun di sudut */}
      <div className="absolute left-[19%] top-[16%] w-[clamp(104px,16vw,200px)]">
        <div className="relative aspect-[100/140] w-full overflow-hidden border-[6px] border-[#2B2233] shadow-[0_0_0_5px_#A87249,0_0_0_8px_#2B2233]" style={{ background: "#0A1540" }}>
          <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full" strokeLinejoin="round">
            <rect width="100" height="140" fill="url(#lt-s-langit)" />
            {Array.from({ length: 16 }, (_, i) => (
              <circle key={i} className="syrobo-bintang" cx={r(i, 70) * 100} cy={r(i, 71) * 60} r={0.5 + r(i, 72) * 0.8} fill="#F6F0D8" style={{ animationDelay: `${r(i, 73) * 3}s` }} />
            ))}
            <circle cx="74" cy="26" r="20" fill="url(#lt-s-bulan)" />
            <circle cx="74" cy="26" r="8.4" fill="#FBF6DC" />
            <circle cx="71" cy="24" r="1.6" fill="#E8E0BA" />
            <circle cx="77" cy="29" r="1.1" fill="#E8E0BA" />
            <path d="M0 92L18 66l12 14 16-24 20 30 14-12 20 18v48H0z" fill="url(#lt-s-gunung)" />
            <path d="M18 66l-6 8 6-2 5 5zM46 56l-7 10 7-3 6 6zM80 74l-5 6 5-2z" fill="#E4EEF8" />
            <path d="M0 108C26 96 50 112 72 102S92 100 100 104V140H0z" fill="url(#lt-s-salju)" />
            <Cemara x={14} y={110} s={0.5} gelap="#12352A" terang="#1A4A36" />
            <Cemara x={84} y={112} s={0.46} gelap="#12352A" terang="#1A4A36" />
            <Cemara x={34} y={124} s={0.82} />
            <Cemara x={66} y={128} s={0.7} />
            <path d="M0 122C30 114 64 128 100 120V140H0z" fill="#F4F9FD" />
            <rect width="100" height="140" fill="#9BB8E0" fillOpacity="0.08" />
          </svg>
          {Array.from({ length: 26 }, (_, i) => (
            <span key={i} className="lt-salju pointer-events-none absolute inset-y-0" style={{ left: `${r(i, 8) * 96}%`, width: 8, animationDuration: `${5 + r(i, 10) * 5}s`, animationDelay: `-${r(i, 9) * 8}s`, ["--ayun" as string]: `${(r(i, 11) - 0.3) * 18}px` }}>
              <i className="block rounded-full bg-white" style={{ width: 3 + r(i, 12) * 4, height: 3 + r(i, 12) * 4, opacity: 0.65 + r(i, 13) * 0.35 }} />
            </span>
          ))}
          {/* embun beku di sudut kaca */}
          <svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <path d="M0 140V108c10 4 14 12 12 20 8-2 14 0 18 12z" fill="#fff" fillOpacity="0.5" style={{ filter: "blur(1.4px)" }} />
            <path d="M100 140V112c-8 2-12 8-10 16-6 0-10 4-12 12z" fill="#fff" fillOpacity="0.45" style={{ filter: "blur(1.4px)" }} />
            <path d="M0 0h18c-6 6-12 10-18 12z" fill="#fff" fillOpacity="0.35" style={{ filter: "blur(1.2px)" }} />
            <g stroke="#fff" strokeOpacity="0.75" strokeWidth="0.7" fill="none" strokeLinecap="round">
              <path d="M2 132l12-10M8 128l2-8M12 124l8-2M6 136l10-4M16 128l6 4" />
              <path d="M98 134l-12-12M92 130l-2-8M88 126l-8-2M96 138l-10-4" />
            </g>
            <path d="M0 0L100 140V0z" fill="#fff" fillOpacity="0.05" />
          </svg>
          <div className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 bg-[#6E4A35] shadow-[0_0_0_1.5px_#2B2233]" />
          <div className="absolute inset-x-0 top-[46%] h-[6px] bg-[#6E4A35] shadow-[0_0_0_1.5px_#2B2233]" />
        </div>
        <div className="relative -mt-[2px] h-[10px] w-[118%] -translate-x-[9%] border-[2px] border-[#2B2233]" style={{ background: "linear-gradient(180deg,#B07C50,#7A5232)" }}>
          <div aria-hidden="true" className="absolute -top-[9px] left-[8%] h-[11px] w-[34%] rounded-[50%_50%_20%_20%] bg-[#F2F8FD] blur-[0.6px]" />
          <div aria-hidden="true" className="absolute -top-[7px] left-[58%] h-[9px] w-[26%] rounded-[50%_50%_20%_20%] bg-[#E9F1F8] blur-[0.6px]" />
          {/* lilin dalam stoples di ambang */}
          <svg viewBox="0 0 24 34" aria-hidden="true" className="absolute -top-[32px] right-[6%] w-[22px] overflow-visible">
            <rect x="4" y="14" width="16" height="18" rx="3" fill="#FFE9B0" fillOpacity="0.55" stroke="#8A6A3A" strokeWidth="1" />
            <rect x="10" y="16" width="4" height="12" fill="#F6EEDA" />
            {!p.gelap && <ellipse cx="12" cy="11" rx="3" ry="5" fill="#FFC15A" className="lt-lilin" />}
          </svg>
        </div>
      </div>
      <Lantai kelas="bg-[#6A4630] [background-image:repeating-linear-gradient(90deg,transparent_0_150px,rgba(20,12,8,0.5)_150px_153px)]" bayang="rgba(20,12,8,0.4)" />
      <div className="absolute bottom-[7%] left-1/2 h-[22%] w-[52%] min-w-[280px] -translate-x-1/2 rounded-[44%] border-[3px] border-[#2B2233] bg-[#3F6E8C]">
        <div className="absolute inset-[9%] rounded-[44%] border-[3px] border-dashed border-[#F6E3C0]/80" />
      </div>
      {/* perapian batu: lantai perapian menapak di garis lantai, api DI DALAM rongganya */}
      <div className="absolute z-[2] w-[clamp(180px,26vw,330px)]" style={{ left: "55%", bottom: "37%" }}>
        <button type="button" disabled={!benda} aria-label="Perapian: lempar kayu" onClick={lempar} className={cn("block w-full cursor-pointer", mati)}>
          <svg viewBox="0 0 240 206" className="block w-full overflow-visible" {...G}>
            <path d="M20 200V46h200v154z" fill="#9AA0A8" />
            <path d="M20 82h200M20 118h200M20 154h200M64 46v36M132 46v36M190 46v36M42 82v36M98 82v36M162 82v36M214 82v36M64 118v36M132 118v36M190 118v36M20 154v46M98 154v46M162 154v46" fill="none" strokeWidth="2.2" opacity="0.42" />
            <path d="M60 200V108C60 86 80 76 120 76s60 10 60 32v92z" fill="#26202E" />
            <ellipse cx="120" cy="170" rx="72" ry="46" fill="url(#lt-s-cahaya)" stroke="none" className="lt-api-cahaya" />
            <path d="M74 197L156 178" strokeWidth="14" stroke="#2A160C" />
            <path d="M74 197L156 178" strokeWidth="9" stroke="url(#lt-s-kulit)" />
            <g key={kobar} className={kobar > 0 ? "lt-api-besar" : undefined} stroke="none">
              <ellipse cx="120" cy="196" rx="46" ry="5.4" fill="#FF5A1F" fillOpacity="0.5" />
              <g className="lt-api" style={{ animationDuration: "0.95s" }}>
                <path d="M120 194C96 190 92 160 104 138C108 150 114 150 116 134C118 120 126 112 124 100C140 120 150 146 140 168C138 182 130 192 120 194Z" fill="url(#lt-s-api)" />
              </g>
              <g className="lt-api" style={{ animationDuration: "0.62s", animationDelay: "-0.3s" }}>
                <path d="M98 194C84 190 80 172 90 158C93 166 97 167 98 156C106 166 108 184 98 194Z" fill="url(#lt-s-api)" />
              </g>
              <g className="lt-api" style={{ animationDuration: "0.74s", animationDelay: "-0.5s" }}>
                <path d="M146 194C158 188 160 172 152 160C149 167 145 167 144 158C136 168 134 184 146 194Z" fill="url(#lt-s-api)" />
              </g>
              <g className="lt-api" style={{ animationDuration: "0.55s", animationDelay: "-0.15s" }}>
                <path d="M82 196C74 192 72 182 78 174C80 179 83 180 84 174C88 182 88 192 82 196Z" fill="url(#lt-s-api)" />
              </g>
              <g className="lt-api" style={{ animationDuration: "0.68s", animationDelay: "-0.4s" }}>
                <path d="M162 196C170 192 170 184 164 176C162 180 160 181 159 176C154 184 156 192 162 196Z" fill="url(#lt-s-api)" />
              </g>
              <g className="lt-api" style={{ animationDuration: "0.8s", animationDelay: "-0.2s" }}>
                <path d="M120 194C108 190 108 172 116 158C118 166 122 168 124 156C130 170 132 188 120 194Z" fill="url(#lt-s-inti)" />
              </g>
              {[102, 114, 126, 138, 110, 132, 120].map((x, i) => (
                <circle key={i} className="lt-bara" cx={x} cy={170} r={1.2 + (i % 3) * 0.5} fill="#FFC15A" style={{ animationDelay: `${(i * 0.43).toFixed(2)}s`, animationDuration: `${(2.2 + (i % 4) * 0.5).toFixed(1)}s`, ["--ayun" as string]: `${(i % 2 ? 1 : -1) * (6 + i * 2)}px` }} />
              ))}
            </g>
            <rect x="6" y="30" width="228" height="17" rx="3" fill="#6E4A35" />
            <path d="M32 47h16v22c0 8-6 10-12 10s-8-4-4-8z" fill="#E56B5D" strokeWidth="2.4" />
            <path d="M32 47h16v6H32z" fill="#fff" strokeWidth="2" />
            <path d="M64 47h16v18c0 8-6 12-12 12s-6-4-4-8z" fill="#6BA7D8" strokeWidth="2.4" />
            <path d="M64 47h16v6H64z" fill="#fff" strokeWidth="2" />
            <path d="M6 198h228v8H6z" fill="#6E6A72" strokeWidth="2.6" />
          </svg>
        </button>
        {kobar > 0 &&
          Array.from({ length: 9 }, (_, i) => (
            <span key={`${kobar}-${i}`} aria-hidden="true" className="lt-percik pointer-events-none absolute h-[5px] w-[5px] rounded-full bg-[#FFC15A] shadow-[0_0_6px_2px_rgba(255,193,90,0.8)]" style={{ left: `${44 + r(i, 14) * 12}%`, bottom: "26%", animationDelay: `${r(i, 15) * 0.25}s`, ["--dx" as string]: `${(r(i, 16) - 0.5) * 150}px` }} />
          ))}
      </div>
      <div className="lt-api-cahaya pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 66% 66%,rgba(255,150,60,0.28),transparent 52%)" }} />
      {/* kayu bakar: tiga tumpuk tersusun rapi (5-4-3), dilihat dari ujung potongan */}
      <div className="absolute z-[2] hidden w-[clamp(110px,14vw,180px)] sm:block" style={{ left: "83%", bottom: "36%" }}>
        <svg viewBox="0 0 170 108" className="pointer-events-none block w-full overflow-visible">
          <ellipse cx="85" cy="104" rx="82" ry="6" fill="#1A0E06" fillOpacity="0.4" style={{ filter: "blur(3px)" }} />
          <rect x="6" y="97" width="158" height="6" rx="2" fill="#5A3A22" stroke="#2E1A0E" strokeWidth="1.2" />
          {[
            [5, 82, 20],
            [4, 57, 35],
            [3, 32, 50],
          ].flatMap(([n, y, x0]) =>
            Array.from({ length: n }, (_, k) => <KayuUjung key={`${y}-${k}`} cx={x0 + k * 30} cy={y} />),
          )}
        </svg>
      </div>
      {/* lentera gantung dari langit-langit = saklar */}
      <Saklar {...p} kelas="absolute right-[12%] top-0 block" label="Lentera gantung">
        <svg viewBox="0 0 50 190" className="block w-[clamp(36px,4.4vw,56px)] overflow-visible" {...G}>
          <path d="M25 0V96" strokeWidth="2.6" />
          <path d="M13 98h24l-3 12H16z" fill="#2B2233" strokeWidth="2" />
          <path d="M16 110h18l5 44H11z" fill={p.gelap ? "#8E8672" : "#F2C14E"} />
          {!p.gelap && <path d="M20 118h10l2 28H18z" fill="#FFF3A8" stroke="none" />}
          <path d="M10 154h30v8H10z" fill="#6E4A35" strokeWidth="2.4" />
        </svg>
      </Saklar>
      <Penutup gelap={p.gelap} warna="#0E0A22" />
    </div>
  );
}
