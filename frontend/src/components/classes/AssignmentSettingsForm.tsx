"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAssignment } from "@/lib/classAssignmentActions";
import { inputWibKeIso, isoKeInputWib } from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

/**
 * Mengubah tenggat & izin terlambat sebuah tugas yang sudah terbit.
 *
 * Tenggat boleh dimundurkan ke masa lalu — itulah cara menutup pengumpulan
 * lebih awal. Status "terlambat" pada pengiriman yang sudah ada TIDAK ikut
 * berubah: ia dibekukan saat dikirim.
 */
export default function AssignmentSettingsForm({
  classId,
  postId,
  dueAt,
  acceptLate,
}: {
  classId: string;
  postId: string;
  dueAt: string | null;
  acceptLate: boolean;
}) {
  const router = useRouter();
  const [pakai, setPakai] = useState(dueAt !== null);
  // isoKeInputWib memakai zona tetap WIB, jadi nilai awal ini identik di
  // server dan browser.
  const [tenggat, setTenggat] = useState(isoKeInputWib(dueAt));
  const [terlambat, setTerlambat] = useState(acceptLate);
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);

    const iso = pakai ? inputWibKeIso(tenggat) : null;
    if (pakai && !iso) return setPesan({ ok: false, teks: "Isi tanggal dan jam tenggat." });

    startTransition(async () => {
      const res = await updateAssignment(classId, postId, { dueAt: iso, acceptLate: terlambat });
      setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={simpan} className="rounded-2xl border border-rule bg-paper-card p-6">
      <p className="t-label mb-4 text-ink-muted">Pengaturan tenggat</p>

      <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={pakai}
          onChange={(e) => setPakai(e.target.checked)}
          className="accent-blue-600"
        />
        Pakai tenggat
      </label>

      {pakai && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="ubah-tenggat" className="sr-only">
              Tenggat (WIB)
            </label>
            <input
              id="ubah-tenggat"
              type="datetime-local"
              value={tenggat}
              onChange={(e) => setTenggat(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink",
                "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
              )}
            />
            <span className="shrink-0 text-xs font-semibold text-ink-muted">WIB</span>
          </div>

          <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-body">
            <input
              type="checkbox"
              checked={terlambat}
              onChange={(e) => setTerlambat(e.target.checked)}
              className="mt-1 accent-blue-600"
            />
            Terima pengumpulan setelah tenggat
          </label>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-lg border border-rule px-5 py-2.5 text-sm font-semibold text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan pengaturan"}
      </button>

      {pesan && (
        <p role="status" className={cn("mt-3 text-sm", pesan.ok ? "text-blue-700" : "text-rust-700")}>
          {pesan.teks}
        </p>
      )}
    </form>
  );
}
