/**
 * Gambar bola untuk game "Bola Gabung": tiap tingkat adalah JENIS bola sungguhan (kelereng sampai bola dunia). Rujukannya foto bola
 * asli (bisbol: dua garis jahitan merah berbentuk V di sepanjang kurva jahitan; tenis: kain kuning-hijau berbulu dengan satu
 * jahitan putih; bola pantai: panel merah/putih/biru/kuning bertemu di tutup putih; voli: jalur putih-biru-kuning yang melengkung;
 * sepak: pentagon hitam dan segi enam putih; dst).
 *
 * Caranya bukan menempel gambar datar ke lingkaran, melainkan PEMETAAN BOLA: tiap piksel cakram dipetakan ke titik di permukaan bola
 * (arah pandang = sumbu z), lalu warnanya dihitung dari titik itu (jahitan 3D, lekuk golf, benua bumi, dst), jadi corak melengkung &
 * menyempit di tepi seperti bola betulan. Bola yang menggelinding di layar berputar pada sumbu pandang, jadi cukup memutar gambar
 * corak. Cahaya (bayangan, tepi gelap, kilap) dipanggang terpisah dan TIDAK ikut berputar. Sprite dibuat sekali per jenis.
 * Hanya tampilan: fisikanya tetap lingkaran (bolaFisika.ts).
 */

type V3 = [number, number, number];
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sm = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hx = (s: string): V3 => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const campur = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const kali = (a: V3, f: number): V3 => [a[0] * f, a[1] * f, a[2] * f];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const jarak2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const silang = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Derau nilai 3D (dasar fbm). */
function h3(x: number, y: number, z: number): number {
  // hash bilangan bulat (bukan sin): sin berpola cincin pada lattice kecil
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function derau(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
function fbm(x: number, y: number, z: number, oktaf = 4): number {
  let jum = 0;
  let amp = 0.5;
  let f = 1;
  let tot = 0;
  for (let i = 0; i < oktaf; i++) {
    jum += amp * derau(x * f, y * f, z * f);
    tot += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return jum / tot;
}

/** Putar titik di sekitar sumbu x lalu y: mengarahkan bola agar coraknya tampak dari sudut yang enak. */
function miring(p: V3, ax: number, ay: number): V3 {
  const cy = Math.cos(ax);
  const sy = Math.sin(ax);
  const y1 = p[1] * cy - p[2] * sy;
  const z1 = p[1] * sy + p[2] * cy;
  const cx = Math.cos(ay);
  const sx = Math.sin(ay);
  return [p[0] * cx + z1 * sx, y1, -p[0] * sx + z1 * cx];
}

/** Kurva jahitan bisbol/tenis (kurva "tennis ball"): satu kurva tertutup di permukaan bola satuan. */
function kurvaJahitan(k: number, n: number): V3[] {
  const hasil: V3[] = [];
  const zk = 2 * Math.sqrt(k * (1 - k));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    hasil.push([(1 - k) * Math.cos(t) + k * Math.cos(3 * t), (1 - k) * Math.sin(t) - k * Math.sin(3 * t), zk * Math.sin(2 * t)]);
  }
  return hasil;
}

function titikKeRuas(p: V3, a: V3, b: V3): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz || 1;
  const t = clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / l2);
  const dx = a[0] + abx * t - p[0];
  const dy = a[1] + aby * t - p[1];
  const dz = a[2] + abz * t - p[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Derau berlapis 2D (dari derau 3D di titik tetap) untuk variasi warna kulit. */
function fbm2d(x: number, y: number, oktaf = 3): number {
  return fbm(x, y, 7.3, oktaf);
}

interface Jenis {
  /** Warna dasar corak di titik O (koordinat benda, setelah dimiringkan). */
  warna: (o: V3) => V3;
  miring: [number, number];
  /** Kilap: kekuatan & kekerasan sorot. */
  kilap: [number, number];
}

function buatJenis(n: number): Jenis {
  switch (n) {
    case 0: {
      // kelereng kaca: tiga sirip warna di dalam kaca bening kehijauan
      const dasar = hx("#2E9FB0");
      const putih = hx("#EAF4EE");
      const biru = hx("#17588C");
      return {
        miring: [0.5, 0.7],
        kilap: [0.95, 70],
        warna: (o) => {
          const phi = Math.atan2(o[0], o[2]);
          const v1 = Math.sin(3 * phi + 2.4 * o[1]);
          const v2 = Math.sin(3 * phi + 2.4 * o[1] + 2.1);
          let c = campur(dasar, hx("#52C1CC"), fbm(o[0] * 2, o[1] * 2, o[2] * 2) * 0.8);
          c = campur(c, putih, sm(0.5, 0.92, v1) * 0.92);
          c = campur(c, biru, sm(0.82, 0.98, v2) * 0.9);
          return c;
        },
      };
    }
    case 1: {
      // bola pingpong: oranye, jahitan tipis melingkar, cap lingkaran
      const oranye = hx("#F28C28");
      const logo = norm([0.3, 0.25, 0.92]);
      return {
        miring: [0.35, 0.45],
        kilap: [0.55, 40],
        warna: (o) => {
          let c = campur(oranye, hx("#F5A04A"), fbm(o[0] * 3, o[1] * 3, o[2] * 3, 2) * 0.35);
          c = kali(c, 1 - 0.14 * (1 - sm(0.004, 0.02, Math.abs(o[1]))));
          const a = Math.acos(clamp(dot(o, logo), -1, 1));
          const ring = 1 - sm(0.014, 0.03, Math.abs(a - 0.24));
          const titik = 1 - sm(0.03, 0.05, a);
          return campur(c, hx("#8A4A14"), Math.max(ring, titik * 0.8) * 0.55);
        },
      };
    }
    case 2: {
      // bola golf: lekukan di permukaan
      const pusat: V3[] = [];
      const N = 300;
      for (let i = 0; i < N; i++) {
        const y = 1 - (2 * (i + 0.5)) / N;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.399963;
        pusat.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      return {
        miring: [0.3, 0.5],
        kilap: [0.35, 30],
        warna: (o) => {
          let dMin = 9;
          for (const q of pusat) {
            const d = jarak2(o, q);
            if (d < dMin) dMin = d;
          }
          const d = Math.sqrt(dMin);
          const lekuk = 1 - sm(0.045, 0.09, d);
          return kali(campur(hx("#F5F3EC"), hx("#E4E1D8"), 0.3), 1 - 0.13 * lekuk);
        },
      };
    }
    case 3: {
      // bola tenis: kain berbulu kuning-hijau, satu jahitan putih berkelok
      const kurva = kurvaJahitan(0.3, 360);
      return {
        miring: [0.45, 0.3],
        kilap: [0, 1],
        warna: (o) => {
          const bulu = derau(o[0] * 46, o[1] * 46, o[2] * 46);
          let c = campur(hx("#C4D433"), hx("#DCE84C"), fbm(o[0] * 5, o[1] * 5, o[2] * 5, 3));
          c = kali(c, 0.93 + bulu * 0.14);
          let d = 9;
          for (const q of kurva) {
            const dd = jarak2(o, q);
            if (dd < d) d = dd;
          }
          d = Math.sqrt(d);
          const jahit = 1 - sm(0.045, 0.075, d);
          const putih = kali(hx("#F2F1E2"), 0.92 + bulu * 0.12);
          // bayangan lipatan di tepi jahitan
          const lipat = sm(0.05, 0.085, d) * (1 - sm(0.085, 0.12, d));
          return campur(kali(c, 1 - 0.1 * lipat), putih, jahit);
        },
      };
    }
    case 4: {
      // bola bisbol: kulit krem, jahitan merah berbentuk V di sepanjang kurva
      const kurva = kurvaJahitan(0.27, 480);
      const ruas: [V3, V3][] = [];
      const M = 54;
      const tebalNaik = 0.032;
      for (let i = 0; i < M; i++) {
        const t = (i / M) * TAU + 0.03;
        const zk = 2 * Math.sqrt(0.27 * 0.73);
        const f = (tt: number): V3 => [0.73 * Math.cos(tt) + 0.27 * Math.cos(3 * tt), 0.73 * Math.sin(tt) - 0.27 * Math.sin(3 * tt), zk * Math.sin(2 * tt)];
        const p = f(t);
        const tan = norm([f(t + 0.01)[0] - f(t - 0.01)[0], f(t + 0.01)[1] - f(t - 0.01)[1], f(t + 0.01)[2] - f(t - 0.01)[2]]);
        const nor = norm(silang(p, tan));
        const lebar = 0.09;
        const maju = tebalNaik * 1.4;
        const a: V3 = [p[0] + nor[0] * lebar + tan[0] * maju, p[1] + nor[1] * lebar + tan[1] * maju, p[2] + nor[2] * lebar + tan[2] * maju];
        const b: V3 = [p[0] - nor[0] * lebar + tan[0] * maju, p[1] - nor[1] * lebar + tan[1] * maju, p[2] - nor[2] * lebar + tan[2] * maju];
        ruas.push([a, p], [b, p]);
      }
      return {
        miring: [0.55, 0.35],
        kilap: [0.25, 24],
        warna: (o) => {
          let c = campur(hx("#EFE7D4"), hx("#F6F1E4"), fbm(o[0] * 4, o[1] * 4, o[2] * 4, 3));
          let d = 9;
          for (const q of kurva) {
            const dd = jarak2(o, q);
            if (dd < d) d = dd;
          }
          d = Math.sqrt(d);
          // alur jahitan sedikit lebih gelap
          c = kali(c, 1 - 0.1 * (1 - sm(0.02, 0.12, d)));
          if (d < 0.17) {
            let m = 9;
            for (const [a, b] of ruas) {
              const dd = titikKeRuas(o, a, b);
              if (dd < m) m = dd;
            }
            const benang = 1 - sm(0.014, 0.024, m);
            c = campur(c, hx("#BF2E24"), benang);
          }
          return c;
        },
      };
    }
    case 5: {
      // bola bowling: resin biru tua berpusar, tiga lubang jari
      const arah = norm([0.12, -0.48, 0.87]);
      const t1 = norm(silang(arah, [1, 0, 0]));
      const t2 = norm(silang(arah, t1));
      const lubang: V3[] = [
        [arah[0] + t1[0] * -0.08 + t2[0] * -0.05, arah[1] + t1[1] * -0.08 + t2[1] * -0.05, arah[2] + t1[2] * -0.08 + t2[2] * -0.05],
        [arah[0] + t1[0] * 0.08 + t2[0] * -0.05, arah[1] + t1[1] * 0.08 + t2[1] * -0.05, arah[2] + t1[2] * 0.08 + t2[2] * -0.05],
        [arah[0] + t2[0] * 0.1, arah[1] + t2[1] * 0.1, arah[2] + t2[2] * 0.1],
      ].map((q) => norm(q as V3));
      return {
        miring: [0.15, 0.5],
        kilap: [1, 90],
        warna: (o) => {
          const w = fbm(o[0] * 1.6, o[1] * 1.6, o[2] * 1.6, 3);
          const s = Math.sin(7 * (o[0] * 0.8 + o[1] * 0.4) + 6 * w);
          let c = campur(hx("#0E1A52"), hx("#3552BE"), sm(-0.4, 0.95, s));
          c = campur(c, hx("#070A22"), sm(0.55, 0.9, fbm(o[0] * 3 + 4, o[1] * 3, o[2] * 3, 3)) * 0.5);
          for (const q of lubang) {
            const d = Math.sqrt(jarak2(o, q));
            c = campur(c, hx("#04050C"), 1 - sm(0.058, 0.074, d));
          }
          return c;
        },
      };
    }
    case 6: {
      // bola voli: jalur putih-biru-kuning yang melengkung
      const putih = hx("#F6F1E0");
      const kuning = hx("#F0BE1C");
      const biru = hx("#2B66B3");
      return {
        miring: [0.35, 0.55],
        kilap: [0.55, 38],
        warna: (o) => {
          const phi = Math.atan2(o[0], o[2]) + 0.38 * o[1];
          const u = (phi / TAU + 0.5) * 18;
          const idx = ((Math.floor(u) % 18) + 18) % 18;
          const frac = u - Math.floor(u);
          let c = idx % 3 === 0 ? putih : idx % 3 === 1 ? biru : kuning;
          if (Math.abs(o[1]) > 0.9) c = putih;
          const tepi = Math.min(frac, 1 - frac);
          const jahit = (1 - sm(0.018, 0.05, tepi)) * (1 - sm(0.88, 0.9, Math.abs(o[1])));
          c = campur(c, hx("#3A3350"), jahit * 0.5);
          return kali(c, 0.97 + derau(o[0] * 30, o[1] * 30, o[2] * 30) * 0.05);
        },
      };
    }
    case 7: {
      // bola basket: kulit karet oranye berbintik (butir timbul), satu garis tengah melingkar, satu garis tegak, dan dua garis
      // lengkung "( )" di kiri-kanan; alur hitam sedikit masuk dengan tepi gelap
      const sudut = 0.62;
      const nKiri: V3 = [Math.cos(sudut), 0, Math.sin(sudut)];
      const nKanan: V3 = [-Math.cos(sudut), 0, Math.sin(sudut)];
      const jarakBidang = (o: V3, n: V3, d: number) => Math.abs(dot(o, n) - d);
      return {
        miring: [0.14, 0.22],
        kilap: [0.35, 26],
        warna: (o) => {
          // butir: bintik-bintik kecil rapat, tiap butir sedikit terang di tengah dan gelap di tepinya
          const bt = derau(o[0] * 150, o[1] * 150, o[2] * 150) * 0.6 + derau(o[2] * 150 + 5, o[0] * 150 + 3, o[1] * 150 + 9) * 0.4;
          let c = campur(hx("#BF4F17"), hx("#E0722B"), fbm2d(o[0] * 3 + o[2], o[1] * 3, 3));
          c = kali(c, 0.8 + bt * 0.42);
          const g = Math.min(
            Math.abs(o[1]),
            Math.abs(o[0]),
            jarakBidang(o, nKiri, 0.1),
            jarakBidang(o, nKanan, 0.1),
          );
          const alur = 1 - sm(0.02, 0.034, g);
          const bayang = sm(0.03, 0.05, g) * (1 - sm(0.05, 0.085, g));
          c = kali(c, 1 - 0.28 * bayang);
          return campur(c, hx("#14100E"), alur);
        },
      };
    }
    case 8: {
      // bola sepak: 12 pentagon hitam (dibatasi sisi lurus) dikelilingi 20 segi enam putih; tiap panel sedikit menggembung
      const fi = (1 + Math.sqrt(5)) / 2;
      const vertex: V3[] = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) vertex.push(norm([0, a, b * fi]), norm([a, b * fi, 0]), norm([b * fi, 0, a]));
      const wajah: V3[] = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) wajah.push(norm([a, b, c]));
      for (const a of [-1, 1]) for (const b of [-1, 1]) wajah.push(norm([0, a / fi, b * fi]), norm([a / fi, b * fi, 0]), norm([b * fi, 0, a / fi]));
      // untuk tiap pentagon: lima bidang sisinya (ke arah lima segi enam tetangga), pada jarak sudut apotema 0,288 rad
      const APOTEMA = 0.288;
      const sisi = vertex.map((c) => {
        const tetangga = wajah
          .map((h) => ({ h, d: dot(h, c) }))
          .sort((x, y) => y.d - x.d)
          .slice(0, 5)
          .map(({ h }) => {
            const t = norm([h[0] - dot(h, c) * c[0], h[1] - dot(h, c) * c[1], h[2] - dot(h, c) * c[2]]);
            const q: V3 = [c[0] * Math.cos(APOTEMA) + t[0] * Math.sin(APOTEMA), c[1] * Math.cos(APOTEMA) + t[1] * Math.sin(APOTEMA), c[2] * Math.cos(APOTEMA) + t[2] * Math.sin(APOTEMA)];
            return { u: t, ambang: dot(q, t) };
          });
        return tetangga;
      });
      return {
        miring: [0.5, 0.4],
        kilap: [0.6, 44],
        warna: (o) => {
          let dv = -2;
          let iv = 0;
          for (let i = 0; i < vertex.length; i++) {
            const d = dot(o, vertex[i]);
            if (d > dv) {
              dv = d;
              iv = i;
            }
          }
          // margin ke sisi pentagon terdekat (negatif = di dalam pentagon)
          let margin = 9;
          for (const f of sisi[iv]) margin = Math.min(margin, f.ambang - dot(o, f.u));
          const dalam = dv > 0.9 && margin > 0;
          // segi enam: sel Voronoi dari 20 pusatnya (garis antar-segi-enam)
          let d1 = -2;
          let d2 = -2;
          let iw = 0;
          for (let i = 0; i < wajah.length; i++) {
            const d = dot(o, wajah[i]);
            if (d > d1) {
              d2 = d1;
              d1 = d;
              iw = i;
            } else if (d > d2) d2 = d;
          }
          const gembung = 1 - 0.12 * Math.pow(Math.acos(clamp(d1, -1, 1)) / 0.45, 2);
          let c: V3;
          if (dalam) {
            c = campur(hx("#0F0D14"), hx("#1B1922"), derau(o[0] * 40, o[1] * 40, o[2] * 40) * 0.5);
          } else {
            c = campur(hx("#F6F4EE"), hx("#ECE9E0"), h3(iw, 5, 1) * 0.8);
            c = kali(c, gembung);
          }
          // jahitan: tepi pentagon + garis antar segi enam (hanya di luar pentagon)
          const jahitPenta = 1 - sm(0.008, 0.022, Math.abs(margin));
          const jahitHex = dalam ? 0 : 1 - sm(0.005, 0.02, d1 - d2);
          const garis = Math.max(jahitPenta * (dv > 0.9 ? 1 : 0), jahitHex);
          return campur(c, hx("#34313F"), garis * 0.92);
        },
      };
    }
    case 9: {
      // bola pantai: enam panel bertemu di tutup putih
      const warna = [hx("#D8372C"), hx("#F6F1E2"), hx("#2C68B5"), hx("#F6F1E2"), hx("#F1C227"), hx("#F6F1E2")];
      return {
        miring: [0.85, 0.3],
        kilap: [0.55, 34],
        warna: (o) => {
          const phi = Math.atan2(o[0], o[2]);
          const u = (phi / TAU + 0.5) * 6;
          const idx = ((Math.floor(u) % 6) + 6) % 6;
          const frac = u - Math.floor(u);
          let c = warna[idx];
          const kutub = Math.abs(o[1]);
          if (kutub > 0.93) c = warna[1];
          const tepi = Math.min(frac, 1 - frac) * Math.max(0.15, Math.sqrt(1 - o[1] * o[1]));
          c = campur(c, hx("#3A3350"), (1 - sm(0.006, 0.03, tepi)) * 0.35);
          c = campur(c, hx("#3A3350"), (1 - sm(0.93, 0.945, kutub)) * sm(0.915, 0.93, kutub) * 0.3);
          // katup tiup di kutub
          const katup = Math.sqrt(jarak2(o, [0, o[1] > 0 ? 1 : -1, 0]));
          c = campur(c, hx("#C9C2AE"), 1 - sm(0.05, 0.07, katup));
          return c;
        },
      };
    }
    default: {
      // bola dunia: benua dari derau, laut dangkal-dalam, es kutub, awan
      return {
        miring: [0.41, 0.35],
        kilap: [0.3, 22],
        warna: (o) => {
          const lat = o[1];
          const tanah = fbm(o[0] * 1.7 + 3.1, o[1] * 1.7, o[2] * 1.7 + 1.3, 5) + 0.06 * (1 - Math.abs(lat));
          const garisPantai = 0.52;
          let c: V3;
          if (tanah > garisPantai) {
            const kering = fbm(o[0] * 2.3 + 7, o[1] * 2.3, o[2] * 2.3 + 5, 3);
            const tinggi = sm(0.6, 0.78, tanah);
            c = campur(hx("#4F8F3C"), hx("#7DA64D"), fbm(o[0] * 6, o[1] * 6, o[2] * 6, 3));
            c = campur(c, hx("#C8B27A"), sm(0.5, 0.68, kering) * (1 - sm(0.45, 0.8, Math.abs(lat))));
            c = campur(c, hx("#7F6E52"), tinggi * 0.7);
          } else {
            c = campur(hx("#14498F"), hx("#2F7BC4"), sm(0.25, 0.5, tanah));
            c = campur(c, hx("#55B2D8"), (1 - sm(0.47, 0.52, tanah)) * sm(0.44, 0.5, tanah) * 0.85);
          }
          const es = sm(0.84, 0.9, Math.abs(lat) + 0.05 * derau(o[0] * 8, 0, o[2] * 8));
          c = campur(c, hx("#EEF4F7"), es);
          const awan = sm(0.58, 0.72, fbm(o[0] * 3.2 + 9, o[1] * 3.8 + 2, o[2] * 3.2, 5));
          return campur(c, hx("#FFFFFF"), awan * 0.7);
        },
      };
    }
  }
}

interface Sprite {
  corak: HTMLCanvasElement;
  cahaya: HTMLCanvasElement;
}
const gudang = new Map<number, Sprite>();
const JUMLAH_JENIS = 11;
const ARAH_CAHAYA = norm([-0.5, -0.62, 0.6]);

function buatSprite(n: number): Sprite {
  const jenis = buatJenis(n);
  const S = n < 4 ? 128 : n < 7 ? 176 : 224;
  const corak = document.createElement("canvas");
  corak.width = S;
  corak.height = S;
  const cahaya = document.createElement("canvas");
  cahaya.width = S;
  cahaya.height = S;
  const ic = corak.getContext("2d");
  const il = cahaya.getContext("2d");
  if (!ic || !il) return { corak, cahaya };
  const dc = ic.createImageData(S, S);
  const dl = il.createImageData(S, S);
  const h: V3 = norm([ARAH_CAHAYA[0], ARAH_CAHAYA[1], ARAH_CAHAYA[2] + 1]);
  const [kuat, keras] = jenis.kilap;
  const tinta: V3 = [26, 20, 38];
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = ((i + 0.5) / S) * 2 - 1;
      const v = ((j + 0.5) / S) * 2 - 1;
      const rr = Math.sqrt(u * u + v * v);
      const tutup = clamp((1 - rr) * (S / 2) + 0.5);
      if (tutup <= 0) continue;
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, rr * rr)));
      const skala = rr > 1 ? 1 / rr : 1;
      const P: V3 = [u * skala, v * skala, z];
      const o = miring(P, jenis.miring[0], jenis.miring[1]);
      const c = jenis.warna(o);
      const k = (j * S + i) * 4;
      dc.data[k] = c[0];
      dc.data[k + 1] = c[1];
      dc.data[k + 2] = c[2];
      dc.data[k + 3] = tutup * 255;

      // cahaya: bayangan lambert + tepi gelap + pantulan lantai hangat di bawah + sorot
      const lam = Math.max(0, dot(P, ARAH_CAHAYA));
      let aBayang = 0.6 * Math.pow(1 - clamp(lam / 0.95), 1.5) + 0.3 * Math.pow(1 - z, 2.4);
      const pantul = Math.max(0, dot(P, [0.45, 0.8, 0.25])) * 0.12;
      aBayang = clamp(aBayang - pantul);
      const aSorot = kuat > 0 ? kuat * Math.pow(Math.max(0, dot(P, h)), keras) : 0;
      const aS = clamp(aSorot);
      const a = aS + aBayang * (1 - aS);
      if (a <= 0.001) continue;
      const r0 = (255 * aS + tinta[0] * aBayang * (1 - aS)) / a;
      const g0 = (255 * aS + tinta[1] * aBayang * (1 - aS)) / a;
      const b0 = (255 * aS + tinta[2] * aBayang * (1 - aS)) / a;
      dl.data[k] = r0;
      dl.data[k + 1] = g0;
      dl.data[k + 2] = b0;
      dl.data[k + 3] = a * tutup * 255;
    }
  }
  ic.putImageData(dc, 0, 0);
  il.putImageData(dl, 0, 0);
  return { corak, cahaya };
}

function sprite(n: number): Sprite {
  let s = gudang.get(n);
  if (!s) {
    s = buatSprite(n);
    gudang.set(n, s);
  }
  return s;
}

/** Membuat semua sprite lebih dulu (sekali) supaya tak ada kedutan saat jenis baru pertama muncul. */
export function siapkanBola(): void {
  for (let n = 0; n < JUMLAH_JENIS; n++) sprite(n);
}

/** Satu bola jenis `n` di (x, y) berjari-jari r; `sudut` memutar coraknya (rad, searah jarum jam). */
export function gambarBola(ctx: Ctx, x: number, y: number, r: number, n: number, alfa = 1, sudut = 0) {
  const s = sprite(n);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(x, y);
  ctx.save();
  ctx.rotate(sudut);
  ctx.drawImage(s.corak, -r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.drawImage(s.cahaya, -r, -r, r * 2, r * 2);
  // tepi tipis supaya bola terbaca di atas latar, bukan garis kartun tebal
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.4, 0, TAU);
  ctx.lineWidth = Math.max(1, Math.min(1.8, r * 0.05));
  ctx.strokeStyle = "rgba(30,22,42,0.55)";
  ctx.stroke();
  ctx.restore();
}

/** Ikon kartu Bola Gabung: wadah dengan tiga bola sungguhan menumpuk dan percik penggabungan. Persegi `u` px. */
export function ikonBola(ctx: Ctx, u: number): void {
  const k = u / 120;
  ctx.save();
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.roundRect(0, 0, 120, 120, 18);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 120, 120);
  bg.addColorStop(0, "#F8D8C6");
  bg.addColorStop(1, "#E7AE9E");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(30, 20, 40, 0, TAU);
  ctx.fill();
  // kaca wadah (sisi & dasar)
  ctx.fillStyle = "rgba(255,248,235,0.5)";
  ctx.beginPath();
  ctx.roundRect(14, 14, 92, 98, 10);
  ctx.fill();
  // bola: dasar kiri (basket), dasar kanan (sepak), atas (tenis)
  gambarBola(ctx, 41, 86, 25, 7, 1, 0.5);
  gambarBola(ctx, 80, 85, 26, 8, 1, -0.3);
  gambarBola(ctx, 61, 47, 18, 3, 1, 0.9);
  // percik penggabungan
  ctx.strokeStyle = "#FBF1DA";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of [
    [84, 22, 90, 16],
    [88, 32, 96, 32],
    [30, 26, 24, 20],
    [34, 36, 26, 38],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // bingkai wadah di depan
  ctx.strokeStyle = "#2B2233";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(14, 102);
  ctx.quadraticCurveTo(14, 112, 24, 112);
  ctx.lineTo(96, 112);
  ctx.quadraticCurveTo(106, 112, 106, 102);
  ctx.lineTo(106, 14);
  ctx.stroke();
  ctx.restore();
}
