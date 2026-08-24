"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IMAGE_ACCEPT, uploadQrisImage, validateImage } from "@/lib/courseUpload";
import { updatePaymentSettings } from "@/lib/paymentSettingsActions";
import { courseImageUrl } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

/** Saklar bergaya, tetap <input type="checkbox"> supaya keyboard tetap jalan. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 shrink-0 rounded border-rule"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted mt-0.5">{hint}</span>
      </span>
    </label>
  );
}

export default function PaymentSettingsForm({
  initial,
  midtransConfigured,
}: {
  initial: {
    midtransEnabled: boolean;
    manualQrisEnabled: boolean;
    qrisImagePath: string | null;
    qrisNote: string;
  };
  /** Kunci Midtrans terpasang di lingkungan? Saklar tanpa kunci tidak berarti. */
  midtransConfigured: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [midtransEnabled, setMidtrans] = useState(initial.midtransEnabled);
  const [manualQrisEnabled, setManual] = useState(initial.manualQrisEnabled);
  const [qrisImagePath, setQris] = useState(initial.qrisImagePath);
  const [qrisNote, setNote] = useState(initial.qrisNote);

  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const preview = courseImageUrl(qrisImagePath);

  async function pilih(file: File | null) {
    if (!file) return;
    setError(null);
    setDone(null);

    const salah = validateImage(file);
    if (salah) return setError(salah);

    setUploading(true);
    try {
      setQris(await uploadQrisImage(file));
    } catch {
      setError("Unggahan gagal. Pastikan Anda masuk sebagai admin, lalu coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      const res = await updatePaymentSettings({
        midtransEnabled,
        manualQrisEnabled,
        qrisImagePath,
        qrisNote,
      });
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={simpan} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 text-lg mb-1.5">Metode Pembayaran</h2>
      <p className="t-body text-sm text-ink-muted mb-6">
        Menentukan tombol apa yang dilihat calon pembeli di halaman kursus berbayar.
      </p>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="mb-4 rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {done}
        </div>
      )}

      <div className="space-y-5">
        <Toggle
          checked={midtransEnabled}
          onChange={setMidtrans}
          label="Midtrans (otomatis)"
          hint={
            midtransConfigured
              ? "Akses terbuka sendiri begitu pembayaran masuk, tanpa campur tangan Anda."
              : "Kunci Midtrans belum terpasang di server — saklar ini belum berpengaruh."
          }
        />

        <Toggle
          checked={manualQrisEnabled}
          onChange={setManual}
          label="QRIS manual (Pedagang Bima)"
          hint="Pembeli mengunggah bukti, lalu Anda yang memastikan uangnya masuk sebelum akses dibuka."
        />

        <div className="border-t border-rule pt-5">
          <p className="t-label text-ink-muted mb-2">Gambar QRIS</p>

          <div className="flex items-start gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Kode QRIS yang sedang dipakai"
                className="w-32 h-32 object-contain rounded-lg border border-rule bg-white shrink-0"
              />
            ) : (
              <div className="w-32 h-32 shrink-0 rounded-lg border border-dashed border-rule bg-paper-alt flex items-center justify-center text-center text-xs text-ink-faint px-2">
                Belum ada
              </div>
            )}

            <div className="min-w-0">
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void pilih(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || pending}
                className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
              >
                {uploading ? "Mengunggah…" : preview ? "Ganti Gambar" : "Unggah Gambar"}
              </button>
              <p className="mt-2 text-xs text-ink-muted">
                JPG, PNG, atau WebP. Maksimal 5 MB. Gambar ini terbuka untuk umum — memang
                harus bisa dipindai calon pembeli.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="qrisNote" className="block t-label text-ink-muted mb-2">
              Keterangan untuk pembeli
            </label>
            <input
              id="qrisNote"
              value={qrisNote}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Contoh: Atas nama UMKM WIBAWA SYNAPED."
              className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || uploading}
        className={cn(
          "mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
          "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
          "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
        )}
      >
        {pending ? "Menyimpan…" : "Simpan Setelan"}
      </button>
    </form>
  );
}
