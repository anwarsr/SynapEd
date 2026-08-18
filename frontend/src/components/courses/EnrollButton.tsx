"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollFree, type EnrollResult } from "@/lib/enrollmentActions";
import { cn } from "@/lib/cn";

/**
 * Tombol daftar kursus gratis.
 *
 * Otorisasi dan harga diperiksa di server action, bukan di sini — tombol yang
 * disembunyikan bukan pengaman, dan harga yang dikirim dari browser bisa
 * dipalsukan. Komponen ini hanya mengurus keadaan menunggu dan pesan hasil.
 */
export default function EnrollButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EnrollResult | null>(null);

  function submit() {
    setResult(null);
    startTransition(async () => {
      const res = await enrollFree(slug);
      setResult(res);
      // Halaman dirender di server, jadi refresh-lah yang menampilkan
      // tombol "Lanjutkan Belajar" menggantikan tombol ini.
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={submit}
        disabled={pending}
        className={cn(
          "w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white",
          "transition-colors duration-200 ease-out-soft hover:bg-blue-700",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        {pending ? "Mendaftarkan…" : "Daftar Kursus Ini"}
      </button>

      {result && !result.ok && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
        >
          {result.error}
        </p>
      )}
    </div>
  );
}
