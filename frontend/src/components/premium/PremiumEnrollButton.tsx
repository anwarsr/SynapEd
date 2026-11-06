"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollPremium } from "@/lib/premiumActions";
import { cn } from "@/lib/cn";

/**
 * Tombol "Pelajari dengan Premium" di kursus berbayar, untuk anggota premium.
 * Penjaganya ada di `enrollPremium` (premium aktif, kursus publik berbayar,
 * bukan milik sendiri) - tombol ini hanya memanggilnya.
 */
export default function PremiumEnrollButton({ slug, label = "Pelajari dengan Premium" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setGalat(null);
            const res = await enrollPremium(slug);
            if (!res.ok) return setGalat(res.error);
            router.push(`/courses/${slug}/learn`);
          })
        }
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 bg-blue-600 px-6 py-3 text-sm font-semibold text-white",
          "transition-colors duration-200 ease-out-soft hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span aria-hidden="true" className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
          Premium
        </span>
        {pending ? "Membuka…" : label}
      </button>
      {galat && (
        <p role="status" className="mt-3 bg-[#E0795A]/15 px-4 py-3 text-sm text-error-text">
          {galat}
        </p>
      )}
    </div>
  );
}
