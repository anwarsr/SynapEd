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
  MAX_AI_NOTES,
  ekstensiOf,
  type PengaturanAi,
  type SumberKonteksAi,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

/**
 * Kartu "Koreksi AI" di halaman tugas pengajar: apakah AI ikut membaca
 * instruksi tugas, KONTEKS dari pengajar (teks bebas + berkas), dan apakah AI
 * juga mengisi komentar secara bawaan.
 *
 * Konteks sengaja SATU kotak teks bebas, bukan kolom per jenis (permintaan
 * pemilik): kunci jawaban, rubrik, rentang nilai, panjang komentar, … ditulis
 * sesukanya dan AI yang memahami maksudnya (lihat classGradingPrompt.ts).
 *
 * Konteks biasanya kunci jawaban — karena itu tidak pernah menjadi lampiran
 * postingan, dan kartu ini hanya dirender di halaman pengelola. Hanya NAMA
 * berkasnya yang sampai ke sini, tanpa tautan unduh.
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
  const [catatan, setCatatan] = useState(awal.notes);
  const [isiKomentar, setIsiKomentar] = useState(awal.fillComment);
  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  const sibuk = mengunggah || pending;
  const sisaSlot = MAX_AI_CONTEXT_FILES - lama.length;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);

    if (source === "separate" && lama.length + baru.length === 0 && !catatan.trim()) {
      return setPesan({ ok: false, teks: "Isi konteks untuk AI (teks atau berkas), atau pilih “Instruksi & lampiran tugas”." });
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
        notes: catatan,
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
        ? "AI membaca instruksi dan lampiran tugas ini, ditambah konteks Anda di bawah."
        : "AI membaca instruksi tugas ini (tidak berlampiran), ditambah konteks Anda di bawah.",
    },
    {
      id: "separate",
      label: "Hanya konteks dari saya",
      ket: "Instruksi tugas diabaikan; AI hanya membaca konteks di bawah. Cocok bila soal lengkap ada di sana.",
    },
  ];

  return (
    <form onSubmit={simpan} className="bg-paper-card p-6">
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
                "flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors",
                source === p.id ? "bg-blue-50/50" : "",
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

      <div className="mt-5">
        <label htmlFor={`konteks-ai-${postId}`} className="block text-sm font-medium text-ink">
          Konteks untuk AI
        </label>
        <p className="mb-2 mt-0.5 text-xs leading-relaxed text-ink-muted">
          Tulis bebas apa saja yang perlu diketahui AI: soal, kunci jawaban, rubrik & bobot nilai, rentang nilai, panjang atau
          gaya komentar. Tidak perlu format khusus, AI memahaminya sendiri. Tidak terlihat oleh siswa.
        </p>
        <textarea
          id={`konteks-ai-${postId}`}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          disabled={sibuk}
          maxLength={MAX_AI_NOTES}
          rows={6}
          placeholder={"Contoh:\nKunci: 1) B  2) 45 cm²  3) gaya gesek\nRubrik: konsep 60%, langkah 30%, kerapian 10%.\nYang sudah mencoba minimal dapat 50.\nKomentar singkat, maks 3 kalimat, nada menyemangati."}
          className="w-full resize-y bg-white/[0.06] px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60"
        />
        <p className="mt-1 text-right text-[11px] tabular-nums text-ink-faint">
          {catatan.length.toLocaleString("id-ID")} / {MAX_AI_NOTES.toLocaleString("id-ID")}
        </p>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-sm font-medium text-ink">
          Berkas konteks <span className="font-normal text-ink-muted">(opsional)</span>
        </p>
        {lama.length > 0 && (
          <ul className="mb-3 space-y-2">
            {lama.map((f) => (
              <li key={f.path} className="flex min-w-0 items-center gap-3 bg-white/[0.06] px-3 py-2">
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
        className="mt-5 w-full px-5 py-2.5 text-sm font-semibold text-ink-body transition-colors duration-200 hover:text-blue-700 disabled:opacity-60"
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
