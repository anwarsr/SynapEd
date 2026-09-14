"use client";
import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { searchUsernames, type UsernameHit } from "@/lib/usernameActions";
import { MAX_CONTRIBUTORS, MIN_SHARE, OWNER_MIN_SHARE, buildContributors } from "@/lib/contributors";
import { splitSale } from "@/lib/royaltySplit";
import { formatPrice } from "@/lib/courseUi";
import { inputClass } from "./fields";
import { cn } from "@/lib/cn";

export interface EditorPerson {
  uid: string;
  name: string;
  username: string | null;
  photoURL: string | null;
}

export type EditorRow = EditorPerson & { share: number };

const CONTOH_HARGA = 100_000;
const DEFAULT_SHARE = 10;

/**
 * Menyusun kontributor & persentase bagi hasil sebuah kursus.
 *
 * Yang dikirim ke server hanya kontributor SELAIN pemilik. Jatah pemilik
 * ditampilkan sebagai sisa otomatis dan tidak bisa digeser — server pun
 * menghitungnya ulang sendiri, jadi angka di layar ini tidak pernah dipercaya.
 *
 * Pratinjau uang memakai `splitSale` yang SAMA dengan yang mencatat penjualan,
 * supaya angka yang dilihat di sini persis angka yang nanti tercatat.
 */
export default function ContributorEditor({
  owner,
  ownerIsViewer,
  initial,
  feePercent,
  price,
  onChange,
}: {
  owner: EditorPerson;
  /** Pemilik adalah orang yang sedang menyunting — labelnya "Anda". */
  ownerIsViewer: boolean;
  initial: readonly EditorRow[];
  feePercent: number;
  price: number;
  onChange: (others: { uid: string; share: number }[]) => void;
}) {
  const [rows, setRows] = useState<EditorRow[]>(() => initial.map((r) => ({ ...r })));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UsernameHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const permintaan = useRef(0);

  const jumlahLain = rows.reduce((n, r) => n + r.share, 0);
  const jatahPemilik = 100 - jumlahLain;
  const tersedia = 100 - OWNER_MIN_SHARE - jumlahLain;
  const penuh = rows.length >= MAX_CONTRIBUTORS - 1;

  function ubah(next: EditorRow[]) {
    setRows(next);
    onChange(next.map((r) => ({ uid: r.uid, share: r.share })));
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function cari(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);

    const kata = value.trim().replace(/^@+/, "");
    const nomor = ++permintaan.current;

    if (kata.length < 2) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    // Jeda 300 ms: satu pencarian per jeda mengetik, bukan satu per huruf —
    // server membatasi 30 pencarian per menit.
    timer.current = setTimeout(async () => {
      try {
        const res = await searchUsernames(kata);
        if (nomor !== permintaan.current) return; // jawaban basi dari ketikan lama
        if (res.ok) {
          setHits(res.hits);
          setSearchError(null);
        } else {
          setHits([]);
          setSearchError(res.error);
        }
      } catch {
        if (nomor === permintaan.current) setSearchError("Pencarian gagal. Coba lagi.");
      } finally {
        if (nomor === permintaan.current) setSearching(false);
      }
    }, 300);
  }

  function tambah(hit: UsernameHit) {
    if (penuh || tersedia < MIN_SHARE) return;
    ubah([...rows, { ...hit, share: Math.min(DEFAULT_SHARE, tersedia) }]);
    cari("");
  }

  function setShare(uid: string, raw: number) {
    ubah(
      rows.map((r) => {
        if (r.uid !== uid) return r;
        const max = r.share + tersedia;
        const n = Number.isFinite(raw) ? Math.round(raw) : r.share;
        return { ...r, share: Math.min(max, Math.max(MIN_SHARE, n)) };
      }),
    );
  }

  const dipakai = new Set([owner.uid, ...rows.map((r) => r.uid)]);
  const pilihan = hits.filter((h) => !dipakai.has(h.uid));

  const dibentuk = buildContributors(owner.uid, rows);
  const hargaPratinjau = price > 0 ? price : CONTOH_HARGA;
  const pratinjau = dibentuk.ok ? splitSale(hargaPratinjau, feePercent, dibentuk.contributors) : null;
  const namaDari = (uid: string) =>
    uid === owner.uid ? (ownerIsViewer ? "Anda" : owner.name) : (rows.find((r) => r.uid === uid)?.name ?? "—");

  return (
    <section className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Kontributor &amp; bagi hasil</h2>
      <p className="t-body text-sm mb-6">
        Orang lain yang ikut menyusun isi kursus ini — modul, video, kuis — dan persentase yang
        mereka terima dari setiap penjualan, setelah potongan platform {feePercent}%. Bagian pemilik
        adalah sisanya, minimal {OWNER_MIN_SHARE}%.
      </p>

      <ul className="divide-y divide-rule border-y border-rule">
        <li className="flex flex-wrap items-center gap-3 py-3">
          <UserAvatar name={owner.name} photoURL={owner.photoURL} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink break-words">
              {ownerIsViewer ? `${owner.name} (Anda)` : owner.name}
            </span>
            <span className="block text-xs text-ink-muted">
              {owner.username ? `@${owner.username} · ` : ""}Pemilik — sisa otomatis
            </span>
          </span>
          <span className="t-numeral text-lg tabular-nums text-ink" aria-live="polite">
            {jatahPemilik}%
          </span>
        </li>

        {rows.map((r) => {
          const max = r.share + tersedia;
          return (
            <li key={r.uid} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3">
              <UserAvatar name={r.name} photoURL={r.photoURL} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink break-words">{r.name}</span>
                {r.username && <span className="block text-xs text-ink-muted">@{r.username}</span>}
              </span>
              <button
                type="button"
                onClick={() => ubah(rows.filter((x) => x.uid !== r.uid))}
                className="rounded-md px-2 py-1 text-xs font-medium text-rust-700 hover:bg-rust-100 transition-colors"
                aria-label={`Hapus ${r.name} dari kontributor`}
              >
                Hapus
              </button>

              <div className="col-span-3 flex items-center gap-3">
                <input
                  type="range"
                  min={MIN_SHARE}
                  max={max}
                  step={1}
                  value={r.share}
                  onChange={(e) => setShare(r.uid, Number(e.target.value))}
                  aria-label={`Persentase ${r.name}`}
                  className="min-w-0 flex-1 accent-blue-600"
                />
                <span className="flex items-center rounded-lg border border-rule bg-paper focus-within:border-blue-500">
                  <input
                    type="number"
                    min={MIN_SHARE}
                    max={max}
                    step={1}
                    inputMode="numeric"
                    value={r.share}
                    onChange={(e) => setShare(r.uid, Number(e.target.value))}
                    aria-label={`Persentase ${r.name} (angka)`}
                    className="w-14 bg-transparent py-1.5 pl-2 text-right text-sm tabular-nums text-ink focus:outline-none"
                  />
                  <span className="pr-2 text-sm text-ink-muted">%</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Menambah kontributor ─────────────────────────────── */}
      <div className="relative mt-5">
        <label htmlFor="contributor-search" className="block t-label text-ink-muted mb-2">
          Tambah kontributor
        </label>
        <input
          id="contributor-search"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(e) => cari(e.target.value)}
          disabled={penuh || tersedia < MIN_SHARE}
          placeholder={
            penuh
              ? `Maksimal ${MAX_CONTRIBUTORS} kontributor termasuk pemilik`
              : tersedia < MIN_SHARE
                ? `Bagian pemilik sudah di batas minimum ${OWNER_MIN_SHARE}%`
                : "Cari username, mis. @budi"
          }
          className={cn(inputClass, "disabled:opacity-60")}
        />

        {(pilihan.length > 0 || searching || searchError || (query.trim().length >= 2 && hits.length === 0)) && (
          <div className="mt-2 rounded-lg border border-rule bg-paper-card shadow-lift">
            {searching && <p className="px-4 py-3 text-sm text-ink-muted">Mencari…</p>}
            {!searching && searchError && <p className="px-4 py-3 text-sm text-rust-700">{searchError}</p>}
            {!searching && !searchError && pilihan.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink-muted">
                {hits.length > 0 ? "Semua hasil sudah tercantum." : "Tidak ada username yang cocok."}
              </p>
            )}
            {!searching && pilihan.length > 0 && (
              <ul className="max-h-72 overflow-y-auto py-1">
                {pilihan.map((h) => (
                  <li key={h.uid}>
                    <button
                      type="button"
                      onClick={() => tambah(h)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-paper-alt transition-colors"
                    >
                      <UserAvatar name={h.name} photoURL={h.photoURL} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-sm text-ink break-words">{h.name}</span>
                        <span className="block text-xs text-ink-muted">@{h.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Pratinjau uang ───────────────────────────────────── */}
      {pratinjau && (
        <p className="mt-5 rounded-lg bg-paper-alt px-4 py-3 text-sm text-ink-body">
          {price > 0 ? "Dari setiap penjualan" : "Contoh dari penjualan"} {formatPrice(hargaPratinjau)}: SynapEd{" "}
          {formatPrice(pratinjau.feeAmount)}
          {pratinjau.lines.map((l) => (
            <span key={l.uid}>
              {" · "}
              {namaDari(l.uid)} {formatPrice(l.amount)}
            </span>
          ))}
        </p>
      )}
      {!dibentuk.ok && <p className="mt-3 text-sm text-rust-700">{dibentuk.error}</p>}

      <p className="mt-3 text-xs text-ink-muted">
        Perubahan pembagian hanya berlaku untuk penjualan setelah disetujui — penjualan yang sudah
        terjadi tidak berubah.
      </p>
    </section>
  );
}
