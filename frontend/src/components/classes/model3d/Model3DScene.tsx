"use client";
/* eslint-disable react-hooks/immutability --
   Graf adegan three.js memang imperatif (mengubah kamera, bahan, dan elemen
   kanvas di useFrame/handler); aturan ini dibuat untuk state React, bukan untuk ini. */
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as klonSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Anotasi3D } from "@/lib/model3dRules";

/**
 * Adegan WebGL objek 3D. Hanya boleh dimuat di browser (`next/dynamic`,
 * `ssr: false` di Model3DStage) — three.js butuh `window` dan WebGL.
 *
 * Pembagian kerja: adegan ini hanya menggambar model, penanda, dan sorotan
 * komponen. KARTU hologram-nya HTML biasa di luar kanvas (teks tajam,
 * bisa dipilih); yang dikirim adegan tiap bingkai hanyalah posisi layar titik
 * yang ditunjuk (`onProject`), supaya kartu & garis penunjuknya bergerak
 * tanpa render ulang React per bingkai.
 */

export interface ProyeksiHolo {
  x: number;
  y: number;
  /** Titik ada di depan kamera dan di dalam kanvas. */
  tampak: boolean;
  /** Terhalang bagian model lain dari sudut pandang sekarang. */
  terhalang: boolean;
}

export interface KontrolAdegan {
  zoom: (faktor: number) => void;
  /** Memutar kamera ke sisi berikutnya (kelipatan 90° dari depan), dengan animasi. */
  putar: () => void;
  /** Memutar kamera mengelilingi model: `dTheta` ke samping, `dPhi` ke atas/bawah (radian). Dipakai kontrol gerakan tangan. */
  orbit: (dTheta: number, dPhi: number) => void;
  /**
   * Menunjuk titik layar (0..1, kiri-atas = 0,0) seperti kursor: menyorot komponen berketerangan di situ dan
   * mengembalikan id keterangannya (null = tak ada). `null,null` = lepas sorotan. Dipakai kontrol gerakan tangan.
   */
  tunjuk: (x: number | null, y: number | null) => string | null;
}

export interface TitikTambah {
  point: [number, number, number];
  mesh: number;
  meshName: string;
}

interface Props {
  url: string;
  annotations: readonly Anotasi3D[];
  mode: "lihat" | "sunting";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd?: (t: TitikTambah) => void;
  onProject: (p: ProyeksiHolo | null) => void;
  kontrolRef: MutableRefObject<KontrolAdegan | null>;
  putarOtomatis: boolean;
  zoomGulir: boolean;
  jalan: boolean;
  onSentuh: () => void;
  onMuat: (jumlahKomponen: number) => void;
}

const POSISI_KAMERA = new THREE.Vector3(0, 0.55, 3.5);
const AMBANG_SERET = 5;
/** Lama satu putaran 90° tombol putar (detik). */
const DURASI_PUTAR = 1.1;
/** Komponen berketerangan sedalam ini (satuan adegan; model berukuran 2) di belakang yang terdepan masih terjangkau penunjuk jari. */
const BATAS_TEMBUS = 0.5;
/** Radius terluar toleransi penunjuk jari, fraksi tinggi layar (0,02 = ±16 px di layar 800 px). */
const TOLERANSI_TUNJUK = 0.02;
/** Kotak deteksi komponen: diperluas ke segala arah sebesar (sisi terpanjang x NISBAH) + TETAP (satuan adegan; model berukuran 2). */
const KOTAK_MARGIN_NISBAH = 0.1;
const KOTAK_MARGIN_TETAP = 0.04;

export default function Model3DScene({ jalan, ...props }: Props) {
  return (
    <Canvas
      camera={{ position: POSISI_KAMERA.toArray(), fov: 38, near: 0.05, far: 100 }}
      dpr={[1, 2]}
      frameloop={jalan ? "always" : "never"}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: "none" }}
    >
      <Lingkungan />
      <Isi {...props} />
    </Canvas>
  );
}

/** Pencahayaan berbasis gambar dari ruangan bawaan three.js — tanpa unduhan HDR. */
function Lingkungan() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.5;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
    </>
  );
}

const BIRU = new THREE.Color("#1f6fff");

interface GarisSorot {
  dasar: THREE.LineSegments;
  gerak: THREE.LineSegments;
  dashMat: THREE.LineDashedMaterial;
  /** Geseran fase strip; ditulis tiap bingkai (LineDashedMaterial tak punya dashOffset). */
  fase: { value: number };
  kecepatan: number;
}

/**
 * Garis tepi sebuah komponen: satu lapis tipis tetap + satu lapis putus-putus
 * yang digeser terus (`dashOffset`) sehingga tampak ada garis biru mengalir
 * menyusuri komponen. Ukuran strip dibuat relatif terhadap besar komponen.
 * Dipasang sebagai anak mesh (ikut transformasinya) dan TIDAK ikut raycast.
 */
function buatGarisSorot(mesh: THREE.Mesh): GarisSorot {
  const tepi = new THREE.EdgesGeometry(mesh.geometry, 25);
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere?.radius || 1;

  const dasarMat = new THREE.LineBasicMaterial({ color: BIRU, transparent: true, opacity: 0.55, depthTest: false });
  const dashMat = new THREE.LineDashedMaterial({
    color: new THREE.Color("#2f8bff"),
    dashSize: r * 0.16,
    gapSize: r * 0.12,
    transparent: true,
    depthTest: false,
  });
  const fase = { value: 0 };
  dashMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFase = fase;
    sh.fragmentShader =
      "uniform float uFase;\n" +
      sh.fragmentShader.replace("mod( vLineDistance, totalSize )", "mod( vLineDistance + uFase, totalSize )");
  };
  const dasar = new THREE.LineSegments(tepi, dasarMat);
  const gerak = new THREE.LineSegments(tepi, dashMat);
  gerak.computeLineDistances();
  for (const l of [dasar, gerak]) {
    l.raycast = () => undefined;
    l.renderOrder = 997;
    l.visible = false;
    mesh.add(l);
  }
  return { dasar, gerak, dashMat, fase, kecepatan: r * 0.7 };
}

function Isi({
  url,
  annotations,
  mode,
  selectedId,
  onSelect,
  onAdd,
  onProject,
  kontrolRef,
  putarOtomatis,
  zoomGulir,
  onSentuh,
  onMuat,
}: Omit<Props, "jalan">) {
  const gltf = useGLTF(url);
  const { camera, gl, size, controls } = useThree();

  // Salinan sendiri (bukan objek ber-cache useGLTF) supaya transformasi & garis
  // sorot satu panggung tidak ikut terlihat di panggung lain yang memuat berkas yang sama.
  const model = useMemo(() => {
    const root = klonSkeleton(gltf.scene);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes.push(m);
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const ukuran = box.getSize(new THREE.Vector3());
    const pusat = box.getCenter(new THREE.Vector3());
    const skala = 2 / (Math.max(ukuran.x, ukuran.y, ukuran.z) || 1);
    return { root, meshes, skala, pusat, tinggi: ukuran.y * skala };
  }, [gltf]);

  useEffect(() => {
    onMuat(model.meshes.length);
  }, [model, onMuat]);

  const grup = useRef<THREE.Group>(null);
  const hover = useRef(-1);
  const tunjukTerbaru = useRef<(x: number | null, y: number | null) => string | null>(() => null);
  const tinggiLantai = -model.tinggi / 2 - 0.02;

  // Keterangan per komponen — untuk menyorot dan memilih dari klik pada komponen.
  const perMesh = useMemo(() => {
    const peta = new Map<number, Anotasi3D[]>();
    for (const a of annotations) peta.set(a.mesh, [...(peta.get(a.mesh) ?? []), a]);
    return peta;
  }, [annotations]);

  const terpilih = annotations.find((a) => a.id === selectedId) ?? null;

  /**
   * Putaran per sisi sebagai tween berbasis WAKTU (bukan pelunakan per-bingkai):
   * `dari`→`ke` (radian, azimut tak dibungkus), `t` detik berjalan. Tekan lagi saat
   * berjalan = lanjut ke sisi berikutnya dari posisi sekarang tanpa lonjakan.
   */
  const putaran = useRef<{ dari: number; ke: number; t: number; sekarang: number } | null>(null);

  // ── Kontrol zoom / putar dari tombol di luar kanvas ──────────────────
  useEffect(() => {
    kontrolRef.current = {
      zoom: (f) => {
        const c = controls as unknown as THREE.EventDispatcher & { target: THREE.Vector3 };
        if (!c) return;
        const arah = camera.position.clone().sub(c.target);
        const panjang = THREE.MathUtils.clamp(arah.length() * f, 1.2, 9);
        camera.position.copy(c.target).add(arah.setLength(panjang));
      },
      tunjuk: (x, y) => tunjukTerbaru.current(x, y),
      orbit: (dTheta, dPhi) => {
        const c = controls as unknown as { target?: THREE.Vector3 } | null;
        if (!c?.target) return;
        putaran.current = null;
        const rel = camera.position.clone().sub(c.target);
        const bola = new THREE.Spherical().setFromVector3(rel);
        bola.theta += dTheta;
        // Kutub dijauhi sedikit supaya model tak terbalik saat tangan bergerak ekstrem.
        bola.phi = THREE.MathUtils.clamp(bola.phi + dPhi, 0.2, Math.PI - 0.2);
        camera.position.copy(c.target).add(rel.setFromSpherical(bola));
      },
      putar: () => {
        const c = controls as unknown as { target?: THREE.Vector3 } | null;
        if (!c?.target) return;
        const selisih = camera.position.clone().sub(c.target);
        const theta = Math.atan2(selisih.x, selisih.z);
        // Sisi terdekat + satu: tiap tekan berhenti tepat di depan/kanan/belakang/kiri.
        const sisi = Math.PI / 2;
        const jalan = putaran.current;
        putaran.current = jalan
          ? { dari: jalan.sekarang, ke: jalan.ke + sisi, t: 0, sekarang: jalan.sekarang }
          : { dari: theta, ke: (Math.round(theta / sisi) + 1) * sisi, t: 0, sekarang: theta };
      },
    };
    return () => {
      kontrolRef.current = null;
    };
  }, [camera, controls, kontrolRef]);

  // Kursor: tangan di atas komponen yang bisa dipilih / ditambah keterangan.
  function setKursor(nilai: string) {
    gl.domElement.style.cursor = nilai;
  }

  function indeksMesh(o: THREE.Object3D): number {
    return model.meshes.indexOf(o as THREE.Mesh);
  }

  /**
   * Titik tembak yang "dianggap" oleh pengguna.
   *
   * Mode sunting: kena komponen apa pun. Mode lihat: HANYA komponen yang punya
   * keterangan - komponen tanpa keterangan tidak merespons sama sekali
   * (tanpa sorotan, kursor tangan, maupun klik) dan tetap menghalangi yang di belakangnya.
   */
  function sasaranKena(e: ThreeEvent<MouseEvent | PointerEvent>): { i: number; titik: THREE.Vector3 } | null {
    for (const h of e.intersections) {
      const i = indeksMesh(h.object);
      if (i < 0) continue;
      if (mode === "sunting" || perMesh.has(i)) return { i, titik: h.point };
      // Komponen tak berketerangan menghalangi: yang di belakangnya pun tak terjangkau
      // oleh kursor, karena yang terlihat pengguna adalah komponen yang di depan.
      return null;
    }
    return null;
  }

  function saatKlik(e: ThreeEvent<MouseEvent>) {
    // Seretan memutar model bukan klik.
    if (e.delta > AMBANG_SERET) return;
    const kena = sasaranKena(e);
    if (!kena) return;
    e.stopPropagation();

    const lokal = model.root.worldToLocal(kena.titik.clone());

    if (mode === "sunting") {
      // Satu komponen = satu keterangan: yang sudah punya hanya dipilih (tak menambah lagi),
      // supaya penjelasan tak menumpuk di komponen yang sama.
      const ada = perMesh.get(kena.i)?.[0];
      if (ada) {
        onSelect(ada.id);
        return;
      }
      onAdd?.({
        point: [lokal.x, lokal.y, lokal.z],
        mesh: kena.i,
        meshName: model.meshes[kena.i].name || `Komponen ${kena.i + 1}`,
      });
      return;
    }

    // Mode lihat: pilih keterangan komponen itu (yang terdekat dari titik klik).
    const kandidat = perMesh.get(kena.i) ?? [];
    if (kandidat.length === 0) return;
    let terdekat = kandidat[0];
    let jarak = Infinity;
    for (const a of kandidat) {
      const d = lokal.distanceToSquared(new THREE.Vector3(...a.point));
      if (d < jarak) {
        jarak = d;
        terdekat = a;
      }
    }
    onSelect(terdekat.id);
  }

  function saatGerak(e: ThreeEvent<PointerEvent>) {
    const kena = sasaranKena(e);
    hover.current = kena ? kena.i : -1;
    setKursor(kena ? "pointer" : "grab");
  }

  function saatKeluar() {
    hover.current = -1;
    setKursor("grab");
  }

  // ── Per bingkai: garis sorot komponen, fokus kamera, proyeksi hologram ───
  const garis = useRef(new Map<number, GarisSorot>());
  const terakhirTampil = useRef(false);
  const hitung = useRef(0);
  const terhalang = useRef(false);
  const v = useMemo(() => new THREE.Vector3(), []);
  const arah = useMemo(() => new THREE.Vector3(), []);
  const penembak = useMemo(() => new THREE.Raycaster(), []);
  const sasaran = useMemo(() => new THREE.Vector3(), []);

  /** Satu sinar dari titik layar (NDC): komponen BERKETERANGAN pertama yang tertembus (bagian kecil tanpa keterangan di depannya tak menghalangi, selama <= `BATAS_TEMBUS`). */
  function tembak(ndcX: number, ndcY: number): { i: number; titik: THREE.Vector3 } | null {
    penembak.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const semua = penembak.intersectObjects(model.meshes, false);
    const terdepan = semua[0]?.distance ?? 0;
    for (const h of semua) {
      if (h.distance - terdepan > BATAS_TEMBUS) break;
      const j = indeksMesh(h.object);
      if (j >= 0 && (perMesh.get(j)?.length ?? 0) > 0) return { i: j, titik: h.point };
    }
    return null;
  }

  /**
   * KOTAK DETEKSI: tiap komponen berketerangan punya kotak 3D tak terlihat (kotak pembatasnya di dunia, DIPERLUAS
   * `KOTAK_MARGIN_NISBAH` x ukurannya + `KOTAK_MARGIN_TETAP`). Sinar yang menembus kotak itu dianggap menunjuk komponennya,
   * TANPA peduli bagian mana dari komponen yang terlihat dari sudut sekarang - port yang menyempit/terhalang bezel saat
   * model menengok tetap terjangkau. Kotak tetangga bisa saling tumpang tindih: yang dipilih yang PUSATNYA paling dekat
   * dengan sinar (dibanding ukurannya). Kotak yang berada jauh di belakang permukaan terdepan (> `BATAS_TEMBUS`) diabaikan,
   * jadi komponen tersembunyi di balik bodi tak ikut terpilih.
   */
  function cariKotak(ndcX: number, ndcY: number, terdepan: number): { i: number; titik: THREE.Vector3 } | null {
    penembak.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const sinar = penembak.ray;
    const kotak = new THREE.Box3();
    const ukuran = new THREE.Vector3();
    const pusat = new THREE.Vector3();
    const kena = new THREE.Vector3();
    let terbaik: { i: number; titik: THREE.Vector3 } | null = null;
    let skorTerbaik = Infinity;
    for (const j of perMesh.keys()) {
      const mesh = model.meshes[j];
      if (!mesh) continue;
      kotak.setFromObject(mesh);
      if (kotak.isEmpty()) continue;
      kotak.getSize(ukuran);
      const margin = Math.max(ukuran.x, ukuran.y, ukuran.z) * KOTAK_MARGIN_NISBAH + KOTAK_MARGIN_TETAP;
      kotak.expandByScalar(margin);
      if (!sinar.intersectBox(kotak, kena)) continue;
      if (kena.distanceTo(sinar.origin) - terdepan > BATAS_TEMBUS) continue;
      kotak.getCenter(pusat);
      const setengahDiagonal = kotak.getSize(ukuran).length() / 2;
      const skor = sinar.distanceToPoint(pusat) / Math.max(1e-6, setengahDiagonal);
      if (skor < skorTerbaik) {
        skorTerbaik = skor;
        terbaik = { i: j, titik: kena.clone() };
      }
    }
    return terbaik;
  }

  /**
   * Menunjuk titik layar (0..1, kiri-atas = 0,0) dengan jari.
   *
   * Titik TENGAH kursor tetap penentu utama. Toleransi di sekitarnya SANGAT kecil (cincin sinar <= `TOLERANSI_TUNJUK`
   * fraksi tinggi layar, ±15 px di layar 800 px): komponen kecil/tipis menyempit drastis saat model menengok
   * (foreshortening) sehingga sinar tunggal hampir mustahil mengenainya. Yang dicoba berurutan dari titik tepat,
   * lalu cincin dalam, lalu cincin luar, dan yang menang adalah yang PERTAMA kena (= terdekat dari ujung panah).
   * Magnet lama (radius 3,5%/7% tinggi layar) terlalu besar: komponen di SAMPING ikut terpilih - JANGAN dibesarkan.
   * Cadangan "kotak layar" (kotak proyeksi memuat titik) pernah dicoba: daerah kena melebar ±5x - JANGAN dikembalikan.
   */
  function tunjuk(x: number | null, y: number | null): string | null {
    if (x === null || y === null) {
      hover.current = -1;
      return null;
    }
    const ndcX = x * 2 - 1;
    const ndcY = -(y * 2 - 1);
    const rasio = size.height / Math.max(1, size.width);

    let hasil = tembak(ndcX, ndcY);
    for (const [r, jumlah] of [
      [TOLERANSI_TUNJUK / 2, 8],
      [TOLERANSI_TUNJUK, 12],
    ] as [number, number][]) {
      if (hasil) break;
      for (let k = 0; k < jumlah && !hasil; k++) {
        const a = (k / jumlah) * Math.PI * 2;
        // 1 satuan tinggi layar = 2 satuan NDC; sumbu x disesuaikan rasio agar cincin bulat di layar.
        hasil = tembak(ndcX + Math.cos(a) * r * 2 * rasio, ndcY + Math.sin(a) * r * 2);
      }
    }

    // Cadangan terakhir: kotak deteksi komponen (lihat `cariKotak`).
    if (!hasil) {
      penembak.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const depan = penembak.intersectObjects(model.meshes, false)[0];
      hasil = cariKotak(ndcX, ndcY, depan ? depan.distance : Infinity);
    }

    const i = hasil ? hasil.i : -1;
    const kandidat = i >= 0 ? (perMesh.get(i) ?? []) : [];
    if (!hasil || kandidat.length === 0) {
      hover.current = -1;
      return null;
    }
    hover.current = i;
    const lokal = model.root.worldToLocal(hasil.titik.clone());
    let terdekat = kandidat[0];
    let jarak = Infinity;
    for (const a of kandidat) {
      const d = lokal.distanceToSquared(new THREE.Vector3(...a.point));
      if (d < jarak) {
        jarak = d;
        terdekat = a;
      }
    }
    return terdekat.id;
  }
  // Fungsi di atas membaca model/keterangan terbaru; ref ini membuatnya terjangkau dari kontrol yang dipasang sekali.
  useEffect(() => {
    tunjukTerbaru.current = tunjuk;
  });

  // Garis dilepas saat model diganti/dicopot dari panggung.
  useEffect(() => {
    const peta = garis.current;
    return () => {
      for (const g of peta.values()) {
        g.dasar.removeFromParent();
        g.gerak.removeFromParent();
        g.dasar.geometry.dispose();
        (g.dasar.material as THREE.Material).dispose();
        g.dashMat.dispose();
      }
      peta.clear();
    };
  }, [model]);

  function tampilkanGaris(i: number, terang: number, dt: number) {
    const mesh = model.meshes[i];
    if (!mesh || !mesh.geometry) return;
    let g = garis.current.get(i);
    if (!g) {
      g = buatGarisSorot(mesh);
      garis.current.set(i, g);
    }
    g.dasar.visible = true;
    g.gerak.visible = true;
    // Bergeser ke belakang = strip tampak mengalir searah garis.
    g.fase.value += g.kecepatan * dt;
    g.dashMat.opacity = terang;
    (g.dasar.material as THREE.LineBasicMaterial).opacity = 0.55 * terang;
  }

  // Titik tunjuk hologram = PUSAT komponennya (bukan titik klik pengajar yang bisa
  // jatuh di pojok). Dihitung sekali per komponen (model statis) dalam koordinat scene;
  // komponen yang indeksnya tak cocok memakai titik tersimpan.
  const pusatMesh = useRef(new Map<number, THREE.Vector3>());
  function titikTunjuk(a: Anotasi3D, keluar: THREE.Vector3): THREE.Vector3 {
    const mesh = model.meshes[a.mesh];
    if (!mesh) return keluar.set(...a.point);
    let pusat = pusatMesh.current.get(a.mesh);
    if (!pusat) {
      mesh.updateWorldMatrix(true, false);
      const kotak = new THREE.Box3().setFromObject(mesh);
      pusat = model.root.worldToLocal(kotak.getCenter(new THREE.Vector3()));
      pusatMesh.current.set(a.mesh, pusat);
    }
    return keluar.copy(pusat);
  }

  useFrame((_state, dt) => {
    // Putar per sisi: azimut dihitung dari kurva waktu (ease-in-out), bukan mengejar
    // sasaran per bingkai - gerak awalnya lembut, lajunya rata, berhentinya mulus.
    const putar = putaran.current;
    const pusatOrbit = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    if (putar && pusatOrbit) {
      // dt dibatasi: bingkai yang tersendat tak boleh melompatkan putaran.
      putar.t += Math.min(dt, 1 / 30);
      const p = Math.min(putar.t / DURASI_PUTAR, 1);
      const e = -(Math.cos(Math.PI * p) - 1) / 2;
      putar.sekarang = putar.dari + (putar.ke - putar.dari) * e;

      const rel = camera.position.clone().sub(pusatOrbit);
      const bola = new THREE.Spherical().setFromVector3(rel);
      bola.theta = putar.sekarang;
      camera.position.copy(pusatOrbit).add(rel.setFromSpherical(bola));
      if (p >= 1) putaran.current = null;
    }

    // Editor (sunting): SEMUA komponen berketerangan selalu bergaris biru mengalir
    // sebagai penanda, dan komponen yang di-hover (boleh diberi keterangan) ikut redup.
    // Murid (lihat): garis hanya saat komponen berketerangan di-hover.
    const h = hover.current;
    const tampil = new Map<number, number>();
    if (mode === "sunting") {
      for (const i of perMesh.keys()) tampil.set(i, 1);
      if (h >= 0 && !tampil.has(h)) tampil.set(h, 0.65);
    } else if (h >= 0 && perMesh.has(h)) {
      tampil.set(h, 1);
    }
    for (const [i, g] of garis.current) {
      if (tampil.has(i)) continue;
      g.dasar.visible = false;
      g.gerak.visible = false;
    }
    for (const [i, terang] of tampil) tampilkanGaris(i, terang, dt);

    // Fokus halus: target orbit mendekat ke titik yang ditunjuk keterangan.
    const c = controls as unknown as { target?: THREE.Vector3 } | null;
    if (c?.target && grup.current) {
      if (terpilih) {
        titikTunjuk(terpilih, sasaran);
        grup.current.localToWorld(sasaran);
        sasaran.multiplyScalar(0.6);
      } else {
        sasaran.set(0, 0, 0);
      }
      c.target.lerp(sasaran, 1 - Math.pow(0.001, dt));
    }

    // Proyeksi titik terpilih ke koordinat layar untuk kartu hologram.
    if (!terpilih || !grup.current) {
      if (terakhirTampil.current) onProject(null);
      terakhirTampil.current = false;
      return;
    }
    titikTunjuk(terpilih, v);
    grup.current.localToWorld(v);

    // Uji halangan tiap beberapa bingkai saja: raycast ke model bisa mahal.
    if (hitung.current++ % 6 === 0) {
      arah.copy(v).sub(camera.position);
      const jarak = arah.length();
      penembak.set(camera.position, arah.normalize());
      penembak.far = jarak;
      // Komponen yang ditunjuk sendiri tidak dihitung penghalang: pusatnya ada di dalamnya.
      const sendiri = model.meshes[terpilih.mesh];
      const kena = penembak.intersectObject(model.root, true).filter((k) => k.object !== sendiri);
      terhalang.current = kena.length > 0 && kena[0].distance < jarak - 0.06;
    }

    v.project(camera);
    terakhirTampil.current = true;
    onProject({
      x: (v.x * 0.5 + 0.5) * size.width,
      y: (-v.y * 0.5 + 0.5) * size.height,
      tampak: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05,
      terhalang: terhalang.current,
    });
  });

  return (
    <>
      <gridHelper
        args={[6, 24, "#0e7490", "#0b3340"]}
        position={[0, tinggiLantai, 0]}
        onUpdate={(g) => {
          const m = g.material as THREE.Material;
          m.transparent = true;
          m.opacity = 0.45;
        }}
      />

      <group
        ref={grup}
        scale={model.skala}
        position={[-model.pusat.x * model.skala, -model.pusat.y * model.skala, -model.pusat.z * model.skala]}
        onClick={saatKlik}
        onPointerMove={saatGerak}
        onPointerOut={saatKeluar}
      >
        <primitive object={model.root} />
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={9}
        enableZoom={zoomGulir}
        autoRotate={putarOtomatis}
        autoRotateSpeed={0.9}
        onStart={() => {
          // Menyeret manual membatalkan putaran per sisi yang sedang berjalan.
          putaran.current = null;
          onSentuh();
        }}
      />
    </>
  );
}
