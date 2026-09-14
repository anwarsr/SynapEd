"use client";
import Link from "next/link";
import { useState } from "react";
import { REFERRAL_PARAM } from "@/lib/referralRules";

/**
 * Membagikan tautan kursus. Kalau yang membagikan punya kode referral,
 * kodenya otomatis ikut di tautan — siapa pun yang membeli lewat tautan itu
 * menerapkan kodenya tanpa perlu mengetik apa pun.
 */
export default function ShareCourseButton({
  slug,
  title,
  code,
  loggedIn,
  referralPercent,
}: {
  slug: string;
  title: string;
  code: string | null;
  loggedIn: boolean;
  referralPercent: number;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function bagikan() {
    const url = new URL(`/courses/${slug}`, window.location.origin);
    if (code) url.searchParams.set(REFERRAL_PARAM, code);
    const tautan = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({ title, url: tautan });
        return;
      }
      await navigator.clipboard.writeText(tautan);
      setStatus("Tautan disalin.");
    } catch (err) {
      // Pengguna menutup lembar bagikan — bukan galat.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus(`Salin tautan ini: ${tautan}`);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={bagikan}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline underline-offset-4"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" />
        </svg>
        {code ? "Bagikan dengan kode referral" : "Bagikan kursus"}
      </button>

      {code ? (
        <p className="mt-1.5 text-xs text-ink-muted">
          Tautan memuat kode <strong className="font-semibold text-ink">{code}</strong>. Anda mendapat{" "}
          {referralPercent}% dari setiap pembelian lewat tautan ini.
        </p>
      ) : (
        loggedIn && (
          <p className="mt-1.5 text-xs text-ink-muted">
            <Link href="/dashboard#referral" className="text-blue-700 hover:underline underline-offset-4">
              Buat kode referral
            </Link>{" "}
            dan dapatkan {referralPercent}% dari setiap pembelian lewat tautan Anda.
          </p>
        )
      )}

      {status && (
        <p role="status" className="mt-1.5 break-all text-xs text-blue-700">
          {status}
        </p>
      )}
    </div>
  );
}
