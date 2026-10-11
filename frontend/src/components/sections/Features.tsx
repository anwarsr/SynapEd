"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SectionTitle from "@/components/sections/SectionTitle";

/** Penjelasan lengkap tiap fitur (urutan = STAGE_CARDS). Dibuka dengan mengetuk kartu. */
const DETAIL_FITUR: { lead: string; poin: string[] }[] = [
  {
    lead: "Setiap kursus di SynapEd disusun oleh educator yang menguasai bidangnya, lalu ditinjau admin sebelum tampil di katalog. Hasilnya, materi yang Anda pelajari sudah melewati penyaringan, bukan sekadar unggahan.",
    poin: [
      "Kursus baru dan setiap perubahan besarnya diajukan dulu, lalu disetujui admin sebelum terbit.",
      "Materi tersusun bertahap dari dasar hingga lanjut, dalam bagian dan pelajaran yang berurutan.",
      "Nilai kelulusan ditetapkan pembuat kursus; sertifikat terbit setelah semua pelajaran selesai dan nilainya tercapai.",
    ],
  },
  {
    lead: "Pelajaran video menjelaskan konsep lewat rekaman dan animasi yang terstruktur, jadi ide yang rumit dapat dipahami langkah demi langkah dan diputar ulang sebanyak yang Anda perlukan.",
    poin: [
      "Video tampil langsung di halaman belajar, tanpa perlu berpindah aplikasi.",
      "Dipadukan dengan pelajaran bacaan, kuis, dan penugasan dalam satu alur kursus.",
      "Kemajuan tiap pelajaran tersimpan, sehingga Anda bisa melanjutkan dari tempat terakhir.",
    ],
  },
  {
    lead: "Teori baru terasa setelah dipakai. Studi kasus dan penugasan di SynapEd melatih keterampilan secara langsung, dengan umpan balik dari educator kursusnya.",
    poin: [
      "Penugasan dikumpulkan sebagai berkas PDF atau gambar langsung dari halaman belajar.",
      "Educator menilai dan menulis umpan balik; nilai akhir selalu keputusan educator, bukan mesin.",
      "Kuis di sela pelajaran menguji pemahaman Anda sebelum melangkah ke materi berikutnya.",
    ],
  },
  {
    lead: "Belajar tidak harus di depan satu perangkat. Halaman SynapEd menyesuaikan diri dengan laptop, tablet, maupun ponsel, dan kemajuan Anda ikut ke mana pun Anda masuk.",
    poin: [
      "Tampilan responsif: nyaman dibaca dan dipakai di layar kecil maupun besar.",
      "Lanjutkan dari pelajaran terakhir kapan saja; tidak ada batas waktu belajar.",
      "Pilih tema terang atau gelap dan bahasa Indonesia atau Inggris lewat pengaturan profil.",
      "Asisten AI di dalam kursus siap membantu menjawab pertanyaan tentang pelajaran yang sedang dibuka.",
    ],
  },
];

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

const STAGE_CARDS = [0, 1, 3, 4].map((i) => ({
  title: features[i].title,
  desc: features[i].desc,
}));

/** 8 slot: 4 kartu asli + 4 bayangan (fitur berulang) untuk barisan tanpa lubang. */
const SLOTS = [...STAGE_CARDS, ...STAGE_CARDS].map((f, slot) => ({
  ...f,
  slot,
  index: slot % STAGE_CARDS.length,
  ghost: slot >= STAGE_CARDS.length,
}));

/* =============================================================
   EASTER EGG - angka kartu dipencet → warna kartu langsung berganti ke warna
   berikutnya. Tanpa petunjuk visual.
============================================================= */

const EGG_COLORS = ["var(--color-paper-card)", "#2F6FED", "#0E7C86", "#5B4BC4", "#1F8A5B"];

/**
 * Penjelasan lengkap satu fitur - lembar persegi bergaya editorial.
 *
 * Tata letak sengaja tidak simetris: label & garis di atas, judul bertingkat
 * (tiap baris menjorok sedikit), kalimat pembuka di kolom kiri berpagar garis
 * tegak, poin-poin bernomor besar-tipis di kolom kanan, dan angka raksasa samar
 * terpotong di pojok kanan bawah yang ikut bergeser mengikuti kursor.
 * Gerak: lembar membuka seperti tirai dari garis tengah, kata judul naik dari
 * balik topeng satu per satu, garis menggambar dirinya, poin menyelinap dari
 * kanan. Semua angka memakai Plus Jakarta Sans (bukan mono). Menutup =
 * tirai menutup balik (420ms) baru dilepas dari pohon.
 */
function DetailFitur({ idx, warna, onClose }: { idx: number; warna: string; onClose: () => void }) {
  const fitur = STAGE_CARDS[idx];
  const isi = DETAIL_FITUR[idx];
  const nomor = String(idx + 1).padStart(2, "0");
  const tutupRef = useRef<HTMLButtonElement>(null);
  const lembarRef = useRef<HTMLDivElement>(null);
  const [keluar, setKeluar] = useState(false);
  const tutup = useCallback(() => setKeluar(true), []);

  useEffect(() => {
    if (!keluar) return;
    const t = setTimeout(onClose, 420);
    return () => clearTimeout(t);
  }, [keluar, onClose]);

  useEffect(() => {
    tutupRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    window.addEventListener("keydown", onKey);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = lama;
    };
  }, [tutup]);

  // Angka raksasa bergeser tipis mengikuti kursor (tanpa render React).
  const gerak = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = lembarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", String(((e.clientX - r.left) / r.width) * 2 - 1));
    el.style.setProperty("--py", String(((e.clientY - r.top) / r.height) * 2 - 1));
  };

  const kata = fitur.title.split(" ");
  const SANS = { fontFamily: "var(--font-sans)" } as const;
  const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

  return (
    <div
      className="fitur-latar fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      data-keluar={keluar}
      onClick={tutup}
    >
      <div
        ref={lembarRef}
        role="dialog"
        aria-modal="true"
        aria-label={fitur.title}
        onClick={(e) => e.stopPropagation()}
        onPointerMove={gerak}
        className="fitur-lembar relative max-h-[96vh] w-full max-w-4xl overflow-hidden text-white"
        data-keluar={keluar}
        style={{ backgroundColor: warna }}
      >
        {/* Angka raksasa samar, terpotong di pojok kanan bawah */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[7%] -right-[2%] select-none">
          <div className="fitur-angka-besar">
            <p
              className="fitur-sejajar text-[clamp(11rem,34vw,24rem)] leading-[0.8] tracking-[-0.08em] text-white/[0.07]"
              style={{ ...SANS, fontWeight: 900 }}
            >
              {nomor}
            </p>
          </div>
        </div>

        <button
          ref={tutupRef}
          type="button"
          onClick={tutup}
          aria-label="Tutup penjelasan"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center text-white/70 transition-[color,transform] duration-300 hover:rotate-90 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Tanpa gulir: semua ukuran (judul, jarak, teks) memakai clamp berbasis TINGGI layar */}
        <div className="relative px-[clamp(1.25rem,5vw,3.5rem)] py-[clamp(1.1rem,4.2vh,3.25rem)]">
          {/* Label + garis + penanda halaman */}
          <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/65" style={SANS}>
            <span className="fitur-geser" style={d(380)}>
              Fitur
            </span>
            <span className="fitur-garis-x h-px flex-1 bg-white/30" style={d(460)} />
            <span className="fitur-geser pr-10 tabular-nums" style={d(420)}>
              {nomor} / {String(STAGE_CARDS.length).padStart(2, "0")}
            </span>
          </div>

          {/* Judul bertingkat: tiap baris naik dari balik topeng & menjorok bergantian */}
          <h3
            className="mt-[clamp(0.9rem,3.2vh,2.2rem)] text-[clamp(1.9rem,min(6.4vw,8vh),4.4rem)] leading-[0.94] tracking-[-0.05em]"
            style={{ ...SANS, fontWeight: 800 }}
          >
            {kata.map((w, i) => (
              <span key={i} className="block overflow-hidden pb-[0.06em]" style={{ paddingLeft: i % 2 ? "clamp(1.25rem, 6vw, 5rem)" : 0 }}>
                <span className="fitur-naik block" style={d(520 + i * 110)}>
                  {w}
                </span>
              </span>
            ))}
          </h3>

          <div className="mt-[clamp(1rem,4vh,3rem)] grid gap-[clamp(1rem,3.5vh,2.5rem)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-[clamp(1.5rem,4vw,3.5rem)]">
            {/* Kalimat pembuka berpagar garis tegak */}
            <div className="relative pl-6">
              <span className="fitur-garis-y absolute bottom-0 left-0 top-1 w-px bg-white/40" style={d(900)} />
              <p
                className="fitur-geser text-[clamp(0.85rem,min(1.6vw,2.2vh),1.05rem)] leading-[1.65] text-white/90"
                style={{ ...SANS, ...d(960) }}
              >
                {isi.lead}
              </p>
            </div>

            {/* Poin: nomor besar-tipis + garis rambut yang menggambar diri */}
            <ol>
              {isi.poin.map((p, i) => (
                <li key={i} className="relative grid grid-cols-[2.8rem_minmax(0,1fr)] items-baseline gap-x-4 py-[clamp(0.5rem,1.9vh,1.05rem)]">
                  <span className="fitur-garis-x absolute inset-x-0 top-0 h-px bg-white/25" style={d(1000 + i * 120)} />
                  <span
                    className="fitur-geser text-[clamp(1.4rem,3.6vh,2.1rem)] leading-none tracking-[-0.04em] tabular-nums text-white/55"
                    style={{ ...SANS, fontWeight: 200, ...d(1060 + i * 120) }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="fitur-geser text-[clamp(0.8rem,min(1.5vw,2vh),0.95rem)] leading-[1.55] text-white/80" style={{ ...SANS, ...d(1100 + i * 120) }}>
                    {p}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Features() {
  // Warna tiap kartu (indeks ke EGG_COLORS).
  const reducedMotion = useReducedMotion();
  const [bases, setBases] = useState<number[]>([0, 0, 0, 0]);
  const downTargetRef = useRef<EventTarget | null>(null);
  // Fitur yang penjelasan lengkapnya sedang dibuka (indeks ke STAGE_CARDS).
  const [detail, setDetail] = useState<number | null>(null);
  const tutupDetail = useCallback(() => setDetail(null), []);

  // Satu langkah, satu warna: kartu langsung menuju warna berikutnya lewat
  // transisi background-color pada kartunya (tanpa lapisan perantara yang bisa
  // menampilkan warna antara yang lebih terang atau lebih gelap dari keduanya).
  const triggerEgg = (card: number) => {
    setBases((b) => b.map((v, i) => (i === card ? (v + 1) % EGG_COLORS.length : v)));
  };

  // ============================
  // DUA TAMPILAN, DUA GESTUR di section ini:
  //  - BAWAAN = BARISAN lurus (`flat` = 1): kartu tengah paling besar & tajam,
  //    tetangganya mengecil bertahap & sedikit buram. Menggeser KARTU menggeser barisan.
  //  - Menggeser JUDUL "Fitur" (>40px) BERGANTIAN barisan ↔ cincin 3D (`flat` 0)
  //    dan memutar ulang acak alfabet judul. Judulnya sendiri TIDAK bergeser, dan
  //    KARTU YANG DISOROT TIDAK BERUBAH: geseran judul hanya mengganti bentuk
  //    (dulu ikut memajukan kartu satu langkah, sehingga 01 jadi 02 dst).
  // ============================

  const flatTargetRef = useRef(1);
  const flatRef = useRef(1);
  const flatVelRef = useRef(0);

  const [judulKe, setJudulKe] = useState(0);
  const tarikRef = useRef<{ id: number; x0: number; dx: number; flat0: number; sudah: boolean } | null>(null);
  const lastSwapRef = useRef(0);

  /** Memasang ulang judul (key berganti) → acak alfabetnya mulai dari awal. */
  const resetJudul = useCallback(() => {
    const now = performance.now();
    // Geseran cepat melewati beberapa langkah tak perlu mengulang berkali-kali.
    if (now - lastSwapRef.current < 450) return;
    lastSwapRef.current = now;
    setJudulKe((k) => k + 1);
  }, []);

  // --- Menggeser JUDUL ---------------------------------------------------
  const judulTurun = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    tarikRef.current = { id: e.pointerId, x0: e.clientX, dx: 0, flat0: flatTargetRef.current, sudah: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const judulGerak = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = tarikRef.current;
    if (!t || e.pointerId !== t.id) return;
    const dx = e.clientX - t.x0;
    t.dx = dx;
    // Geseran judul membalik bentuk (barisan ↔ cincin); pratinjaunya langsung terlihat.
    // Posisi putar dibulatkan ke kartu terdekat SEKALI di awal supaya kartu yang
    // disorot sama di kedua bentuk dan peralihannya mulus; setelah itu tak diubah.
    if (Math.abs(dx) > 10 && !t.sudah) {
      t.sudah = true;
      flatTargetRef.current = t.flat0 === 1 ? 0 : 1;
      rotationTargetRef.current = Math.round(rotationTargetRef.current);
    }
  };

  const judulLepas = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = tarikRef.current;
    if (!t || e.pointerId !== t.id) return;
    tarikRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture sudah dilepas.
    }

    const dx = t.dx;
    if (Math.abs(dx) <= 40) {
      // Geseran terlalu pendek: bentuk kembali seperti semula.
      flatTargetRef.current = t.flat0;
      return;
    }

    // Bentuk sudah berbalik; kartu yang disorot TETAP (rotasi sudah bulat di atas).
    resetJudul();
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);


  // ============================
  // CAROUSEL ROTATION
  // ============================

  const rotationRef = useRef(0);
  const rotationTargetRef = useRef(0);

  // ============================
  // DRAG
  // ============================

  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartRotation = useRef(0);

  // ============================
  // CURSOR WOBBLE
  // ============================

  const wobbleTarget = useRef({
    x: 0,
    y: 0,
  });

  const wobbleCurrent = useRef({
    x: 0,
    y: 0,
  });

  const frontIndexRef = useRef(0);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    let raf = 0;

    // ========================================
    // APPLY 3D CARD TRANSFORMS
    // ========================================

    const applyTransforms = () => {
      const cards = cardRefs.current;
      const count = cards.length;

      if (!count) {
        raf = requestAnimationFrame(applyTransforms);
        return;
      }

      // Smooth rotation
      rotationRef.current = lerp(
        rotationRef.current,
        rotationTargetRef.current,
        0.12
      );

      // Cincin → barisan (dan sebaliknya) meluncur halus
      // Pegas yang diredam hampir kritis (kekakuan 0,010; redaman 0,80): mulai
      // pelan, melaju, lalu mendarat tanpa memantul - lebih lembut daripada lerp
      // eksponensial yang selalu mulai dengan lonjakan terbesar.
      flatVelRef.current += (flatTargetRef.current - flatRef.current) * 0.01;
      flatVelRef.current *= 0.8;
      flatRef.current = clamp(flatRef.current + flatVelRef.current, 0, 1);
      const f = flatRef.current;
      // Pencampuran memakai smootherstep (6f⁵-15f⁴+10f³): turunan awal & akhir nol.
      const fe = f * f * f * (f * (f * 6 - 15) + 10);

      // Smooth cursor wobble
      wobbleCurrent.current.x = lerp(
        wobbleCurrent.current.x,
        wobbleTarget.current.x,
        0.12
      );

      wobbleCurrent.current.y = lerp(
        wobbleCurrent.current.y,
        wobbleTarget.current.y,
        0.12
      );

      const vw = window.innerWidth;
      const mobile = vw < 640;

      // ========================================
      // CARD WIDTH / STAGE SPREAD
      // ========================================

      const radiusX = mobile
        ? Math.min(vw * 0.58, 230)
        : Math.min(vw * 0.26, 370);

      const radiusZ = mobile
        ? Math.min(vw * 0.24, 130)
        : Math.min(vw * 0.15, 200);

      // Cincin memakai 4 kartu asli. Di barisan dipakai 8 slot (4 asli + 4
      // bayangan, fitur berulang) supaya sisi kanan/kiri tak berlubang dan kartu
      // yang melompat ke sisi seberang selalu berada jauh di luar layar.
      const base = STAGE_CARDS.length;
      const step = (Math.PI * 2) / base;

      // ========================================
      // FIND FRONT CARD
      // ========================================

      let frontIndex = 0;
      let frontDepth = -1;

      cards.forEach((card, index) => {
        if (!card || index >= base) return;

        const angle =
          (index - rotationRef.current) * step;

        const cos = Math.cos(angle);
        const depth = (cos + 1) / 2;

        if (depth > frontDepth) {
          frontDepth = depth;
          frontIndex = index;
        }
      });

      frontIndexRef.current = frontIndex;

      // ========================================
      // POSITION EVERY CARD
      // ========================================

      cards.forEach((card, index) => {
        if (!card) return;

        const ghost = index >= base;
        // Posisi cincin: kartu bayangan menyalin kartu aslinya.
        const angle =
          ((index % base) - rotationRef.current) * step;

        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const x = sin * radiusX;

        const z =
          (cos - 1) * radiusZ;

        const depth =
          (cos + 1) / 2;

        const rotateY =
          sin * (mobile ? 22 : 32);

        const scale =
          0.74 +
          Math.pow(depth, 1.6) * 0.26;

        // ========================================
        // IMPORTANT:
        // CARD SELALU OPAQUE
        // ========================================

        const opacity = 1;

        const blur =
          depth < 0.3
            ? 2.2
            : depth < 0.6
              ? 0.8
              : 0;

        const y =
          depth > 0.7
            ? -(depth - 0.7) * 10
            : 0;

        // d = jarak bertanda dari tengah barisan (melingkar 8 slot, -4 ≤ d < 4).
        let d = (((index - rotationRef.current) % count) + count) % count;
        if (d >= count / 2) d -= count;
        const absD = Math.abs(d);

        const isFront = f < 0.5 ? index === frontIndex : absD < 0.5;
        // Penanda untuk ketuk(): hanya kartu yang DISOROT yang membuka penjelasan lengkap.
        card.dataset.sorot = isFront ? "1" : "0";

        const wobbleRotX = isFront
          ? wobbleCurrent.current.y * -8
          : 0;

        const wobbleRotY = isFront
          ? wobbleCurrent.current.x * 8
          : 0;

        // Posisi sebagai BARISAN lurus. Ukuran MENGECIL BERTAHAP menjauhi tengah
        // (skala 1,1 → ×0,76 tiap langkah) supaya kartu tampak berurutan, dan
        // jarak tiap pasangan kartu mengikuti lebar keduanya: celahnya selalu 28px.
        const lebar = card.offsetWidth || 410;
        const skala = (k: number) => 1.1 * Math.pow(0.76, k);
        const jarakKe = (k: number) => (lebar * (skala(k) + skala(k + 1))) / 2 + 28;
        const lantai = Math.floor(absD);
        let xr = 0;
        for (let k = 0; k < lantai; k++) xr += jarakKe(k);
        xr += (absD - lantai) * jarakKe(lantai);
        const xRow = Math.sign(d) * xr;

        const xm = lerp(x, xRow, fe);
        const ym = lerp(y, 0, fe);
        const zm = lerp(z, -absD * 40, fe);
        const rotateYm = lerp(rotateY, 0, fe);
        const sm = lerp(scale, skala(absD), fe);
        const blurm = lerp(blur, Math.min(absD, 2) * 1.8, fe);
        const depthm = lerp(depth, Math.max(0, 1 - absD * 0.5), fe);

        card.style.transform = `
          translate3d(
            ${xm.toFixed(2)}px,
            ${ym.toFixed(2)}px,
            ${zm.toFixed(2)}px
          )
          rotateX(${wobbleRotX.toFixed(2)}deg)
          rotateY(
            ${(rotateYm + wobbleRotY).toFixed(2)}deg
          )
          scale(${sm.toFixed(3)})
        `;

        // Card tidak pernah transparan
        // Kartu bayangan HANYA terlihat saat barisan hampir terbentuk; saat kembali
        // ke cincin ia sudah lenyap lebih dulu. Dulu ia memudar bersamaan dengan
        // kartu asli sehingga tampak bertumpuk setengah transparan.
        const gh = Math.min(1, Math.max(0, (f - 0.55) / 0.4));
        const ghOp = gh * gh * (3 - 2 * gh);
        card.style.opacity = (ghost ? ghOp : opacity).toFixed(3);
        card.style.visibility = ghost && ghOp < 0.01 ? "hidden" : "visible";

        card.style.filter = blurm
          ? `blur(${blurm.toFixed(2)}px)`
          : "";

        card.style.zIndex =
          String(Math.round(depthm * 1000));

        // Semua kartu menerima penunjuk (kartu bayangan yang tersembunyi tidak, karena
        // visibility:hidden). Kartu mana yang diketuk ditentukan lewat geometri di
        // pointerup (lihat ketuk), bukan lewat hit-test peramban.
        card.style.pointerEvents = "auto";

        // ========================================
        // HOLOGRAM VARIABLES
        // ========================================

        card.style.setProperty(
          "--holo-strength",
          (
            0.35 +
            depthm * 0.65
          ).toFixed(3)
        );

        card.style.setProperty(
          "--holo-shift",
          `${(sin * 55).toFixed(2)}%`
        );

        card.style.setProperty(
          "--content-shift",
          `${(sin * 14).toFixed(2)}px`
        );
      });

      raf = requestAnimationFrame(
        applyTransforms
      );
    };

    // ========================================
    // UPDATE CURSOR POSITION
    // ========================================

    const updateWobble = (
      clientX: number,
      clientY: number
    ) => {
      const rect =
        stage.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }

      wobbleTarget.current = {
        x: clamp(
          ((clientX - rect.left) /
            rect.width) *
            2 -
            1,
          -1,
          1
        ),

        y: clamp(
          ((clientY - rect.top) /
            rect.height) *
            2 -
            1,
          -1,
          1
        ),
      };

      // ========================================
      // HOLOGRAM LIGHT
      // ========================================

      const front =
        cardRefs.current[
          frontIndexRef.current
        ];

      if (!front) return;

      const rectCard =
        front.getBoundingClientRect();

      if (
        rectCard.width <= 0 ||
        rectCard.height <= 0
      ) {
        return;
      }

      front.style.setProperty(
        "--mouse-x",
        `${(
          ((clientX - rectCard.left) /
            rectCard.width) *
          100
        ).toFixed(2)}%`
      );

      front.style.setProperty(
        "--mouse-y",
        `${(
          ((clientY - rectCard.top) /
            rectCard.height) *
          100
        ).toFixed(2)}%`
      );
    };

    // ========================================
    // KETUK KARTU
    // Kartu yang dituju dicari lewat GEOMETRI (kotak pembatas yang sudah
    // memperhitungkan transform 3D) diperluas KETUK_PAD di tiap sisi, bukan lewat
    // elemen di bawah penunjuk. Kartu yang sedang bergerak/berputar, miring, atau
    // buram jadi jauh lebih mudah dikenai; bila beberapa kartu terkena, yang paling
    // depan (z-index tertinggi) menang. Angka = ganti warna, bagian lain = penjelasan.
    // ========================================

    const KETUK_PAD = 28;
    const EGG_PAD = 14;

    const ketuk = (x: number, y: number) => {
      let terbaik: HTMLElement | null = null;
      let zTerbaik = -1;

      for (const card of cardRefs.current) {
        if (!card || card.style.visibility === "hidden") continue;
        const r = card.getBoundingClientRect();
        if (
          x < r.left - KETUK_PAD ||
          x > r.right + KETUK_PAD ||
          y < r.top - KETUK_PAD ||
          y > r.bottom + KETUK_PAD
        ) {
          continue;
        }
        const z = Number(card.style.zIndex) || 0;
        if (z > zTerbaik) {
          zTerbaik = z;
          terbaik = card;
        }
      }

      if (!terbaik) return;

      const egg = terbaik.querySelector<HTMLElement>("[data-egg]");
      if (egg) {
        const er = egg.getBoundingClientRect();
        if (
          x >= er.left - EGG_PAD &&
          x <= er.right + EGG_PAD &&
          y >= er.top - EGG_PAD &&
          y <= er.bottom + EGG_PAD
        ) {
          // .click() memanggil onClick React pada tombol angka.
          egg.click();
          return;
        }
      }

      // Penjelasan lengkap HANYA untuk kartu yang disorot; kartu lain diabaikan.
      if (terbaik.dataset.sorot === "1") setDetail(Number(terbaik.dataset.fitur));
    };

    // ========================================
    // POINTER DOWN
    // ========================================

    const handlePointerDown = (
      e: PointerEvent
    ) => {
      dragging.current = true;

      downTargetRef.current = e.target;

      dragStartX.current =
        e.clientX;
      dragStartY.current =
        e.clientY;

      dragStartRotation.current =
        rotationTargetRef.current;

      stage.setPointerCapture(
        e.pointerId
      );

      stage.style.cursor =
        "grabbing";

      updateWobble(
        e.clientX,
        e.clientY
      );
    };

    // ========================================
    // POINTER MOVE
    // ========================================

    const handlePointerMove = (
      e: PointerEvent
    ) => {
      updateWobble(
        e.clientX,
        e.clientY
      );

      if (!dragging.current) {
        return;
      }

      const deltaX =
        e.clientX -
        dragStartX.current;

      const sensitivity = 180;

      rotationTargetRef.current =
        dragStartRotation.current -
        deltaX / sensitivity;
    };

    // ========================================
    // POINTER UP
    // ========================================

    const handlePointerUp = (
      e: PointerEvent
    ) => {
      dragging.current = false;

      try {
        stage.releasePointerCapture(
          e.pointerId
        );
      } catch {
        // Pointer capture sudah dilepas.
      }

      stage.style.cursor =
        "grab";

      // Mode barisan: berhenti tepat pada satu kartu (yang disorot). Cincin tetap bebas.
      if (flatTargetRef.current === 1 && Math.abs(e.clientX - dragStartX.current) >= 6) {
        rotationTargetRef.current = Math.round(rotationTargetRef.current);
      }

      downTargetRef.current = null;

      if (
        e.type === "pointerup" &&
        Math.hypot(e.clientX - dragStartX.current, e.clientY - dragStartY.current) < 10
      ) {
        ketuk(e.clientX, e.clientY);
      }
    };

    // ========================================
    // POINTER LEAVE
    // ========================================

    const handlePointerLeave = () => {
      if (dragging.current) {
        return;
      }

      wobbleTarget.current = {
        x: 0,
        y: 0,
      };

      cardRefs.current.forEach(
        (card) => {
          if (!card) return;

          card.style.removeProperty(
            "--mouse-x"
          );

          card.style.removeProperty(
            "--mouse-y"
          );
        }
      );
    };

    // ========================================
    // EVENT LISTENERS
    // ========================================

    stage.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    stage.addEventListener(
      "pointermove",
      handlePointerMove
    );

    stage.addEventListener(
      "pointerup",
      handlePointerUp
    );

    stage.addEventListener(
      "pointercancel",
      handlePointerUp
    );

    stage.addEventListener(
      "pointerleave",
      handlePointerLeave
    );

    stage.style.cursor =
      "grab";

    // ========================================
    // START ANIMATION
    // ========================================

    if (!reducedMotion) {
      raf =
        requestAnimationFrame(
          applyTransforms
        );
    } else {
      applyTransforms();
    }

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      stage.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      stage.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      stage.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      stage.removeEventListener(
        "pointercancel",
        handlePointerUp
      );

      stage.removeEventListener(
        "pointerleave",
        handlePointerLeave
      );

      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [reducedMotion]);

  return (
    <section
      id="features"
      className="
        overflow-x-clip
        bg-ivory
        py-28
      "
    >
      <div className="container-page">

        {/* ======================================
            HEADING
        ====================================== */}

        <div
          className="flex cursor-grab touch-pan-y select-none flex-col items-center text-center active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          onPointerDown={judulTurun}
          onPointerMove={judulGerak}
          onPointerUp={judulLepas}
          onPointerCancel={judulLepas}
        >
          {/* key berganti → SectionTitle dipasang ulang → acak alfabet mulai dari awal */}
          <div key={`judul-${judulKe}`}>
            <SectionTitle as="h1" title="Fitur" />
          </div>
        </div>

        {/* ======================================
            CARD STAGE
        ====================================== */}

        <div className="relative mt-8">

          <div
            ref={stageRef}
            className="
              features-stage
              relative
              select-none
              touch-pan-y
            "
            style={{
              height:
                "min(620px, 75vh)",

              overflow:
                "visible",

              touchAction:
                "pan-y",
            }}
          >

            <div className="cards-stack">

              {SLOTS.map(
                ({ index, slot, ghost, ...feat }) => (

                  <div
                    key={slot}
                    ref={(el) => {
                      cardRefs.current[
                        slot
                      ] = el;
                    }}
                    data-fitur={index}
                    aria-hidden={ghost || undefined}
                    className="
                      feature-card
                      group
                      relative
                      overflow-hidden
                    "
                    style={{
                      width:
                        "clamp(280px, 68vw, 410px)",

                      maxWidth:
                        "410px",

                      /* Kotak solid, tanpa garis, bayangan, kaca, atau
                         lapisan holo - kesannya datang dari tipografi. */
                      backgroundColor:
                        EGG_COLORS[bases[index]],
                      transition: reducedMotion ? "none" : "background-color 650ms cubic-bezier(0.4, 0, 0.2, 1)",

                      borderRadius: 0,
                      opacity: 1,
                      border: "none",
                      outline: "none",
                      boxShadow: "none",
                      backdropFilter: "none",
                      WebkitBackdropFilter: "none",
                    }}
                  >

                    <div
                      className="
                        feature-card__content
                        relative
                        z-10
                        flex
                        h-full
                        flex-col
                        justify-between
                        p-9
                        max-sm:p-6
                      "
                    >

                      {/* Angka besar — juga pemicu easter egg ganti warna kartu */}
                      <button
                        type="button"
                        data-egg={index}
                        tabIndex={ghost ? -1 : undefined}
                        onClick={() => triggerEgg(index)}
                        aria-label="Ganti warna kartu"
                        className="
                          cursor-pointer
                          select-none
                          self-start
                          text-left
                          text-white
                          focus-visible:outline-none
                        "
                        style={{
                          fontFamily:
                            "var(--font-sans)",

                          fontSize:
                            "clamp(4.5rem, 10vw, 7rem)",

                          fontWeight: 900,

                          lineHeight: 0.8,

                          letterSpacing:
                            "-0.08em",
                        }}
                      >
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </button>

                      <div>
                        {/* Judul: tiap kata satu baris */}
                        <h2
                          className="text-white"
                          style={{
                            fontFamily:
                              "var(--font-sans)",

                            fontSize:
                              "clamp(2.1rem, 4.2vw, 3.1rem)",

                            fontWeight: 800,

                            lineHeight: 0.98,

                            letterSpacing:
                              "-0.04em",
                          }}
                        >
                          {feat.title
                            .split(" ")
                            .map((word, w) => (
                              <span key={w} className="block">
                                {word}
                              </span>
                            ))}
                        </h2>

                        <p
                          className="
                            mt-5
                            max-w-[30ch]
                            text-[1.0625rem]
                            leading-[1.6]
                            text-white
                          "
                          style={{
                            fontFamily:
                              "var(--font-sans)",
                          }}
                        >
                          {feat.desc}
                        </p>
                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

        </div>

      </div>
      {detail !== null && (
        <DetailFitur
          key={detail}
          idx={detail}
          warna={EGG_COLORS[bases[detail]]}
          onClose={tutupDetail}
        />
      )}
    </section>
  );
}