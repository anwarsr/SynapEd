"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { uploadSubmission, validateSubmission } from "@/lib/courseUpload";
import { submitAssignment } from "@/lib/submissionActions";
import { formatBytes } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

export interface SubmissionView {
  id: string;
  fileName: string;
  fileSize: number;
  status: "submitted" | "graded";
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
}

/**
 * Pengumpulan tugas peserta pada pelajaran penugasan & kuis.
 *
 * Menggantikan tombol "Tandai Selesai" pada kedua tipe itu: mengunggah berkas
 * SEKALIGUS menandai pelajarannya selesai — satu tindakan, bukan dua yang
 * salah satunya mudah terlupa.
 *
 * Sertifikatnya tetap tertahan sampai educator menilai, dan panel ini
 * mengatakannya terang-terangan supaya peserta tidak menunggu tanpa tahu
 * sedang menunggu apa.
 */
export default function AssignmentPanel({
  courseSlug,
  lessonSlug,
  passingGrade,
  submission,
}: {
  courseSlug: string;
  lessonSlug: string;
  passingGrade: number;
  submission: SubmissionView | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pilih(file: File | null) {
    if (!file) return;
    setError(null);

    const salah = validateSubmission(file);
    if (salah) return setError(salah);

    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");

    setUploading(true);
    try {
      const path = await uploadSubmission(uid, courseSlug, lessonSlug, file);

      startTransition(async () => {
        const res = await submitAssignment(courseSlug, lessonSlug, path, file.name, file.size);
        if (!res.ok) return setError(res.error);
        router.refresh();
      });
    } catch {
      setError("Unggahan gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  const lulus = submission?.grade !== null && submission?.grade !== undefined && submission.grade >= passingGrade;
  const sibuk = uploading || pending;

  return (
    <div className="  bg-white/5 p-5">
      <p className="text-sm font-semibold text-ink mb-1">Pengumpulan Tugas</p>
      <p className="text-xs text-ink-muted mb-4">
        Berkas jenis apa pun, maksimal 50 MB. Nilai minimum kelulusan {passingGrade}.
      </p>

      {submission && (
        <div className="mb-4   bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ink-body break-all">{submission.fileName}</span>
            <span className="text-xs text-ink-muted shrink-0">
              {formatBytes(submission.fileSize) ?? ""}
            </span>
          </div>

          {submission.status === "submitted" ? (
            <p className="mt-3 text-sm text-amber-700">
              Terkumpul. Menunggu dinilai educator - sertifikat terbit setelah dinilai.
            </p>
          ) : (
            <div className="mt-3">
              <p className={cn("text-sm font-semibold", lulus ? "text-blue-700" : "text-error-text")}>
                Nilai {submission.grade} {lulus ? "· Lulus" : `· Belum mencapai ${passingGrade}`}
              </p>
              {submission.feedback && (
                <p className="mt-2 text-sm text-ink-body whitespace-pre-line break-words">
                  {submission.feedback}
                </p>
              )}
              {!lulus && (
                <p className="mt-2 text-xs text-ink-muted">
                  Perbaiki tugas Anda lalu kumpulkan ulang.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          void pilih(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={sibuk}
        className={cn(
          "px-6 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out-soft",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          submission
            ? "  text-ink-body  hover:text-blue-700"
            : "bg-blue-600 text-white hover:bg-blue-700",
        )}
      >
        {uploading ? "Mengunggah…" : pending ? "Menyimpan…" : submission ? "Kumpulkan Ulang" : "Kumpulkan Tugas"}
      </button>

      {submission && (
        <a
          href={`/api/submissions/file?id=${encodeURIComponent(submission.id)}`}
          className="ml-3 text-sm text-blue-700 hover:underline underline-offset-4"
        >
          Unduh berkas saya
        </a>
      )}

      {error && <p className="mt-3 text-sm text-error-text">{error}</p>}
    </div>
  );
}
