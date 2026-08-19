"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { clearDecidedCourseRequests, deleteCourseRequest } from "@/lib/courseRequestActions";

/**
 * Tombol hapus di halaman pengajuan kursus.
 *
 * Sengaja sebangun dengan NotificationActions: kedua daftar itu bekerja dengan
 * cara yang sama — baris masuk, admin memutuskan, catatannya dibersihkan —
 * jadi bentuk tombol, kalimat konfirmasi, dan aturan "putuskan dulu baru boleh
 * hapus" ikut disamakan supaya tidak ada dua kebiasaan yang harus dipelajari.
 *
 * Dua komponen terpisah karena barisnya berupa <Link> yang menutupi seluruh
 * lebar: <button> di dalam <a> bukan HTML yang sah.
 */

/** Menghapus satu catatan. Hanya dirender untuk yang sudah diputuskan. */
export function DeleteRequestButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await deleteCourseRequest(id);
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
        aria-label={`Hapus pengajuan ${title}`}
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
        description={`Riwayat pengajuan untuk "${title}" akan hilang dari daftar ini.`}
        note="Kursusnya tidak terpengaruh — keputusan yang sudah diambil tetap berlaku."
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
export function ClearRequestsButton({ count }: { count: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await clearDecidedCourseRequests();
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
        description={`${count} catatan pengajuan yang sudah disetujui atau ditolak akan dihapus.`}
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
