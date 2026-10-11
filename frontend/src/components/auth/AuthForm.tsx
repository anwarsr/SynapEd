"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { mulaiFisika } from "@/components/auth/hurufFisika";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

// Isi memudar keluar (OUT_MS), teks ditukar saat tak terlihat, lalu memudar
// masuk. Panel meluncur serentak (700ms) jadi isi baru tiba tepat saat panel
// hampir mendarat. URL baru disinkronkan sesudahnya (lihat switchMode).
const OUT_MS = 240;

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

/**
 * Bagian formulir yang hanya ada di satu mode. Dirender SELALU dan dilipat
 * lewat grid-rows 0fr↔1fr: tingginya mengalir halus, bukan lenyap seketika
 * seperti saat dilepas dari pohon. `inert` mencegah fokus/pembaca layar
 * masuk ke bagian yang sedang terlipat.
 */
function Lipat({ buka, children }: { buka: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-warm motion-reduce:transition-none",
        buka ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!buka}
    >
      <div className="min-h-0 overflow-hidden" inert={!buka}>
        {children}
      </div>
    </div>
  );
}

/**
 * Teks yang dipecah per huruf: masuk dengan ayunan (tertinggal lalu melampaui
 * sebelum mendarat). Setelah `fisika` menyala, tiap huruf jadi benda yang
 * jatuh, bergelinding, dan bisa dilempar (lihat hurufFisika.ts). Kata dibungkus
 * nowrap agar baris tidak patah di tengah kata. Pembaca layar membaca teks utuh
 * dari aria-label, bukan huruf-hurufnya.
 */
function Huruf({ teks, fisika, mulai = 0 }: { teks: string; fisika: boolean; mulai?: number }) {
  let i = mulai;
  return (
    <span aria-label={teks}>
      {teks.split(" ").map((kata, k, semua) => (
        <span key={k} aria-hidden="true" className="inline-block whitespace-nowrap">
          {[...kata].map((h) => {
            const n = i++;
            return (
              <span key={n} className="grav-h" data-fisika={fisika} style={{ "--i": n } as CSSProperties}>
                {h}
              </span>
            );
          })}
          {k < semua.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </span>
  );
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

  // `mode` = tujuan (menggerakkan panel); `shown` = mode yang isinya sedang
  // TERLIHAT (tertinggal OUT_MS di belakang `mode` supaya pertukaran teks
  // terjadi saat isi transparan). `initialMode` tetap sumber kebenaran saat
  // halaman dibuka langsung atau tombol kembali/maju ditekan - disinkronkan
  // saat render (pola resmi React untuk "adjusting state when a prop changes").
  const [mode, setMode] = useState<Mode>(initialMode);
  const [shown, setShown] = useState<Mode>(initialMode);
  const [tampil, setTampil] = useState(true);
  const [syncedInitialMode, setSyncedInitialMode] = useState(initialMode);
  if (initialMode !== syncedInitialMode) {
    setSyncedInitialMode(initialMode);
    setMode(initialMode);
    setShown(initialMode);
    setTampil(true);
  }

  const t = copy[shown];

  // Arah isi: masuk dari kanan saat menuju Daftar, dari kiri saat menuju Masuk.
  // Teks panel tertinggal sedikit di arah berlawanan dengan geser panel, lalu
  // mengayun mendarat (lihat .grav-h).
  const ayunStyle = { "--grav-dx": mode === "login" ? "-70px" : "70px" } as CSSProperties;
  const isiStyle = { "--auth-fade-from": mode === "register" ? "14px" : "-14px" } as React.CSSProperties;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  // Tombol panel "digesek" 3 kali (kiri-kanan-kiri) → seluruh huruf panel jatuh
  // ke dasar kotaknya dan jadi benda fisika sampai halaman dimuat ulang. `beku`
  // menyimpan mode saat itu: teks panel dibekukan agar huruf-hurufnya (elemen
  // yang sama) tidak diganti saat mode berpindah.
  const [beku, setBeku] = useState<Mode | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const ketukRef = useRef<() => void>(() => undefined);
  const gesek = useRef({ x: 0, arah: 0, jarak: 0, hitung: 0, sudah: false, t0: 0 });

  function onGesek(e: React.PointerEvent) {
    if (beku || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = gesek.current;
    const now = performance.now();
    // Gesekan yang terlalu lambat (tak berurutan) dihitung dari awal lagi.
    if (now - g.t0 > 3000) Object.assign(g, { hitung: 0, arah: 0, jarak: 0, sudah: false, t0: now });
    const dx = e.clientX - g.x;
    g.x = e.clientX;
    if (Math.abs(dx) < 2) return;
    const arah = Math.sign(dx);
    if (arah !== g.arah) {
      g.arah = arah;
      g.jarak = 0;
      g.sudah = false;
    }
    g.jarak += Math.abs(dx);
    if (g.jarak >= 28 && !g.sudah) {
      g.sudah = true;
      g.hitung += 1;
      if (g.hitung >= 3) setBeku(shown);
    }
  }

  // Fisika hidup selama `beku` terisi; ketukan pada huruf tombol = menekan tombol.
  useEffect(() => {
    ketukRef.current = () => switchMode(other(mode));
  });
  useEffect(() => {
    if (!beku || !panelRef.current) return;
    return mulaiFisika(panelRef.current, tombolRef.current, () => ketukRef.current());
  }, [beku]);

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
    setTampil(false);
    setError(null);
    setNotice(null);
    clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      setShown(next);
      // Huruf yang berjatuhan ikut direset: wadah dipasang ulang (key berganti)
      // dengan teks mode baru dan animasi masuk normal.
      setBeku(null);
      setTampil(true);
      window.history.replaceState(null, "", next === "login" ? "/login" : "/register");
    }, OUT_MS);
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
        shown === "register"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (shown === "register") {
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

  /** Isi formulir. `scope` hanya dipakai sebagai awalan id — kartu ponsel &
   *  kartu desktop sama-sama ter-mount di DOM (disembunyikan lewat CSS per
   *  breakpoint), jadi tanpa awalan id="email" akan dobel. */
  function renderFields(scope: "mobile" | "desktop") {
    const daftar = shown === "register";
    return (
      <>
        {error && (
          <div role="alert" className="mb-4 bg-rust-100 px-4 py-3 text-sm text-rust-700">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-4 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {notice}
          </div>
        )}

        {/* Google didahulukan: bagi kebanyakan orang ini jalan tercepat,
            dan menaruhnya di bawah form membuatnya mudah terlewat. */}
        <GoogleButton
          onClick={onGoogle}
          pending={googlePending}
          disabled={pending}
          label={daftar ? "Daftar dengan Google" : "Masuk dengan Google"}
        />

        <div className="flex items-center gap-3 my-6" aria-hidden="true">
          <span className="flex-1 h-px bg-rule" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">atau</span>
          <span className="flex-1 h-px bg-rule" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <Lipat buka={daftar}>
            <div className="pb-4">
              <Field
                id={`${scope}-name`}
                label="Nama lengkap"
                type="text"
                value={name}
                onChange={setName}
                autoComplete="name"
                required={daftar}
              />
            </div>
          </Lipat>

          <div className="mb-4">
            <Field
              id={`${scope}-email`}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
          </div>

          <Field
            id={`${scope}-password`}
            label="Kata sandi"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={daftar ? "new-password" : "current-password"}
            hint={daftar ? "Minimal 6 karakter." : undefined}
            required
          />

          <Lipat buka={!daftar}>
            <p className="pt-3 text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-700 hover:underline underline-offset-4"
              >
                Lupa kata sandi?
              </button>
            </p>
          </Lipat>

          <button
            type="submit"
            disabled={pending || googlePending}
            className={cn(
              "mt-6 w-full px-6 py-3.5 text-sm font-semibold transition-colors duration-300 ease-out-soft",
              "bg-blue-600 text-white hover:bg-blue-700",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {pending ? "Memproses…" : t.submit}
          </button>

          {/* Persetujuan ketentuan.
              Ditulis sebagai pernyataan, bukan kotak centang, karena
              pendaftaran bisa lewat email MAUPUN Google - kotak centang
              harus mengunci kedua jalur itu sekaligus, dan tombol Google
              berada di atas formulir ini. Kalimatnya sengaja menyebut
              tindakan yang memicu persetujuan, dan kedua tautannya
              benar-benar bisa dibuka sebelum akun dibuat. */}
          <Lipat buka={daftar}>
            <p className="pt-4 text-xs text-ink-muted leading-relaxed text-center">
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
          </Lipat>
        </form>

        <p className="mt-7 pt-6 border-t border-rule text-center text-sm text-ink-muted md:hidden">
          {t.altText}{" "}
          <Link
            href={shown === "login" ? "/register" : "/login"}
            onClick={(e) => {
              e.preventDefault();
              switchMode(other(shown));
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
   *  yang sedang tampil; panel meluncur kiri/kanan mengikuti mode. */
  function renderInvite() {
    const basis = beku ?? shown;
    const c = copy[other(basis)];
    return (
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 py-12 text-center text-white lg:px-14">
        <h2 className="t-h3 mb-3 text-[1.7rem] text-white">
          <Huruf teks={c.heading} fisika={beku !== null} />
        </h2>
        <p className="t-body mb-9 max-w-[26ch] text-sm text-white/75">
          <Huruf teks={c.sub} fisika={beku !== null} mulai={c.heading.length} />
        </p>
        <button
          ref={tombolRef}
          type="button"
          onClick={() => switchMode(other(mode))}
          onPointerMove={onGesek}
          onPointerEnter={(e) => {
            gesek.current.x = e.clientX;
            gesek.current.t0 = performance.now();
          }}
          className="rounded-full border border-white/50 px-9 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors duration-300 ease-out-soft hover:bg-white hover:text-navy"
        >
          <Huruf
            teks={other(basis) === "login" ? "Masuk" : "Daftar"}
            fisika={beku !== null}
            mulai={c.heading.length + c.sub.length}
          />
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ivory bg-grid flex items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl">
        <Link href="/" className="flex justify-center mb-8" aria-label="SynapEd - beranda">
          <Image
            src="/images/logotextwhite.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="logo-on-dark w-32 h-auto -my-10"
            priority
          />
          <Image
            src="/images/logotext.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="logo-on-light w-32 h-auto -my-10"
          />
        </Link>

        <div className="rise-in relative overflow-hidden bg-paper-card">
          {/* ══ Ponsel/tablet kecil — satu kartu, tanpa ruang untuk sisi
              "merek" terpisah. ══ */}
          <div className="p-6 sm:p-8 md:hidden">
            <div className="auth-isi" data-tampil={tampil} style={isiStyle}>
              <h1 className="t-h2 text-center text-[1.9rem] mb-3">{t.heading}</h1>
              <p className="t-body text-sm text-center text-ink-muted mb-8">{t.sub}</p>

              {renderFields("mobile")}
            </div>
          </div>

          {/* ══ Desktop — kartu terbelah: panel merek (navy, berisi tombol
              Masuk/Daftar) dan sisi formulir BERTUKAR tempat dengan
              meluncur saat mode berpindah: Daftar = panel di kiri, Masuk =
              panel di kanan. Isinya memudar bergantian (.auth-isi), TIDAK
              dilepas-pasang, jadi kolom tidak pernah lenyap mendadak. ══ */}
          {/* Daftar punya lebih banyak isi (nama + ketentuan), jadi kartunya lebih tinggi
              supaya formulir tidak terhimpit; tinggi ikut beranimasi bersama panel. */}
          <div
            className="relative hidden transition-[min-height] duration-[900ms] ease-warm motion-reduce:transition-none md:block"
            style={{ minHeight: mode === "register" ? 800 : 640 }}
          >
            <div
              ref={panelRef}
              className={cn(
                "auth-brand-panel absolute inset-y-0 left-0 z-10 w-1/2 overflow-hidden transition-transform duration-[900ms] ease-warm motion-reduce:transition-none",
                mode === "register" ? "translate-x-0" : "translate-x-full",
              )}
            >
              <div
                key={beku ?? shown}
                className="auth-isi h-full"
                data-tampil={tampil}
                style={{ ...isiStyle, ...ayunStyle }}
              >
                {renderInvite()}
              </div>
            </div>

            <div
              className={cn(
                "absolute inset-y-0 left-0 flex w-1/2 items-center justify-center px-10 py-14 transition-transform duration-[900ms] ease-warm motion-reduce:transition-none lg:px-14",
                mode === "register" ? "translate-x-full" : "translate-x-0",
              )}
            >
              <div className="auth-isi w-full max-w-sm" data-tampil={tampil} style={isiStyle}>
                <h1 className="t-h2 text-[1.9rem] mb-3">{t.heading}</h1>
                <p className="t-body text-sm text-ink-muted mb-8">{t.sub}</p>
                {renderFields("desktop")}
              </div>
            </div>
          </div>
        </div>
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
        className="w-full bg-white/[0.06] px-4 py-3 text-sm text-ink shadow-[inset_0_-1px_0_var(--color-rule)] transition-[background-color,box-shadow] duration-300 placeholder:text-ink-faint hover:bg-white/[0.09] focus:bg-white/[0.09] focus:shadow-[inset_0_-2px_0_var(--color-blue-400)] focus:outline-none"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
