"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import PemilihBerkas from "@/components/classes/PemilihBerkas";
import IsianTugas, { KOLOM_KELAS as KOLOM, type NilaiIsianTugas } from "@/components/classes/IsianTugas";
import { createAssignment, createPost } from "@/lib/classActions";
import { firebaseAuth } from "@/lib/firebase/client";
import { pesanGagalUnggah, unggahLampiranKelas } from "@/lib/classUpload";
import { MAX_POST_BODY } from "@/lib/classTypes";
import {
  DEFAULT_MAX_POINTS,
  MAX_ASSIGNMENT_TITLE,
  MAX_FILES_PER_POST,
  inputWibKeIso,
  type JenisPost,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

const ISIAN_AWAL: NilaiIsianTugas = {
  formats: ["text", "pdf", "jpg", "png"],
  pakaiTenggat: false,
  tenggat: "",
  terimaTerlambat: false,
  poin: String(DEFAULT_MAX_POINTS),
};

/**
 * Kotak tulis kelas: pengumuman ATAU tugas. Hanya dirender untuk pemilik kelas.
 *
 * Dua jenis dalam satu kotak (bukan dua formulir) karena keduanya berbagi
 * isi teks dan lampiran — pengajar cukup menekan "Tugas" untuk memunculkan
 * pengaturan tambahannya, seperti di Google Classroom.
 */
export default function PostComposer({
  classId,
  meName,
  mePhoto,
}: {
  classId: string;
  meName: string;
  mePhoto: string | null;
}) {
  const router = useRouter();
  const [jenis, setJenis] = useState<JenisPost>("announcement");
  const [judul, setJudul] = useState("");
  const [body, setBody] = useState("");
  const [berkas, setBerkas] = useState<File[]>([]);
  const [isian, setIsian] = useState<NilaiIsianTugas>(ISIAN_AWAL);

  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tugas = jenis === "assignment";
  const sibuk = mengunggah || pending;

  function reset() {
    setJudul("");
    setBody("");
    setBerkas([]);
    // Format dipertahankan: pengajar biasanya memakai format yang sama untuk tugas berikutnya.
    setIsian((x) => ({ ...ISIAN_AWAL, formats: x.formats }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Pemeriksaan cepat di browser hanya demi pesan yang segera; server
    // memeriksa ulang semuanya.
    let dueAt: string | null = null;
    if (tugas && isian.pakaiTenggat) {
      dueAt = inputWibKeIso(isian.tenggat);
      if (!dueAt) return setError("Isi tanggal dan jam tenggat.");
    }

    const uid = firebaseAuth().currentUser?.uid;
    if (berkas.length > 0 && !uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");

    let lampiran: { path: string; name: string }[] = [];
    if (berkas.length > 0 && uid) {
      setMengunggah(true);
      try {
        lampiran = await unggahLampiranKelas(uid, classId, berkas);
      } catch (e) {
        setMengunggah(false);
        return setError(pesanGagalUnggah(e));
      }
      setMengunggah(false);
    }

    startTransition(async () => {
      const res = tugas
        ? await createAssignment(classId, {
            title: judul,
            body,
            attachments: lampiran,
            formats: isian.formats,
            dueAt,
            acceptLate: isian.terimaTerlambat,
            maxPoints: Number(isian.poin),
          })
        : await createPost(classId, body, lampiran);

      if (!res.ok) return setError(res.error);
      reset();
      router.refresh();
    });
  }

  const sisa = MAX_POST_BODY - body.length;
  const bisaKirim = tugas ? judul.trim().length >= 3 && isian.formats.length > 0 : body.trim().length > 0 || berkas.length > 0;

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-6">
      <div className="flex items-start gap-3">
        <span className="shrink-0 max-sm:hidden">
          <UserAvatar name={meName} photoURL={mePhoto} />
        </span>

        <div className="min-w-0 flex-1">
          <div role="radiogroup" aria-label="Jenis postingan" className="mb-4 inline-flex bg-white/[0.06] p-1">
            {(
              [
                { id: "announcement", label: "Pengumuman" },
                { id: "assignment", label: "Tugas" },
              ] as const
            ).map((j) => (
              <button
                key={j.id}
                type="button"
                role="radio"
                aria-checked={jenis === j.id}
                disabled={sibuk}
                onClick={() => setJenis(j.id)}
                className={cn(
                  "px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
                  jenis === j.id ? "bg-blue-600 text-white" : "text-ink-body hover:text-blue-700",
                )}
              >
                {j.label}
              </button>
            ))}
          </div>

          {tugas && (
            <div className="mb-3">
              <label htmlFor="judultugas" className="sr-only">
                Judul tugas
              </label>
              <input
                id="judultugas"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                maxLength={MAX_ASSIGNMENT_TITLE}
                placeholder="Judul tugas"
                className={cn(KOLOM, "font-medium")}
              />
            </div>
          )}

          <label htmlFor="postbody" className="sr-only">
            {tugas ? "Instruksi tugas" : "Tulis untuk kelas ini"}
          </label>
          <textarea
            id="postbody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_POST_BODY}
            rows={3}
            placeholder={
              tugas
                ? "Instruksi tugas (opsional): apa yang dikerjakan, kriteria penilaian."
                : "Pengumuman, materi singkat, atau pengantar diskusi."
            }
            className={cn(KOLOM, "resize-y py-3 leading-[1.7]")}
          />

          <div className="mt-3">
            <PemilihBerkas
              files={berkas}
              onChange={setBerkas}
              formats={null}
              maks={MAX_FILES_PER_POST}
              disabled={sibuk}
            />
          </div>

          {tugas && (
            <div className="mt-5">
              <IsianTugas
                nilai={isian}
                ubah={(patch) => setIsian((x) => ({ ...x, ...patch }))}
                disabled={sibuk}
                idAwalan="buat"
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {sisa < 500 ? `${sisa} karakter tersisa` : "Terlihat oleh seluruh anggota kelas"}
            </span>

            <button
              type="submit"
              disabled={sibuk || !bisaKirim}
              className={cn(
                "bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
                "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
              )}
            >
              {mengunggah ? "Mengunggah…" : pending ? "Mengirim…" : tugas ? "Terbitkan tugas" : "Kirim ke kelas"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rust-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
