"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  authErrorMessage,
  establishSession,
  isPopupDismissed,
  readRole,
  sendPasswordReset,
  signInWithGoogle,
} from "@/lib/authActions";
import GoogleButton from "@/components/auth/GoogleButton";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

// Lamanya crossfade saat berpindah Masuk <-> Daftar — dipakai juga untuk
// menunda sinkronisasi URL (lihat switchMode).
const FADE_MS = 420;

const copy = {
  login: {
    heading: "Selamat datang kembali",
    sub: "Lanjutkan belajar dari tempat Anda berhenti.",
    submit: "Masuk",
    altText: "Belum punya akun?",
    altLabel: "Daftar gratis",
  },
  register: {
    heading: "Mulai belajar hari ini",
    sub: "Buat akun gratis dan akses seluruh kurikulum SynapEd.",
    submit: "Daftar Gratis",
    altText: "Sudah punya akun?",
    altLabel: "Masuk di sini",
  },
} as const;

function other(mode: Mode): Mode {
  return mode === "login" ? "register" : "login";
}

export default function AuthForm({
  mode: initialMode,
  redirectTo = "/",
}: {
  mode: Mode;
  /** Sudah divalidasi hanya berupa jalur internal oleh halaman pemanggil. */
  redirectTo?: string;
}) {
  const router = useRouter();

  // Mode tampilan dikendalikan state lokal (bukan langsung props) supaya
  // berpindah Masuk <-> Daftar bisa dianimasikan tanpa menunggu navigasi
  // Next selesai. `initialMode` tetap sumber kebenaran saat halaman dibuka
  // langsung atau pengguna menekan tombol kembali/maju — disinkronkan saat
  // render (pola resmi React untuk "adjusting state when a prop changes"),
  // bukan lewat efek, supaya tidak memicu render susulan.
  const [mode, setMode] = useState<Mode>(initialMode);
  const [syncedInitialMode, setSyncedInitialMode] = useState(initialMode);
  if (initialMode !== syncedInitialMode) {
    setSyncedInitialMode(initialMode);
    setMode(initialMode);
  }

  const t = copy[mode];

  // Arah animasi .auth-fade: masuk dari kanan saat menuju Daftar, dari
  // kiri saat menuju Masuk — untuk isi yang memudar di atas panel yang meluncur.
  const fadeFromStyle = { "--auth-fade-from": mode === "register" ? "18px" : "-18px" } as React.CSSProperties;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const switchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(switchTimer.current), []);

  /** Beralih Masuk <-> Daftar. URL disinkronkan lewat History API langsung
   *  (bukan router.replace) — router.replace membuat Next mengambil ulang
   *  RSC halaman tujuan dan me-remount AuthForm, yang mengulang animasi
   *  masuk kartu (.rise-in) di tengah transisi dan terlihat patah.
   *  history.replaceState murni kosmetik: alamat & tombol kembali tetap
   *  benar, tanpa menyentuh router Next sama sekali. */
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
    clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      window.history.replaceState(null, "", next === "login" ? "/login" : "/register");
    }, FADE_MS);
  }

  /**
   * Langkah setelah kredensial diterima — sama untuk kata sandi maupun Google,
   * karena bagi Firebase keduanya menghasilkan pengguna yang setara.
   */
  async function completeSignIn(user: User) {
    // Tukar ID token menjadi session cookie httpOnly, supaya Server
    // Component bisa mengenali sesi ini tanpa menunggu JavaScript.
    await establishSession(user);

    // Admin diantar langsung ke panelnya — kecuali memang sedang diminta
    // membuka halaman tertentu lewat ?next=, misalnya setelah ditolak dari
    // halaman belajar. Menimpa tujuan itu justru membingungkan.
    const role = await readRole(user);
    const target = redirectTo !== "/" ? redirectTo : role === "admin" ? "/admin" : "/";

    router.replace(target);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      const auth = firebaseAuth();

      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (mode === "register") {
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });

        // Email yang belum diverifikasi adalah sebab kata sandi terlepas
        // begitu akun yang sama masuk lewat Google: Google membuktikan
        // kepemilikan email, akun kata sandi tidak. Mengirim tautan ini
        // sejak awal memberi pengguna kesempatan menutup celah itu.
        await sendEmailVerification(credential.user).catch(() => undefined);
      }

      await completeSignIn(credential.user);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setGooglePending(true);

    try {
      const credential = await signInWithGoogle();
      await completeSignIn(credential.user);
    } catch (err) {
      // Menutup popup adalah keputusan pengguna, bukan kegagalan — tidak
      // pantas dibalas kotak merah.
      if (!isPopupDismissed(err)) setError(authErrorMessage(err));
      setGooglePending(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Isi alamat email Anda dulu.");
      return;
    }

    try {
      await sendPasswordReset(email.trim());
    } catch (err) {
      // Galat selain jaringan sengaja tidak dibedakan: membedakannya akan
      // memberitahu penebak email mana yang terdaftar.
      setError(authErrorMessage(err));
      return;
    }

    // Pesan netral — sama saja apakah emailnya terdaftar atau tidak.
    setNotice(`Kalau ${email.trim()} terdaftar, tautan atur ulang kata sandi sudah dikirim.`);
  }

  /** Isi formulir untuk mode AKTIF saat ini. `scope` hanya dipakai sebagai
   *  awalan id — kartu ponsel & kartu desktop sama-sama bisa ter-mount
   *  sekaligus di DOM (disembunyikan lewat CSS per breakpoint, bukan
   *  dilepas), jadi tanpa awalan id="email" akan dobel. */
  function renderFields(scope: "mobile" | "desktop") {
    return (
      <>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"
          >
            {notice}
          </div>
        )}

        {/* Google didahulukan: bagi kebanyakan orang ini jalan tercepat,
            dan menaruhnya di bawah form membuatnya mudah terlewat. */}
        <GoogleButton
          onClick={onGoogle}
          pending={googlePending}
          disabled={pending}
          label={mode === "register" ? "Daftar dengan Google" : "Masuk dengan Google"}
        />

        <div className="flex items-center gap-3 my-6" aria-hidden="true">
          <span className="flex-1 h-px bg-rule" />
          <span className="text-xs uppercase tracking-wider text-ink-faint">atau</span>
          <span className="flex-1 h-px bg-rule" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {mode === "register" && (
            <Field
              id={`${scope}-name`}
              label="Nama lengkap"
              type="text"
              value={name}
              onChange={setName}
              autoComplete="name"
              required
            />
          )}

          <Field
            id={`${scope}-email`}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <Field
            id={`${scope}-password`}
            label="Kata sandi"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            hint={mode === "register" ? "Minimal 6 karakter." : undefined}
            required
          />

          {mode === "login" && (
            <p className="text-right -mt-1">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-700 hover:underline underline-offset-4"
              >
                Lupa kata sandi?
              </button>
            </p>
          )}

          <button
            type="submit"
            disabled={pending || googlePending}
            className={cn(
              "w-full rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 ease-out-soft",
              "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5",
              "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0",
            )}
          >
            {pending ? "Memproses…" : t.submit}
          </button>

          {/* Persetujuan ketentuan.
              Ditulis sebagai pernyataan, bukan kotak centang, karena
              pendaftaran bisa lewat email MAUPUN Google — kotak centang
              harus mengunci kedua jalur itu sekaligus, dan tombol Google
              berada di atas formulir ini. Kalimatnya sengaja menyebut
              tindakan yang memicu persetujuan, dan kedua tautannya
              benar-benar bisa dibuka sebelum akun dibuat. */}
          {mode === "register" && (
            <p className="text-xs text-ink-muted leading-relaxed text-center">
              Dengan mendaftar, Anda menyetujui{" "}
              <Link
                href="/syarat-ketentuan"
                className="text-blue-700 hover:underline underline-offset-4"
              >
                Syarat &amp; Ketentuan
              </Link>{" "}
              dan{" "}
              <Link
                href="/kebijakan-privasi"
                className="text-blue-700 hover:underline underline-offset-4"
              >
                Kebijakan Privasi
              </Link>{" "}
              SynapEd.
            </p>
          )}
        </form>

        <p className="mt-7 pt-6 border-t border-rule text-center text-sm text-ink-muted md:hidden">
          {t.altText}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            onClick={(e) => {
              e.preventDefault();
              switchMode(other(mode));
            }}
            className="text-blue-700 font-medium hover:underline underline-offset-4"
          >
            {t.altLabel}
          </Link>
        </p>
      </>
    );
  }

  /** Panel "merek" navy (desktop) — isinya selalu ajakan ke mode LAWAN dari
   *  yang sedang aktif; panel meluncur kiri/kanan mengikuti mode. */
  function renderInvite() {
    const c = copy[other(mode)];
    return (
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 py-12 text-center text-white lg:px-14">
        <h2 className="t-h3 text-[1.7rem] text-white mb-3">{c.heading}</h2>
        <p className="t-body text-sm text-blue-50/80 mb-8 max-w-[26ch]">{c.sub}</p>
        <button
          type="button"
          onClick={() => switchMode(other(mode))}
          className="rounded-full border border-white/60 px-8 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-all duration-200 ease-out-soft hover:bg-white hover:text-navy hover:-translate-y-0.5"
        >
          {other(mode) === "login" ? "Masuk" : "Daftar"}
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ivory bg-grid flex items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl">
        <Link href="/" className="flex justify-center mb-8" aria-label="SynapEd — beranda">
          <Image
            src="/images/logotext.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="w-32 h-auto -my-10"
            priority
          />
        </Link>

        <div className="rise-in relative overflow-hidden rounded-3xl border border-rule bg-paper-card shadow-lift md:min-h-160">
          {/* ══ Ponsel/tablet kecil — satu kartu, tanpa ruang untuk sisi
              "merek" terpisah. Perpindahan mode ditandai geser + memudar
              singkat (.auth-fade). ══ */}
          <div className="p-6 sm:p-8 md:hidden">
            <div key={mode} className="auth-fade" style={fadeFromStyle}>
              <h1 className="t-h2 text-center text-[1.9rem] mb-3">{t.heading}</h1>
              <p className="t-body text-sm text-center text-ink-muted mb-8">{t.sub}</p>

              {renderFields("mobile")}
            </div>
          </div>

          {/* ══ Desktop — kartu terbelah: panel merek (navy, berisi tombol
              Masuk/Daftar) dan sisi formulir BERTUKAR tempat dengan
              meluncur (translate-x, 700ms) saat mode berpindah: Daftar =
              panel di kiri, Masuk = panel di kanan. Isinya juga memudar
              (.auth-fade). Atas permintaan pemilik (sesuai gambar acuan). ══ */}
          <div className="hidden md:block relative md:min-h-160">
            <div
              className={cn(
                "auth-brand-panel absolute inset-y-0 left-0 z-10 w-1/2 overflow-hidden transition-transform duration-700 ease-out-soft motion-reduce:transition-none",
                mode === "register" ? "translate-x-0" : "translate-x-full",
              )}
            >
              <div key={mode} className="auth-fade h-full" style={fadeFromStyle}>
                {renderInvite()}
              </div>
            </div>

            <div
              className={cn(
                "absolute inset-y-0 left-0 flex w-1/2 items-center justify-center px-10 py-12 transition-transform duration-700 ease-out-soft motion-reduce:transition-none lg:px-14",
                mode === "register" ? "translate-x-full" : "translate-x-0",
              )}
            >
              <div key={mode} className="auth-fade w-full max-w-sm" style={fadeFromStyle}>
                <h1 className="t-h2 text-[1.9rem] mb-3">{t.heading}</h1>
                <p className="t-body text-sm text-ink-muted mb-8">{t.sub}</p>
                {renderFields("desktop")}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-ink-muted hover:text-blue-600 transition-colors">
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
