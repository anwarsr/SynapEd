"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  PALET,
  WARNA_KUSTOM_AWAL,
  WHEEL_DURASI_MAKS,
  WHEEL_DURASI_MIN,
  WHEEL_MAX_ITEM,
  WHEEL_MAX_NAMA_ITEM,
  WHEEL_MAX_NAMA_RODA,
  WHEEL_MAX_RODA,
  WHEEL_MAX_WARNA,
  WHEEL_MIN_WARNA,
  acakIndeks,
  bersihkanRoda,
  rodaBaru,
  sudutTujuan,
  tambahItem,
  warnaRoda,
  warnaTeks,
  type PaletBawaan,
  type Wheel,
} from "@/lib/wheel";
import { cn } from "@/lib/cn";

const SANS = { fontFamily: "var(--font-sans)" } as const;
const TOMBOL = "bg-blue-600 px-5 py-2.5 text-sm font-semibold text-[#fff] transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const TOMBOL_2 = "bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50";
const ISIAN = "w-full bg-white/[0.06] px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]";

const CX = 200;
const R = 190;

function titik(derajat: number, r: number): [number, number] {
  const a = (derajat * Math.PI) / 180;
  return [CX + r * Math.sin(a), CX - r * Math.cos(a)];
}

function acak32(): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0];
}

function idBaru(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Roda SVG: irisan berwarna + nama; `sudut` diputar lewat transisi CSS pada grupnya. */
function Roda({
  wheel,
  sudut,
  transisi,
  onSelesai,
}: {
  wheel: Wheel;
  sudut: number;
  transisi: string;
  onSelesai: () => void;
}) {
  const n = wheel.items.length;
  const warna = warnaRoda(wheel);
  const seg = n > 0 ? 360 / n : 360;
  const fs = Math.max(9, Math.min(20, 22 - n * 0.3));

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Penunjuk di atas */}
      <svg viewBox="0 0 40 40" className="absolute left-1/2 top-0 z-10 h-9 w-9 -translate-x-1/2 -translate-y-[40%] drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]" aria-hidden="true">
        <path d="M20 38 6 8h28Z" fill="#fff" />
      </svg>
      <svg viewBox="0 0 400 400" className="block h-auto w-full" role="img" aria-label={`Roda berisi ${n} nama`}>
        <g
          style={{ transform: `rotate(${sudut}deg)`, transformOrigin: "200px 200px", transition: transisi }}
          onTransitionEnd={onSelesai}
        >
          {n === 0 && <circle cx={CX} cy={CX} r={R} fill="#1F2A33" />}
          {n === 1 && <circle cx={CX} cy={CX} r={R} fill={warna[0]} />}
          {n >= 2 &&
            wheel.items.map((_, i) => {
              const [x1, y1] = titik(i * seg, R);
              const [x2, y2] = titik((i + 1) * seg, R);
              const fill = warna[(n > warna.length && i === n - 1 && i % warna.length === 0 ? 1 : i) % warna.length];
              return (
                <path
                  key={i}
                  d={`M${CX} ${CX}L${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`}
                  fill={fill}
                  stroke="rgba(0,0,0,0.25)"
                  strokeWidth="1"
                />
              );
            })}
          {n > 0 &&
            wheel.items.map((nama, i) => {
              const mid = n === 1 ? 0 : (i + 0.5) * seg;
              const fill = warna[(n > warna.length && i === n - 1 && i % warna.length === 0 ? 1 : i) % warna.length];
              const label = nama.length > 18 ? `${nama.slice(0, 17)}…` : nama;
              return (
                <text
                  key={`t${i}`}
                  transform={`rotate(${mid - 90} ${CX} ${CX})`}
                  x={CX + R - 16}
                  y={CX}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={fs}
                  fontWeight={700}
                  fill={warnaTeks(fill)}
                  style={SANS}
                >
                  {label}
                </text>
              );
            })}
        </g>
        {/* Poros */}
        <circle cx={CX} cy={CX} r="16" fill="#0B1A24" />
        <circle cx={CX} cy={CX} r="6" fill="#fff" />
      </svg>
    </div>
  );
}

function Isi({ classId, namaKelas, anggota }: { classId: string; namaKelas: string; anggota: string[] }) {
  const kunci = `synaped_wheels_${classId}`;

  const [daftar, setDaftar] = useState<Wheel[]>(() => {
    try {
      const baca = bersihkanRoda(JSON.parse(localStorage.getItem(kunci) ?? "null"));
      if (baca.length) return baca;
    } catch {
      // penyimpanan terblokir/rusak: mulai dari roda bawaan
    }
    // Roda pertama langsung berisi anggota kelas.
    return [rodaBaru(idBaru(), "Roda 1", anggota)];
  });
  const [aktifId, setAktifId] = useState(() => daftar[0].id);
  const [sudut, setSudut] = useState(0);
  const [transisi, setTransisi] = useState("none");
  const [memutar, setMemutar] = useState(false);
  const [pemenang, setPemenang] = useState<{ nama: string; index: number } | null>(null);
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const tujuanRef = useRef<{ index: number; nama: string } | null>(null);
  // Pop-up pemenang di tengah layar (opsi per roda): tampil ±2 dtk dengan layar diburamkan.
  const [popup, setPopup] = useState<string | null>(null);
  const timerPopup = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hemat = useRef(false);

  useEffect(() => {
    hemat.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => () => {
    if (timerPopup.current) clearTimeout(timerPopup.current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(kunci, JSON.stringify(daftar));
    } catch {
      // abaikan: roda tetap berfungsi, hanya tidak diingat
    }
  }, [daftar, kunci]);

  const roda = daftar.find((w) => w.id === aktifId) ?? daftar[0];
  const n = roda.items.length;

  function ubah(f: (w: Wheel) => Wheel) {
    setDaftar((d) => d.map((w) => (w.id === roda.id ? f(w) : w)));
  }

  function pilihRoda(id: string) {
    if (memutar) return;
    setAktifId(id);
    setPemenang(null);
    setGalat(null);
    setTransisi("none");
    setSudut(0);
  }

  function tambahRoda() {
    if (memutar) return;
    if (daftar.length >= WHEEL_MAX_RODA) return setGalat(`Maksimal ${WHEEL_MAX_RODA} roda.`);
    const w = rodaBaru(idBaru(), `Roda ${daftar.length + 1}`);
    setDaftar((d) => [...d, w]);
    pilihRoda(w.id);
  }

  function hapusRoda() {
    if (memutar || daftar.length <= 1) return;
    const sisa = daftar.filter((w) => w.id !== roda.id);
    setDaftar(sisa);
    pilihRoda(sisa[0].id);
  }

  function tambahNama(e: React.FormEvent) {
    e.preventDefault();
    const r = tambahItem(roda.items, nama);
    if (r.error) return setGalat(r.error);
    setGalat(null);
    ubah((w) => ({ ...w, items: r.items }));
    setNama("");
  }

  function masukkanAnggota() {
    const ada = new Set(roda.items.map((x) => x.toLowerCase()));
    const tambahan = anggota.filter((a) => !ada.has(a.toLowerCase()));
    const gabung = [...roda.items, ...tambahan].slice(0, WHEEL_MAX_ITEM);
    setGalat(roda.items.length + tambahan.length > WHEEL_MAX_ITEM ? `Hanya ${WHEEL_MAX_ITEM} nama yang muat; sisanya tidak dimasukkan.` : null);
    ubah((w) => ({ ...w, items: gabung }));
  }

  function putar() {
    if (memutar) return;
    // "Keluarkan pemenang otomatis": pemenang putaran sebelumnya dibuang dari roda sebelum diundi lagi.
    const items = pemenang && roda.hapusPemenang ? roda.items.filter((_, i) => i !== pemenang.index) : roda.items;
    const n = items.length;
    if (n < 2) {
      if (items !== roda.items) ubah((w) => ({ ...w, items }));
      setPemenang(null);
      return setGalat("Sisa nama kurang dari 2. Tambahkan nama atau masukkan anggota lagi.");
    }
    if (items !== roda.items) ubah((w) => ({ ...w, items }));
    setGalat(null);
    setPemenang(null);
    // Pemenang diundi DULU; roda lalu diputar tepat ke irisannya.
    const index = acakIndeks(n, acak32);
    const jitter = (acak32() / 0xffffffff - 0.5) * 0.7;
    const putaran = 4 + Math.floor((acak32() / 0xffffffff) * 3);
    const akhir = sudutTujuan(sudut, index, n, putaran, jitter);
    tujuanRef.current = { index, nama: items[index] };
    if (hemat.current) {
      setTransisi("none");
      setSudut(akhir);
      selesai(tujuanRef.current);
      return;
    }
    setMemutar(true);
    setTransisi(`transform ${roda.durasi}s cubic-bezier(0.12, 0.62, 0.12, 1)`);
    setSudut(akhir);
  }

  function selesai(t = tujuanRef.current) {
    if (!t) return;
    tujuanRef.current = null;
    setMemutar(false);
    setPemenang({ nama: t.nama, index: t.index });
    if (roda.popup) {
      setPopup(t.nama);
      if (timerPopup.current) clearTimeout(timerPopup.current);
      timerPopup.current = setTimeout(() => setPopup(null), 2000);
    }
  }

  function keluarkanPemenang() {
    if (!pemenang) return;
    const idx = pemenang.index;
    // Sudut dinormalkan dulu tanpa animasi supaya irisan yang tersisa tak melompat terlihat.
    setPemenang(null);
    ubah((w) => ({ ...w, items: w.items.filter((_, i) => i !== idx) }));
    setTransisi("none");
    setSudut(0);
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {popup && (
        <button
          type="button"
          onClick={() => setPopup(null)}
          aria-label="Tutup"
          className="wheel-popup fixed inset-0 z-[90] flex cursor-default flex-col items-center justify-center gap-5 bg-black/45 px-6 text-center backdrop-blur-xl"
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.4em] text-[#fff]/70">Yang menjawab</span>
          <span className="wheel-popup-nama max-w-[90vw] break-words text-[clamp(2.6rem,9vw,7rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#fff]" style={SANS}>
            {popup}
          </span>
        </button>
      )}
      {/* ── Roda ── */}
      <section className="bg-paper-card p-6 sm:p-10">
        <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted">{roda.name}</p>
        <Roda wheel={roda} sudut={sudut} transisi={transisi} onSelesai={() => selesai()} />

        <div className="mt-8 flex flex-col items-center gap-4">
          <button type="button" onClick={putar} disabled={memutar || n < 2} className={cn(TOMBOL, "min-w-[12rem] py-3.5 text-base")}>
            {memutar ? "Memutar…" : "Putar roda"}
          </button>
          {n < 2 && <p className="text-sm text-ink-muted">Isi minimal 2 nama untuk memutar.</p>}

          {pemenang && (
            <div role="status" className="w-full max-w-md bg-white/[0.06] px-6 py-6 text-center shadow-[inset_3px_0_0_var(--color-blue-500)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-300">Yang menjawab</p>
              <p className="mt-2 break-words text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-white" style={SANS}>
                {pemenang.nama}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={putar} disabled={n < 2} className={TOMBOL_2}>
                  Putar lagi
                </button>
                <button type="button" onClick={keluarkanPemenang} className={TOMBOL_2}>
                  Keluarkan dari roda
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Pengaturan ── */}
      <aside className="space-y-4">
        <div className="bg-paper-card p-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-ink-muted">Roda saya</p>
          <div className="flex flex-wrap gap-2">
            {daftar.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => pilihRoda(w.id)}
                disabled={memutar}
                aria-pressed={w.id === roda.id}
                className={cn(
                  "px-3.5 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-60",
                  w.id === roda.id ? "bg-white/[0.12] text-white shadow-[inset_0_-3px_0_var(--color-blue-500)]" : "bg-white/[0.05] text-ink-body hover:bg-white/10 hover:text-white",
                )}
              >
                {w.name}
              </button>
            ))}
            <button type="button" onClick={tambahRoda} disabled={memutar} className="bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-white/10 disabled:opacity-60">
              + Roda baru
            </button>
          </div>
        </div>

        <div className="bg-paper-card p-6">
          <label htmlFor="nama-roda" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.26em] text-ink-muted">
            Nama roda
          </label>
          <input id="nama-roda" value={roda.name} maxLength={WHEEL_MAX_NAMA_RODA} onChange={(e) => ubah((w) => ({ ...w, name: e.target.value }))} className={ISIAN} />

          <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.26em] text-ink-muted">Warna</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PALET) as PaletBawaan[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => ubah((w) => ({ ...w, palet: p }))}
                aria-pressed={roda.palet === p}
                className={cn("flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white transition-colors", roda.palet === p ? "bg-white/[0.14]" : "bg-white/[0.05] hover:bg-white/10")}
              >
                <span aria-hidden="true" className="flex">
                  {PALET[p].warna.slice(0, 4).map((c) => (
                    <span key={c} className="h-3.5 w-2.5" style={{ background: c }} />
                  ))}
                </span>
                {PALET[p].label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => ubah((w) => ({ ...w, palet: "kustom" }))}
              aria-pressed={roda.palet === "kustom"}
              className={cn("flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white transition-colors", roda.palet === "kustom" ? "bg-white/[0.14]" : "bg-white/[0.05] hover:bg-white/10")}
            >
              <span aria-hidden="true" className="flex">
                {roda.warna.slice(0, 4).map((c, i) => (
                  <span key={i} className="h-3.5 w-2.5" style={{ background: c }} />
                ))}
              </span>
              Kustom
            </button>
          </div>

          {roda.palet === "kustom" && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-ink-muted">Pilih warna irisan (diulang berurutan bila nama lebih banyak dari warna).</p>
              <div className="flex flex-wrap items-center gap-2">
                {roda.warna.map((c, i) => (
                  <span key={i} className="group relative">
                    <input
                      type="color"
                      value={c}
                      aria-label={`Warna ${i + 1}`}
                      onChange={(e) => ubah((w) => ({ ...w, warna: w.warna.map((x, j) => (j === i ? e.target.value.toLowerCase() : x)) }))}
                      className="h-10 w-10 cursor-pointer bg-transparent p-0"
                    />
                    {roda.warna.length > WHEEL_MIN_WARNA && (
                      <button
                        type="button"
                        onClick={() => ubah((w) => ({ ...w, warna: w.warna.filter((_, j) => j !== i) }))}
                        aria-label={`Hapus warna ${i + 1}`}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-[#0B1A24] text-[10px] leading-none text-[#fff] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {roda.warna.length < WHEEL_MAX_WARNA && (
                  <button
                    type="button"
                    onClick={() => ubah((w) => ({ ...w, warna: [...w.warna, WARNA_KUSTOM_AWAL[w.warna.length % WARNA_KUSTOM_AWAL.length]] }))}
                    className="h-10 w-10 bg-white/[0.06] text-lg text-blue-300 transition-colors hover:bg-white/10"
                    aria-label="Tambah warna"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )}

          <label htmlFor="durasi-roda" className="mb-2 mt-6 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.26em] text-ink-muted">
            <span>Lama putaran</span>
            <span className="tabular-nums text-white">{roda.durasi} dtk</span>
          </label>
          <input
            id="durasi-roda"
            type="range"
            min={WHEEL_DURASI_MIN}
            max={WHEEL_DURASI_MAKS}
            value={roda.durasi}
            onChange={(e) => ubah((w) => ({ ...w, durasi: Number(e.target.value) }))}
            className="range-tipis w-full"
          />

          <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-ink-body">
            <input type="checkbox" checked={roda.hapusPemenang} onChange={(e) => ubah((w) => ({ ...w, hapusPemenang: e.target.checked }))} className="mt-1 h-4 w-4 accent-blue-600" />
            <span>
              Keluarkan pemenang otomatis
              <span className="block text-xs text-ink-muted">Nama yang sudah menjawab tidak muncul lagi di putaran berikutnya.</span>
            </span>
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink-body">
            <input type="checkbox" checked={roda.popup} onChange={(e) => ubah((w) => ({ ...w, popup: e.target.checked }))} className="mt-1 h-4 w-4 accent-blue-600" />
            <span>
              Tampilkan nama pemenang di tengah layar
              <span className="block text-xs text-ink-muted">Layar diburamkan selama 2 detik; ketuk untuk menutup lebih awal.</span>
            </span>
          </label>
        </div>

        <div className="bg-paper-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-ink-muted">Nama di roda</p>
            <p className="text-xs tabular-nums text-ink-muted">
              {n}/{WHEEL_MAX_ITEM}
            </p>
          </div>

          <form onSubmit={tambahNama} className="flex gap-2">
            <input value={nama} maxLength={WHEEL_MAX_NAMA_ITEM} onChange={(e) => setNama(e.target.value)} placeholder="Tambah nama sendiri" className={ISIAN} />
            <button type="submit" disabled={memutar} className={TOMBOL}>
              Tambah
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={masukkanAnggota} disabled={memutar || anggota.length === 0} className={TOMBOL_2}>
              Masukkan anggota kelas ({anggota.length})
            </button>
            <button type="button" onClick={() => ubah((w) => ({ ...w, items: [] }))} disabled={memutar || n === 0} className={TOMBOL_2}>
              Kosongkan
            </button>
          </div>

          {galat && (
            <p role="alert" className="mt-3 text-sm text-rust-700">
              {galat}
            </p>
          )}

          {n > 0 && (
            <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto pr-1">
              {roda.items.map((it, i) => (
                <li key={`${it}-${i}`} className="flex items-center gap-3 bg-white/[0.04] px-3 py-2 text-sm text-ink">
                  <span className="min-w-0 flex-1 truncate">{it}</span>
                  <button
                    type="button"
                    onClick={() => ubah((w) => ({ ...w, items: w.items.filter((_, j) => j !== i) }))}
                    disabled={memutar}
                    aria-label={`Hapus ${it}`}
                    className="text-ink-muted transition-colors hover:text-rust-700 disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {daftar.length > 1 && (
          <button type="button" onClick={hapusRoda} disabled={memutar} className="w-full bg-white/[0.05] px-4 py-3 text-sm font-semibold text-ink-body transition-colors hover:bg-rust-700 hover:text-[#fff] disabled:opacity-50">
            Hapus roda &quot;{roda.name}&quot;
          </button>
        )}
        <p className="px-1 text-xs leading-[1.7] text-ink-muted">
          Roda disimpan di peramban ini untuk kelas {namaKelas}; tidak dibagikan ke siswa dan tidak tersimpan di server.
        </p>
      </aside>
    </div>
  );
}

/** Roda membaca localStorage, jadi hanya dirender di klien (HTML server = kerangka kosong). */
export default function WheelBoard(props: { classId: string; namaKelas: string; anggota: string[] }) {
  const klien = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!klien) return <div className="h-[560px] bg-paper-card" aria-hidden="true" />;
  return <Isi {...props} />;
}
