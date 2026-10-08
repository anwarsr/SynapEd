"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PemilihBerkas from "@/components/classes/PemilihBerkas";
import IsianTugas, { KOLOM_KELAS, type NilaiIsianTugas } from "@/components/classes/IsianTugas";
import { editPost } from "@/lib/classActions";
import { firebaseAuth } from "@/lib/firebase/client";
import { pesanGagalUnggah, unggahLampiranKelas } from "@/lib/classUpload";
import { MAX_POST_BODY, type KelasPost } from "@/lib/classTypes";
import {
  MAX_ASSIGNMENT_TITLE,
  MAX_FILES_PER_POST,
  ekstensiOf,
  inputWibKeIso,
  isoKeInputWib,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

type DataPost = Pick<KelasPost, "id" | "kind" | "title" | "body" | "attachments" | "assignment">;

function isianDari(post: DataPost): NilaiIsianTugas {
  const p = post.assignment;
  return {
    formats: p?.formats ?? ["text"],
    pakaiTenggat: Boolean(p?.dueAt),
    // isoKeInputWib memakai zona tetap WIB, jadi nilai awal identik di server dan browser.
    tenggat: isoKeInputWib(p?.dueAt ?? null),
    terimaTerlambat: p?.acceptLate ?? false,
    poin: String(p?.maxPoints ?? 100),
  };
}

/**
 * Tombol "Edit" + formulir edit untuk postingan yang sudah terbit.
 *
 * Satu komponen untuk pengumuman (di umpan) dan tugas (di halaman tugas).
 * Formulir mengirim bentuk UTUH ke `editPost`; lampiran lama yang tidak
 * dibuang dikirim sebagai daftar path untuk dipertahankan, lampiran baru
 * diunggah saat disimpan (sama seperti kotak tulis).
 *
 * Hanya dirender untuk pengelola kelas — penjaganya tetap di server.
 */
export default function EditPost({
  classId,
  post,
  className,
}: {
  classId: string;
  post: DataPost;
  className?: string;
}) {
  const router = useRouter();
  const tugas = post.kind === "assignment";

  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [lama, setLama] = useState(post.attachments);
  const [baru, setBaru] = useState<File[]>([]);
  const [isian, setIsian] = useState<NilaiIsianTugas>(() => isianDari(post));

  const [mengunggah, setMengunggah] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sibuk = mengunggah || pending;

  /**
   * Mengisi ulang formulir dari data TERBARU setiap kali dibuka. Tanpa ini,
   * state dari pembukaan sebelumnya bertahan setelah router.refresh(): daftar
   * lampiran lamanya tidak memuat unggahan yang baru tersimpan, dan simpanan
   * berikutnya diam-diam membuang unggahan itu.
   */
  function muatUlang() {
    setJudul(post.title);
    setBody(post.body);
    setLama(post.attachments);
    setBaru([]);
    setIsian(isianDari(post));
    setError(null);
  }

  function batal() {
    muatUlang();
    setBuka(false);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let dueAt: string | null = null;
    if (tugas && isian.pakaiTenggat) {
      dueAt = inputWibKeIso(isian.tenggat);
      if (!dueAt) return setError("Isi tanggal dan jam tenggat.");
    }

    let unggahan: { path: string; name: string }[] = [];
    if (baru.length > 0) {
      const uid = firebaseAuth().currentUser?.uid;
      if (!uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");
      setMengunggah(true);
      try {
        unggahan = await unggahLampiranKelas(uid, classId, baru);
      } catch (err) {
        setMengunggah(false);
        return setError(pesanGagalUnggah(err));
      }
      setMengunggah(false);
    }

    startTransition(async () => {
      const res = await editPost(classId, post.id, {
        title: judul,
        body,
        keepAttachments: lama.map((a) => a.path),
        attachments: unggahan,
        formats: isian.formats,
        dueAt,
        acceptLate: isian.terimaTerlambat,
        maxPoints: Number(isian.poin),
      });
      if (!res.ok) return setError(res.error);
      setBaru([]);
      setBuka(false);
      router.refresh();
    });
  }

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => {
          muatUlang();
          setBuka(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors duration-200 hover:text-blue-700",
          className,
        )}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
        {tugas ? "Edit tugas" : "Edit"}
      </button>
    );
  }

  const sisaSlot = MAX_FILES_PER_POST - lama.length;
  const id = `edit-${post.id}`;

  return (
    <form onSubmit={simpan} className="mt-4 w-full rounded-2xl border border-blue-200 bg-paper-card p-5 shadow-soft">
      <p className="t-label mb-4 text-blue-700">{tugas ? "Edit tugas" : "Edit pengumuman"}</p>

      {tugas && (
        <div className="mb-3">
          <label htmlFor={`${id}-judul`} className="mb-1 block text-sm font-medium text-ink">
            Judul
          </label>
          <input
            id={`${id}-judul`}
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            maxLength={MAX_ASSIGNMENT_TITLE}
            disabled={sibuk}
            className={cn(KOLOM_KELAS, "font-medium")}
          />
        </div>
      )}

      <label htmlFor={`${id}-isi`} className="mb-1 block text-sm font-medium text-ink">
        {tugas ? "Instruksi" : "Isi"}
      </label>
      <textarea
        id={`${id}-isi`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_POST_BODY}
        rows={4}
        disabled={sibuk}
        className={cn(KOLOM_KELAS, "resize-y py-3 leading-[1.7]")}
      />

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-ink">Lampiran</p>
        {lama.length > 0 && (
          <ul className="mb-3 space-y-2">
            {lama.map((a) => (
              <li key={a.path} className="flex min-w-0 items-center gap-3 rounded-xl border border-rule bg-paper px-3 py-2">
                <span className="w-11 shrink-0 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                  {ekstensiOf(a.name).replace(".", "")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.name}</span>
                <button
                  type="button"
                  disabled={sibuk}
                  onClick={() => setLama((x) => x.filter((y) => y.path !== a.path))}
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
          formats={null}
          maks={Math.max(0, sisaSlot)}
          disabled={sibuk || sisaSlot <= 0}
          label="Tambah lampiran"
        />
      </div>

      {tugas && (
        <div className="mt-5">
          <IsianTugas
            nilai={isian}
            ubah={(patch) => setIsian((x) => ({ ...x, ...patch }))}
            disabled={sibuk}
            idAwalan={id}
            catatanEdit
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={batal}
          disabled={sibuk}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={sibuk || (tugas && (judul.trim().length < 3 || isian.formats.length === 0))}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mengunggah ? "Mengunggah…" : pending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </form>
  );
}
