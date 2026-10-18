"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  bentukSimpul,
  dGaris,
  jepret,
  posisiLabel,
  ruteGaris,
  sisiTerdekat,
  titikGaris,
  titikSisi,
  TINGGI_BARIS,
  UKURAN_FONT,
  type Titik,
} from "@/lib/lab/flowGeometri";
import { RONA_JENIS, tataTeks } from "@/lib/lab/flowSvg";
import { FLOW_GRID, FLOW_MAX_LABEL, FLOW_MAX_TEKS, FLOW_MIN_UKURAN, SISI, type Diagram, type Simpul, type Sisi } from "@/lib/lab/flowTypes";
import { cn } from "@/lib/cn";

export interface Viewport {
  x: number;
  y: number;
  z: number;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAKS = 3;

export interface Pilihan {
  simpul: ReadonlySet<number>;
  garis: ReadonlySet<number>;
}

export type Penyuntingan = { jenis: "simpul" | "garis"; id: number } | null;

type Sudut = "kiAtas" | "kaAtas" | "kiBawah" | "kaBawah";

type Mode =
  | { k: "diam" }
  | { k: "geser"; awal: Titik; dx: number; dy: number; bergerak: boolean; ids: number[]; persempit: number | null }
  | { k: "ukur"; id: number; sudut: Sudut; awal: Titik; asal: { x: number; y: number; w: number; h: number }; kotak: { x: number; y: number; w: number; h: number } }
  | { k: "sambung"; dari: number; sisi: Sisi; ujung: Titik; target: number | null }
  | { k: "pan"; layar: Titik; vp: Viewport }
  | { k: "kotak"; awal: Titik; ujung: Titik; tambah: boolean };

/**
 * Kanvas flowchart: SVG yang digambar dari data, dengan interaksi ala draw.io.
 *
 *  - seret simbol = memindahkan (semua yang terpilih), dijepret ke grid;
 *  - seret titik sambung (bulatan biru di sisi simbol) ke simbol lain = garis;
 *  - seret sudut simbol terpilih = mengubah ukuran;
 *  - seret area kosong = menggeser kanvas; Shift+seret = memilih dengan kotak;
 *  - roda = menggeser; Ctrl/⌘+roda = memperbesar di posisi kursor;
 *  - klik ganda simbol/garis = menyunting teks/label langsung di tempatnya.
 *
 * Selama seret, perubahan hanya PRATINJAU di state lokal; diagram baru
 * dikirim sekali saat dilepas — satu seretan = satu entri riwayat undo.
 *
 * Semua warna dari token tema (kartu, tinta, biru) yang dicampur rona per
 * jenis simbol, jadi kanvas ikut tema gelap/terang tanpa cabang kode.
 */
export default function FlowCanvas({
  diagram,
  pilihan,
  viewport,
  bisaSunting,
  tampilGrid,
  sorot,
  aktif,
  garisAktif,
  menyunting,
  onViewport,
  onPilih,
  onPindah,
  onUbahKotak,
  onSambung,
  onMulaiSunting,
  onSelesaiSunting,
  onJatuhkan,
}: {
  diagram: Diagram;
  pilihan: Pilihan;
  viewport: Viewport;
  bisaSunting: boolean;
  tampilGrid: boolean;
  /** Simbol & garis yang disorot pemeriksa aturan. */
  sorot: { simpul: ReadonlySet<number>; garis: ReadonlySet<number> };
  /** Simbol yang sedang dijalankan (mode Jalankan). */
  aktif: number | null;
  garisAktif: number | null;
  menyunting: Penyuntingan;
  onViewport: (v: Viewport) => void;
  onPilih: (p: Pilihan) => void;
  onPindah: (ids: ReadonlySet<number>, dx: number, dy: number) => void;
  onUbahKotak: (id: number, kotak: { x: number; y: number; w: number; h: number }) => void;
  onSambung: (dari: number, dariSisi: Sisi, ke: number, keSisi: Sisi) => void;
  onMulaiSunting: (p: Penyuntingan) => void;
  onSelesaiSunting: (nilai: string | null) => void;
  /** Simbol diseret dari palet ke kanvas: titik jatuh dalam koordinat diagram. */
  onJatuhkan: (data: string, titik: Titik) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>({ k: "diam" });
  const [arahkan, setArahkan] = useState<number | null>(null);
  const vpRef = useRef(viewport);
  useLayoutEffect(() => {
    vpRef.current = viewport;
  });

  // ── Koordinat ──────────────────────────────────────────────────────
  function keDiagram(clientX: number, clientY: number): Titik {
    const r = svgRef.current!.getBoundingClientRect();
    const v = vpRef.current;
    return { x: (clientX - r.left - v.x) / v.z, y: (clientY - r.top - v.y) / v.z };
  }

  function simpulDi(p: Titik, kecuali?: number): Simpul | null {
    for (let i = diagram.simpul.length - 1; i >= 0; i--) {
      const s = diagram.simpul[i];
      if (s.id !== kecuali && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) return s;
    }
    return null;
  }

  // Roda: dipasang manual karena React memasang `wheel` sebagai pasif, dan
  // tanpa preventDefault seluruh halaman ikut menggulir/memperbesar.
  const onViewportRef = useRef(onViewport);
  useLayoutEffect(() => {
    onViewportRef.current = onViewport;
  });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function roda(e: WheelEvent) {
      e.preventDefault();
      const v = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el!.getBoundingClientRect();
        const z = Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, v.z * Math.exp(-e.deltaY * 0.0015)));
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        onViewportRef.current({ z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z });
      } else {
        onViewportRef.current({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    }
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  // ── Penunjuk ───────────────────────────────────────────────────────
  function turun(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    if (menyunting) return;
    const el = (e.target as Element).closest("[data-peran]");
    const peran = el?.getAttribute("data-peran");
    const p = keDiagram(e.clientX, e.clientY);
    svgRef.current?.setPointerCapture(e.pointerId);

    if (e.button === 1 || !peran || !bisaSunting) {
      if (e.shiftKey && bisaSunting && e.button === 0) {
        setMode({ k: "kotak", awal: p, ujung: p, tambah: true });
      } else {
        if (!e.shiftKey && bisaSunting && e.button === 0) onPilih({ simpul: new Set(), garis: new Set() });
        setMode({ k: "pan", layar: { x: e.clientX, y: e.clientY }, vp: vpRef.current });
      }
      return;
    }

    const id = Number(el!.getAttribute("data-id"));
    if (peran === "port") {
      setMode({ k: "sambung", dari: id, sisi: el!.getAttribute("data-sisi") as Sisi, ujung: p, target: null });
      return;
    }
    if (peran === "ukur") {
      const s = diagram.simpul.find((x) => x.id === id)!;
      const asal = { x: s.x, y: s.y, w: s.w, h: s.h };
      setMode({ k: "ukur", id, sudut: el!.getAttribute("data-sudut") as Sudut, awal: p, asal, kotak: asal });
      return;
    }
    if (peran === "garis") {
      const garis = new Set(e.shiftKey ? pilihan.garis : []);
      if (e.shiftKey && garis.has(id)) garis.delete(id);
      else garis.add(id);
      onPilih({ simpul: e.shiftKey ? pilihan.simpul : new Set(), garis });
      setMode({ k: "diam" });
      return;
    }
    // Simbol.
    const sudahDipilih = pilihan.simpul.has(id);
    let simpul: Set<number>;
    if (e.shiftKey) {
      simpul = new Set(pilihan.simpul);
      if (sudahDipilih) simpul.delete(id);
      else simpul.add(id);
    } else {
      simpul = sudahDipilih ? new Set(pilihan.simpul) : new Set([id]);
    }
    onPilih({ simpul, garis: e.shiftKey ? pilihan.garis : new Set() });
    setMode({
      k: "geser",
      awal: p,
      dx: 0,
      dy: 0,
      bergerak: false,
      ids: [...simpul],
      // Klik (tanpa geser) pada simbol yang sudah terpilih bersama yang lain
      // mempersempit pilihan ke simbol itu saja — perilaku draw.io.
      persempit: sudahDipilih && !e.shiftKey && simpul.size > 1 ? id : null,
    });
  }

  function gerak(e: React.PointerEvent<SVGSVGElement>) {
    if (mode.k === "diam") return;
    const p = keDiagram(e.clientX, e.clientY);
    switch (mode.k) {
      case "pan":
        onViewport({ ...mode.vp, x: mode.vp.x + e.clientX - mode.layar.x, y: mode.vp.y + e.clientY - mode.layar.y });
        return;
      case "geser": {
        const dx = p.x - mode.awal.x;
        const dy = p.y - mode.awal.y;
        setMode({ ...mode, dx, dy, bergerak: mode.bergerak || Math.hypot(dx, dy) * vpRef.current.z > 3 });
        return;
      }
      case "ukur": {
        const dx = p.x - mode.awal.x;
        const dy = p.y - mode.awal.y;
        const a = mode.asal;
        const kiri = mode.sudut === "kiAtas" || mode.sudut === "kiBawah";
        const atas = mode.sudut === "kiAtas" || mode.sudut === "kaAtas";
        const w = Math.max(FLOW_MIN_UKURAN, jepret(a.w + (kiri ? -dx : dx)));
        const h = Math.max(FLOW_MIN_UKURAN, jepret(a.h + (atas ? -dy : dy)));
        setMode({ ...mode, kotak: { x: kiri ? a.x + a.w - w : a.x, y: atas ? a.y + a.h - h : a.y, w, h } });
        return;
      }
      case "sambung": {
        const t = simpulDi(p, mode.dari);
        setMode({ ...mode, ujung: p, target: t?.id ?? null });
        return;
      }
      case "kotak":
        setMode({ ...mode, ujung: p });
        return;
    }
  }

  function naik(e: React.PointerEvent<SVGSVGElement>) {
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    const m = mode;
    setMode({ k: "diam" });
    switch (m.k) {
      case "geser":
        if (m.bergerak) onPindah(new Set(m.ids), jepret(m.dx), jepret(m.dy));
        else if (m.persempit !== null) onPilih({ simpul: new Set([m.persempit]), garis: new Set() });
        return;
      case "ukur":
        if (m.kotak !== m.asal) onUbahKotak(m.id, m.kotak);
        return;
      case "sambung": {
        if (m.target === null) return;
        const t = diagram.simpul.find((s) => s.id === m.target)!;
        onSambung(m.dari, m.sisi, t.id, sisiTerdekat(t, m.ujung));
        return;
      }
      case "kotak": {
        const x1 = Math.min(m.awal.x, m.ujung.x);
        const x2 = Math.max(m.awal.x, m.ujung.x);
        const y1 = Math.min(m.awal.y, m.ujung.y);
        const y2 = Math.max(m.awal.y, m.ujung.y);
        const kena = diagram.simpul.filter((s) => s.x >= x1 && s.x + s.w <= x2 && s.y >= y1 && s.y + s.h <= y2).map((s) => s.id);
        onPilih({ simpul: new Set([...pilihan.simpul, ...kena]), garis: pilihan.garis });
        return;
      }
    }
  }

  function klikGanda(e: React.MouseEvent) {
    if (!bisaSunting) return;
    // BUKAN e.target: selama pointer capture (dipasang di pointerdown),
    // peramban mengarahkan klik ke <svg> itu sendiri, bukan ke simbolnya.
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-peran]");
    const peran = el?.getAttribute("data-peran");
    const id = Number(el?.getAttribute("data-id"));
    if (peran === "simpul") onMulaiSunting({ jenis: "simpul", id });
    else if (peran === "garis") onMulaiSunting({ jenis: "garis", id });
  }

  // ── Pratinjau ──────────────────────────────────────────────────────
  // Diagram yang digambar = diagram + perubahan seret yang belum dilepas.
  let tampil = diagram;
  if (mode.k === "geser" && mode.bergerak) {
    const ids = new Set(mode.ids);
    const dx = jepret(mode.dx);
    const dy = jepret(mode.dy);
    tampil = { ...diagram, simpul: diagram.simpul.map((s) => (ids.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s)) };
  } else if (mode.k === "ukur") {
    tampil = { ...diagram, simpul: diagram.simpul.map((s) => (s.id === mode.id ? { ...s, ...mode.kotak } : s)) };
  }

  const satuTerpilih = pilihan.simpul.size === 1 && pilihan.garis.size === 0 ? [...pilihan.simpul][0] : null;
  const tunjukkanPort = (id: number) =>
    bisaSunting && (mode.k === "sambung" ? id !== mode.dari : arahkan === id || satuTerpilih === id) && mode.k !== "geser";

  const v = viewport;
  const panah = (nama: string) => `url(#${uid}-${nama})`;

  // ── Penyunting teks di tempat ──────────────────────────────────────
  let editor: React.ReactNode = null;
  if (menyunting?.jenis === "simpul") {
    const s = diagram.simpul.find((x) => x.id === menyunting.id);
    if (s) {
      editor = (
        <PenyuntingTeks
          key={`s${s.id}`}
          awal={s.teks}
          maks={FLOW_MAX_TEKS}
          banyakBaris
          gaya={{ left: v.x + s.x * v.z, top: v.y + s.y * v.z, width: s.w * v.z, height: s.h * v.z, fontSize: UKURAN_FONT * v.z }}
          onSelesai={onSelesaiSunting}
        />
      );
    }
  } else if (menyunting?.jenis === "garis") {
    const g = diagram.garis.find((x) => x.id === menyunting.id);
    const t = g ? titikGaris(diagram, g) : null;
    if (g && t) {
      const p = posisiLabel(t);
      editor = (
        <PenyuntingTeks
          key={`g${g.id}`}
          awal={g.label}
          maks={FLOW_MAX_LABEL}
          banyakBaris={false}
          gaya={{ left: v.x + p.x * v.z - 4, top: v.y + p.y * v.z - 12, width: 90, height: 24, fontSize: 12 }}
          onSelesai={onSelesaiSunting}
        />
      );
    }
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onDragOver={(e) => {
        if (bisaSunting && e.dataTransfer.types.includes("application/x-flow-jenis")) e.preventDefault();
      }}
      onDrop={(e) => {
        const data = e.dataTransfer.getData("application/x-flow-jenis");
        if (!data || !bisaSunting) return;
        e.preventDefault();
        onJatuhkan(data, keDiagram(e.clientX, e.clientY));
      }}
    >
      <svg
        ref={svgRef}
        role="application"
        aria-label="Kanvas flowchart"
        className={cn(
          "block h-full w-full touch-none select-none",
          mode.k === "pan" ? "cursor-grabbing" : mode.k === "sambung" ? "cursor-crosshair" : "cursor-default",
        )}
        onPointerDown={turun}
        onPointerMove={gerak}
        onPointerUp={naik}
        onPointerCancel={() => setMode({ k: "diam" })}
        onDoubleClick={klikGanda}
      >
        <defs>
          <pattern id={`${uid}-grid`} width={FLOW_GRID * 2 * v.z} height={FLOW_GRID * 2 * v.z} patternUnits="userSpaceOnUse" x={v.x} y={v.y}>
            <circle cx={1} cy={1} r={0.9} fill="var(--grid-line, rgb(127 127 127 / 0.15))" />
          </pattern>
          {(
            [
              ["biasa", "var(--color-ink-muted)"],
              ["pilih", "var(--color-blue-500)"],
              ["aktif", "var(--color-blue-400)"],
              ["sorot", "var(--color-error-text)"],
            ] as const
          ).map(([nama, warna]) => (
            <marker key={nama} id={`${uid}-${nama}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={warna} />
            </marker>
          ))}
        </defs>

        {tampilGrid && <rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />}

        <g transform={`translate(${v.x} ${v.y}) scale(${v.z})`}>
          {/* ── Garis (di bawah simbol, seperti draw.io) ── */}
          {tampil.garis.map((g) => {
            const t = titikGaris(tampil, g);
            if (!t) return null;
            const d = dGaris(t);
            const dipilih = pilihan.garis.has(g.id);
            const jalan = garisAktif === g.id;
            const salah = sorot.garis.has(g.id);
            const warna = jalan ? "var(--color-blue-400)" : dipilih ? "var(--color-blue-500)" : salah ? "var(--color-error-text)" : "var(--color-ink-muted)";
            const lbl = g.label.trim() ? posisiLabel(t) : null;
            return (
              <g key={g.id} data-peran="garis" data-id={g.id} className={bisaSunting ? "cursor-pointer" : undefined}>
                {/* Garis tak terlihat yang lebar: sasaran klik yang nyaman. */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={12 / v.z} />
                <path
                  d={d}
                  fill="none"
                  stroke={warna}
                  strokeWidth={jalan || dipilih ? 2.4 : 1.6}
                  strokeDasharray={salah && !dipilih ? "5 4" : undefined}
                  className={jalan ? "flow-garis-jalan" : undefined}
                  markerEnd={panah(jalan ? "aktif" : dipilih ? "pilih" : salah ? "sorot" : "biasa")}
                />
                {lbl && !(menyunting?.jenis === "garis" && menyunting.id === g.id) && (
                  // Halo warna latar di belakang huruf: label tetap terbaca walau tertimpa garis.
                  <text
                    x={lbl.x}
                    y={lbl.y}
                    fontSize={12}
                    fontWeight={600}
                    fill={warna}
                    stroke="var(--color-paper)"
                    strokeWidth={4}
                    paintOrder="stroke"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                  >
                    {g.label}
                  </text>
                )}
              </g>
            );
          })}

          {mode.k === "sambung" &&
            (() => {
              const asal = tampil.simpul.find((s) => s.id === mode.dari);
              if (!asal) return null;
              const a = titikSisi(asal, mode.sisi);
              const t = mode.target !== null ? tampil.simpul.find((s) => s.id === mode.target) : null;
              const rute = t ? ruteGaris(a, mode.sisi, titikSisi(t, sisiTerdekat(t, mode.ujung)), sisiTerdekat(t, mode.ujung)) : [a, mode.ujung];
              return (
                <path d={dGaris(rute)} fill="none" stroke="var(--color-blue-500)" strokeWidth={2} strokeDasharray="6 4" markerEnd={panah("pilih")} className="pointer-events-none" />
              );
            })()}

          {/* ── Simbol ── */}
          {tampil.simpul.map((s) => {
            const b = bentukSimpul(s);
            const rona = RONA_JENIS[s.jenis];
            const dipilih = pilihan.simpul.has(s.id);
            const salah = sorot.simpul.has(s.id);
            const jalan = aktif === s.id;
            const target = mode.k === "sambung" && mode.target === s.id;
            const { baris, x, y0 } = tataTeks(s);
            const disunting = menyunting?.jenis === "simpul" && menyunting.id === s.id;
            return (
              <g
                key={s.id}
                data-peran="simpul"
                data-id={s.id}
                className={bisaSunting ? "cursor-move" : undefined}
                onPointerEnter={() => setArahkan(s.id)}
                onPointerLeave={() => setArahkan((a) => (a === s.id ? null : a))}
              >
                {jalan && <path d={b.d} fill="none" stroke="var(--color-blue-400)" strokeWidth={9} className="flow-aktif pointer-events-none" />}
                <path
                  d={b.d}
                  fill={b.tanpaIsi ? "transparent" : `color-mix(in srgb, ${rona} 20%, var(--color-paper-card))`}
                  stroke={b.tanpaIsi ? "transparent" : jalan ? "var(--color-blue-400)" : dipilih || target ? "var(--color-blue-500)" : salah ? "var(--color-error-text)" : rona}
                  strokeWidth={jalan ? 3.2 : dipilih || target ? 2.6 : 1.6}
                  strokeDasharray={salah && !dipilih ? "6 4" : undefined}
                />
                {b.tambahan && <path d={b.tambahan} fill="none" stroke={rona} strokeWidth={1.6} className="pointer-events-none" />}
                {!disunting && (
                  <text fontSize={UKURAN_FONT} fill="var(--color-ink)" textAnchor="middle" className="pointer-events-none">
                    {baris.map((l, i) => (
                      <tspan key={i} x={x} y={y0 + i * TINGGI_BARIS}>
                        {l}
                      </tspan>
                    ))}
                  </text>
                )}
                {dipilih && s.jenis === "catatan" && (
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke="var(--color-blue-500)" strokeDasharray="4 3" className="pointer-events-none" />
                )}
              </g>
            );
          })}

          {/* ── Pegangan: titik sambung & sudut ukuran (paling atas) ── */}
          {tampil.simpul.map((s) =>
            tunjukkanPort(s.id) ? (
              <g key={`p${s.id}`}>
                {SISI.map((sisi) => {
                  const p = titikSisi(s, sisi);
                  return (
                    <circle
                      key={sisi}
                      data-peran="port"
                      data-id={s.id}
                      data-sisi={sisi}
                      cx={p.x}
                      cy={p.y}
                      r={5.5 / v.z}
                      fill="var(--color-blue-500)"
                      stroke="var(--color-paper)"
                      strokeWidth={1.5 / v.z}
                      className="cursor-crosshair"
                      onPointerEnter={() => setArahkan(s.id)}
                    >
                      <title>Seret untuk menyambung</title>
                    </circle>
                  );
                })}
              </g>
            ) : null,
          )}
          {bisaSunting &&
            satuTerpilih !== null &&
            mode.k !== "geser" &&
            (() => {
              const s = tampil.simpul.find((x) => x.id === satuTerpilih);
              if (!s) return null;
              const ukuranPegangan = 8 / v.z;
              const sudut: [Sudut, number, number, string][] = [
                ["kiAtas", s.x, s.y, "cursor-nwse-resize"],
                ["kaAtas", s.x + s.w, s.y, "cursor-nesw-resize"],
                ["kiBawah", s.x, s.y + s.h, "cursor-nesw-resize"],
                ["kaBawah", s.x + s.w, s.y + s.h, "cursor-nwse-resize"],
              ];
              return (
                <g>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke="var(--color-blue-500)" strokeWidth={1 / v.z} strokeDasharray={`${4 / v.z} ${3 / v.z}`} className="pointer-events-none" />
                  {sudut.map(([nama, x, y, kursor]) => (
                    <rect
                      key={nama}
                      data-peran="ukur"
                      data-id={s.id}
                      data-sudut={nama}
                      x={x - ukuranPegangan / 2}
                      y={y - ukuranPegangan / 2}
                      width={ukuranPegangan}
                      height={ukuranPegangan}
                      fill="var(--color-paper)"
                      stroke="var(--color-blue-500)"
                      strokeWidth={1.5 / v.z}
                      className={kursor}
                    />
                  ))}
                </g>
              );
            })()}

          {mode.k === "kotak" && (
            <rect
              x={Math.min(mode.awal.x, mode.ujung.x)}
              y={Math.min(mode.awal.y, mode.ujung.y)}
              width={Math.abs(mode.ujung.x - mode.awal.x)}
              height={Math.abs(mode.ujung.y - mode.awal.y)}
              fill="color-mix(in srgb, var(--color-blue-500) 10%, transparent)"
              stroke="var(--color-blue-500)"
              strokeWidth={1 / v.z}
              strokeDasharray={`${4 / v.z} ${3 / v.z}`}
            />
          )}
        </g>
      </svg>
      {editor}
    </div>
  );
}

/** Kotak teks yang menimpa simbol/label selama disunting. Ctrl+Enter atau klik di luar = simpan, Esc = batal. */
function PenyuntingTeks({
  awal,
  maks,
  banyakBaris,
  gaya,
  onSelesai,
}: {
  awal: string;
  maks: number;
  banyakBaris: boolean;
  gaya: React.CSSProperties;
  onSelesai: (nilai: string | null) => void;
}) {
  const [nilai, setNilai] = useState(awal);
  const selesai = useRef(false);
  const akhiri = (v: string | null) => {
    if (selesai.current) return;
    selesai.current = true;
    onSelesai(v);
  };
  const umum = {
    autoFocus: true,
    value: nilai,
    maxLength: maks,
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => e.currentTarget.select(),
    onBlur: () => akhiri(nilai),
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") akhiri(null);
      else if (e.key === "Enter" && (!banyakBaris || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        akhiri(nilai);
      }
    },
    style: gaya,
    "aria-label": banyakBaris ? "Teks simbol" : "Label garis",
  };
  return banyakBaris ? (
    <textarea
      {...umum}
      onChange={(e) => setNilai(e.target.value)}
      className="absolute z-10 resize-none border-2 border-blue-500 bg-paper-card p-1 text-center leading-tight text-ink outline-none"
    />
  ) : (
    <input
      {...umum}
      onChange={(e) => setNilai(e.target.value)}
      list="flow-label-saran"
      className="absolute z-10 border-2 border-blue-500 bg-paper-card px-1 text-xs font-semibold text-ink outline-none"
    />
  );
}
