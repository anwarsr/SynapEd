"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { uploadPaymentProof, validateImage, IMAGE_ACCEPT } from "@/lib/courseUpload";
import { createManualOrder, submitPaymentProof } from "@/lib/manualPaymentActions";
import { formatPrice } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

/**
 * Pembayaran QRIS manual di halaman kursus.
 *
 * Tiga keadaan, dan hanya satu yang tampil sekaligus:
 *   belum ada pesanan  -> tombol "Bayar dengan QRIS"
 *   pesanan pending    -> QR, nominal, dan formulir unggah bukti
 *   menunggu tinjauan  -> keterangan bahwa admin sedang memeriksa
 *
 * Tidak ada keadaan "lunas" di sini: begitu admin menyetujui, halaman kursus
 * merender tombol "Lanjutkan Belajar" dan komponen ini tidak dipanggil lagi.
 */
export default function ManualQrisPanel({
  slug,
  price,
  qrisUrl,
  qrisNote,
  order,
}: {
  slug: string;
  price: number;
  qrisUrl: string;
  qrisNote: string;
  /** Pesanan manual yang masih hidup, kalau ada. */
  order: {
    orderId: string;
    amount: number;
    status: "pending" | "awaiting_review";
  } | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function mulai() {
    setError(null);
    startTransition(async () => {
      const res = await createManualOrder(slug);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  async function pilihBerkas(file: File | null) {
    if (!file || !order) return;
    setError(null);

    const salah = validateImage(file);
    if (salah) return setError(salah);

    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) return setError("Sesi Anda berakhir. Muat ulang halaman ini.");

    setUploading(true);
    setFileName(file.name);
    try {
      setProofPath(await uploadPaymentProof(uid, order.orderId, file));
    } catch {
      setFileName(null);
      setError("Unggahan gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  function kirim() {
    if (!order || !proofPath) return;
    setError(null);
    startTransition(async () => {
      const res = await submitPaymentProof(order.orderId, proofPath, note);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  // ── Sudah dikirim, tinggal menunggu ────────────────────────────────
  if (order?.status === "awaiting_review") {
    return (
      <div className="rounded-lg border border-amber-700/25 bg-amber-100 px-4 py-3 text-sm text-amber-700">
        <p className="font-semibold">Bukti bayar sedang diperiksa.</p>
        <p className="mt-1">
          Akses kursus terbuka setelah admin memastikan pembayaran Anda masuk. Anda akan
          melihat tombol Lanjutkan Belajar di halaman ini begitu itu terjadi.
        </p>
      </div>
    );
  }

  // ── Belum ada pesanan ──────────────────────────────────────────────
  if (!order) {
    return (
      <>
        <button
          type="button"
          onClick={mulai}
          disabled={pending}
          className={cn(
            "w-full rounded-lg border border-rule px-6 py-3 text-sm font-semibold text-ink",
            "transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Menyiapkan…" : "Bayar dengan QRIS"}
        </button>
        {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
      </>
    );
  }

  // ── Pesanan hidup: tampilkan QR dan formulir bukti ─────────────────
  return (
    <div className="rounded-2xl border border-rule bg-paper-alt p-4">
      <p className="text-sm font-semibold text-ink mb-1">Bayar dengan QRIS</p>
      <p className="text-xs text-ink-muted mb-4">
        Pindai kode di bawah dengan aplikasi apa pun yang mendukung QRIS, lalu unggah
        buktinya.
      </p>

      {/* Gambar QRIS datang dari Storage dengan URL panjang — <img> biasa
          menghindarkan daftar remotePatterns. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrisUrl}
        alt="Kode QRIS pembayaran"
        className="w-full max-w-[15rem] mx-auto rounded-lg border border-rule bg-white"
      />

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Nominal</dt>
          <dd className="t-numeral text-base text-ink">{formatPrice(order.amount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">No. pesanan</dt>
          <dd className="text-xs text-ink-body break-all text-right">{order.orderId}</dd>
        </div>
      </dl>

      {/* Nominalnya bulat, tanpa kode unik. Kalimat ini yang menolong admin
          mencocokkan nanti — tanpa jam transfer, dua pembelian bernominal sama
          di hari yang sama praktis tidak bisa dibedakan. */}
      <p className="mt-3 text-xs text-ink-muted">
        Bayar tepat {formatPrice(price)}. Sebutkan jam transfer pada catatan supaya admin
        lebih cepat menemukannya.
      </p>

      {qrisNote && <p className="mt-2 text-xs text-ink-muted">{qrisNote}</p>}

      <div className="mt-4 border-t border-rule pt-4">
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void pilihBerkas(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || pending}
          className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
        >
          {uploading ? "Mengunggah…" : proofPath ? "Ganti Bukti" : "Pilih Bukti Bayar"}
        </button>

        {fileName && !uploading && (
          <p className="mt-2 text-xs text-ink-muted break-all">{fileName}</p>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Catatan, mis. jam transfer 14.05"
          className="mt-3 w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 resize-y placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
        />

        <button
          type="button"
          onClick={kirim}
          disabled={!proofPath || uploading || pending}
          className="mt-3 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Mengirim…" : "Kirim Bukti Bayar"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rust-700">{error}</p>}
    </div>
  );
}
