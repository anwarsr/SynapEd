"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { removeClassMember } from "@/lib/classActions";
import { TOMBOL_KOTAK_BAHAYA } from "@/lib/quizUi";

/**
 * Tombol "Keluarkan" + dialog konfirmasi (persegi) untuk pengajar/admin.
 * Hanya dirender untuk pengelola kelas; penjaganya tetap di server action.
 */
export default function KeluarkanAnggota({ classId, uid, nama }: { classId: string; uid: string; nama: string }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function jalankan() {
    setBuka(false);
    setError(null);
    startTransition(async () => {
      const res = await removeClassMember(classId, uid);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setBuka(true)} className={TOMBOL_KOTAK_BAHAYA} aria-label={`Keluarkan ${nama} dari kelas`}>
        <svg className="h-3.5 w-3.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
        {pending ? "Memproses…" : "Keluarkan"}
      </button>

      <ConfirmDialog
        open={buka}
        title={`Keluarkan ${nama}?`}
        description="Ia tidak akan bisa membuka kelas ini lagi. Jawaban tugas dan quiz miliknya tetap tersimpan untuk catatan Anda. Ia bisa bergabung kembali dengan kode undangan selama kodenya belum diganti."
        confirmLabel="Keluarkan"
        onConfirm={jalankan}
        onCancel={() => setBuka(false)}
      />

      {error && (
        <p role="alert" className="mt-2 w-full text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}
