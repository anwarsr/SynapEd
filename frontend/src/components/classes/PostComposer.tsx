"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import PemilihBerkas from "@/components/classes/PemilihBerkas";
import { createAssignment, createPost } from "@/lib/classActions";
import { firebaseAuth } from "@/lib/firebase/client";
import { unggahLampiranKelas } from "@/lib/classUpload";
import { MAX_POST_BODY } from "@/lib/classTypes";
import {
  DEFAULT_MAX_POINTS,
  FORMAT_TUGAS,
  INFO_FORMAT,
  MAX_ASSIGNMENT_TITLE,
  MAX_FILES_PER_POST,
  MAX_POINTS_LIMIT,
  inputWibKeIso,
  type FormatTugas,
  type JenisPost,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

const KOLOM = cn(
  "w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-[15px] text-ink",
  "transition-colors duration-200 placeholder:text-ink-faint",
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
);

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
  const [formats, setFormats] = useState<FormatTugas[]>(["text", "pdfImage"]);
  const [pakaiTenggat, setPakaiTenggat] = useState(false);
  const [tenggat, setTenggat] = useState("");
  const [terimaTerlambat, setTerimaTerlambat] = useState(false);
  const [poin, setPoin] = useState(String(DEFAULT_MAX_POINTS));

  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tugas = jenis === "assignment";
  const sibuk = mengunggah || pending;

  function reset() {
    setJudul("");
    setBody("");
    setBerkas([]);
    setPakaiTenggat(false);
    setTenggat("");
    setTerimaTerlambat(false);
    setPoin(String(DEFAULT_MAX_POINTS));
  }

  function ubahFormat(f: FormatTugas, aktif: boolean) {
    setFormats((lama) => (aktif ? FORMAT_TUGAS.filter((x) => x === f || lama.includes(x)) : lama.filter((x) => x !== f)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Pemeriksaan cepat di browser hanya demi pesan yang segera; server
    // memeriksa ulang semuanya.
    let dueAt: string | null = null;
    if (tugas && pakaiTenggat) {
      dueAt = inputWibKeIso(tenggat);
      if (!dueAt) return setError("Isi tanggal dan jam tenggat.");
    }

    const uid = firebaseAuth().currentUser?.uid;
    if (berkas.length > 0 && !uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");

    let lampiran: { path: string; name: string }[] = [];
    if (berkas.length > 0 && uid) {
      setMengunggah(true);
      try {
        lampiran = await unggahLampiranKelas(uid, classId, berkas);
      } catch {
        setMengunggah(false);
        return setError("Unggahan lampiran gagal. Coba lagi.");
      }
      setMengunggah(false);
    }

    startTransition(async () => {
      const res = tugas
        ? await createAssignment(classId, {
            title: judul,
            body,
            attachments: lampiran,
            formats,
            dueAt,
            acceptLate: terimaTerlambat,
            maxPoints: Number(poin),
          })
        : await createPost(classId, body, lampiran);

      if (!res.ok) return setError(res.error);
      reset();
      router.refresh();
    });
  }

  const sisa = MAX_POST_BODY - body.length;
  const bisaKirim = tugas ? judul.trim().length >= 3 && formats.length > 0 : body.trim().length > 0 || berkas.length > 0;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-rule bg-paper-card p-6">
      <div className="flex items-start gap-3">
        <span className="shrink-0 max-sm:hidden">
          <UserAvatar name={meName} photoURL={mePhoto} />
        </span>

        <div className="min-w-0 flex-1">
          <div role="radiogroup" aria-label="Jenis postingan" className="mb-4 inline-flex rounded-full border border-rule bg-paper p-1">
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
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
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
            <div className="mt-5 grid gap-5 rounded-xl border border-rule bg-paper p-4 sm:grid-cols-2">
              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="t-label mb-2 text-ink-muted">Format yang boleh dikumpulkan</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FORMAT_TUGAS.map((f) => (
                    <label
                      key={f}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                        formats.includes(f) ? "border-blue-300 bg-blue-50/50" : "border-rule hover:border-rule-strong",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formats.includes(f)}
                        onChange={(e) => ubahFormat(f, e.target.checked)}
                        disabled={sibuk}
                        className="mt-1 accent-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{INFO_FORMAT[f].label}</span>
                        <span className="block text-xs text-ink-muted">{INFO_FORMAT[f].ket}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {formats.length === 0 && (
                  <p className="mt-2 text-xs text-rust-700">Pilih minimal satu format.</p>
                )}
              </fieldset>

              <div className="min-w-0">
                <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={pakaiTenggat}
                    onChange={(e) => setPakaiTenggat(e.target.checked)}
                    disabled={sibuk}
                    className="accent-blue-600"
                  />
                  Pakai tenggat
                </label>
                {pakaiTenggat ? (
                  <>
                    <label htmlFor="tenggat" className="sr-only">
                      Tenggat (WIB)
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        id="tenggat"
                        type="datetime-local"
                        value={tenggat}
                        onChange={(e) => setTenggat(e.target.value)}
                        disabled={sibuk}
                        className={cn(KOLOM, "text-sm")}
                      />
                      <span className="shrink-0 text-xs font-semibold text-ink-muted">WIB</span>
                    </div>
                    <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-body">
                      <input
                        type="checkbox"
                        checked={terimaTerlambat}
                        onChange={(e) => setTerimaTerlambat(e.target.checked)}
                        disabled={sibuk}
                        className="mt-1 accent-blue-600"
                      />
                      <span>
                        Terima pengumpulan setelah tenggat
                        <span className="block text-xs text-ink-muted">Ditandai &ldquo;Terlambat&rdquo;.</span>
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted">Tanpa tenggat: pengumpulan selalu dibuka.</p>
                )}
              </div>

              <div className="min-w-0">
                <label htmlFor="poin" className="block text-sm font-medium text-ink">
                  Nilai maksimal
                </label>
                <input
                  id="poin"
                  type="number"
                  min={1}
                  max={MAX_POINTS_LIMIT}
                  inputMode="numeric"
                  value={poin}
                  onChange={(e) => setPoin(e.target.value)}
                  disabled={sibuk}
                  className={cn(KOLOM, "mt-2 w-28 text-sm")}
                />
              </div>
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
                "rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
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
