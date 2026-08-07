"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  authErrorMessage,
  isPopupDismissed,
  linkGoogle,
  sendVerification,
} from "@/lib/authActions";
import type { SignInMethods } from "@/lib/accountProviders";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
        on ? "bg-blue-50 text-blue-700" : "bg-paper-alt text-ink-faint",
      )}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d={on ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
      </svg>
    </span>
  );
}

/**
 * Cara-cara masuk yang menempel pada akun, sekaligus tempat menambahkannya.
 *
 * Menautkan Google dari sini bersifat MENAMBAH — kata sandinya tetap ada.
 * Itulah bedanya dengan menekan "Masuk dengan Google" dalam keadaan keluar,
 * yang membuat Firebase melepas kata sandi pada akun yang emailnya belum
 * terverifikasi.
 */
export default function SignInMethodsCard({
  methods,
  emailVerified,
}: {
  methods: SignInMethods;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState<"link" | "verify" | null>(null);

  async function onLink() {
    setStatus({ kind: "idle" });
    setPending("link");
    try {
      const user = firebaseAuth().currentUser;
      if (!user) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      await linkGoogle(user);
      setStatus({
        kind: "ok",
        msg: "Google berhasil ditautkan. Kata sandi Anda tetap berlaku — kini keduanya bisa dipakai.",
      });
      router.refresh();
    } catch (err) {
      if (!isPopupDismissed(err)) setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(null);
    }
  }

  async function onVerify() {
    setStatus({ kind: "idle" });
    setPending("verify");
    try {
      const user = firebaseAuth().currentUser;
      if (!user) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      await sendVerification(user);
      setStatus({
        kind: "ok",
        msg: "Tautan verifikasi dikirim. Periksa kotak masuk Anda, termasuk folder spam.",
      });
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Cara Masuk</h2>
      <p className="t-body text-sm mb-6">
        Metode yang bisa Anda pakai untuk masuk ke akun ini.
      </p>

      <ul className="space-y-3 mb-6">
        <li className="flex items-center gap-3 text-sm">
          <Check on={methods.password} />
          <span className={methods.password ? "text-ink" : "text-ink-muted"}>
            Email dan kata sandi
            {!methods.password && " — belum ada"}
          </span>
        </li>
        <li className="flex items-center gap-3 text-sm">
          <Check on={methods.google} />
          <span className={methods.google ? "text-ink" : "text-ink-muted"}>
            Akun Google
            {!methods.google && " — belum ditautkan"}
          </span>
        </li>
      </ul>

      {/* Peringatan ini yang paling penting: email belum terverifikasi adalah
          sebab kata sandi terlepas saat akun yang sama masuk lewat Google. */}
      {!emailVerified && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-100 px-4 py-3.5 text-sm text-amber-700 mb-6">
          <p className="font-semibold mb-1">Email belum diverifikasi</p>
          <p>
            Selama belum diverifikasi, masuk lewat Google dengan email yang sama akan{" "}
            <span className="font-medium">melepas kata sandi Anda</span> — Firebase
            memperlakukan kata sandi pada email yang belum terbukti kepemilikannya sebagai
            berisiko. Verifikasi sekali, dan keduanya bisa hidup berdampingan.
          </p>
          <button
            onClick={onVerify}
            disabled={pending !== null}
            className="mt-3 rounded-lg border border-amber-700/30 bg-paper-card px-4 py-2 text-sm font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-100 disabled:opacity-60"
          >
            {pending === "verify" ? "Mengirim…" : "Kirim Tautan Verifikasi"}
          </button>
        </div>
      )}

      {!methods.google && (
        <div>
          <button
            onClick={onLink}
            disabled={pending !== null}
            className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
          >
            {pending === "link" ? "Menghubungkan…" : "Tautkan Akun Google"}
          </button>
          <p className="mt-2.5 text-xs text-ink-muted">
            Menautkan dari sini aman: kata sandi Anda tetap berlaku.
          </p>
        </div>
      )}

      {status.kind !== "idle" && (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-lg px-4 py-3 text-sm border",
            status.kind === "ok"
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-rust-100 text-rust-700 border-rust-700/25",
          )}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}
