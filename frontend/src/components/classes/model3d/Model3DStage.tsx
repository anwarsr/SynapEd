"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Anotasi3D } from "@/lib/model3dRules";
import type { KontrolAdegan, ProyeksiHolo, TitikTambah } from "@/components/classes/model3d/Model3DScene";
import TeksAcak from "@/components/classes/model3d/TeksAcak";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { cn } from "@/lib/cn";

// three.js butuh `window`/WebGL, dan bundelnya besar: dimuat hanya di browser
// dan hanya saat panggung ini benar-benar dirender.
const Adegan = dynamic(() => import("@/components/classes/model3d/Model3DScene"), {
  ssr: false,
  loading: () => null,
});

/** Galat memuat model / WebGL tidak ada → pesan, bukan halaman putih. */
class PenangkapGalat extends Component<{ children: ReactNode }, { galat: boolean }> {
  state = { galat: false };
  static getDerivedStateFromError() {
    return { galat: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[objek 3D]", e);
  }
  render() {
    if (this.state.galat) {
      return (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
          Objek 3D tidak bisa ditampilkan. Pastikan berkasnya GLB yang sah dan peramban Anda mendukung WebGL.
        </div>
      );
    }
    return this.props.children;
  }
}

function jepit(n: number, a: number, b: number) {
  return Math.min(Math.max(n, a), Math.max(a, b));
}

/**
 * Panggung objek 3D: model yang bisa diputar/di-zoom, penanda keterangan, dan
 * kartu HOLOGRAM yang ditarik garis ke titik komponen yang dipilih.
 *
 * Dipakai tiga tempat dengan satu kode: umpan kelas (`lihat`, tampil
 * langsung), pratinjau editor (`lihat`, persis yang dilihat murid), dan
 * editor (`sunting`: klik model menambah keterangan).
 *
 * `selectedId` opsional: bila diberikan, pemilihan dikendalikan induk (editor
 * menyelaraskannya dengan daftar keterangan); bila tidak, panggung memegangnya.
 */
export default function Model3DStage({
  url,
  nama,
  annotations,
  mode = "lihat",
  selectedId,
  onSelect,
  onAdd,
  className,
}: {
  url: string;
  nama: string;
  annotations: readonly Anotasi3D[];
  mode?: "lihat" | "sunting";
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onAdd?: (t: TitikTambah) => void;
  className?: string;
}) {
  const hemat = useReducedMotion();
  const wadah = useRef<HTMLDivElement>(null);
  const kartu = useRef<HTMLDivElement>(null);
  const garis = useRef<SVGPolylineElement>(null);
  const titik = useRef<SVGCircleElement>(null);
  const kontrol = useRef<KontrolAdegan | null>(null);

  const [mulai, setMulai] = useState(false);
  const [tampak, setTampak] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [jumlahKomponen, setJumlahKomponen] = useState(0);
  const [aktif, setAktif] = useState(false);
  const [sentuh, setSentuh] = useState(false);
  const [penuh, setPenuh] = useState(false);
  const [dalam, setDalam] = useState<string | null>(null);

  const terpilihId = selectedId !== undefined ? selectedId : dalam;
  const terpilih = annotations.find((a) => a.id === terpilihId) ?? null;

  const pilih = useCallback(
    (id: string | null) => {
      setDalam(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  // Dimuat saat mendekati layar (berkas bisa belasan MB), dijeda saat menjauh.
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setTampak(e.isIntersecting);
        if (e.isIntersecting) setMulai(true);
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const f = () => setPenuh(document.fullscreenElement === wadah.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  // Posisi kartu & garis ditulis langsung ke DOM tiap bingkai (bukan state).
  const proyeksi = useCallback((p: ProyeksiHolo | null) => {
    const k = kartu.current;
    const g = garis.current;
    const t = titik.current;
    const w = wadah.current;
    if (!k || !g || !t || !w) return;

    if (!p || !p.tampak) {
      k.style.visibility = "hidden";
      g.style.visibility = "hidden";
      t.style.visibility = "hidden";
      return;
    }

    const W = w.clientWidth;
    const H = w.clientHeight;
    const lebar = k.offsetWidth;
    const tinggi = k.offsetHeight;

    // Kartu di sisi yang lapang: anchor di kiri → kartu ke kanan, dan seterusnya.
    const kanan = p.x < W * 0.55;
    // Sisa 48px di kanan menjaga kartu tidak menimpa tombol zoom.
    const cx = jepit(kanan ? p.x + 44 : p.x - 44 - lebar, 8, W - lebar - 48);
    let cy = p.y - tinggi - 34;
    if (cy < 8) cy = p.y + 34;
    cy = jepit(cy, 8, H - tinggi - 8);

    const diAtas = cy + tinggi <= p.y;
    const ax = jepit(p.x, cx + 14, cx + lebar - 14);
    const ay = diAtas ? cy + tinggi : cy;

    k.style.transform = `translate(${cx}px, ${cy}px)`;
    k.style.visibility = "visible";
    k.style.opacity = p.terhalang ? "0.5" : "1";

    g.setAttribute("points", `${p.x},${p.y} ${ax},${ay}`);
    g.style.visibility = "visible";
    g.style.opacity = p.terhalang ? "0.45" : "1";
    t.setAttribute("cx", String(p.x));
    t.setAttribute("cy", String(p.y));
    t.style.visibility = "visible";
  }, []);

  function layarPenuh() {
    const el = wadah.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }


  return (
    <div className={cn("keep-white", className)}>
      <div
        ref={wadah}
        className={cn("holo-panggung relative overflow-hidden", penuh ? "h-full" : "h-[360px] sm:h-[440px]")}
        onPointerDown={() => setAktif(true)}
        onPointerLeave={() => setAktif(false)}
        role="group"
        aria-label={`Objek 3D ${nama}. Seret untuk memutar, gulir atau tombol plus-minus untuk zoom.`}
      >
        {mulai && (
          <PenangkapGalat>
            <Adegan
              url={url}
              annotations={annotations}
              mode={mode}
              selectedId={terpilihId ?? null}
              onSelect={pilih}
              onAdd={onAdd}
              onProject={proyeksi}
              kontrolRef={kontrol}
              putarOtomatis={!hemat && !sentuh && !terpilih && mode === "lihat"}
              zoomGulir={aktif}
              jalan={tampak}
              onSentuh={() => setSentuh(true)}
              onMuat={(n) => {
                setJumlahKomponen(n);
                setMemuat(false);
              }}
            />
          </PenangkapGalat>
        )}

        {mulai && memuat && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">
            <span className="holo-memuat">Memuat objek 3D…</span>
          </div>
        )}
        {!mulai && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/55">Objek 3D</div>
        )}

        {/* Lapisan hologram: garis penunjuk + kartu keterangan. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <polyline
            key={terpilih?.id ?? "kosong"}
            ref={garis}
            className="holo-garis"
            fill="none"
            style={{ visibility: "hidden" }}
          />
          <circle ref={titik} r="4" className="holo-titik" style={{ visibility: "hidden" }} />
        </svg>

        <div
          ref={kartu}
          className="holo-bungkus pointer-events-none absolute left-0 top-0 w-[min(280px,72%)]"
          style={{ visibility: "hidden" }}
        >
          {terpilih && (
            <div key={terpilih.id} className="holo-kartu" aria-live="polite">
              <TeksAcak className="holo-judul" tunda={120} durasi={650} teks={terpilih.title} />
              {terpilih.text && (
                <TeksAcak
                  className="holo-isi"
                  tunda={260}
                  durasi={Math.min(1400, 500 + terpilih.text.length * 8)}
                  teks={terpilih.text}
                />
              )}
            </div>
          )}
        </div>

        {/* Bilah alat: zoom, putar per sisi, layar penuh. */}
        <div className="holo-bar absolute right-3 top-3" role="toolbar" aria-label="Alat objek 3D">
          <TombolHolo label="Perbesar" onClick={() => kontrol.current?.zoom(0.8)}>
            <path d="M12 6v12M6 12h12" />
          </TombolHolo>
          <TombolHolo label="Perkecil" onClick={() => kontrol.current?.zoom(1.25)}>
            <path d="M6 12h12" />
          </TombolHolo>
          <TombolHolo
            label="Putar ke sisi berikutnya"
            onClick={() => {
              setSentuh(true);
              kontrol.current?.putar();
            }}
          >
            <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5" />
          </TombolHolo>
          <TombolHolo label={penuh ? "Keluar layar penuh" : "Layar penuh"} onClick={layarPenuh}>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </TombolHolo>
        </div>

        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] tracking-wide text-white/55">
          {mode === "sunting"
            ? "Klik bagian objek untuk menambah keterangan"
            : annotations.length > 0
              ? "Seret untuk memutar · klik titik atau komponen untuk keterangan"
              : "Seret untuk memutar · gulir untuk zoom"}
          {jumlahKomponen > 0 ? ` · ${jumlahKomponen} komponen` : ""}
        </p>
      </div>

      {/* Daftar keterangan: jalan pintas papan ketik & petunjuk bahwa ada keterangan. */}
      {mode === "lihat" && annotations.length > 0 && (
        <ul className="holo-daftar flex flex-wrap gap-1.5 px-3 py-3">
          {annotations.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={a.id === terpilihId}
                onClick={() => pilih(a.id === terpilihId ? null : a.id)}
                className={cn("holo-chip", a.id === terpilihId && "holo-chip-aktif")}
              >
                <span className="holo-chip-no">{String(i + 1).padStart(2, "0")}</span>
                {a.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TombolHolo({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="holo-tombol">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
