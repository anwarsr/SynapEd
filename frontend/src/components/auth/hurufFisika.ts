/**
 * Fisika sederhana untuk huruf-huruf `.grav-h` di panel Masuk/Daftar.
 *
 * Tiap huruf jadi lingkaran yang jatuh ke dasar kotaknya: huruf judul &
 * kalimat ke dasar panel (dengan tombol sebagai pijakan), huruf di dalam
 * tombol ke tepi bawah tombol. Panel yang meluncur memberi gaya semu pada
 * huruf (diukur dari percepatan posisi panel), jadi tumpukan huruf ikut
 * bergelinding. Huruf bisa diseret & dilempar. Posisi ditulis langsung ke
 * `transform` (tanpa render React per bingkai); tata letak asli tidak berubah.
 *
 * Tidak disimpan ke mana pun: muat ulang halaman = semua kembali normal.
 */

type Ruang = "panel" | "tombol";

type Badan = {
  el: HTMLElement;
  hx: number; // pusat asal, koordinat lokal panel
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  r: number;
  ruang: Ruang;
  asal: Ruang;
  /** Waktu (ms sejak mulai) huruf ini lepas dari tempatnya; sebelum itu ia diam & bergetar. */
  lepas: number;
  lepasLah: boolean;
};

const GRAVITASI = 2400; // px/dtk²
const LEMPAR_MAKS = 3200; // px/dtk
const SUB = 2;

const jepit = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function mulaiFisika(panel: HTMLElement, tombol: HTMLElement | null, ketukTombol: () => void): () => void {
  let pr = panel.getBoundingClientRect();
  const lokal = (r: DOMRect) => ({ x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height });
  let kt = tombol ? lokal(tombol.getBoundingClientRect()) : null;

  const badan: Badan[] = Array.from(panel.querySelectorAll<HTMLElement>(".grav-h")).map((el) => {
    const b = lokal(el.getBoundingClientRect());
    const ruang: Ruang = tombol && tombol.contains(el) ? "tombol" : "panel";
    return {
      el,
      hx: b.x + b.w / 2,
      hy: b.y + b.h / 2,
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
      vx: 0,
      vy: 0,
      a: 0,
      va: 0,
      // Lingkaran lebih ramping dari kotak huruf: huruf tinggi tak jadi bola raksasa.
      r: Math.max(4, Math.max(b.w, b.h * 0.55) / 2),
      ruang,
      asal: ruang,
      lepas: 0,
      lepasLah: false,
    };
  });

  // Huruf tidak runtuh serempak: satu per satu dalam urutan acak, dimulai dari
  // getar kecil lalu terlepas - seperti benda yang dicopot satu demi satu.
  const urutan = badan.map((_, i) => i);
  for (let i = urutan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urutan[i], urutan[j]] = [urutan[j], urutan[i]];
  }
  const rentang = Math.min(2800, badan.length * 55);
  urutan.forEach((idx, k) => {
    badan[idx].lepas = 250 + (k / Math.max(1, badan.length - 1)) * rentang + Math.random() * 120;
  });
  const mulaiMs = performance.now();

  let seret: {
    b: Badan;
    id: number;
    dx: number;
    dy: number;
    x0: number;
    y0: number;
    bergerak: boolean;
    jejak: { t: number; x: number; y: number }[];
  } | null = null;

  let raf = 0;
  let terakhir = performance.now();
  let prevKiri = pr.left;
  let prevV = 0;

  const langkah = (t: number) => {
    raf = requestAnimationFrame(langkah);
    const dt = Math.min(0.033, (t - terakhir) / 1000);
    terakhir = t;
    if (dt <= 0) return;

    // Baca semua ukuran dulu, baru tulis transform (hindari layout berulang).
    pr = panel.getBoundingClientRect();
    if (tombol) kt = lokal(tombol.getBoundingClientRect());
    const v = (pr.left - prevKiri) / dt;
    // Panel dipercepat ke kanan → huruf terasa terdorong ke kiri (gaya semu).
    const ax = jepit(-((v - prevV) / dt), -14000, 14000);
    prevKiri = pr.left;
    prevV = v;

    const W = pr.width;
    const H = pr.height;
    const h = dt / SUB;

    for (let s = 0; s < SUB; s++) {
      for (const b of badan) {
        if (seret?.b === b) continue;
        if (!b.lepasLah) {
          const sisa = b.lepas - (t - mulaiMs);
          if (sisa > 0) {
            // Getar halus beberapa saat sebelum terlepas.
            b.a = sisa < 260 ? Math.sin(t / 22 + b.hx) * 0.07 * (1 - sisa / 260) : 0;
            continue;
          }
          b.lepasLah = true;
          b.va = (Math.random() - 0.5) * 2;
          b.vx = (Math.random() - 0.5) * 60;
        }
        b.vy += GRAVITASI * h;
        b.vx += ax * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.a += b.va * h;
        b.va *= 0.995;

        let kiri = b.r;
        let kanan = W - b.r;
        let lantai = H - b.r;
        let atap = b.r;
        if (b.ruang === "tombol" && kt) {
          kiri = kt.x + 1 + b.r;
          kanan = kt.x + kt.w - 1 - b.r;
          lantai = kt.y + kt.h - 1 - b.r;
          atap = kt.y + 1 + b.r;
        }
        let kontak = false;
        if (b.y > lantai) {
          b.y = lantai;
          if (b.vy > 0) b.vy = b.vy < 90 ? 0 : -b.vy * 0.35;
          kontak = true;
        }
        if (b.y < atap) {
          b.y = atap;
          if (b.vy < 0) b.vy = -b.vy * 0.3;
        }
        if (b.x < kiri) {
          b.x = kiri;
          if (b.vx < 0) b.vx = -b.vx * 0.4;
        } else if (b.x > kanan) {
          b.x = kanan;
          if (b.vx > 0) b.vx = -b.vx * 0.4;
        }

        // Tombol = pijakan bagi huruf yang ada di luarnya.
        if (b.ruang === "panel" && kt) {
          const cx = jepit(b.x, kt.x, kt.x + kt.w);
          const cy = jepit(b.y, kt.y, kt.y + kt.h);
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 === 0) {
            b.y = kt.y - b.r;
            b.vy = 0;
            kontak = true;
          } else if (d2 < b.r * b.r) {
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            b.x += nx * (b.r - d);
            b.y += ny * (b.r - d);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              b.vx -= 1.3 * vn * nx;
              b.vy -= 1.3 * vn * ny;
            }
            if (ny < -0.5) kontak = true;
          }
        }

        if (kontak) {
          // Menggelinding: putaran mengejar kecepatan alas, geseknya meredam.
          b.va += (b.vx / b.r - b.va) * Math.min(1, 12 * h);
          b.vx *= 1 - Math.min(0.5, 2.2 * h);
        }
      }

      // Tumbukan antar huruf (massa sama).
      for (let i = 0; i < badan.length; i++) {
        const p = badan[i];
        for (let j = i + 1; j < badan.length; j++) {
          const q = badan[j];
          if (p.ruang !== q.ruang) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const min = p.r + q.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const tembus = min - d;
          const pTetap = seret?.b === p || !p.lepasLah;
          const qTetap = seret?.b === q || !q.lepasLah;
          const bagP = pTetap ? 0 : qTetap ? 1 : 0.5;
          const bagQ = qTetap ? 0 : pTetap ? 1 : 0.5;
          p.x -= nx * tembus * bagP;
          p.y -= ny * tembus * bagP;
          q.x += nx * tembus * bagQ;
          q.y += ny * tembus * bagQ;
          const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (vn < 0) {
            const j2 = -(1 + 0.25) * vn;
            if (!pTetap) {
              p.vx -= j2 * bagP * nx;
              p.vy -= j2 * bagP * ny;
            }
            if (!qTetap) {
              q.vx += j2 * bagQ * nx;
              q.vy += j2 * bagQ * ny;
            }
          }
        }
      }
    }

    for (const b of badan) {
      b.el.style.transform = `translate(${(b.x - b.hx).toFixed(2)}px, ${(b.y - b.hy).toFixed(2)}px) rotate(${b.a.toFixed(3)}rad)`;
    }
  };
  raf = requestAnimationFrame(langkah);

  const titik = (e: PointerEvent) => ({ x: e.clientX - pr.left, y: e.clientY - pr.top });

  const turun = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".grav-h");
    const b = el ? badan.find((k) => k.el === el) : undefined;
    if (!b) return;
    e.preventDefault();
    pr = panel.getBoundingClientRect();
    const p = titik(e);
    panel.setPointerCapture(e.pointerId);
    b.vx = 0;
    b.vy = 0;
    b.lepasLah = true; // digenggam sebelum gilirannya: langsung dianggap lepas
    seret = { b, id: e.pointerId, dx: b.x - p.x, dy: b.y - p.y, x0: p.x, y0: p.y, bergerak: false, jejak: [] };
  };

  const gerak = (e: PointerEvent) => {
    if (!seret || e.pointerId !== seret.id) return;
    const p = titik(e);
    const b = seret.b;
    b.x = jepit(p.x + seret.dx, b.r, pr.width - b.r);
    b.y = jepit(p.y + seret.dy, b.r, pr.height - b.r);
    if (Math.hypot(p.x - seret.x0, p.y - seret.y0) > 5) seret.bergerak = true;
    const now = performance.now();
    seret.jejak.push({ t: now, x: b.x, y: b.y });
    while (seret.jejak.length > 2 && now - seret.jejak[0].t > 110) seret.jejak.shift();
  };

  const lepas = (e: PointerEvent) => {
    if (!seret || e.pointerId !== seret.id) return;
    const { b, bergerak, jejak } = seret;
    seret = null;
    if (panel.hasPointerCapture(e.pointerId)) panel.releasePointerCapture(e.pointerId);
    if (!bergerak) {
      // Sentuhan singkat pada huruf tombol = menekan tombolnya.
      if (b.asal === "tombol") ketukTombol();
      return;
    }
    const a = jejak[0];
    const z = jejak[jejak.length - 1];
    const dtj = (z.t - a.t) / 1000;
    if (dtj > 0.005 && performance.now() - z.t < 80) {
      b.vx = jepit((z.x - a.x) / dtj, -LEMPAR_MAKS, LEMPAR_MAKS);
      b.vy = jepit((z.y - a.y) / dtj, -LEMPAR_MAKS, LEMPAR_MAKS);
      b.va = b.vx / b.r / 3;
    }
    // Huruf yang pernah dilempar tak lagi terkurung di dalam tombol.
    b.ruang = "panel";
  };

  const ubahUkuran = () => {
    pr = panel.getBoundingClientRect();
  };

  panel.addEventListener("pointerdown", turun);
  panel.addEventListener("pointermove", gerak);
  panel.addEventListener("pointerup", lepas);
  panel.addEventListener("pointercancel", lepas);
  window.addEventListener("resize", ubahUkuran);

  return () => {
    cancelAnimationFrame(raf);
    panel.removeEventListener("pointerdown", turun);
    panel.removeEventListener("pointermove", gerak);
    panel.removeEventListener("pointerup", lepas);
    panel.removeEventListener("pointercancel", lepas);
    window.removeEventListener("resize", ubahUkuran);
  };
}
