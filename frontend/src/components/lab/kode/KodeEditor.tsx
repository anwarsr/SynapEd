"use client";
import { useEffect, useId, useMemo, useRef } from "react";
import { sorotKode, type JenisToken } from "@/lib/lab/kodeSorot";
import type { BahasaKode } from "@/lib/lab/kodeUrl";
import { cn } from "@/lib/cn";

/** Tinggi baris & bantalan atas — HARUS sama dengan kelas `leading-6`/`py-3` di bawah. */
const TINGGI_BARIS = 24;
const BANTALAN = 12;

/** Warna sintaks: variabel `--kode-*` di globals.css (punya versi tema terang). */
const WARNA: Record<JenisToken, string> = {
  kunci: "kode-kunci",
  tipe: "kode-tipe",
  fungsi: "kode-fungsi",
  teks: "kode-teks",
  angka: "kode-angka",
  komentar: "text-ink-faint italic",
  biasa: "text-ink",
};

/** Indentasi bawaan: Python 4 spasi (PEP 8), pseudocode 3 spasi (panduan 9618 §1.2). */
const INDENTASI: Record<BahasaKode, string> = { python: "    ", pseudocode: "   " };

/** Pseudocode: baris pembuka blok yang isinya menjorok satu tingkat. */
const PEMBUKA_PS = /^(IF\b|ELSE$|THEN$|FOR\b|WHILE\b|REPEAT$|CASE\s+OF\b|PROCEDURE\b|FUNCTION\b|OTHERWISE\b)/;

/**
 * Menyisipkan teks lewat `execCommand` supaya Ctrl+Z bawaan browser tetap
 * bekerja (menulis `value` langsung menghapus riwayat undo textarea).
 * `execCommand` usang tetapi masih satu-satunya cara itu; bila tidak didukung,
 * jatuh ke `setRangeText` + kabar perubahan manual.
 */
function sisipkan(ta: HTMLTextAreaElement, teks: string, onUbah: (v: string) => void) {
  ta.focus();
  let berhasil = false;
  try {
    berhasil = document.execCommand("insertText", false, teks);
  } catch {
    berhasil = false;
  }
  if (!berhasil) {
    ta.setRangeText(teks, ta.selectionStart, ta.selectionEnd, "end");
    onUbah(ta.value);
  }
}

/**
 * Editor kode lab: `<textarea>` transparan di atas `<pre>` berwarna.
 *
 * Yang diketik selalu textarea asli (seleksi, IME, salin-tempel, undo, pembaca
 * layar bekerja tanpa diatur ulang); `<pre>` di belakangnya hanya gambar.
 * Keduanya WAJIB berbagi huruf, ukuran, tinggi baris, bantalan, dan
 * `white-space` yang sama — selisih satu piksel membuat kursor melayang dari
 * huruf yang terlihat. Gulir disinkronkan dengan menulis `transform` langsung
 * ke DOM (bukan state) agar tidak merender ulang per piksel gulir.
 */
export default function KodeEditor({
  nilai,
  onUbah,
  bahasa,
  barisAktif,
  barisLalu,
  barisGalat,
  hanyaBaca,
  label,
  onJalankan,
}: {
  nilai: string;
  onUbah: (v: string) => void;
  bahasa: BahasaKode;
  /** Baris yang akan dijalankan pada langkah ini. */
  barisAktif: number | null;
  /** Baris yang baru saja dijalankan (langkah sebelumnya). */
  barisLalu: number | null;
  barisGalat: number | null;
  hanyaBaca: boolean;
  label: string;
  onJalankan?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lapisRef = useRef<HTMLDivElement>(null);
  const nomorRef = useRef<HTMLDivElement>(null);
  /** Setelah Esc, Tab berikutnya memindah fokus — jalan keluar papan ketik dari editor. */
  const lepasTab = useRef(false);
  const idPetunjuk = useId();

  const token = useMemo(() => sorotKode(nilai, bahasa), [nilai, bahasa]);

  function sinkronGulir() {
    const ta = taRef.current;
    if (!ta) return;
    if (lapisRef.current) lapisRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    if (nomorRef.current) nomorRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  // Baris aktif selalu terlihat saat langkah diputar.
  useEffect(() => {
    const ta = taRef.current;
    const n = barisAktif ?? barisGalat;
    if (!ta || n === null) return;
    const atas = BANTALAN + (n - 1) * TINGGI_BARIS;
    if (atas < ta.scrollTop + TINGGI_BARIS || atas + 2 * TINGGI_BARIS > ta.scrollTop + ta.clientHeight) {
      ta.scrollTop = Math.max(0, atas - ta.clientHeight / 3);
      sinkronGulir();
    }
  }, [barisAktif, barisGalat]);

  function tekan(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onJalankan?.();
      return;
    }
    if (e.key === "Escape") {
      lepasTab.current = true;
      return;
    }
    if (hanyaBaca) return;
    const jorok = INDENTASI[bahasa];

    if (e.key === "Tab") {
      if (lepasTab.current) {
        lepasTab.current = false;
        return;
      }
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = ta;
      const awalBaris = value.lastIndexOf("\n", a - 1) + 1;
      const banyak = value.slice(a, b).includes("\n");
      if (!banyak && !e.shiftKey) {
        // Sisipkan sampai kelipatan indentasi berikutnya.
        const kolom = a - awalBaris;
        sisipkan(ta, " ".repeat(jorok.length - (kolom % jorok.length)), onUbah);
        return;
      }
      // Beberapa baris (atau Shift+Tab): jorokkan/kurangi tiap baris terpilih.
      const akhirBaris = b > a && value[b - 1] === "\n" ? b - 1 : b;
      const ujung = value.indexOf("\n", akhirBaris);
      const sampai = ujung === -1 ? value.length : ujung;
      const potongan = value.slice(awalBaris, sampai).split("\n");
      const baru = potongan.map((l) => {
        if (!e.shiftKey) return jorok + l;
        const spasi = /^ */.exec(l)![0].length;
        return l.slice(Math.min(spasi, jorok.length));
      });
      ta.setSelectionRange(awalBaris, sampai);
      sisipkan(ta, baru.join("\n"), onUbah);
      ta.setSelectionRange(awalBaris, awalBaris + baru.join("\n").length);
      return;
    }
    lepasTab.current = false;

    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      const { selectionStart: a, value } = ta;
      const awalBaris = value.lastIndexOf("\n", a - 1) + 1;
      const sebelum = value.slice(awalBaris, a);
      let indent = /^[ \t]*/.exec(sebelum)![0];
      const isi = sebelum.trim();
      // Python wajib berindentasi setelah `:`; tanpa bantuan ini, siswa yang
      // baru belajar langsung bertemu IndentationError.
      if (bahasa === "python" ? isi.endsWith(":") : PEMBUKA_PS.test(isi) && !/\b(ENDIF|ENDWHILE|ENDCASE|NEXT)\b/.test(isi)) indent += jorok;
      e.preventDefault();
      sisipkan(ta, "\n" + indent, onUbah);
    }
  }

  const jumlahBaris = token.length;

  return (
    <div className="relative flex min-h-[50vh] overflow-hidden bg-white/[0.03] font-mono text-[13px] leading-6 outline outline-1 outline-white/10 lg:min-h-0 lg:flex-1">
      <div aria-hidden="true" className="w-11 shrink-0 select-none overflow-hidden bg-white/[0.03] text-right tabular-nums">
        <div ref={nomorRef} className="py-3 pr-2.5">
          {Array.from({ length: jumlahBaris }, (_, i) => {
            const n = i + 1;
            return (
              <div
                key={n}
                className={cn(
                  "h-6",
                  n === barisGalat ? "font-semibold text-error-text" : n === barisAktif ? "font-semibold text-blue-300" : "text-ink-faint",
                )}
              >
                {n === barisAktif ? "▸" : ""}
                {n}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div ref={lapisRef} className="relative w-max min-w-full px-3 py-3">
            {barisLalu !== null && barisLalu !== barisAktif && (
              <div className="absolute inset-x-0 h-6 bg-white/[0.05]" style={{ top: BANTALAN + (barisLalu - 1) * TINGGI_BARIS }} />
            )}
            {barisAktif !== null && (
              <div
                className="absolute inset-x-0 h-6 bg-blue-500/20 shadow-[inset_3px_0_0_var(--color-blue-400)] transition-[top] duration-200 ease-out-soft motion-reduce:transition-none"
                style={{ top: BANTALAN + (barisAktif - 1) * TINGGI_BARIS }}
              />
            )}
            {barisGalat !== null && (
              <div className="kode-baris-galat absolute inset-x-0 h-6" style={{ top: BANTALAN + (barisGalat - 1) * TINGGI_BARIS }} />
            )}
            <pre className="relative m-0 whitespace-pre font-mono text-[13px] leading-6 [tab-size:4]">
              {token.map((baris, i) => (
                <div key={i} className="h-6">
                  {baris.length === 0 ? " " : baris.map((t, j) => <span key={j} className={WARNA[t.t]}>{t.v}</span>)}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <textarea
          ref={taRef}
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          onScroll={sinkronGulir}
          onKeyDown={tekan}
          readOnly={hanyaBaca}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label={label}
          aria-describedby={idPetunjuk}
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 font-mono text-[13px] leading-6 text-transparent caret-ink outline-none [tab-size:4] selection:bg-blue-500/35 selection:text-transparent"
        />
        <p id={idPetunjuk} className="sr-only">
          Tab menyisipkan indentasi. Tekan Escape lalu Tab untuk keluar dari editor. Ctrl+Enter menjalankan program.
        </p>
      </div>
    </div>
  );
}
