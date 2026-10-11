"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/paymentActions";
import { useReferralCode } from "./ReferralField";
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
    snap?: { pay: (token: string, callbacks?: SnapCallbacks) => void; hide?: () => void };
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
  const referralCode = useReferralCode();
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

  /**
   * Membuka popup Snap.
   *
   * `snap.pay` MELEMPAR galat — bukan memanggil onError — kalau Snap masih
   * menganggap popup sebelumnya terbuka ("Invalid state transition from
   * PopupInView to PopupInView"). Dulu galat itu tidak ditangkap: tombolnya
   * diam, tanpa popup dan tanpa pesan, padahal pesanannya sudah dibuat di
   * server. Keadaan basi itu ditutup dulu lewat `snap.hide()`, lalu dicoba
   * sekali lagi.
   */
  async function openSnap(token: string, callbacks: SnapCallbacks): Promise<void> {
    const snap = window.snap;
    if (!snap) throw new Error("snap belum dimuat");
    try {
      snap.pay(token, callbacks);
    } catch (first) {
      console.warn("[payment] snap.pay ditolak, mencoba ulang:", first);
      snap.hide?.();
      await new Promise((r) => setTimeout(r, 400));
      snap.pay(token, callbacks);
    }
  }

  async function buy() {
    // Klik kedua selagi yang pertama berjalan akan memanggil snap.pay dua kali.
    if (status.kind === "working") return;
    setStatus({ kind: "working" });

    let res: Awaited<ReturnType<typeof createOrder>>;
    try {
      res = await createOrder(slug, referralCode);
    } catch {
      setStatus({ kind: "error", message: "Pesanan gagal dibuat. Periksa koneksi lalu coba lagi." });
      return;
    }
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

    try {
      await openSnap(res.token, {
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
      setStatus({ kind: "idle" });
    } catch (err) {
      console.error("[payment] popup pembayaran gagal dibuka:", err);
      setStatus({
        kind: "error",
        message: "Halaman pembayaran gagal dibuka. Muat ulang halaman ini lalu coba lagi.",
      });
    }
  }

  return (
    <div>
      <button
        onClick={buy}
        disabled={status.kind === "working"}
        className={cn(
          "w-full bg-blue-600 px-6 py-3 text-sm font-medium text-white",
          "transition-colors duration-200 ease-out-soft hover:bg-blue-700",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        {status.kind === "working" ? "Menyiapkan…" : "Beli Kursus Ini"}
      </button>

      {status.kind === "waiting" && (
        <p
          role="status"
          className="mt-3 bg-blue-500/15 px-4 py-3 text-sm text-blue-200"
        >
          Pembayaran sedang diproses. Akses terbuka otomatis begitu dana masuk -
          biasanya kurang dari satu menit.
        </p>
      )}

      {status.kind === "error" && (
        <p
          role="status"
          className="mt-3 bg-[#E0795A]/15 px-4 py-3 text-sm text-error-text"
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
