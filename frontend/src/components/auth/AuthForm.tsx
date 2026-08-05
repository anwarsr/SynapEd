"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { authErrorMessage, establishSession, readRole } from "@/lib/authActions";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

const copy = {
  login: {
    chapter: "Masuk",
    heading: ["Selamat datang", "kembali"],
    sub: "Lanjutkan belajar dari tempat Anda berhenti.",
    submit: "Masuk",
    altText: "Belum punya akun?",
    altLabel: "Daftar gratis",
    altHref: "/register",
  },
  register: {
    chapter: "Daftar",
    heading: ["Mulai belajar", "hari ini"],
    sub: "Buat akun gratis dan akses seluruh kurikulum SynapEd.",
    submit: "Daftar Gratis",
    altText: "Sudah punya akun?",
    altLabel: "Masuk di sini",
    altHref: "/login",
  },
} as const;

export default function AuthForm({
  mode,
  redirectTo = "/",
}: {
  mode: Mode;
  /** Sudah divalidasi hanya berupa jalur internal oleh halaman pemanggil. */
  redirectTo?: string;
}) {
  const t = copy[mode];
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const auth = firebaseAuth();

      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (mode === "register" && name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }

      // Tukar ID token menjadi session cookie httpOnly, supaya Server
      // Component bisa mengenali sesi ini tanpa menunggu JavaScript.
      await establishSession(credential.user);

      // Admin diantar langsung ke panelnya — kecuali memang sedang diminta
      // membuka halaman tertentu lewat ?next=, misalnya setelah ditolak dari
      // halaman belajar. Menimpa tujuan itu justru membingungkan.
      const role = await readRole(credential.user);
      const target = redirectTo !== "/" ? redirectTo : role === "admin" ? "/admin" : "/";

      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-hero-navy flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8" aria-label="SynapEd — beranda">
          <Image
            src="/images/logotextwhite.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="w-32 h-auto -my-10"
            priority
          />
        </Link>

        <div className="rise-in bg-paper-card border border-rule rounded-3xl p-8 shadow-lift">
          <p className="chapter-mark justify-center mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>{t.chapter}</span>
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          </p>

          <h1 className="t-h2 text-center text-[1.9rem] mb-3">
            {t.heading[0]} <span className="mark">{t.heading[1]}</span>
          </h1>
          <p className="t-body text-sm text-center text-ink-muted mb-8">{t.sub}</p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
              >
                {error}
              </div>
            )}

            {mode === "register" && (
              <Field
                id="name"
                label="Nama lengkap"
                type="text"
                value={name}
                onChange={setName}
                autoComplete="name"
                required
              />
            )}

            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />

            <Field
              id="password"
              label="Kata sandi"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              hint={mode === "register" ? "Minimal 6 karakter." : undefined}
              required
            />

            <button
              type="submit"
              disabled={pending}
              className={cn(
                "w-full rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 ease-out-soft",
                "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0",
              )}
            >
              {pending ? "Memproses…" : t.submit}
            </button>
          </form>

          <p className="mt-7 pt-6 border-t border-rule text-center text-sm text-ink-muted">
            {t.altText}{" "}
            <Link href={t.altHref} className="text-blue-700 font-medium hover:underline underline-offset-4">
              {t.altLabel}
            </Link>
          </p>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-blue-100/70 hover:text-white transition-colors">
            ← Kembali ke beranda
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  required,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block t-label text-ink-muted mb-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
