"use client";

import { useEffect, useRef } from "react";

/**
 * Bintang-bintang berkedip yang membentuk PENSIL, BUKU, LAMPU, dan LAPTOP di
 * latar hero - tersebar tak beraturan (ukuran, kemiringan, dan posisi berbeda,
 * sedikit diacak tiap pemuatan), bentuknya rinci, ditambah debu bintang.
 *
 * KEMUNCULAN: begitu `mulai` bernilai true (hero baru boleh beranimasi sesudah
 * splash loader selesai), tiap bintang melesat dalam PUTARAN SPIRAL dari jauh
 * menuju titik asalnya, berurutan per bentuk, membesar-terang lalu mengendap.
 *
 * INTERAKSI: kursor/sentuhan menghancurkan bentuknya - bintang terpental dan
 * terpencar, lalu pegas menariknya pulang. Ketuk/tekan = ledakan lebih besar.
 *
 * Murni canvas 2D + satu rAF; pergerakan penunjuk dibaca dari `window` (kanvas
 * `pointer-events: none`). Berhenti saat tak terlihat/tab tersembunyi. Hemat
 * gerak: digambar sekali, diam, tanpa interaksi.
 */

type Titik = [number, number];
type Garis = Titik[];
/** [pusatX, pusatY, jari-jari, jumlah] - taburan bintang acak di dalam lingkaran. */
type Taburan = [number, number, number, number];
interface Bentuk {
  garis: Garis[];
  taburan?: Taburan[];
}

/** Busur lingkaran (derajat; 0 = kanan, searah jarum jam di koordinat layar). */
function busur(cx: number, cy: number, r: number, dari: number, ke: number, n = 44): Garis {
  const out: Garis = [];
  for (let i = 0; i <= n; i++) {
    const a = ((dari + ((ke - dari) * i) / n) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

function sinar(cx: number, cy: number, der: number, r0: number, r1: number): Garis {
  const a = (der * Math.PI) / 180;
  return [
    [cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)],
    [cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)],
  ];
}

function putarTitik(x: number, y: number, der: number): Titik {
  const a = (der * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c];
}

function putar(garis: Garis[], der: number): Garis[] {
  return garis.map((g) => g.map(([x, y]) => putarTitik(x, y, der)));
}

// ── Bentuk (kotak 0..100) ───────────────────────────────────────────────────

const PENSIL: Bentuk = {
  garis: putar(
    [
      [[22, 38], [84, 38], [84, 62], [22, 62]], // badan
      [[22, 44], [84, 44]], // sisi segi enam
      [[22, 56], [84, 56]],
      [[22, 38], [4, 50], [22, 62]], // kerucut kayu
      [[13, 43], [13, 57]], // batas serat
      [[4, 50], [9, 47], [9, 53], [4, 50]], // mata pensil
      [[84, 38], [94, 38], [94, 62], [84, 62]], // cincin logam
      [[87, 38], [87, 62]],
      [[90, 38], [90, 62]],
      [[94, 40], [98, 41], [100, 50], [98, 59], [94, 60]], // penghapus
      [[30, 50], [38, 50]], // cetakan merek
      [[42, 50], [47, 50]],
      [[52, 50], [74, 50]],
      [[26, 41], [33, 41]], // serat kayu
      [[60, 41], [70, 41]],
      [[40, 59], [52, 59]],
    ],
    -45,
  ),
};

const BUKU: Bentuk = {
  garis: [
    [[4, 18], [50, 28], [96, 18], [96, 84], [50, 94], [4, 84], [4, 18]], // sampul
    [[10, 16], [50, 26], [90, 16]], // tepi atas halaman
    [[10, 16], [10, 78]],
    [[90, 16], [90, 78]],
    [[10, 78], [50, 88], [90, 78]],
    [[50, 26], [50, 88]], // punggung
    [[6, 82], [50, 92], [94, 82]], // tumpukan halaman
    [[8, 80], [50, 90], [92, 80]],
    [[16, 26], [44, 32]], // teks halaman kiri
    [[16, 35], [44, 41]],
    [[16, 44], [38, 49]],
    [[16, 53], [44, 59]],
    [[16, 62], [30, 66]],
    [[84, 26], [56, 32]], // teks halaman kanan
    [[84, 35], [56, 41]],
    [[84, 44], [62, 49]],
    [[84, 53], [56, 59]],
    busur(70, 68, 7, 0, 360, 22), // gambar kecil
    [[64, 29], [64, 52], [68, 47], [72, 52], [72, 30]], // pita penanda
  ],
};

const LAMPU: Bentuk = {
  garis: [
    busur(50, 34, 26, 130, 410), // kaca bohlam
    [[33.3, 53.9], [41, 66]],
    [[66.7, 53.9], [59, 66]],
    busur(50, 34, 19, 150, 250, 20), // kilau kaca
    busur(50, 34, 19, 290, 330, 12),
    [[44, 66], [44, 48], [47, 40], [50, 48], [53, 40], [56, 48], [56, 66]], // filamen
    [[41, 66], [59, 66]], // ulir
    [[41, 70], [59, 70]],
    [[41, 74], [59, 74]],
    [[41, 78], [59, 78]],
    [[41, 66], [41, 80]],
    [[59, 66], [59, 80]],
    [[44, 80], [56, 80], [54, 87], [46, 87], [44, 80]], // tutup bawah
    sinar(50, 34, -90, 33, 43),
    sinar(50, 34, -130, 33, 41),
    sinar(50, 34, -50, 33, 41),
    sinar(50, 34, -170, 33, 40),
    sinar(50, 34, -10, 33, 40),
    sinar(50, 34, 170, 33, 39),
    sinar(50, 34, 10, 33, 39),
  ],
  taburan: [[50, 34, 17, 22]],
};

function papanKetik(): Garis[] {
  const out: Garis[] = [];
  for (let b = 0; b < 3; b++) {
    for (let x = 18; x <= 80; x += 7) out.push([[x, 69.5 + b * 3.4], [x + 3.5, 69.5 + b * 3.4]]);
  }
  return out;
}

const LAPTOP: Bentuk = {
  garis: [
    [[18, 12], [82, 12], [82, 64], [18, 64], [18, 12]], // layar
    [[22, 16], [78, 16], [78, 60], [22, 60], [22, 16]], // bingkai dalam
    [[50, 13.6], [50.1, 13.6]], // kamera
    [[22, 23], [78, 23]], // bilah judul jendela
    [[25, 19.5], [25.2, 19.5]],
    [[29, 19.5], [29.2, 19.5]],
    [[33, 19.5], [33.2, 19.5]],
    [[26, 29], [44, 29]], // baris kode
    [[30, 35], [58, 35]],
    [[30, 41], [50, 41]],
    [[26, 47], [38, 47]],
    [[44, 47], [66, 47]],
    [[26, 53], [36, 53]],
    [[62, 28], [62, 56]], // panel samping
    [[10, 66], [90, 66]], // alas
    [[4, 82], [96, 82]],
    [[10, 66], [4, 82]],
    [[90, 66], [96, 82]],
    [[4, 82], [4, 86], [96, 86], [96, 82]],
    [[40, 82.8], [60, 82.8]], // takik
    ...papanKetik(),
  ],
};

/** Penempatan: pecahan lebar/tinggi kanvas, skala, kemiringan (derajat). Tak simetris sengaja. */
type Tempat = [Bentuk, number, number, number, number];
const TEMPAT_LEBAR: Tempat[] = [
  [PENSIL, 0.09, 0.2, 1.1, 14],
  [BUKU, 0.8, 0.17, 0.95, 8],
  [LAMPU, 0.2, 0.73, 0.9, -7],
  [LAPTOP, 0.85, 0.69, 1.1, -9],
  [BUKU, 0.045, 0.52, 0.5, -16],
  [PENSIL, 0.63, 0.9, 0.55, -34],
  [LAMPU, 0.93, 0.44, 0.5, 13],
  [LAPTOP, 0.4, 0.09, 0.42, 6],
];
const TEMPAT_PONSEL: Tempat[] = [
  [PENSIL, 0.17, 0.17, 1, 14],
  [BUKU, 0.8, 0.3, 0.85, -10],
  [LAMPU, 0.24, 0.8, 0.9, -8],
  [LAPTOP, 0.76, 0.88, 0.85, 6],
];

interface Bintang {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fase: number;
  kec: number;
  r: number;
  patah: number;
  // kemunculan
  cx: number;
  cy: number;
  jauh: number;
  putar: number;
  tunda: number;
  dur: number;
  selesai: boolean;
  /** Pengali kecerahan selama kemunculan (0..1, + kilatan >1). */
  muncul: number;
}

function baru(hx: number, hy: number, cx: number, cy: number, urut: number): Bintang {
  const jarakPusat = Math.hypot(hx - cx, hy - cy);
  return {
    hx,
    hy,
    x: hx,
    y: hy,
    vx: 0,
    vy: 0,
    fase: Math.random() * Math.PI * 2,
    kec: 0.0012 + Math.random() * 0.0028,
    r: 0.7 + Math.random() * 1.5,
    patah: 0,
    cx,
    cy,
    jauh: 2.4 + Math.random() * 3.6,
    putar: (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 2.4),
    tunda: urut * 380 + jarakPusat * 3 + Math.random() * 650,
    dur: 1700 + Math.random() * 1000,
    selesai: false,
    muncul: 0,
  };
}

function bintangDari(b: Bentuk, cx: number, cy: number, kotak: number, jarak: number, der: number, urut: number): Bintang[] {
  const k = kotak / 100;
  const ox = cx - kotak / 2;
  const oy = cy - kotak / 2;
  const garis = putar(b.garis, der);
  const out: Bintang[] = [];
  const tambah = (x: number, y: number) => out.push(baru(ox + x * k, oy + y * k, cx, cy, urut));

  for (const g of garis) {
    let sisa = 0;
    for (let i = 0; i < g.length - 1; i++) {
      const [x0, y0] = g[i];
      const [x1, y1] = g[i + 1];
      const pj = Math.hypot(x1 - x0, y1 - y0) * k;
      if (pj < 0.01) {
        tambah(x0, y0); // titik tunggal (kamera, kancing)
        continue;
      }
      let d = sisa;
      while (d <= pj) {
        const t = d / pj;
        tambah(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        d += jarak;
      }
      sisa = d - pj;
    }
  }

  // Taburan di dalam lingkaran (cahaya bohlam)
  for (const [tx, ty, tr, n] of b.taburan ?? []) {
    const [rx, ry] = putarTitik(tx, ty, der);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = tr * Math.sqrt(Math.random());
      tambah(rx + rr * Math.cos(a), ry + rr * Math.sin(a));
    }
  }
  return out;
}

/** Jitter tetap seumur komponen (tak berubah saat ukuran jendela berubah). */
interface Jitter {
  dx: number;
  dy: number;
  der: number;
}

function susun(w: number, h: number, jitter: Jitter[]): Bintang[] {
  const ponsel = w < 700;
  const kotak = ponsel ? Math.min(w * 0.3, 118) : Math.min(w * 0.2, h * 0.34, 260);
  const jarak = ponsel ? 7.5 : 9;
  const tempat = ponsel ? TEMPAT_PONSEL : TEMPAT_LEBAR;

  const out = tempat.flatMap(([b, fx, fy, skala, der], i) => {
    const j = jitter[i % jitter.length] ?? { dx: 0, dy: 0, der: 0 };
    return bintangDari(b, w * (fx + j.dx), h * (fy + j.dy), kotak * skala, jarak * Math.max(0.8, skala), der + j.der, i);
  });

  // Debu bintang: titik kecil acak di seluruh latar, ikut berkedip & terhambur.
  const debu = ponsel ? 36 : 90;
  for (let i = 0; i < debu; i++) {
    const p = baru(Math.random() * w, Math.random() * h, w / 2, h / 2, Math.floor(Math.random() * tempat.length));
    p.r = 0.5 + Math.random() * 0.9;
    out.push(p);
  }
  return out;
}

const PEGAS = 0.0065;
const REDAM = 0.93;
const lembut = (u: number) => 1 - Math.pow(1 - u, 4);

export default function HeroStars({ mulai }: { mulai: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const t0Ref = useRef<number | null>(null);
  // Diundi di dalam efek (bukan saat render), seumur komponen.
  const jitter = useRef<Jitter[]>([]);

  // Hero baru boleh beranimasi sesudah splash loader: catat saat dimulainya.
  useEffect(() => {
    if (mulai && t0Ref.current === null) t0Ref.current = performance.now();
  }, [mulai]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    jitter.current = Array.from({ length: 8 }, () => ({
      dx: (Math.random() - 0.5) * 0.05,
      dy: (Math.random() - 0.5) * 0.06,
      der: (Math.random() - 0.5) * 14,
    }));

    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let bintang: Bintang[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let tampak = true;
    let warna: [number, number, number] = [200, 220, 255];
    let hitungWarna = 0;
    const ptr = { x: 0, y: 0, aktif: false, R: 90, ledakan: 0 };

    const bacaWarna = () => {
      // Warna bintang = warna teks kanvas (text-blue-300) → ikut tema terang/gelap.
      const m = getComputedStyle(canvas).color.match(/\d+(\.\d+)?/g);
      if (m && m.length >= 3) warna = [Number(m[0]), Number(m[1]), Number(m[2])];
    };

    const gambar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const [r, g, b] = warna;
      for (const p of bintang) {
        if (p.muncul <= 0.01) continue;
        // Berkedip: tiap bintang punya fase & kecepatan sendiri. Hanya titik bulat - tanpa kilau silang (+).
        const kedip = hemat ? 0.75 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.kec + p.fase));
        const a = Math.min(1, kedip * Math.min(1, p.muncul) + p.patah * 0.25 + Math.max(0, p.muncul - 1));
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.85 + a * 0.4), 0, Math.PI * 2);
        ctx.fill();

      }
    };

    const ukur = () => {
      const rc = canvas.getBoundingClientRect();
      w = rc.width;
      h = rc.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bintang = susun(w, h, jitter.current);
      // Setelah ukuran berubah (kemunculan sudah jalan), bentuk langsung utuh.
      if (t0Ref.current !== null || hemat) {
        for (const p of bintang) {
          p.selesai = true;
          p.muncul = 1;
        }
      }
      bacaWarna();
      if (hemat) gambar(0);
    };

    const langkah = (t: number) => {
      raf = requestAnimationFrame(langkah);
      if (!tampak || document.hidden) return;
      if (++hitungWarna % 90 === 0) bacaWarna();

      const t0 = t0Ref.current;
      if (t0 === null) {
        ctx.clearRect(0, 0, w, h); // menunggu splash loader selesai
        return;
      }
      const sekarang = performance.now();

      const R = ptr.R * (ptr.ledakan > 0 ? 1.9 : 1);
      for (const p of bintang) {
        if (!p.selesai) {
          // KEMUNCULAN: melesat spiral dari jauh ke titik asal, membesar-terang lalu mengendap.
          const u = Math.min(1, Math.max(0, (sekarang - t0 - p.tunda) / p.dur));
          if (u <= 0) {
            p.muncul = 0;
            continue;
          }
          const e = lembut(u);
          const faktor = 1 + (p.jauh - 1) * (1 - e);
          const sudut = p.putar * (1 - e);
          const c = Math.cos(sudut);
          const s = Math.sin(sudut);
          const vx = (p.hx - p.cx) * faktor;
          const vy = (p.hy - p.cy) * faktor;
          p.x = p.cx + vx * c - vy * s;
          p.y = p.cy + vx * s + vy * c;
          // 0 → 1 cepat, ditambah kilatan terang (>1) di tengah perjalanan.
          p.muncul = Math.min(1, u * 2) + Math.sin(Math.PI * u) * 0.55;
          if (u >= 1) {
            p.selesai = true;
            p.x = p.hx;
            p.y = p.hy;
            p.vx = 0;
            p.vy = 0;
            p.muncul = 1;
          }
          continue;
        }

        if (ptr.aktif) {
          const dx = p.x - ptr.x;
          const dy = p.y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d / R;
            const kuat = (ptr.ledakan > 0 ? 11 : 6) * f + 2;
            // Terpental menjauh + acak: "hancur dan terpencar".
            p.vx += (dx / d) * kuat + (Math.random() - 0.5) * 3.2;
            p.vy += (dy / d) * kuat + (Math.random() - 0.5) * 3.2;
            p.patah = 1;
          }
        }
        // Pegas pulang melemah selama masih "patah": serpihan sempat berkeliaran dulu.
        const k = PEGAS * (1 - p.patah * 0.8);
        p.vx += (p.hx - p.x) * k;
        p.vy += (p.hy - p.y) * k;
        p.vx *= REDAM;
        p.vy *= REDAM;
        p.x += p.vx;
        p.y += p.vy;
        p.patah *= 0.992;
      }
      if (ptr.ledakan > 0) ptr.ledakan -= 1;
      gambar(t);
    };

    const gerak = (e: PointerEvent) => {
      const rc = canvas.getBoundingClientRect();
      const x = e.clientX - rc.left;
      const y = e.clientY - rc.top;
      ptr.aktif = x >= -40 && y >= -40 && x <= rc.width + 40 && y <= rc.height + 40;
      ptr.x = x;
      ptr.y = y;
      ptr.R = e.pointerType === "touch" ? 110 : 90;
    };
    const turun = (e: PointerEvent) => {
      gerak(e);
      if (ptr.aktif) ptr.ledakan = 6;
    };
    const lepas = (e: PointerEvent) => {
      if (e.pointerType === "touch") ptr.aktif = false;
    };
    const keluar = () => {
      ptr.aktif = false;
    };

    ukur();

    const ro = new ResizeObserver(ukur);
    ro.observe(canvas);

    if (!hemat) {
      const io = new IntersectionObserver(([en]) => (tampak = en.isIntersecting), { threshold: 0 });
      io.observe(canvas);
      window.addEventListener("pointermove", gerak, { passive: true });
      window.addEventListener("pointerdown", turun, { passive: true });
      window.addEventListener("pointerup", lepas, { passive: true });
      window.addEventListener("pointercancel", lepas, { passive: true });
      document.addEventListener("pointerleave", keluar);
      raf = requestAnimationFrame(langkah);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", gerak);
        window.removeEventListener("pointerdown", turun);
        window.removeEventListener("pointerup", lepas);
        window.removeEventListener("pointercancel", lepas);
        document.removeEventListener("pointerleave", keluar);
      };
    }

    return () => ro.disconnect();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full text-blue-300" />;
}
