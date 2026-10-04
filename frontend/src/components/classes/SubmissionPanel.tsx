"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Tag from "@/components/ui/Tag";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Lampiran, { hrefJawaban } from "@/components/classes/Lampiran";
import PemilihBerkas from "@/components/classes/PemilihBerkas";
import { submitClassAssignment, unsubmitClassAssignment } from "@/lib/classAssignmentActions";
import { firebaseAuth } from "@/lib/firebase/client";
import { unggahJawabanKelas } from "@/lib/classUpload";
import {
  INFO_FORMAT,
  LABEL_STATUS,
  MAX_ANSWER_TEXT,
  MAX_FILES_PER_SUBMISSION,
  terimaBerkas,
  type FormatTugas,
  type KelasSubmission,
  type StatusTugas,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

/**
 * Panel "Tugas Anda" di halaman tugas siswa.
 *
 * `dibuka`, `lewat`, dan `status` dihitung server saat halaman dirender.
 * Halaman yang dibiarkan terbuka melewati tenggat masih menampilkan tombol
 * kirim — tidak apa-apa, karena action memeriksa tenggat dengan jam server
 * dan menjawab dengan pesan yang jelas.
 *
 * Waktu kirim datang sebagai teks jadi (`waktuKirim`) dari server: Intl di
 * Node dan di browser tidak selalu menulis tanggal yang persis sama, dan
 * selisih satu tanda baca sudah cukup untuk hydration mismatch.
 */
export default function SubmissionPanel({
  classId,
  postId,
  formats,
  maxPoints,
  dibuka,
  lewat,
  status,
  submission,
  waktuKirim,
}: {
  classId: string;
  postId: string;
  formats: readonly FormatTugas[];
  maxPoints: number;
  dibuka: boolean;
  lewat: boolean;
  status: StatusTugas;
  submission: KelasSubmission | null;
  waktuKirim: string | null;
}) {
  const router = useRouter();
  const [teks, setTeks] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);

  const bolehTeks = formats.includes("text");
  const bolehBerkas = terimaBerkas(formats);
  const sibuk = mengunggah || pending;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!teks.trim() && berkas.length === 0) {
      return setError(bolehTeks ? "Tulis jawaban atau lampirkan berkas." : "Lampirkan minimal satu berkas.");
    }

    let files: { path: string; name: string }[] = [];
    if (berkas.length > 0) {
      const uid = firebaseAuth().currentUser?.uid;
      if (!uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");

      setMengunggah(true);
      try {
        files = await unggahJawabanKelas(uid, classId, postId, berkas);
      } catch {
        setMengunggah(false);
        return setError("Unggahan gagal. Periksa koneksi lalu coba lagi.");
      }
      setMengunggah(false);
    }

    startTransition(async () => {
      const res = await submitClassAssignment(classId, postId, { text: teks, files });
      if (!res.ok) return setError(res.error);
      setTeks("");
      setBerkas([]);
      router.refresh();
    });
  }

  function batalkan() {
    setKonfirmasi(false);
    setError(null);
    startTransition(async () => {
      const res = await unsubmitClassAssignment(classId, postId);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  const label = LABEL_STATUS[status];

  return (
    <div className="rounded-2xl border border-rule bg-paper-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[17px] font-medium text-ink">Tugas Anda</p>
        <Tag tone={label.tone}>{label.label}</Tag>
      </div>

      {submission ? (
        <>
          {submission.status === "graded" && submission.grade !== null && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
              <p className="t-label text-blue-700">Nilai</p>
              <p className="mt-1 text-[28px] font-medium leading-none tabular-nums text-ink">
                {submission.grade}
                <span className="text-base text-ink-muted">/{maxPoints}</span>
              </p>
              {submission.feedback && (
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-[1.7] text-ink-body">
                  {submission.feedback}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted">
            Dikirim {waktuKirim}
            {submission.late && <span className="font-semibold text-amber-700"> · terlambat</span>}
          </p>

          {submission.text && (
            <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line break-words rounded-xl border border-rule bg-paper px-4 py-3 text-sm leading-[1.7] text-ink-body">
              {submission.text}
            </p>
          )}

          <Lampiran
            files={submission.files}
            hrefs={submission.files.map((_, i) => hrefJawaban(submission.id, i))}
            className="mt-3 sm:grid-cols-1"
          />

          {submission.status !== "graded" &&
            (dibuka ? (
              <button
                type="button"
                onClick={() => setKonfirmasi(true)}
                disabled={sibuk}
                className="mt-5 w-full rounded-lg border border-rule px-5 py-2.5 text-sm font-semibold text-ink-body transition-colors duration-200 hover:border-rust-700 hover:text-rust-700 disabled:opacity-60"
              >
                {pending ? "Membatalkan…" : "Batalkan pengiriman"}
              </button>
            ) : (
              <p className="mt-5 text-xs text-ink-muted">Tenggat sudah lewat — pengiriman terkunci.</p>
            ))}
        </>
      ) : dibuka ? (
        <form onSubmit={kirim}>
          <p className="mb-3 text-xs text-ink-muted">
            Diterima: {formats.map((f) => INFO_FORMAT[f].label).join(", ")}.
          </p>

          {bolehTeks && (
            <>
              <label htmlFor="jawaban" className="sr-only">
                Jawaban
              </label>
              <textarea
                id="jawaban"
                value={teks}
                onChange={(e) => setTeks(e.target.value)}
                maxLength={MAX_ANSWER_TEXT}
                rows={6}
                disabled={sibuk}
                placeholder="Tulis jawaban Anda di sini."
                className={cn(
                  "w-full resize-y rounded-xl border border-rule bg-paper px-4 py-3 text-sm leading-[1.7] text-ink",
                  "transition-colors duration-200 placeholder:text-ink-faint",
                  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
                )}
              />
            </>
          )}

          {bolehBerkas && (
            <div className={bolehTeks ? "mt-3" : ""}>
              <PemilihBerkas
                files={berkas}
                onChange={setBerkas}
                formats={formats}
                maks={MAX_FILES_PER_SUBMISSION}
                disabled={sibuk}
                label="Tambah berkas"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={sibuk}
            className={cn(
              "mt-5 w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white",
              "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
              "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
            )}
          >
            {mengunggah ? "Mengunggah…" : pending ? "Mengirim…" : lewat ? "Kirim (terlambat)" : "Kirim tugas"}
          </button>

          <p className="mt-2 text-xs text-ink-muted">
            Selama belum dinilai, pengiriman bisa dibatalkan lalu dikirim ulang.
          </p>
        </form>
      ) : (
        <p className="text-sm leading-[1.7] text-ink-muted">
          Tenggat sudah lewat dan tugas ini tidak menerima pengumpulan terlambat.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={konfirmasi}
        title="Batalkan pengiriman?"
        description="Jawaban dan berkas yang sudah Anda kirim akan dihapus. Anda bisa mengirim ulang selama pengumpulan masih dibuka."
        confirmLabel="Batalkan pengiriman"
        cancelLabel="Kembali"
        onConfirm={batalkan}
        onCancel={() => setKonfirmasi(false)}
      />
    </div>
  );
}
