"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PemilihBerkas from "@/components/classes/PemilihBerkas";
import { saveAiGradingSettings } from "@/lib/classGradingActions";
import { firebaseAuth } from "@/lib/firebase/client";
import { pesanGagalUnggah, unggahKonteksAi } from "@/lib/classUpload";
import {
  FORMAT_AI_KONTEKS,
  MAX_AI_CONTEXT_FILES,
  ekstensiOf,
  type PengaturanAi,
  type SumberKonteksAi,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

/**
 * Kartu "Koreksi AI" di halaman tugas pengajar: dari mana AI membaca soal,
 * dan apakah AI juga mengisi komentar secara bawaan.
 *
 * Berkas konteks terpisah biasanya kunci jawaban — karena itu ia tidak
 * pernah menjadi lampiran postingan, dan kartu ini hanya dirender di halaman
 * pengelola. Hanya NAMA berkasnya yang sampai ke sini, tanpa tautan unduh.
 */
export default function AiGradingSettings({
  classId,
  postId,
  awal,
  adaLampiranTugas,
}: {
  classId: string;
  postId: string;
  awal: PengaturanAi;
  /** Untuk keterangan: mode "tugas" tanpa lampiran berarti AI hanya membaca teks instruksi. */
  adaLampiranTugas: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState<SumberKonteksAi>(awal.source);
  const [lama, setLama] = useState(awal.files);
  const [baru, setBaru] = useState<File[]>([]);
  const [isiKomentar, setIsiKomentar] = useState(awal.fillComment);
  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  const sibuk = mengunggah || pending;
  const sisaSlot = MAX_AI_CONTEXT_FILES - lama.length;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);

    if (source === "separate" && lama.length + baru.length === 0) {
      return setPesan({ ok: false, teks: "Unggah minimal satu berkas konteks." });
    }

    let files: { path: string; name: string }[] = [];
    if (baru.length > 0) {
      const uid = firebaseAuth().currentUser?.uid;
      if (!uid) return setPesan({ ok: false, teks: "Sesi Anda berakhir. Muat ulang halaman ini." });
      setMengunggah(true);
      try {
        files = await unggahKonteksAi(uid, classId, postId, baru);
      } catch (err) {
        setMengunggah(false);
        return setPesan({ ok: false, teks: pesanGagalUnggah(err) });
      }
      setMengunggah(false);
    }

    startTransition(async () => {
      const res = await saveAiGradingSettings(classId, postId, {
        source,
        keep: lama.map((f) => f.path),
        files,
        fillComment: isiKomentar,
      });
      if (!res.ok) return setPesan({ ok: false, teks: res.error });
      setBaru([]);
      setPesan({ ok: true, teks: res.message });
      router.refresh();
    });
  }

  const PILIHAN: readonly { id: SumberKonteksAi; label: string; ket: string }[] = [
    {
      id: "assignment",
      label: "Instruksi & lampiran tugas",
      ket: adaLampiranTugas
        ? "AI membaca teks instruksi dan lampiran yang Anda unggah di tugas ini."
        : "AI membaca teks instruksi tugas ini (tugas ini tidak berlampiran).",
    },
    {
      id: "separate",
      label: "Berkas konteks terpisah",
      ket: "Misalnya soal lengkap atau kunci jawaban. Tidak terlihat oleh siswa.",
    },
  ];

  return (
    <form onSubmit={simpan} className="rounded-2xl border border-rule bg-paper-card p-6">
      <p className="t-label mb-1 text-ink-muted">Koreksi AI</p>
      <p className="mb-4 text-xs leading-relaxed text-ink-muted">
        Tombol “Koreksi dengan AI” di tiap siswa mengisi nilai otomatis. Anda tetap meninjau dan menyimpannya sendiri.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">AI membaca soal dari</legend>
        <div className="space-y-2">
          {PILIHAN.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                source === p.id ? "border-blue-300 bg-blue-50/50" : "border-rule hover:border-rule-strong",
              )}
            >
              <input
                type="radio"
                name={`sumber-ai-${postId}`}
                checked={source === p.id}
                onChange={() => setSource(p.id)}
                disabled={sibuk}
                className="mt-1 accent-blue-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{p.label}</span>
                <span className="block text-xs text-ink-muted">{p.ket}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {source === "separate" && (
        <div className="mt-4">
          {lama.length > 0 && (
            <ul className="mb-3 space-y-2">
              {lama.map((f) => (
                <li key={f.path} className="flex min-w-0 items-center gap-3 rounded-xl border border-rule bg-paper px-3 py-2">
                  <span className="w-11 shrink-0 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    {ekstensiOf(f.name).replace(".", "")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
                  <button
                    type="button"
                    disabled={sibuk}
                    onClick={() => setLama((x) => x.filter((y) => y.path !== f.path))}
                    className="shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-rust-700 disabled:opacity-50"
                  >
                    Buang
                  </button>
                </li>
              ))}
            </ul>
          )}
          <PemilihBerkas
            files={baru}
            onChange={setBaru}
            formats={FORMAT_AI_KONTEKS}
            maks={Math.max(0, sisaSlot)}
            disabled={sibuk || sisaSlot <= 0}
            label="Tambah berkas konteks"
          />
          <p className="mt-2 text-xs text-ink-muted">PDF, gambar, atau dokumen Office. ZIP tidak bisa dibaca AI.</p>
        </div>
      )}

      <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-body">
        <input
          type="checkbox"
          checked={isiKomentar}
          onChange={(e) => setIsiKomentar(e.target.checked)}
          disabled={sibuk}
          className="mt-1 accent-blue-600"
        />
        <span>
          AI juga mengisi komentar untuk siswa
          <span className="block text-xs text-ink-muted">Bawaan; masih bisa diubah per siswa.</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={sibuk}
        className="mt-5 w-full rounded-lg border border-rule px-5 py-2.5 text-sm font-semibold text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
      >
        {mengunggah ? "Mengunggah…" : pending ? "Menyimpan…" : "Simpan pengaturan AI"}
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        Jawaban siswa dan konteks soal dikirim ke layanan AI pihak ketiga (OpenRouter, model gratis) saat dikoreksi.
      </p>

      {pesan && (
        <p role="status" className={cn("mt-3 text-sm", pesan.ok ? "text-blue-700" : "text-rust-700")}>
          {pesan.teks}
        </p>
      )}
    </form>
  );
}
