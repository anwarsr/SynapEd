"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Batang, LangkahMerge, SimpulMerge } from "@/lib/lab/sort/sortTypes";
import { cn } from "@/lib/cn";

/** Tinggi kotak dan jarak antarbaris (px). Jarak menampung panah + label i/j/k + nomor proses. */
const KOTAK = 38;
const BARIS = KOTAK + 40;

type JenisKotak = "bagi" | "gabung";

interface Kotak {
  simpul: SimpulMerge;
  jenis: JenisKotak;
  baris: number;
  isi: (Batang | null)[];
}

/**
 * Pohon bagi-gabung merge sort, digambar seperti diagram buku teks: data dibelah
 * TURUN sampai satu elemen, lalu hasil gabungan juga digambar TURUN di baris-
 * baris berikutnya, sehingga pohonnya berbentuk belah ketupat dan setiap
 * hasil gabungan punya kotaknya sendiri (dulu hasil gabungan menimpa kotak
 * induknya, dan alur "naik kembali" tidak terlihat - permintaan pemilik).
 *
 * Tata letak baris (D = kedalaman pohon):
 *   - simpul yang dibagi: baris = tingkatnya (0..D-1);
 *   - daun: SELALU baris D, walau tingkatnya lebih dangkal (panahnya memanjang),
 *     supaya semua elemen tunggal sejajar seperti di diagram;
 *   - hasil gabungan simpul bertingkat t: baris 2D - t (akar = paling bawah).
 * Posisi mendatar: kotak menempati lo..hi dari lebar papan, jadi anak selalu
 * tepat di bawah bagian induknya. Lebar diukur (ResizeObserver); 720px dipakai
 * server & klien sebelum terukur supaya tanpa hydration mismatch.
 *
 * Panah SVG: induk → anak saat membagi; hasil anak (kotak gabungan anak, atau
 * daun) → kotak gabungan induk. Yang sedang dikerjakan berwarna biru. Angka
 * kecil di pojok kotak = urutan proses (`nomorBagi`/`nomorGabung` dari perekam).
 */
export default function PohonMerge({ langkah }: { langkah: LangkahMerge }) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(720);
  const idPanah = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLebar(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const simpul = langkah.simpul;
  const akar = simpul[0];
  if (!akar) return null;
  const n = akar.hi + 1;
  const D = Math.max(...simpul.map((s) => s.tingkat));
  const jumlahBaris = 2 * D + 1;
  const tinggi = (jumlahBaris - 1) * BARIS + KOTAK + 22;

  const daun = (s: SimpulMerge) => s.kiri === null;
  const terlihat = (s: SimpulMerge) => s.status !== "tersembunyi";
  const adaGabungan = (s: SimpulMerge) => !daun(s) && (s.status === "menggabung" || s.status === "urut" || s.status === "terpakai");

  const kotakBagi = (s: SimpulMerge): Kotak => ({ simpul: s, jenis: "bagi", baris: daun(s) ? D : s.tingkat, isi: daun(s) ? s.isi : s.asli });
  const kotakGabung = (s: SimpulMerge): Kotak => ({ simpul: s, jenis: "gabung", baris: 2 * D - s.tingkat, isi: s.isi });
  /** Kotak yang menjadi "hasil" simpul (masukan bagi induknya saat digabung). */
  const keluaran = (s: SimpulMerge): Kotak => (daun(s) ? kotakBagi(s) : kotakGabung(s));

  const kotak: Kotak[] = [];
  for (const s of simpul) {
    if (!terlihat(s)) continue;
    kotak.push(kotakBagi(s));
    if (adaGabungan(s)) kotak.push(kotakGabung(s));
  }

  // Geometri. Celah antarkotak harus JAUH lebih lebar dari celah antarsel (2px):
  // dengan celah yang mirip, dua kotak bertetangga terbaca sebagai satu deret.
  // Di ponsel sel sudah sempit (12 data ≈ 27px), jadi celahnya dikecilkan.
  const CELAH = lebar < 480 ? 3 : 9;
  const kiriX = (s: SimpulMerge) => (s.lo / n) * lebar + CELAH;
  const lebarK = (s: SimpulMerge) => ((s.hi - s.lo + 1) / n) * lebar - 2 * CELAH;
  const tengahX = (s: SimpulMerge) => ((s.lo + s.hi + 1) / 2 / n) * lebar;
  const atasY = (k: Kotak) => k.baris * BARIS + 16;

  // Penggabungan yang sedang berjalan: penunjuk i/j di hasil anak, k di kotak gabungan.
  const aktif = langkah.aktif === null ? null : simpul[langkah.aktif];
  const menggabung = aktif && aktif.status === "menggabung" ? aktif : null;
  const anakKiri = menggabung ? simpul[menggabung.kiri!] : null;
  const anakKanan = menggabung ? simpul[menggabung.kanan!] : null;

  const panah: { dari: Kotak; ke: Kotak; aktif: boolean }[] = [];
  for (const s of simpul) {
    if (daun(s) || !terlihat(s)) continue;
    const ki = simpul[s.kiri!];
    const ka = simpul[s.kanan!];
    // Pembagian: induk → kedua anak, begitu anak terlihat.
    for (const a of [ki, ka]) {
      if (terlihat(a)) panah.push({ dari: kotakBagi(s), ke: kotakBagi(a), aktif: aktif?.id === s.id && s.status === "dibagi" });
    }
    // Penggabungan: hasil kedua anak → kotak gabungan induk.
    if (adaGabungan(s)) {
      for (const a of [ki, ka]) panah.push({ dari: keluaran(a), ke: kotakGabung(s), aktif: menggabung?.id === s.id });
    }
  }

  return (
    <div className="bg-paper-card px-2 pb-3 pt-4 sm:px-4">
      <div
        ref={wadahRef}
        className="relative"
        style={{ height: tinggi }}
        role="img"
        aria-label={`Pohon merge sort: dibagi sampai satu elemen, lalu digabung. Data semula ${akar.asli.map((b) => b.nilai).join(", ")}`}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            {(["netral", "aktif"] as const).map((j) => (
              <marker
                key={j}
                id={`${idPanah}-${j}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
                className={j === "aktif" ? "text-blue-400" : "text-white/35"}
              >
                <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
              </marker>
            ))}
          </defs>
          {panah.map((p) => {
            const x1 = tengahX(p.dari.simpul);
            const y1 = atasY(p.dari) + KOTAK;
            const x2 = tengahX(p.ke.simpul);
            const y2 = atasY(p.ke) - 4;
            return (
              <line
                key={`${p.dari.jenis}${p.dari.simpul.id}-${p.ke.jenis}${p.ke.simpul.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={p.aktif ? 2 : 1.4}
                markerEnd={`url(#${idPanah}-${p.aktif ? "aktif" : "netral"})`}
                className={cn("lab-fade-up transition-colors duration-300", p.aktif ? "text-blue-400" : "text-white/30")}
              />
            );
          })}
        </svg>

        {kotak.map((k) => {
          const s = k.simpul;
          const sorot =
            (k.jenis === "bagi" && aktif?.id === s.id && (s.status === "dibagi" || daun(s))) ||
            (k.jenis === "gabung" && menggabung?.id === s.id);
          const nomor = k.jenis === "gabung" ? s.nomorGabung : s.nomorBagi;
          // Penunjuk & sel yang sudah diambil hanya di hasil anak & kotak gabungan yang sedang digabung.
          let label: Record<number, string> = {};
          let diambil = 0;
          if (menggabung) {
            const { i, j, k: kk } = langkah.penunjuk;
            if (anakKiri && keluaran(anakKiri).jenis === k.jenis && anakKiri.id === s.id) {
              if (i !== null && i < k.isi.length) label = { [i]: "i" };
              diambil = i ?? 0;
            } else if (anakKanan && keluaran(anakKanan).jenis === k.jenis && anakKanan.id === s.id) {
              if (j !== null && j < k.isi.length) label = { [j]: "j" };
              diambil = j ?? 0;
            } else if (k.jenis === "gabung" && s.id === menggabung.id && kk !== null && kk < k.isi.length) {
              label = { [kk]: "k" };
            }
          }
          const gaya: "netral" | "daun" | "isi" | "urut" =
            k.jenis === "gabung" ? (s.status === "menggabung" ? "isi" : "urut") : daun(s) && s.status === "urut" ? "daun" : "netral";
          const pudar = k.jenis === "bagi" && !daun(s) && s.status !== "menunggu" && !sorot;

          return (
            <div
              key={`${k.jenis}-${s.id}`}
              data-kotak={k.jenis}
              data-simpul={s.id}
              className={cn("lab-fade-up absolute transition-opacity duration-300", pudar && "opacity-55")}
              style={{ left: kiriX(s), width: lebarK(s), top: atasY(k), height: KOTAK }}
            >
              <div
                className={cn(
                  "flex h-full gap-[2px] transition-shadow duration-300",
                  sorot && "shadow-[0_0_0_2px_var(--color-blue-400)]",
                )}
              >
                {k.isi.map((b, x) => (
                  <div
                    key={x}
                    data-sel={b ? b.nilai : ""}
                    className={cn(
                      "relative flex min-w-0 flex-1 items-center justify-center text-[11px] font-semibold tabular-nums transition-[background-color,opacity] duration-300 sm:text-sm",
                      b === null
                        ? "bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--color-blue-400)]"
                        : gaya === "urut"
                          ? "bg-blue-600 text-white"
                          : gaya === "isi"
                            ? "bg-blue-300 text-paper"
                            : gaya === "daun"
                              ? "bg-blue-600/45 text-ink"
                              : "bg-white/[0.09] text-ink",
                      x < diambil && "opacity-30",
                    )}
                  >
                    {label[x] && (
                      <span key={label[x]} className="lab-pop absolute -top-[15px] text-[11px] font-bold leading-none text-blue-300">
                        {label[x]}
                      </span>
                    )}
                    {b ? <span key={b.id} className={k.jenis === "gabung" ? "lab-pop" : undefined}>{b.nilai}</span> : null}
                  </div>
                ))}
              </div>
              {nomor !== null && (
                <span data-nomor={nomor} className="absolute -bottom-[15px] left-0 text-[10px] font-bold tabular-nums leading-none text-blue-300/80">
                  {nomor}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
