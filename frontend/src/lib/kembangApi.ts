"use client";

/**
 * Kembang api layar penuh untuk juara 1 yang membuka papan peringkat.
 *
 * Kanvas sementara menimpa seluruh layar (tak bisa diklik), menyala ±5 detik,
 * lalu dibuang. Hanya BOLEH ada satu pertunjukan sekaligus: memanggil
 * `mulaiKembangApi` saat pertunjukan sebelumnya belum selesai tidak melakukan
 * apa-apa (tidak ditumpuk, tidak diperpanjang). Hemat gerak: tidak tampil.
 */

const DURASI_MS = 5000;
/** Peluncuran baru berhenti di sini supaya ledakan terakhir sempat memudar sebelum 5 dtk. */
const BERHENTI_LUNCUR_MS = 3300;
const WARNA = ["#bbd5ff", "#8db8ff", "#6aa0ff", "#4c8dff", "#2f6fed", "#ffffff"];
const GRAVITASI = 0.055;

let berjalan = false;

interface Partikel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hidup: number;
  umur: number;
  warna: string;
}

interface Roket {
  x: number;
  y: number;
  vy: number;
  tujuanY: number;
  warna: string;
}

export function kembangApiSedangBerjalan(): boolean {
  return berjalan;
}

/** Mengembalikan true bila pertunjukan dimulai, false bila dilewati (sedang berjalan / hemat gerak). */
export function mulaiKembangApi(): boolean {
  if (berjalan) return false;
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  berjalan = true;

  const kanvas = document.createElement("canvas");
  kanvas.setAttribute("aria-hidden", "true");
  Object.assign(kanvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "9999",
    pointerEvents: "none",
    transition: "opacity 600ms ease-out",
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lebar = window.innerWidth;
  const tinggi = window.innerHeight;
  kanvas.width = lebar * dpr;
  kanvas.height = tinggi * dpr;
  document.body.appendChild(kanvas);

  const ctx = kanvas.getContext("2d");
  if (!ctx) {
    kanvas.remove();
    berjalan = false;
    return false;
  }
  ctx.scale(dpr, dpr);

  const roket: Roket[] = [];
  const partikel: Partikel[] = [];
  const mulai = performance.now();
  let terakhirLuncur = -Infinity;
  let raf = 0;
  let memudar = false;

  const acak = (a: number, b: number) => a + Math.random() * (b - a);

  function luncurkan() {
    roket.push({
      x: acak(lebar * 0.12, lebar * 0.88),
      y: tinggi + 10,
      vy: -acak(9, 12.5),
      tujuanY: acak(tinggi * 0.14, tinggi * 0.46),
      warna: WARNA[Math.floor(Math.random() * WARNA.length)],
    });
  }

  function ledakkan(x: number, y: number, warna: string) {
    const jumlah = 56 + Math.floor(Math.random() * 26);
    for (let i = 0; i < jumlah; i++) {
      const sudut = (Math.PI * 2 * i) / jumlah + Math.random() * 0.2;
      const laju = acak(1.2, 4.6);
      partikel.push({
        x,
        y,
        vx: Math.cos(sudut) * laju,
        vy: Math.sin(sudut) * laju,
        hidup: acak(55, 95),
        umur: 0,
        warna: Math.random() < 0.25 ? "#ffffff" : warna,
      });
    }
  }

  function selesai() {
    cancelAnimationFrame(raf);
    kanvas.remove();
    berjalan = false;
  }

  function bingkai(sekarang: number) {
    const t = sekarang - mulai;

    // Jejak: pudarkan isi kanvas sedikit demi sedikit (kanvas tetap transparan).
    ctx!.globalCompositeOperation = "destination-out";
    ctx!.fillStyle = "rgba(0,0,0,0.22)";
    ctx!.fillRect(0, 0, lebar, tinggi);
    ctx!.globalCompositeOperation = "lighter";

    if (t < BERHENTI_LUNCUR_MS && t - terakhirLuncur > 420) {
      terakhirLuncur = t;
      luncurkan();
      if (Math.random() < 0.45) luncurkan();
    }

    for (let i = roket.length - 1; i >= 0; i--) {
      const r = roket[i];
      r.y += r.vy;
      r.vy += 0.07;
      ctx!.fillStyle = r.warna;
      ctx!.fillRect(r.x - 1.2, r.y, 2.4, 9);
      if (r.y <= r.tujuanY || r.vy >= -1.2) {
        ledakkan(r.x, r.y, r.warna);
        roket.splice(i, 1);
      }
    }

    for (let i = partikel.length - 1; i >= 0; i--) {
      const p = partikel[i];
      p.umur++;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + GRAVITASI;
      p.x += p.vx;
      p.y += p.vy;
      if (p.umur >= p.hidup) {
        partikel.splice(i, 1);
        continue;
      }
      ctx!.globalAlpha = 1 - p.umur / p.hidup;
      ctx!.fillStyle = p.warna;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;

    if (!memudar && t > DURASI_MS - 600) {
      memudar = true;
      kanvas.style.opacity = "0";
    }
    if (t >= DURASI_MS) return selesai();
    raf = requestAnimationFrame(bingkai);
  }

  raf = requestAnimationFrame(bingkai);
  // Jaring pengaman: tab yang tersembunyi menghentikan rAF; kanvas tetap harus dibuang.
  window.setTimeout(() => {
    if (berjalan && document.body.contains(kanvas)) selesai();
  }, DURASI_MS + 1500);
  return true;
}
