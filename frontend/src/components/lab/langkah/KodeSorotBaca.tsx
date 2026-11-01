"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { sorotKode, type JenisToken } from "@/lib/lab/kodeSorot";
import { cn } from "@/lib/cn";

const WARNA: Record<JenisToken, string> = {
  kunci: "kode-kunci",
  tipe: "kode-tipe",
  fungsi: "kode-fungsi",
  teks: "kode-teks",
  angka: "kode-angka",
  komentar: "text-ink-faint italic",
  biasa: "text-ink",
};

/**
 * Pseudocode baca-saja dengan rentang baris aktif disorot — huruf, warna, dan
 * sorotan sama dengan editor Lab 05 (`KodeEditor`).
 *
 * Baris aktif digulir ke dalam pandangan dengan menulis `scrollTop` kotak
 * kodenya sendiri, BUKAN `scrollIntoView`: yang terakhir ikut menggulir panel
 * lab dan halaman, sehingga layar melompat setiap langkah.
 */
export default function KodeSorotBaca({ kode, dari, sampai }: { kode: string; dari: number; sampai: number }) {
  const token = useMemo(() => sorotKode(kode.replace(/\n$/, ""), "pseudocode"), [kode]);
  const kotakRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const kotak = kotakRef.current;
    if (!kotak) return;
    const atas = (dari - 1) * 24;
    const bawah = sampai * 24 + 24;
    if (atas < kotak.scrollTop || bawah > kotak.scrollTop + kotak.clientHeight) {
      kotak.scrollTop = Math.max(0, atas - kotak.clientHeight / 3);
    }
  }, [dari, sampai]);

  return (
    <div
      ref={kotakRef}
      data-boleh-salin
      className="lab-pane relative max-h-[26rem] overflow-auto bg-white/[0.03] py-3 font-mono text-[12.5px] leading-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bg-blue-500/20 shadow-[inset_3px_0_0_var(--color-blue-400)] transition-[top,height] duration-300 ease-out-soft motion-reduce:transition-none"
        style={{ top: 12 + (dari - 1) * 24, height: (sampai - dari + 1) * 24 }}
      />
      <pre className="relative m-0 w-max min-w-full whitespace-pre">
        {token.map((baris, i) => {
          const n = i + 1;
          const nyala = n >= dari && n <= sampai;
          return (
            <div key={i} className="flex h-6">
              <span className={cn("w-9 shrink-0 select-none pr-2.5 text-right tabular-nums", nyala ? "font-semibold text-blue-300" : "text-ink-faint")}>
                {n}
              </span>
              <span className="pr-4">{baris.length === 0 ? " " : baris.map((t, j) => <span key={j} className={WARNA[t.t]}>{t.v}</span>)}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
