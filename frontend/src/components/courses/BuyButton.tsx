"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/paymentActions";
import { cn } from "@/lib/cn";

/**
 * Tombol beli kursus berbayar.
 *
 * Snap menampilkan sendiri pilihan QRIS, Virtual Account, dan e-wallet
 * lengkap dengan QR, hitung mundur, dan status pembayarannya — jadi komponen
 * ini tidak menggambar apa pun soal metode bayar.
 *
 * PENTING: `onSuccess` di bawah TIDAK memberi akses. Callback itu berjalan di
 * komputer pembeli dan bisa dipanggil siapa saja tanpa membayar. Akses hanya
 * ditulis webhook, setelah Midtrans mengonfirmasi ke server. Yang dilakukan
 * callback ini cuma menyegarkan halaman supaya hasilnya terlihat.
 */

/** Yang disuntikkan snap.js ke window. */
interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: SnapCallbacks) => void };
  }
}

const SANDBOX_SNAP = "https://app.sandbox.midtrans.com/snap/snap.js";
const PRODUCTION_SNAP = "https://app.midtrans.com/snap/snap.js";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

export default function BuyButton({
  slug,
  clientKey,
  production,
}: {
  slug: string;
  /** Client key MEMANG publik — ia harus ikut ke browser agar Snap berjalan. */
  clientKey: string;
  production: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Menahan pemuatan skrip supaya klik kedua tidak memuatnya dua kali.
  const loader = useRef<Promise<void> | null>(null);

  const loadSnap = useCallback((): Promise<void> => {
    if (window.snap) return Promise.resolve();
    if (loader.current) return loader.current;

    loader.current = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = production ? PRODUCTION_SNAP : SANDBOX_SNAP;
      script.setAttribute("data-client-key", clientKey);
      script.onload = () => resolve();
      script.onerror = () => {
        // Dilepas supaya percobaan berikutnya benar-benar mencoba lagi,
        // bukan mewarisi janji yang sudah gagal selamanya.
        loader.current = null;
        reject(new Error("snap.js gagal dimuat"));
      };
      document.head.appendChild(script);
    });

    return loader.current;
  }, [clientKey, production]);

  // Skrip dimuat sejak awal, bukan saat diklik: memuatnya setelah klik
  // menambah jeda beberapa detik antara tombol ditekan dan popup muncul,
  // yang terasa seperti tombol rusak.
  useEffect(() => {
    loadSnap().catch(() => undefined);
  }, [loadSnap]);

  async function buy() {
    setStatus({ kind: "working" });

    const res = await createOrder(slug);
    if (!res.ok) {
      setStatus({ kind: "error", message: res.error });
      return;
    }

    try {
      await loadSnap();
    } catch {
      setStatus({ kind: "error", message: "Halaman pembayaran gagal dimuat. Periksa koneksi Anda." });
      return;
    }

    if (!window.snap) {
      setStatus({ kind: "error", message: "Halaman pembayaran belum siap. Coba lagi." });
      return;
    }

    setStatus({ kind: "idle" });

    window.snap.pay(res.token, {
      // Pembayaran tercatat di server lewat webhook, yang bisa datang
      // sedetik setelah ini. Menyegarkan halaman menampilkan hasilnya.
      onSuccess: () => {
        setStatus({ kind: "waiting" });
        router.refresh();
      },
      // QRIS yang sudah dipindai tapi belum tuntas berakhir di sini.
      onPending: () => setStatus({ kind: "waiting" }),
      onError: () =>
        setStatus({ kind: "error", message: "Pembayaran gagal. Tidak ada dana yang terpotong." }),
      onClose: () => router.refresh(),
    });
  }

  return (
    <div>
      <button
        onClick={buy}
        disabled={status.kind === "working"}
        className={cn(
          "w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white",
          "transition-colors duration-200 ease-out-soft hover:bg-blue-700",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        {status.kind === "working" ? "Menyiapkan…" : "Beli Kursus Ini"}
      </button>

      {status.kind === "waiting" && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700"
        >
          Pembayaran sedang diproses. Akses terbuka otomatis begitu dana masuk —
          biasanya kurang dari satu menit.
        </p>
      )}

      {status.kind === "error" && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
