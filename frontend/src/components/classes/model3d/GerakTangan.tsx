"use client";
import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { KontrolAdegan } from "@/components/classes/model3d/Model3DScene";
import { cn } from "@/lib/cn";

/**
 * Kontrol gerakan tangan untuk objek 3D (layar penuh): kamera depan dibaca
 * pelacak tangan MediaPipe, lalu gerak tangan diterjemahkan jadi putaran,
 * penunjuk, dan zoom.
 *
 *  - TANGAN TERBUKA bergerak            → memutar objek (searah gerak tangan)
 *  - TELUNJUK SAJA (jari lain dilipat)  → menunjuk: ujung telunjuk jadi kursor; arahkan ke komponen
 *                                          lalu TAHAN sebentar → keterangan komponen itu tampil
 *  - DUA JARI (telunjuk + tengah) naik/turun → zoom masuk/keluar
 *  - KEPALAN                            → jeda (objek diam)
 *
 * Zoom dulu memakai cubitan jempol-telunjuk, tetapi ambangnya terlalu sempit
 * sehingga sulit diaktifkan; dua jari terangkat jauh lebih mudah dikenali.
 *
 * Privasi: gambar kamera hanya diproses di perangkat ini - tidak direkam, tidak
 * dikirim ke server mana pun, dan TIDAK ditampilkan (pratinjau hanya kerangka tangan;
 * elemen video disembunyikan). Yang diunduh hanya model pelacak (±8 MB, sekali per
 * sesi dari penyimpanan publik Google) dan WASM-nya dari jsDelivr (versi dipatok).
 * Izin kamera hanya diminta saat tombolnya ditekan; stream dimatikan saat komponen
 * dilepas (tombol dimatikan / keluar layar penuh).
 */

const VERSI = "0.10.17";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSI}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Radian putaran untuk gerak tangan selebar seluruh bingkai kamera. */
const GAIN_PUTAR = 4.2;
/** Faktor zoom per satuan gerak vertikal (fraksi bingkai). */
const GAIN_ZOOM = 3.2;
/** Gerak lebih kecil dari ini (fraksi bingkai) dianggap getar tangan. */
const ZONA_MATI = 0.0035;
/** Bingkai berturut-turut yang harus sepakat sebelum gestur berganti (menahan kedipan salah-baca). */
const BINGKAI_STABIL = 3;
/** Lama menahan penunjuk di satu komponen sebelum keterangannya tampil (ms). */
const TAHAN_PILIH_MS = 350;
/** Setelah memilih, kamera bergeser memusat ke komponen itu (komponen "lari" dari bawah jari): selama ini menunjuk ruang kosong TIDAK menutup keterangan. */
const MASA_REDA_PASCA_PILIH_MS = 1500;
/** Pengisian hitungan tahan susut sebanyak ini x lebih cepat saat sinar lepas dari komponen (bukan langsung nol: getar tangan di tepi komponen tak membatalkan). */
const PELUANG_SUSUT = 1.1;
/** Sorotan komponen bertahan sesingkat ini setelah sinar lepas (getar tangan di tepi komponen tak mengulang hitungan). */
const TOLERANSI_LEPAS_MS = 280;
/** Lama menunjuk ruang kosong sebelum keterangan ditutup (ms) - SENGAJA tak dipercepat bersama waktu pilih. */
const TAHAN_TUTUP_MS = 1600;
/** Jangkauan tangan di bingkai kamera dipetakan ke seluruh layar (>1 = tepi layar lebih mudah dicapai). */
const PERBESAR_JANGKAUAN = 1.7;

type Mode = "putar" | "tunjuk" | "zoom" | "jeda";
type Status = { jenis: "memuat" } | { jenis: "galat"; pesan: string } | { jenis: "siap"; mode: Mode | null };

const KETERANGAN: Record<Mode, string> = {
  putar: "Memutar: gerakkan tangan terbuka",
  tunjuk: "Menunjuk: arahkan ke komponen, tahan sebentar",
  zoom: "Zoom: dua jari, naik = perbesar, turun = perkecil",
  jeda: "Jeda: buka tangan untuk memutar lagi",
};

const LABEL_PENDEK: Record<Mode, string> = { putar: "Putar", tunjuk: "Tunjuk", zoom: "Zoom", jeda: "Jeda" };

const jarak = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

/** [telunjuk, tengah, manis, kelingking] lurus? Ujung lebih jauh dari pergelangan daripada sendi tengahnya (tahan terhadap arah tangan). */
function jariLurus(h: NormalizedLandmark[]): [boolean, boolean, boolean, boolean] {
  const ujung = [8, 12, 16, 20];
  const sendi = [6, 10, 14, 18];
  const r = ujung.map((u, i) => jarak(h[u], h[0]) > jarak(h[sendi[i]], h[0]) * 1.08);
  return [r[0], r[1], r[2], r[3]];
}

function klasifikasi(h: NormalizedLandmark[]): Mode {
  const [tel, teng, manis, kel] = jariLurus(h);
  if (tel && !teng && !manis && !kel) return "tunjuk";
  if (tel && teng && !manis && !kel) return "zoom";
  const lurus = [tel, teng, manis, kel].filter(Boolean).length;
  return lurus >= 3 ? "putar" : "jeda";
}

function pesanGalat(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") return "Izin kamera ditolak. Izinkan kamera di pengaturan peramban lalu coba lagi.";
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError") return "Kamera tidak ditemukan di perangkat ini.";
    if (e.name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain.";
  }
  return "Kontrol gerakan tangan tidak bisa dimulai di peramban ini.";
}

/** Bentuk panah kursor (ujung di 4,4 = titik seleksi). */
const PANAH = "M4 4 L4 42 L13 33.5 L19.5 48 L27 44.5 L20.5 31 L33 30.5 Z";

/**
 * MediaPipe menulis pesan INFO (mis. "Created TensorFlow Lite XNNPACK delegate for CPU") lewat console.error. Itu bukan galat,
 * tetapi overlay dev Next menghitung tiap console.error sebagai "issue" - pesan itu disaring selama kontrol tangan hidup
 * (galat sungguhan tetap lewat).
 */
const BISING_MEDIAPIPE = /TensorFlow Lite|XNNPACK|inference_feedback_manager|gl_context|landmark_projection/i;

function saringBisingMediaPipe(): () => void {
  const asliError = console.error;
  const asliWarn = console.warn;
  const bungkus =
    (asli: typeof console.error) =>
    (...argumen: unknown[]) => {
      if (typeof argumen[0] === "string" && BISING_MEDIAPIPE.test(argumen[0])) return;
      asli.apply(console, argumen);
    };
  const err = bungkus(asliError);
  const warn = bungkus(asliWarn);
  console.error = err;
  console.warn = warn;
  return () => {
    // Dipulihkan hanya bila tak ada pihak lain yang menimpa sesudah kita.
    if (console.error === err) console.error = asliError;
    if (console.warn === warn) console.warn = asliWarn;
  };
}

const jepit = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

export default function GerakTangan({
  kontrol,
  onGerak,
  onPilih,
  onTutup,
}: {
  kontrol: MutableRefObject<KontrolAdegan | null>;
  /** Dipanggil saat tangan benar-benar menggerakkan objek (mematikan putar otomatis). */
  onGerak: () => void;
  /** Keterangan komponen yang ditunjuk (id), atau null untuk menutup keterangan. */
  onPilih: (id: string | null) => void;
  onTutup: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const kursor = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ jenis: "memuat" });
  // Bawaan DIKECILKAN (persegi panjang di tepi kanan) supaya tak menutupi objek; pelacakan tetap berjalan.
  const [kecil, setKecil] = useState(true);
  // Posisi vertikal batang kecil (px dari atas panggung); null = bawaan di bawah. Hanya bisa digeser naik-turun.
  const [atas, setAtas] = useState<number | null>(null);
  const batang = useRef<HTMLDivElement>(null);
  const seret = useRef<{ y: number; awal: number; geser: boolean } | null>(null);

  // Callback dipegang lewat ref supaya efek kamera tidak dimulai ulang tiap render induk.
  const onGerakRef = useRef(onGerak);
  const onPilihRef = useRef(onPilih);
  useEffect(() => {
    onGerakRef.current = onGerak;
    onPilihRef.current = onPilih;
  }, [onGerak, onPilih]);

  useEffect(() => {
    let batal = false;
    let raf = 0;
    let aliran: MediaStream | null = null;
    let pelacak: HandLandmarker | null = null;
    let hubungan: { start: number; end: number }[] = [];
    const elVideo = video.current;
    const pulihkanKonsol = saringBisingMediaPipe();

    async function mulai() {
      try {
        const [{ FilesetResolver, HandLandmarker }, stream] = await Promise.all([
          import("@mediapipe/tasks-vision"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        ]);
        aliran = stream;
        if (batal) return;

        const el = elVideo;
        if (!el) return;
        el.srcObject = stream;
        await el.play();

        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const buat = (delegate: "GPU" | "CPU") =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL, delegate },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minTrackingConfidence: 0.5,
          });
        hubungan = HandLandmarker.HAND_CONNECTIONS;
        pelacak = await buat("GPU").catch(() => buat("CPU"));
        if (batal) return;
        setStatus({ jenis: "siap", mode: null });

        let waktuTerakhir = -1;
        let sebelum: { x: number; y: number } | null = null;
        let halus: { x: number; y: number } | null = null;
        let modeAktif: Mode | null = null; // gestur yang SAH (sudah stabil)
        let usul: Mode | null = null;
        let hitungUsul = 0;
        let kursorHalus: { x: number; y: number } | null = null;
        let idTerakhir: string | null = null;
        let terakhirAda = 0;
        // Penahan penunjuk: komponen yang sedang ditunggu & kapan mulai ditunjuk.
        let idTerpilih: string | null = null;
        let kosongSejak = 0;
        let waktuPilih = 0;
        let tProses = 0;
        // Hitungan tahan per komponen (0..1): mengisi saat ditunjuk, menyusut perlahan saat lepas.
        const isiTahan = new Map<string, number>();
        let kursorSebelum: { x: number; y: number } | null = null;

        const lepasPenunjuk = () => {
          kontrol.current?.tunjuk(null, null);
          if (kursor.current) kursor.current.style.opacity = "0";
          isiTahan.clear();
          kosongSejak = 0;
          kursorSebelum = null;
        };

        const bingkai = () => {
          raf = requestAnimationFrame(bingkai);
          if (!pelacak || el.readyState < 2 || el.currentTime === waktuTerakhir) return;
          if (document.visibilityState !== "visible") return;
          waktuTerakhir = el.currentTime;
          const sekarang = performance.now();

          const hasil = pelacak.detectForVideo(el, sekarang);
          const h = hasil.landmarks[0];
          gambar(h);

          if (!h) {
            sebelum = null;
            halus = null;
            usul = null;
            hitungUsul = 0;
            if (modeAktif !== null) {
              if (modeAktif === "tunjuk") lepasPenunjuk();
              modeAktif = null;
              setStatus({ jenis: "siap", mode: null });
            }
            return;
          }

          // Gestur baru baru sah setelah beberapa bingkai berturut-turut sepakat.
          const calon = klasifikasi(h);
          if (calon === usul) hitungUsul++;
          else {
            usul = calon;
            hitungUsul = 1;
          }
          if (calon !== modeAktif && hitungUsul >= BINGKAI_STABIL) {
            if (modeAktif === "tunjuk") lepasPenunjuk();
            modeAktif = calon;
            sebelum = null; // titik acuan baru: perpindahan gestur tak melontarkan objek
            kursorHalus = null;
            isiTahan.clear();
            kosongSejak = 0;
            kursorSebelum = null;
            setStatus({ jenis: "siap", mode: calon });
          }
          if (modeAktif === null) return;

          // x dicerminkan: kamera depan = cermin, jadi gerak ke kanan di layar = ke kanan menurut pengguna.
          const pusat = { x: 1 - (h[0].x + h[9].x) / 2, y: (h[0].y + h[9].y) / 2 };
          halus = halus ? { x: halus.x + (pusat.x - halus.x) * 0.5, y: halus.y + (pusat.y - halus.y) * 0.5 } : pusat;

          if (modeAktif === "tunjuk") {
            // Ujung telunjuk = kursor; jangkauan diperbesar agar tepi layar terjangkau tanpa menjulurkan tangan.
            const mentah = {
              x: jepit((1 - h[8].x - 0.5) * PERBESAR_JANGKAUAN + 0.5, 0, 1),
              y: jepit((h[8].y - 0.5) * PERBESAR_JANGKAUAN + 0.5, 0, 1),
            };
            // Penghalusan adaptif: diam = mantap (redam getar), bergerak cepat = nyaris tanpa tertinggal.
            const laju = kursorHalus ? Math.hypot(mentah.x - kursorHalus.x, mentah.y - kursorHalus.y) : 1;
            const alfa = jepit(0.3 + laju * 9, 0.3, 0.9);
            kursorHalus = kursorHalus
              ? { x: kursorHalus.x + (mentah.x - kursorHalus.x) * alfa, y: kursorHalus.y + (mentah.y - kursorHalus.y) * alfa }
              : mentah;
            const mentahId = kontrol.current?.tunjuk(kursorHalus.x, kursorHalus.y) ?? null;
            if (mentahId) {
              idTerakhir = mentahId;
              terakhirAda = sekarang;
            }
            const id = mentahId ?? (idTerakhir && sekarang - terakhirAda < TOLERANSI_LEPAS_MS ? idTerakhir : null);
            onGerakRef.current();

            const dt = tProses ? Math.min(100, sekarang - tProses) : 16;
            tProses = sekarang;
            // Pengisi bocor: naik saat ditunjuk, susut (tak langsung nol) saat sinar lepas atau pindah komponen.
            for (const [kunci, nilai] of isiTahan) {
              if (kunci === id) continue;
              const susut = nilai - (dt / TAHAN_PILIH_MS) * PELUANG_SUSUT;
              if (susut <= 0) isiTahan.delete(kunci);
              else isiTahan.set(kunci, susut);
            }
            let kemajuan = 0; // 0..1 untuk pengisian kursor
            if (id) {
              const naik = Math.min(1, (isiTahan.get(id) ?? 0) + dt / TAHAN_PILIH_MS);
              isiTahan.set(id, naik);
              kemajuan = id === idTerpilih ? 1 : naik;
              if (id !== idTerpilih && naik >= 1) {
                idTerpilih = id;
                waktuPilih = sekarang;
                isiTahan.clear();
                onPilihRef.current(id);
              }
              kosongSejak = 0;
            } else {
              kemajuan = Math.max(0, ...isiTahan.values());
              // Menunjuk ruang kosong cukup lama = tutup keterangan (kecuali masa reda sesudah memilih).
              if (idTerpilih && sekarang - waktuPilih > MASA_REDA_PASCA_PILIH_MS) {
                if (!kosongSejak) kosongSejak = sekarang;
                kemajuan = Math.min(1, (sekarang - kosongSejak) / TAHAN_TUTUP_MS);
                if (sekarang - kosongSejak >= TAHAN_TUTUP_MS) {
                  idTerpilih = null;
                  kosongSejak = 0;
                  onPilihRef.current(null);
                }
              }
            }

            const k = kursor.current;
            if (k) {
              k.style.opacity = "1";
              k.style.left = `${kursorHalus.x * 100}%`;
              k.style.top = `${kursorHalus.y * 100}%`;
              k.style.setProperty("--p", `${Math.round(kemajuan * 100)}%`);
              k.dataset.kena = id ? "ya" : "tidak";
              // Kursor 3D condong mengikuti arah gerak (kesan benda bervolume yang ditarik tangan).
              const dx = kursorSebelum ? kursorHalus.x - kursorSebelum.x : 0;
              const dy = kursorSebelum ? kursorHalus.y - kursorSebelum.y : 0;
              k.style.setProperty("--ry", `${jepit(24 + dx * 900, -30, 70)}deg`);
              k.style.setProperty("--rx", `${jepit(-16 - dy * 900, -55, 25)}deg`);
              kursorSebelum = { x: kursorHalus.x, y: kursorHalus.y };
            }
            return;
          }

          if (sebelum && modeAktif !== "jeda") {
            const dx = halus.x - sebelum.x;
            const dy = halus.y - sebelum.y;
            const k = kontrol.current;
            if (k && (Math.abs(dx) > ZONA_MATI || Math.abs(dy) > ZONA_MATI)) {
              if (modeAktif === "putar") {
                // Seperti menyeret objek: tangan ke kanan → permukaan depan ikut ke kanan.
                k.orbit(-dx * GAIN_PUTAR, -dy * GAIN_PUTAR * 0.8);
              } else {
                // Tangan naik (dy < 0) → mendekat.
                k.zoom(jepit(1 + dy * GAIN_ZOOM, 0.8, 1.2));
              }
              onGerakRef.current();
            }
          }
          sebelum = halus;
        };
        raf = requestAnimationFrame(bingkai);
      } catch (e) {
        if (!batal) {
          setStatus({ jenis: "galat", pesan: pesanGalat(e) });
          setKecil(false); // pesan galat harus terbaca, bukan tersembunyi di batang kecil
        }
      }
    }

    /**
     * Pratinjau = KERANGKA tangan di latar gelap, bukan gambar kamera: wajah dan latar
     * belakang tak pernah ditampilkan (videonya disembunyikan, hanya dibaca pelacak).
     */
    function gambar(h: NormalizedLandmark[] | undefined) {
      const c = kanvas.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      g.clearRect(0, 0, c.width, c.height);
      if (!h) return;
      g.strokeStyle = "rgba(34, 211, 238, 0.85)";
      g.lineWidth = 2;
      g.lineCap = "round";
      for (const { start, end } of hubungan) {
        g.beginPath();
        g.moveTo(h[start].x * c.width, h[start].y * c.height);
        g.lineTo(h[end].x * c.width, h[end].y * c.height);
        g.stroke();
      }
      g.fillStyle = "#fff";
      for (const p of h) {
        g.beginPath();
        g.arc(p.x * c.width, p.y * c.height, 3, 0, Math.PI * 2);
        g.fill();
      }
    }

    void mulai();
    const penunjuk = kontrol.current;
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      penunjuk?.tunjuk(null, null);
      pelacak?.close();
      pulihkanKonsol();
      aliran?.getTracks().forEach((t) => t.stop());
      if (elVideo) elVideo.srcObject = null;
    };
  }, [kontrol]);

  const mode = status.jenis === "siap" ? status.mode : null;
  const labelKecil = status.jenis === "memuat" ? "Menyiapkan…" : status.jenis === "galat" ? "Galat" : mode ? LABEL_PENDEK[mode] : "Cari tangan…";

  // Batang kecil: seret NAIK-TURUN (posisi x tetap di tepi kanan); tekan tanpa menggeser = buka panel.
  function mulaiSeret(e: ReactPointerEvent<HTMLDivElement>) {
    const el = batang.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seret.current = { y: e.clientY, awal: el.offsetTop, geser: false };
  }
  function geserSeret(e: ReactPointerEvent<HTMLDivElement>) {
    const d = seret.current;
    const el = batang.current;
    const induk = el?.offsetParent as HTMLElement | null;
    if (!d || !el || !induk) return;
    const selisih = e.clientY - d.y;
    if (Math.abs(selisih) > 4) d.geser = true;
    if (d.geser) setAtas(jepit(d.awal + selisih, 8, induk.clientHeight - el.offsetHeight - 8));
  }
  function akhiriSeret() {
    const d = seret.current;
    seret.current = null;
    if (d && !d.geser) setKecil(false);
  }

  return (
    <>
      {/* Kursor 3D (di atas panggung): UJUNG panah = titik seleksi sebenarnya. Terisi cyan dari bawah selama ditahan di komponen berketerangan. */}
      <div ref={kursor} className="gerak-kursor pointer-events-none absolute z-10" style={{ opacity: 0 }} aria-hidden="true">
        <div className="gerak-kursor-miring">
          <svg viewBox="0 0 48 60" width="48" height="60" className="absolute left-0 top-0 overflow-visible">
            <defs>
              <path id="gerak-panah" d={PANAH} />
              <linearGradient id="gerak-muka" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#bfe9f3" />
              </linearGradient>
            </defs>
            {/* Ketebalan: salinan bergeser ke kanan-bawah, makin dalam makin gelap. */}
            {[7, 6, 5, 4, 3, 2, 1].map((n) => (
              <use key={n} href="#gerak-panah" x={n * 0.9} y={n * 1.1} className="gerak-sisi" style={{ opacity: 0.45 + (7 - n) * 0.07 }} />
            ))}
            <use href="#gerak-panah" fill="url(#gerak-muka)" stroke="#06202b" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <div className="gerak-isi">
            <svg viewBox="0 0 48 60" width="48" height="60" className="absolute left-0 top-0 overflow-visible">
              <use href="#gerak-panah" fill="#22d3ee" stroke="#06202b" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Batang kecil (bawaan): persegi panjang TIPIS memanjang ke ATAS di tepi kanan. Tanpa teks/titik: batangnya sendiri menjadi
          BIRU saat tangan terdeteksi (redup berdenyut selama menyiapkan). Seret naik-turun untuk memindah; tekan tanpa geser = buka panel. */}
      {kecil && (
        <div
          ref={batang}
          role="button"
          tabIndex={0}
          aria-label={`Kontrol gerakan tangan: ${labelKecil}. Tekan untuk membuka panel, seret untuk menaik-turunkan.`}
          onPointerDown={mulaiSeret}
          onPointerMove={geserSeret}
          onPointerUp={akhiriSeret}
          onPointerCancel={() => (seret.current = null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setKecil(false);
            }
          }}
          data-tangan={mode ? "ya" : "tidak"}
          className={cn(
            "gerak-batang absolute right-0 z-10 h-[104px] w-4 cursor-grab touch-none select-none",
            status.jenis === "memuat" && "gerak-denyut",
            atas === null && "bottom-10",
          )}
          style={atas === null ? undefined : { top: atas }}
        >
          <span className="sr-only" aria-live="polite">
            {labelKecil}
          </span>
        </div>
      )}

      {/* Panel lengkap: tetap terpasang saat dikecilkan (disembunyikan) supaya video & kanvas pelacak tidak ikut dilepas. */}
      <div className={cn("gerak-kotak absolute bottom-10 right-3 z-10 w-[232px] text-white", kecil && "hidden")} role="region" aria-label="Kontrol gerakan tangan">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/60">
          {/* Tetap diputar (pelacak membaca bingkainya) tetapi TIDAK terlihat: wajah tak ditampilkan. */}
          <video ref={video} playsInline muted aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
          <canvas ref={kanvas} width={232} height={174} className="gerak-video absolute inset-0 h-full w-full" aria-hidden="true" />
          {status.jenis === "memuat" && (
            <p className="gerak-denyut absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] text-white/80">Menyiapkan kamera & pelacak tangan…</p>
          )}
          {status.jenis === "siap" && mode === null && (
            <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] text-white/70">Tunjukkan tangan Anda ke kamera</p>
          )}
          <button
            type="button"
            onClick={() => setKecil(true)}
            aria-label="Kecilkan panel"
            title="Kecilkan"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center bg-black/55 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
        </div>

        <div className="px-3 py-2.5">
          {status.jenis === "galat" ? (
            <p role="alert" className="text-[12px] leading-[1.5] text-white/85">
              {status.pesan}
            </p>
          ) : (
            <>
              <p aria-live="polite" className={cn("text-[12px] leading-[1.5]", mode ? "font-semibold text-[#67e8f9]" : "text-white/70")}>
                {mode ? KETERANGAN[mode] : "Pilih gestur di bawah"}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10.5px] leading-[1.45] text-white/55">
                <li>Tangan terbuka: putar</li>
                <li>Telunjuk saja: lihat keterangan komponen</li>
                <li>Dua jari naik/turun: zoom</li>
                <li>Kepalan: jeda</li>
              </ul>
            </>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] leading-[1.4] text-white/45">Hanya tangan yang dibaca, wajah tidak ditampilkan. Tidak direkam.</span>
            <button type="button" onClick={onTutup} className="shrink-0 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/20">
              Matikan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
