"use client";
import { AirLiur, BauBusuk, GemuruhPerut, Lalat, NodaLumpur } from "@/components/syrobo/OrnamenKondisi";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { TINTA } from "./IkonSyrobo";
import { PakaianBadan, PakaianBelakang, PakaianKepala } from "./PakaianRobot";
import EfekDewa from "./EfekDewa";
import { AMBANG_LELAH, AMBANG_TIDUR, cariPakaian, UKURAN_BAWAAN, type MakananDewaId, type PakaianId, type Suasana } from "@/lib/syrobo/syroboRules";

/**
 * Tubuh SyRobo (SVG digambar tangan: garis tinta tebal, warna datar hangat, bentuk sedikit tak simetris) + interaksi:
 *  - ELUS: gerakkan kursor/jari di atasnya → badan condong mengikuti tangan (pegas), mata tersenyum, hati melayang.
 *    Senangnya bertahan selama masih dielus lalu reda pelan, bukan berhenti mendadak.
 *  - KETUK: reaksi melompat (memampat-meregang) + ucapan sesuai suasananya.
 *  - ANGKAT: tahan ±0,35 dtk lalu seret ke MANA SAJA di layar (dibatasi tepi layar); lepas → jatuh ke lantai memantul.
 *  - `reaksi` dari induk: "makan" (mengunyah) dan "mandi" (busa). `gelap`: lampu padam, robot mengantuk.
 *
 * GERAK MULUS: posisi & kemiringan dihitung pegas fisika (kekakuan + redaman) di requestAnimationFrame dan ditulis
 * langsung ke `transform` (tanpa render React per bingkai, tanpa transisi CSS yang patah). Hemat gerak: pegas langsung
 * menempel, animasi CSS dimatikan (`.syrobo-*` di globals.css).
 */

type Aksi = "diam" | "ketuk" | "elus" | "angkat" | "makan" | "mandi";
export interface ReaksiRobot {
  jenis: "makan" | "mandi";
  /** Berganti tiap pemicu supaya reaksi yang sama bisa diputar ulang. */
  n: number;
}

const UCAP: Record<Suasana | "elus" | "angkat" | "gelap" | "lelah" | "tidur", readonly string[]> = {
  senang: ["Halo! Senangnya ketemu kamu.", "Hehe, geli!", "Ayo belajar bareng!", "Aku siap!"],
  lapar: ["Perutku bunyi... kruyuk.", "Aku lapar, ada makanan?", "Beri aku makan dong..."],
  kotor: ["Aku bau nih, mandiin dong.", "Badanku kotor...", "Ayo mandi!"],
  "lapar-kotor": ["Aku lapar dan kotor...", "Tolong, makan dan mandi dulu ya.", "Huhu, nasibku..."],
  elus: ["Nyaman banget~", "Mmm, lagi dong!", "Kamu baik sekali."],
  angkat: ["Wuaaa! Tinggi sekali!", "Turunkan aku pelan-pelan!", "Aku melayang!"],
  gelap: ["Zzz... gelap ya.", "Hoaam, ngantuk...", "Nyalakan lampunya dong."],
  lelah: ["Aku kelelahan... matikan lampu ya, aku mau tidur.", "Capek... boleh tidur dulu?", "Hatiku redup, aku perlu istirahat."],
  tidur: ["Zzz... biarkan aku tidur sebentar.", "Mmm... energiku lagi diisi.", "Zzz..."],
};

const acak = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Pegas posisi & kemiringan, BERBASIS WAKTU (px/dtk): sama di layar 60 maupun 120 Hz dan tak menyentak saat bingkai tersendat. Teredam
 * ringan (zeta ~0,65): mengendap dengan satu pantulan kecil, bukan bergetar atau berhenti kaku.
 */
const KAKU = 130;
const REDAM = 15;
const KAKU_PUTAR = 110;
const REDAM_PUTAR = 14;
/** Panjang langkah: jarak (px) per radian fase gaya jalan. */
const PX_PER_FASE = 9.5;

const KULIT = "#F6F0E2";
const PLAT = "#8FBCD6";
const LAYAR = "#2B3350";
const MATA = "#BFE7F5";
const GARIS = { stroke: TINTA, strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export default function SyroboRobot({
  pakaianKepala = null,
  pakaianBadan = null,
  ukuranKepala = UKURAN_BAWAAN,
  ukuranBadan = UKURAN_BAWAAN,
  suasana,
  reaksi,
  gelap = false,
  jeda = false,
  lantaiMin = 0.66,
  mati = false,
  energi = 100,
  emas = false,
  dewa = null,
  ledakDewa = null,
  onMati,
  ucapan,
  className,
}: {
  /** Pakaian di slot kepala / badan (null = kosong) dan ukurannya dalam persen. */
  pakaianKepala?: PakaianId | null;
  pakaianBadan?: PakaianId | null;
  ukuranKepala?: number;
  ukuranBadan?: number;
  suasana: Suasana;
  reaksi?: ReaksiRobot | null;
  gelap?: boolean;
  /** Robot berhenti berkeliling (mis. lembar menu terbuka). */
  jeda?: boolean;
  /** Batas ATAS lantai tempat kaki boleh berpijak (pecahan tinggi adegan dari atas). Di ruangan berperabot nilainya di bawah garis kaki perabot, supaya robot berdiri DI DEPAN benda (bukan melayang di atasnya). */
  lantaiMin?: number;
  /** Belum masuk: robot 'mati' (layar padam, tak bergerak); ditekan memanggil `onMati`. */
  mati?: boolean;
  /** Energi 0..100: hati di dada meredup seiring kelelahan; sangat tipis & berkedip = perlu tidur (matikan lampu Main Room). */
  energi?: number;
  /** Cheat: robot berwarna EMAS (logam emas bergradasi + kilau + aura). */
  emas?: boolean;
  /** Aura makanan dewa yang masih menyala (selama kenyang beku) dan ledakan sesaat saat baru dimakan (`n` berganti tiap makan). */
  dewa?: MakananDewaId | null;
  ledakDewa?: { id: MakananDewaId; n: number } | null;
  onMati?: () => void;
  /** Ucapan dari benda kamar yang diketuk: muncul di atas kepala robot. `n` berganti tiap ketukan. */
  ucapan?: { teks: string; n: number } | null;
  className?: string;
}) {
  const [aksi, setAksi] = useState<Aksi>("diam");
  const [berjalan, setBerjalan] = useState(false);
  const [ucap, setUcap] = useState<string | null>(null);
  const [hati, setHati] = useState<{ id: number; x: number }[]>([]);
  const klip = `syrobo-klip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const wadah = useRef<HTMLDivElement>(null);
  const bayang = useRef<HTMLSpanElement>(null);
  const gelembung = useRef<HTMLDivElement>(null);
  const ekorGelembung = useRef<HTMLSpanElement>(null);
  const badan = useRef<HTMLDivElement>(null);
  const mata = useRef<SVGGElement>(null);
  const gerakEl = useRef<HTMLDivElement>(null);
  const kakiKi = useRef<SVGGElement>(null);
  const kakiKa = useRef<SVGGElement>(null);
  const lenganKi = useRef<SVGGElement>(null);
  const lenganKa = useRef<SVGGElement>(null);
  const sentuh = useRef<{
    id: number;
    x0: number;
    y0: number;
    px0: number;
    py0: number;
    t0: number;
    lama: ReturnType<typeof setTimeout> | undefined;
    angkat: boolean;
    gerak: boolean;
  } | null>(null);
  const elus = useRef({ x: 0, jarak: 0, t: 0, arah: 0, balik: 0, hatiT: 0 });
  const idHati = useRef(0);
  const timerUcap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerAksi = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerCondong = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aksiRef = useRef<Aksi>("diam");
  const jedaRef = useRef(jeda || mati);
  const gelapRef = useRef(gelap);
  const lantaiMinRef = useRef(lantaiMin);
  const lelahRef = useRef(false);
  /** Robot tidak berkeliling sebelum waktu ini (mis. sesaat setelah dijatuhkan, supaya terlihat menetap di tempatnya). */
  const diamSampai = useRef(0);
  // Ditulis di efek (bukan saat render) supaya tak melanggar aturan ref.
  useEffect(() => {
    jedaRef.current = jeda || mati;
    gelapRef.current = gelap;
    lantaiMinRef.current = lantaiMin;
    lelahRef.current = energi < AMBANG_LELAH;
  });
  /** Batas gerak saat diangkat: seluruh layar. Dihitung ulang tiap angkat dimulai. */
  const batas = useRef({ minX: -200, maxX: 200, minY: -240, maxY: 40, dasarAtas: 0, tinggi: 0 });
  /** Pegas: posisi (x,y), kemiringan (r), kecepatan, sasaran. Hanya disentuh rAF & penanganan penunjuk. */
  const pegas = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, r: 0, vr: 0, tr: 0, liftY: 0, bingkai: 0 });

  function setAksiRef(a: Aksi) {
    aksiRef.current = a;
    setAksi(a);
  }

  /** Bayangan mengikuti robot di lantai: ikut berjalan, tertinggal di lantai saat diangkat (mengecil & memudar). */
  function tulisBayangan() {
    const g = bayang.current;
    if (!g) return;
    const p = pegas.current;
    const jatuh = p.ty - p.y > 20;
    // Saat diangkat, lantai di bawah robot = posisi dasarnya bila ia di atasnya; bila digeser LEBIH RENDAH dari titik itu, bayangan ikut turun.
    const dasarY = aksiRef.current === "angkat" ? Math.max(p.liftY, p.y) : jatuh ? p.ty : p.y;
    const tinggi = Math.max(0, dasarY - p.y);
    g.style.transform = `translate3d(${p.x.toFixed(1)}px, ${dasarY.toFixed(1)}px, 0) scale(${(1 - Math.min(0.45, tinggi / 520)).toFixed(3)})`;
    g.style.opacity = String((1 - Math.min(0.6, tinggi / 400)).toFixed(2));
  }

  function putar() {
    const p = pegas.current;
    if (p.bingkai) return;
    let sebelum = performance.now();
    const langkah = (now: number) => {
      const dt = Math.min(1 / 30, Math.max(0.001, (now - sebelum) / 1000));
      sebelum = now;
      const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (hemat) {
        p.x = p.tx;
        p.y = p.ty;
        p.r = p.tr;
        p.vx = p.vy = p.vr = 0;
      } else {
        p.vx += ((p.tx - p.x) * KAKU - p.vx * REDAM) * dt;
        p.vy += ((p.ty - p.y) * KAKU - p.vy * REDAM) * dt;
        p.vr += ((p.tr - p.r) * KAKU_PUTAR - p.vr * REDAM_PUTAR) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
      }
      const el = wadah.current;
      if (el) {
        const miring = Math.max(-14, Math.min(14, p.vx * 0.0165)) + p.r;
        el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) rotate(${miring.toFixed(2)}deg)`;
      }
      tulisBayangan();
      const diam =
        Math.abs(p.tx - p.x) < 0.12 &&
        Math.abs(p.ty - p.y) < 0.12 &&
        Math.abs(p.tr - p.r) < 0.05 &&
        Math.abs(p.vx) < 3 &&
        Math.abs(p.vy) < 3 &&
        Math.abs(p.vr) < 1.2;
      if (diam) {
        p.bingkai = 0;
        p.x = p.tx;
        p.y = p.ty;
        p.r = p.tr;
        p.vx = p.vy = p.vr = 0;
        if (el) el.style.transform = `translate3d(${p.tx}px, ${p.ty}px, 0) rotate(${p.tr}deg)`;
        tulisBayangan();
        return;
      }
      p.bingkai = requestAnimationFrame(langkah);
    };
    p.bingkai = requestAnimationFrame(langkah);
  }

  useEffect(() => {
    const p = pegas.current;
    return () => {
      cancelAnimationFrame(p.bingkai);
      clearTimeout(timerUcap.current);
      clearTimeout(timerAksi.current);
      clearTimeout(timerCondong.current);
      if (sentuh.current) clearTimeout(sentuh.current.lama);
    };
  }, []);

  /** Posisi dasar robot (tanpa pergeseran sekarang) + tinggi, dalam koordinat jendela. */
  function dasar() {
    const r = badan.current?.getBoundingClientRect();
    const p = pegas.current;
    if (!r) return null;
    return { kiri: r.left - p.x, atas: r.top - p.y, lebar: r.width, tinggi: r.height };
  }

  /** Daerah lantai tempat kaki boleh berpijak (koordinat jendela): dari tepi atas lantai sampai di atas dok menu. */
  function lantai() {
    // Tinggi adegan diukur dari elemen adegannya (h-dvh), bukan innerHeight: di peramban ponsel keduanya bisa berbeda.
    const adegan = document.querySelector("[data-adegan-syrobo]")?.getBoundingClientRect();
    const H = adegan?.height ?? window.innerHeight;
    const atas = adegan?.top ?? 0;
    const W = window.innerWidth;
    // Dok menu: ponsel menempati 92-154 px dari bawah (kaki boleh sedikit menyelinap di bawahnya), desktop ±100 px.
    const kakiMaks = atas + (W < 640 ? H - 150 : H - 100 - 22);
    const kakiMin = Math.min(atas + H * lantaiMinRef.current, kakiMaks - 8);
    return { kakiMin, kakiMaks, pusatMin: W * 0.1, pusatMaks: W * 0.9 };
  }

  // Berkeliling kamar: sesekali memilih titik di lantai, berjalan ke sana dengan kecepatan tetap (pegas menghaluskan),
  // lalu diam sebentar. Berhenti selama diangkat / dielus / makan / mandi / lembar menu terbuka / lampu padam / tab
  // tersembunyi, dan tak pernah jalan bila hemat gerak.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const j = { jalan: false, gx: 0, gy: 0, v: 0, tunggu: performance.now() + 2500, last: 0, raf: 0 };
    const p = pegas.current;
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - (j.last || t)) / 1000);
      j.last = t;
      const boleh = !jedaRef.current && !gelapRef.current && t >= diamSampai.current && aksiRef.current === "diam" && !sentuh.current && document.visibilityState === "visible";
      if (!boleh) {
        if (j.jalan) {
          j.jalan = false;
          setBerjalan(false);
        }
        j.v = 0;
        j.tunggu = Math.max(j.tunggu, t + 1500);
        j.raf = requestAnimationFrame(tick);
        return;
      }
      if (!j.jalan) {
        if (t >= j.tunggu) {
          const d = dasar();
          if (d) {
            const L = lantai();
            const pusat = L.pusatMin + Math.random() * (L.pusatMaks - L.pusatMin);
            const kaki = L.kakiMin + Math.random() * (L.kakiMaks - L.kakiMin);
            j.gx = pusat - (d.kiri + d.lebar / 2);
            j.gy = kaki - (d.atas + d.tinggi);
            j.jalan = true;
            setBerjalan(true);
            if (mata.current) mata.current.style.transform = `translate(${j.gx > p.tx ? 4 : -4}px, 0)`;
          } else {
            j.tunggu = t + 2000;
          }
        }
      } else {
        const dx = j.gx - p.tx;
        const dy = j.gy - p.ty;
        const d = Math.hypot(dx, dy);
        // Kecepatan dilandaikan: berangkat pelan, menyusut mendekati tujuan (mengerem); robot yang kelelahan berjalan lebih lambat.
        const vMaks = (window.innerWidth < 640 ? 46 : 72) * (lelahRef.current ? 0.6 : 1);
        j.v += (Math.min(vMaks, d * 1.6 + 5) - j.v) * Math.min(1, dt * 3.2);
        const langkah = j.v * dt;
        if (d <= Math.max(1.5, langkah)) {
          p.tx = j.gx;
          p.ty = j.gy;
          j.jalan = false;
          j.v = 0;
          setBerjalan(false);
          j.tunggu = t + 2500 + Math.random() * 4500;
        } else {
          p.tx += (dx / d) * langkah;
          p.ty += (dy / d) * langkah;
        }
        putar();
      }
      j.raf = requestAnimationFrame(tick);
    };
    j.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(j.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gaya jalan & gerak halus, DITULIS tiap bingkai dari kecepatan nyata robot (bukan keyframe berulang yang menyentak): fase langkah maju
  // sebanding jarak tempuh, ayunan kaki/lengan membesar-mengecil pelan menurut kecepatan, badan naik-turun dan mengayun kecil, lengan
  // dan badan terus bernapas pelan saat diam. Jadi mulai/berhenti berjalan menyatu mulus dengan gerak diamnya.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = { ph: 0, k: 0, last: 0, raf: 0 };
    const p = pegas.current;
    const tulis = (t: number) => {
      const dt = Math.min(0.05, (t - (g.last || t)) / 1000);
      g.last = t;
      const diangkat = aksiRef.current === "angkat";
      const kecepatan = diangkat ? 0 : Math.hypot(p.vx, p.vy);
      g.k += (Math.min(1, kecepatan / 55) - g.k) * Math.min(1, dt * 7);
      g.ph += (kecepatan * dt) / PX_PER_FASE;
      const s = Math.sin(g.ph);
      const k = g.k;
      const napas = Math.sin(t / 1150);
      if (!diangkat) {
        if (kakiKi.current) kakiKi.current.style.transform = `rotate(${(s * 19 * k).toFixed(2)}deg)`;
        if (kakiKa.current) kakiKa.current.style.transform = `rotate(${(-s * 19 * k).toFixed(2)}deg)`;
      }
      const lengan = (arah: number, fase: number) => (-s * 15 * k * arah + Math.sin(t / 1700 + fase) * 2.2 * (1 - k * 0.6)).toFixed(2);
      if (lenganKi.current) lenganKi.current.style.rotate = `${lengan(1, 0)}deg`;
      if (lenganKa.current) lenganKa.current.style.rotate = `${lengan(-1, 1.6)}deg`;
      if (gerakEl.current) {
        const naik = -Math.abs(s) * 4.6 * k;
        const goyang = s * 1.5 * k + napas * 0.35 * (1 - k);
        gerakEl.current.style.transform = `translate3d(0, ${naik.toFixed(2)}px, 0) rotate(${goyang.toFixed(2)}deg) scale(${(1 + Math.abs(s) * 0.012 * k).toFixed(4)}, ${(1 - Math.abs(s) * 0.014 * k + napas * 0.004).toFixed(4)})`;
      }
      g.raf = requestAnimationFrame(tulis);
    };
    g.raf = requestAnimationFrame(tulis);
    return () => cancelAnimationFrame(g.raf);
  }, []);

  // Mata melirik kursor (maks 4px), ditulis langsung ke DOM.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let bingkai = 0;
    const gerak = (e: PointerEvent) => {
      if (bingkai) return;
      bingkai = requestAnimationFrame(() => {
        bingkai = 0;
        const el = mata.current;
        const kotak = badan.current?.getBoundingClientRect();
        if (!el || !kotak) return;
        const dx = e.clientX - (kotak.left + kotak.width / 2);
        const dy = e.clientY - (kotak.top + kotak.height * 0.35);
        const j = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, j / 160) * 4;
        el.style.transform = `translate(${((dx / j) * k).toFixed(2)}px, ${((dy / j) * k * 0.7).toFixed(2)}px)`;
      });
    };
    window.addEventListener("pointermove", gerak, { passive: true });
    return () => {
      window.removeEventListener("pointermove", gerak);
      cancelAnimationFrame(bingkai);
    };
  }, []);

  // Reaksi dari induk (makan / mandi). Lewat timer 0 dtk supaya setState tidak sinkron di badan efek.
  useEffect(() => {
    if (!reaksi) return;
    const mulai = setTimeout(() => {
      clearTimeout(timerAksi.current);
      aksiRef.current = reaksi.jenis;
      setAksi(reaksi.jenis);
      timerAksi.current = setTimeout(
        () => {
          aksiRef.current = "diam";
          setAksi("diam");
        },
        reaksi.jenis === "makan" ? 1800 : 2600,
      );
    }, 0);
    return () => clearTimeout(mulai);
  }, [reaksi]);

  useEffect(() => {
    if (!ucapan) return;
    const id = setTimeout(() => bicara(ucapan.teks), 0);
    return () => clearTimeout(id);
  }, [ucapan]);

  /**
   * Menata gelembung ucapan: SELALU tepat di atas kepala robot. Dihitung dari ukuran tata letak gelembung (offsetWidth/Height) dan kotak
   * robot - BUKAN dari getBoundingClientRect gelembung, yang ikut terkena animasi masuk dan dulu membuat ia terukur salah tempat lalu
   * didorong turun menimpa robot. Geser mendatar bila terlalu ke tepi layar; bila di atas robot tak ada ruang (robot di dekat navbar)
   * gelembung pindah ke SAMPING kepala (ekornya disembunyikan), tak pernah menimpa robot.
   */
  function tataGelembung() {
    const el = gelembung.current;
    const kotak = wadah.current?.getBoundingClientRect();
    if (!el || !kotak) return;
    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const W = window.innerWidth;
    const pusatX = kotak.left + kotak.width / 2;
    const dasarY = kotak.top + kotak.height * 0.11;
    const kiri = pusatX - bw / 2;
    const atas = dasarY - bh;
    const ekor = ekorGelembung.current;
    let dx = 0;
    let dy = 0;
    let samping = false;
    if (atas >= 84) {
      if (kiri < 8) dx = 8 - kiri;
      else if (kiri + bw > W - 8) dx = W - 8 - (kiri + bw);
    } else {
      const kananMuat = kotak.right + 10 + bw <= W - 8;
      const kiriMuat = kotak.left - 10 - bw >= 8;
      if (kananMuat || kiriMuat) {
        samping = true;
        const targetKiri = kananMuat ? kotak.right + 10 : kotak.left - 10 - bw;
        dx = targetKiri - kiri;
        dy = Math.max(84, kotak.top + kotak.height * 0.12) - atas;
      } else {
        // layar sangat sempit: tetap di atas, dijepit di bawah navbar (boleh menutupi sedikit antena, bukan kepala)
        dy = 84 - atas;
        if (kiri < 8) dx = 8 - kiri;
        else if (kiri + bw > W - 8) dx = W - 8 - (kiri + bw);
      }
    }
    el.style.marginLeft = `${dx.toFixed(1)}px`;
    el.style.marginTop = `${dy.toFixed(1)}px`;
    if (ekor) ekor.style.display = samping ? "none" : "";
  }
  useLayoutEffect(() => {
    if (!ucap) return;
    tataGelembung();
    // robot bisa berjalan/diangkat selagi gelembung tampil: tata ulang berkala
    const id = setInterval(tataGelembung, 100);
    return () => clearInterval(id);
  }, [ucap]);

  function bicara(teks: string) {
    setUcap(teks);
    clearTimeout(timerUcap.current);
    timerUcap.current = setTimeout(() => setUcap(null), 2600);
  }

  function setAksiSementara(a: Aksi, ms: number) {
    clearTimeout(timerAksi.current);
    setAksiRef(a);
    timerAksi.current = setTimeout(() => setAksiRef("diam"), ms);
  }

  function semburHati() {
    const id = ++idHati.current;
    setHati((h) => [...h.slice(-4), { id, x: 25 + Math.random() * 50 }]);
    setTimeout(() => setHati((h) => h.filter((x) => x.id !== id)), 1500);
  }

  function mulai(e: React.PointerEvent) {
    if (mati) {
      onMati?.();
      return;
    }
    if (sentuh.current) return;
    const lama = setTimeout(() => {
      const s = sentuh.current;
      if (!s || s.gerak) return;
      s.angkat = true;
      // Batas = seluruh layar: posisi dasar robot (tanpa pergeseran sekarang) dijaga tetap di dalam jendela.
      const d = dasar();
      const p = pegas.current;
      if (d) {
        const m = 6;
        batas.current = {
          minX: m - d.kiri,
          maxX: window.innerWidth - m - (d.kiri + d.lebar),
          minY: m - d.atas,
          maxY: window.innerHeight - m - (d.atas + d.tinggi),
          dasarAtas: d.atas,
          tinggi: d.tinggi,
        };
      }
      s.px0 = p.x;
      s.py0 = p.y;
      p.liftY = p.y;
      try {
        wadah.current?.setPointerCapture(s.id);
      } catch {
        // abaikan
      }
      clearTimeout(timerAksi.current);
      p.tr = 0;
      document.documentElement.style.overscrollBehavior = "none";
      setAksiRef("angkat");
      bicara(acak(UCAP.angkat));
    }, 350);
    sentuh.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px0: 0, py0: 0, t0: performance.now(), lama, angkat: false, gerak: false };
  }

  function gerak(e: React.PointerEvent) {
    if (mati) return;
    const s = sentuh.current;
    const p = pegas.current;
    if (s && s.id === e.pointerId && s.angkat) {
      const b = batas.current;
      p.tx = Math.max(b.minX, Math.min(b.maxX, s.px0 + e.clientX - s.x0));
      p.ty = Math.max(b.minY, Math.min(b.maxY, s.py0 + e.clientY - s.y0));
      putar();
      return;
    }

    if (s && !s.angkat && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > 10) {
      s.gerak = true;
      clearTimeout(s.lama);
    }

    // Elus: condong pelan mengikuti tangan (pegas), senang bertahan selama masih bergerak di atasnya.
    const kotak = badan.current?.getBoundingClientRect();
    if (kotak) {
      const rel = (e.clientX - (kotak.left + kotak.width / 2)) / (kotak.width / 2);
      p.tr = Math.max(-6, Math.min(6, rel * 7));
      putar();
      clearTimeout(timerCondong.current);
      timerCondong.current = setTimeout(() => {
        p.tr = 0;
        putar();
      }, 450);
    }

    const nowT = performance.now();
    const j = elus.current;
    if (nowT - j.t > 1200) {
      j.jarak = 0;
      j.balik = 0;
      j.arah = 0;
    }
    j.t = nowT;
    const dx = e.clientX - j.x;
    j.x = e.clientX;
    if (Math.abs(dx) < 1 || Math.abs(dx) > 120) return;
    const arah = dx > 0 ? 1 : -1;
    if (j.arah !== 0 && arah !== j.arah) j.balik += 1;
    j.arah = arah;
    j.jarak += Math.abs(dx);

    const a = aksiRef.current;
    if (a === "angkat" || a === "makan" || a === "mandi") return;
    if (a === "elus") {
      // Masih dielus: perpanjang senangnya, beri hati sesekali (tidak tiap gerakan).
      clearTimeout(timerAksi.current);
      timerAksi.current = setTimeout(() => setAksiRef("diam"), 900);
      if (nowT - j.hatiT > 520) {
        j.hatiT = nowT;
        semburHati();
      }
    } else if (j.balik >= 1 && j.jarak > 70) {
      j.jarak = 0;
      j.balik = 0;
      j.hatiT = nowT;
      setAksiSementara("elus", 1100);
      bicara(acak(UCAP.elus));
      semburHati();
    }
  }

  function selesai(e: React.PointerEvent) {
    const s = sentuh.current;
    if (!s || s.id !== e.pointerId) return;
    clearTimeout(s.lama);
    sentuh.current = null;
    document.documentElement.style.overscrollBehavior = "";
    if (s.angkat) {
      const p = pegas.current;
      // Dilepas: jatuh lurus ke bawah dan MENETAP di tempat dilepas (bukan ke tengah). Bila dilepas di atas lantai
      // (di dinding/udara) ia jatuh sampai kakinya menyentuh lantai; di dalam daerah lantai posisinya tak berubah.
      const L = lantai();
      const b = batas.current;
      const kaki = b.dasarAtas + b.tinggi + p.ty;
      p.ty += Math.min(L.kakiMaks, Math.max(L.kakiMin, kaki)) - kaki;
      diamSampai.current = performance.now() + 5000;
      putar();
      setAksiSementara("ketuk", 900);
      return;
    }
    if (!s.gerak && performance.now() - s.t0 < 350 && aksiRef.current !== "elus") {
      setAksiSementara("ketuk", 700);
      bicara(acak(gelap ? (energi < AMBANG_LELAH ? UCAP.tidur : UCAP.gelap) : energi < AMBANG_LELAH ? UCAP.lelah : UCAP[suasana]));
    }
  }

  const tutupAntena = pakaianKepala !== null && cariPakaian(pakaianKepala).tutupAntena;
  const lapar = suasana === "lapar" || suasana === "lapar-kotor";
  const kotor = suasana === "kotor" || suasana === "lapar-kotor";
  const angkat = aksi === "angkat";
  const senang = aksi === "elus" || aksi === "mandi";
  const makan = aksi === "makan";
  const ngantuk = gelap && !mati && !angkat && !senang && !makan;
  const kulit = emas ? `url(#${klip}-e1)` : KULIT;
  const plat = emas ? `url(#${klip}-e2)` : PLAT;
  const lelah = energi < AMBANG_LELAH;
  const butuhTidur = energi < AMBANG_TIDUR;
  /** Kelelahan (belum tidur): mata sayu & mulut datar. */
  const sayu = lelah && !gelap && !mati && !angkat && !senang && !makan;
  // Hati dada = ukuran energi: penuh saat segar, makin tipis saat lelah, BERKEDIP HANYA saat mengantuk (perlu tidur);
  // selain itu menyala mantap tanpa berdenyut. Selagi tidur ia mantap dan terang kembali seiring energi pulih.
  const frak = Math.min(1, Math.max(0, (energi - AMBANG_TIDUR) / (100 - AMBANG_TIDUR)));
  const opasitasHati = butuhTidur ? 0.14 + (energi / AMBANG_TIDUR) * 0.12 : 0.3 + 0.7 * Math.pow(frak, 0.75);

  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[1.5%] flex justify-center">
        <span ref={bayang} className="block h-3 w-[min(17vw,10dvh)] rounded-[50%] bg-[#2B2233]/30 blur-[1.5px] sm:h-3.5 sm:w-[min(21vw,12dvh,118px)]" />
      </span>
    <div
      ref={wadah}
      onPointerDown={mulai}
      onPointerMove={gerak}
      onPointerUp={selesai}
      onPointerCancel={selesai}
      // Tekan-tahan di ponsel memunculkan menu konteks/callout yang MEMBATALKAN sentuhan (robot terlepas); jangan biarkan.
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={(e) => {
        if (!sentuh.current?.angkat) selesai(e);
      }}
      className={cn("pointer-events-auto relative mx-auto w-[min(40vw,22dvh)] touch-none select-none [-webkit-touch-callout:none] will-change-transform sm:w-[min(46vw,26dvh,260px)]", mati ? "cursor-pointer" : "cursor-grab active:cursor-grabbing", className)}
    >
      {emas && <span aria-hidden="true" className="emas-aura" />}
      {dewa && !(ledakDewa && ledakDewa.id === dewa) && <EfekDewa id={dewa} />}
      {ledakDewa && <EfekDewa key={ledakDewa.n} id={ledakDewa.id} kuat />}

      {ucap && (
        <div
          ref={gelembung}
          role="status"
          className="syrobo-ucap absolute left-1/2 top-[11%] z-20 w-max max-w-[15rem] -translate-x-1/2 -translate-y-full rounded-[14px_16px_14px_6px] border-[2.5px] border-[#2B2233] bg-[#FFF8E6] px-3.5 py-1.5 text-center text-sm font-bold text-[#2B2233] shadow-[3px_3px_0_#2B2233]"
        >
          {ucap}
          <span ref={ekorGelembung} aria-hidden="true" className="absolute left-1/2 top-full -mt-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-b-[2.5px] border-r-[2.5px] border-[#2B2233] bg-[#FFF8E6]" />
        </div>
      )}

      {hati.map((h) => (
        <span key={h.id} aria-hidden="true" className="syrobo-hati absolute top-6 z-10 text-2xl text-[#E56B5D] [-webkit-text-stroke:1.5px_#2B2233]" style={{ left: `${h.x}%` }}>
          ♥
        </span>
      ))}

      {ngantuk && (
        // Z digambar sebagai garis (tinta di belakang, warna di depan) - bukan teks - supaya tak ada goresan yang menimpa; muncul satu per satu.
        <svg aria-hidden="true" viewBox="0 0 64 44" className="pointer-events-none absolute -top-[14%] right-[-8%] z-10 w-[40%] overflow-visible" fill="none" strokeLinejoin="round" strokeLinecap="round">
          {(
            [
              { d: "M0 0H10L0 11H10", x: 4, y: 26, s: 0.8, tunda: 0 },
              { d: "M0 0H10L0 11H10", x: 24, y: 12, s: 1, tunda: 700 },
              { d: "M0 0H10L0 11H10", x: 44, y: -1, s: 1.25, tunda: 1400 },
            ] as const
          ).map((z, i) => (
            <g key={i} transform={`translate(${z.x} ${z.y}) scale(${z.s})`}>
              <g className="syrobo-z" style={{ animationDelay: `${z.tunda}ms` }}>
                <path d={z.d} stroke={TINTA} strokeWidth={5.2} />
                <path d={z.d} stroke="#BFE7F5" strokeWidth={2.4} />
              </g>
            </g>
          ))}
        </svg>
      )}

      {aksi === "mandi" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="syrobo-busa absolute rounded-full border-2 border-[#2B2233] bg-white/85"
              style={{
                left: `${8 + ((i * 53) % 84)}%`,
                bottom: `${(i * 37) % 60}%`,
                width: `${14 + ((i * 7) % 16)}px`,
                height: `${14 + ((i * 7) % 16)}px`,
                animationDelay: `${(i % 7) * 160}ms`,
              }}
            />
          ))}
        </div>
      )}

      <div ref={badan}>
        <div ref={gerakEl} style={{ transformOrigin: "50% 100%" }}>
        <svg
          viewBox="0 0 200 240"
          className={cn("block h-auto w-full overflow-visible", aksi === "ketuk" && "syrobo-hop", aksi === "mandi" && "syrobo-goyang", !mati && aksi === "diam" && !berjalan && "syrobo-napas")}
          fill="none"
          role="img"
          aria-label={mati ? "Robot SyRobo (mati). Ketuk untuk masuk" : `Robot SyRobo, suasana ${suasana}`}
          {...GARIS}
        >
          {emas && (
            <defs>
              <linearGradient id={`${klip}-e1`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FFF3B0" />
                <stop offset="0.45" stopColor="#F4C940" />
                <stop offset="1" stopColor="#C88A1C" />
              </linearGradient>
              <linearGradient id={`${klip}-e2`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F7D567" />
                <stop offset="1" stopColor="#B87814" />
              </linearGradient>
            </defs>
          )}
          <PakaianBelakang id={pakaianBadan} persen={ukuranBadan} />

          {/* kaki: ayunannya ditulis tiap bingkai dari kecepatan jalan (lihat efek gaya jalan); saat diangkat menjuntai berayun */}
          <g ref={kakiKi} className={angkat ? "syrobo-kaki" : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}>
            <path d="M76 202c0-2 2-3 4-3h9c2 0 4 1 4 3l1 21c0 4-2 6-6 6h-6c-4 0-6-2-6-6z" fill={plat} />
          </g>
          <g ref={kakiKa} className={angkat ? "syrobo-kaki" : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}>
            <path d="M107 202c0-2 2-3 4-3h9c2 0 4 1 4 3l1 21c0 4-2 6-6 6h-6c-4 0-6-2-6-6z" fill={plat} />
          </g>
          {/* lengan: pangkalnya menyelinap di balik badan (bahu) sehingga lengan menyatu dengan badan, bukan menempel terpisah */}
          <g
            ref={lenganKi}
            style={{ transformOrigin: "68px 152px", transform: angkat ? "rotate(35deg)" : senang ? "rotate(-14deg)" : undefined, transition: "transform 520ms cubic-bezier(0.34,1.3,0.64,1)" }}
          >
            <path d="M71 145C58 143 48 147 46 156L45 189C45 194 48 197 52 197C56 197 59 194 59 189L60 166C60 161 63 158 68 157Z" fill={plat} />
          </g>
          <g
            ref={lenganKa}
            style={{ transformOrigin: "132px 152px", transform: angkat ? "rotate(-35deg)" : senang ? "rotate(14deg)" : undefined, transition: "transform 520ms cubic-bezier(0.34,1.3,0.64,1)" }}
          >
            <path d="M129 145C142 143 152 147 154 156L155 189C155 194 152 197 148 197C144 197 141 194 141 189L140 166C140 161 137 158 132 157Z" fill={plat} />
          </g>
          {/* badan */}
          <path d="M78 136c-9 0-13 4-13 11l-1 46c0 8 5 12 13 12h46c8 0 13-4 13-12l-1-46c0-7-4-11-13-11z" fill={kulit} />
          {/* layar dada berbentuk hati = ukuran energi: meredup saat lelah; sangat tipis & berkedip = perlu tidur; bernapas pelan saat tidur */}
          <path
            d="M100 182c-9-6-15-11-15-17 0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 6-6 11-15 17z"
            fill={mati ? "#8A8FA3" : lapar ? "#E0833B" : "#E56B5D"}
            className={mati ? undefined : butuhTidur && !gelap ? "syrobo-hati-tipis" : undefined}
            style={mati ? undefined : ({ "--o": opasitasHati.toFixed(2), opacity: opasitasHati } as React.CSSProperties)}
            data-energi={Math.round(energi)}
          />
          {lapar && !mati && (
            <g strokeWidth={0}>
              <GemuruhPerut x={64} y={186} s={1.6} arah={-1} />
              <GemuruhPerut x={137} y={190} s={1.4} arah={1} />
            </g>
          )}

          {/* antena */}
          <PakaianBadan id={pakaianBadan} persen={ukuranBadan} klip={klip} />

          {/* antena: tersembunyi di balik topi yang menutupi kepala */}
          {!tutupAntena && (
            <g className={mati ? undefined : "syrobo-antena"}>
              <path d="M100 40c0-8 4-11 3-19" />
              <circle cx="103" cy="17" r="7" fill={mati ? "#9A9A9A" : "#F2C14E"} />
            </g>
          )}
          {/* telinga/baut */}
          <circle cx="33" cy="86" r="9" fill={plat} />
          <circle cx="167" cy="86" r="9" fill={plat} />
          {/* kepala */}
          <path d="M66 38c-18 0-27 8-27 26v46c0 17 9 26 27 26h68c18 0 27-9 27-26V64c0-18-9-26-27-26z" fill={kulit} />
          <path d="M56 58c-1 0-2 1-2 2v52c0 2 2 4 4 4h84c2 0 4-2 4-4V60c0-1-1-2-2-2z" fill={LAYAR} />

          {/* pipi */}
          <g fill="#F28C8C" strokeWidth={0} opacity={mati ? 0.2 : senang ? 0.85 : 0.5}>
            <ellipse cx="67" cy="100" rx="8" ry="4.5" />
            <ellipse cx="133" cy="100" rx="8" ry="4.5" />
          </g>

          {/* mata */}
          <g ref={mata} style={{ transition: "transform 180ms cubic-bezier(0.22,1,0.36,1)" }}>
            {mati ? (
              <g stroke="#55607A" strokeWidth={4}>
                <path d="M70 84h18M112 84h18" />
              </g>
            ) : senang ? (
              <g stroke={MATA} strokeWidth={5}>
                <path d="M68 86q11 -14 22 0" />
                <path d="M110 86q11 -14 22 0" />
              </g>
            ) : ngantuk ? (
              <g stroke={MATA} strokeWidth={5}>
                <path d="M68 84q11 7 22 0" />
                <path d="M110 84q11 7 22 0" />
              </g>
            ) : sayu ? (
              <g strokeWidth={0}>
                <ellipse cx="79" cy="86" rx="9" ry="5.500" fill={MATA} />
                <ellipse cx="121" cy="86" rx="9" ry="5.500" fill={MATA} />
                {/* kelopak berat menutupi separuh atas mata */}
                <path d="M68 80h22v6c-5-2-17-2-22 0z" fill={LAYAR} />
                <path d="M110 80h22v6c-5-2-17-2-22 0z" fill={LAYAR} />
              </g>
            ) : (
              <g className={cn(!angkat && !lapar && "syrobo-mata")} strokeWidth={0}>
                <ellipse cx="79" cy="82" rx="9" ry={angkat ? 14 : lapar ? 5 : 11} fill={MATA} />
                <ellipse cx="121" cy="82" rx="9" ry={angkat ? 14 : lapar ? 5 : 11} fill={MATA} />
                {!lapar && (
                  <>
                    <circle cx="82" cy={angkat ? 77 : 78} r="3" fill="#fff" />
                    <circle cx="124" cy={angkat ? 77 : 78} r="3" fill="#fff" />
                  </>
                )}
              </g>
            )}
          </g>
          {/* mulut */}
          {mati ? null : makan ? (
            <ellipse cx="100" cy="104" rx="10" ry="8" fill={MATA} strokeWidth={0} className="syrobo-kunyah" />
          ) : angkat ? (
            <ellipse cx="100" cy="106" rx="7" ry="8" fill={MATA} strokeWidth={0} />
          ) : ngantuk ? (
            <path d="M92 106h16" stroke={MATA} strokeWidth={4} />
          ) : sayu ? (
            <path d="M91 107q9 -3 18 0" stroke={MATA} strokeWidth={4} />
          ) : lapar || kotor ? (
            <path d="M86 108q14 -12 28 0" stroke={MATA} strokeWidth={4} />
          ) : (
            <path d="M86 100q14 14 28 0" stroke={MATA} strokeWidth={4} />
          )}
          {lapar && !makan && !mati && <AirLiur x={115} y={108} s={1.25} garis="#2B2233" />}

          {/* kotor: noda lumpur, bau, dan lalat (hilang saat mandi) */}
          {kotor && aksi !== "mandi" && (
            <g strokeWidth={0}>
              <NodaLumpur x={58} y={126} s={1.1} r={-15} garis="#2B2233" />
              <NodaLumpur x={138} y={52} s={0.75} r={20} />
              <NodaLumpur x={88} y={190} s={1.2} r={10} garis="#2B2233" />
              <NodaLumpur x={124} y={152} s={0.8} r={-30} />
              <BauBusuk x={22} y={124} s={1.3} />
              <BauBusuk x={178} y={118} s={1.1} />
              <Lalat x={44} y={36} s={1.7} r={-20} garis="#2B2233" />
              <Lalat x={160} y={28} s={1.3} r={15} garis="#2B2233" jejak={false} />
            </g>
          )}

          {emas && (
            <g strokeWidth={0} fill="#FFFBE0">
              {[
                [58, 56, 0],
                [146, 70, 0.6],
                [84, 150, 1.1],
                [128, 176, 0.3],
                [100, 40, 0.9],
              ].map(([x, y, t], i) => (
                <path key={i} className="emas-kilau" style={{ animationDelay: `${t}s` }} d={`M${x} ${y - 8}L${x + 2} ${y - 2}L${x + 8} ${y}L${x + 2} ${y + 2}L${x} ${y + 8}L${x - 2} ${y + 2}L${x - 8} ${y}L${x - 2} ${y - 2}Z`} />
              ))}
            </g>
          )}

          {/* pakaian kepala (di atas kepala & layar wajah) */}
          <PakaianKepala id={pakaianKepala} persen={ukuranKepala} />
        </svg>
        </div>
      </div>
    </div>
    </>
  );
}
