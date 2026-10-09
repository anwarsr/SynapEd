"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { clearDecidedApplications, deleteApplication } from "@/lib/educatorActions";

/**
 * Tombol hapus di halaman notifikasi admin.
 *
 * Dua komponen terpisah, bukan satu: baris daftar adalah <Link> yang menutupi
 * seluruh barisnya, dan menaruh <button> di dalam <a> menghasilkan elemen
 * interaktif bersarang — tidak sah, dan pembaca layar tidak bisa
 * membedakannya. Karena itu tombolnya jadi saudara sebelah Link, bukan anaknya.
 */

/** Menghapus satu catatan. Hanya dirender untuk yang sudah diputuskan. */
export function DeleteNotificationButton({ uid, name }: { uid: string; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await deleteApplication(uid);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        aria-label={`Hapus pengajuan ${name}`}
        className="shrink-0 rounded-lg p-2 text-ink-faint transition-colors duration-200 hover:bg-rust-100 hover:text-rust-700 disabled:opacity-40"
      >
        {pending ? (
          <span className="text-xs">…</span>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
          </svg>
        )}
      </button>

      <ConfirmDialog
        open={asking}
        title="Hapus catatan pengajuan ini?"
        description={`Catatan pengajuan ${name} akan hilang dari daftar ini.`}
        note="Role pengguna tidak berubah - yang dihapus hanya catatannya."
        confirmLabel="Ya, Hapus"
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />

      {error && (
        <p role="status" className="w-full text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}

/** Membersihkan semua catatan yang sudah diputuskan. */
export function ClearNotificationsButton({ count }: { count: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await clearDecidedApplications();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-rust-700/40 hover:text-rust-700 disabled:opacity-60"
      >
        {pending ? "Membersihkan…" : `Bersihkan ${count} pengajuan`}
      </button>

      <ConfirmDialog
        open={asking}
        title="Bersihkan pengajuan yang sudah diputuskan?"
        description={`${count} catatan pengajuan yang sudah diterima atau ditolak akan dihapus.`}
        note="Pengajuan yang masih menunggu keputusan tidak ikut terhapus."
        confirmLabel="Ya, Bersihkan"
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />

      {error && (
        <p role="status" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Jalan keluar untuk pengajuan yang terkunci: masih "menunggu", tetapi akun
 * pelamarnya sudah dihapus sehingga tidak ada lagi role yang bisa diubah.
 *
 * Dirender hanya oleh halaman detail, karena di sanalah keberadaan akun sudah
 * diperiksa. Daftar notifikasi tidak menampilkannya supaya tidak perlu satu
 * kueri Firebase Auth per baris hanya untuk memutuskan satu tombol.
 */
export function DeleteStuckApplicationButton({ uid, name }: { uid: string; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await deleteApplication(uid);
      if (res.ok) router.push("/admin/notifications");
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        className="rounded-lg border border-rust-700/40 px-5 py-2.5 text-sm font-medium text-rust-700 transition-colors duration-200 hover:bg-rust-100 disabled:opacity-60"
      >
        {pending ? "Menghapus…" : "Hapus Pengajuan Ini"}
      </button>

      <ConfirmDialog
        open={asking}
        title="Hapus pengajuan yang tidak bisa diputuskan?"
        description={`Akun ${name} sudah dihapus, jadi pengajuannya tidak bisa diterima maupun ditolak.`}
        note="Menghapusnya membersihkan lencana Pengajuan Edukator. Tidak ada akun yang terpengaruh."
        confirmLabel="Ya, Hapus"
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />

      {error && (
        <p role="status" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}
