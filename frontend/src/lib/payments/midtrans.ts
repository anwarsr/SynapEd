import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { OrderStatus } from "@/lib/orders";

/**
 * Satu-satunya berkas yang tahu apa itu Midtrans.
 *
 * Sengaja dikurung: SynapEd belum punya badan usaha, sementara Midtrans dan
 * Xendit umumnya mewajibkan dokumen badan usaha untuk akun PRODUKSI. Kalau
 * nanti harus pindah ke penyedia yang menerima perorangan (Duitku, Tripay,
 * Mayar), yang berubah cukup berkas ini — bukan alur pesanan, bukan webhook,
 * bukan pendaftaran kursus.
 *
 * Karena itu tidak ada satu pun tipe atau istilah khas Midtrans yang bocor
 * keluar dari sini; yang keluar hanya bentuk yang netral.
 */

const SANDBOX = "https://app.sandbox.midtrans.com";
const PRODUCTION = "https://app.midtrans.com";

// Snap dan Core API tinggal di HOST YANG BERBEDA. Menembak /v2/... ke host
// Snap menghasilkan 404 yang terlihat seperti "transaksinya tidak ada",
// padahal yang salah cuma alamatnya.
const SANDBOX_API = "https://api.sandbox.midtrans.com";
const PRODUCTION_API = "https://api.midtrans.com";

interface Config {
  serverKey: string;
  baseUrl: string;
  apiUrl: string;
}

/**
 * Server key TIDAK boleh berawalan NEXT_PUBLIC_.
 *
 * Berbeda dari apiKey Firebase yang memang tampil di browser dan bukan
 * rahasia, kunci ini adalah kredensial penuh: siapa pun yang memegangnya bisa
 * membuat transaksi, membaca data pembayaran, dan memalsukan tanda tangan
 * notifikasi — yang berarti memberi dirinya sendiri akses ke seluruh kursus
 * berbayar.
 */
function config(): Config | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return null;

  const produksi = process.env.MIDTRANS_IS_PRODUCTION === "true";

  return {
    serverKey,
    baseUrl: produksi ? PRODUCTION : SANDBOX,
    apiUrl: produksi ? PRODUCTION_API : SANDBOX_API,
  };
}

/** Sudah dikonfigurasi? Dipakai UI untuk tidak menampilkan tombol yang pasti gagal. */
export function paymentsConfigured(): boolean {
  return config() !== null && Boolean(process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.trim());
}

// ── Membuat transaksi ───────────────────────────────────────────────────

/** Batas Midtrans: nama item maksimal 50 karakter, dan ditolak kalau lebih. */
const MAX_ITEM_NAME = 50;

export interface NewTransaction {
  orderId: string;
  amount: number;
  itemId: string;
  itemName: string;
  customerName: string | null;
  customerEmail: string | null;
  /** Menit sampai QR/VA hangus. */
  expiryMinutes: number;
}

/**
 * Menerbitkan token Snap.
 *
 * Snap dipilih, bukan Core API: satu token menghasilkan popup yang sudah
 * memuat QRIS, Virtual Account, dan e-wallet sekaligus — termasuk penampil QR,
 * hitung mundur, dan status pembayarannya. Lewat Core API semua itu harus
 * digambar sendiri.
 */
export async function createSnapTransaction(input: NewTransaction): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("MIDTRANS_SERVER_KEY belum disetel.");

  // gross_amount WAJIB sama persis dengan jumlah item_details, kalau tidak
  // Midtrans menolak transaksinya. Karena kursusnya selalu satu dengan
  // kuantitas satu, keduanya memang nilai yang sama.
  const body = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.amount,
    },
    item_details: [
      {
        id: input.itemId.slice(0, 50),
        price: input.amount,
        quantity: 1,
        name: input.itemName.slice(0, MAX_ITEM_NAME),
      },
    ],
    customer_details: {
      first_name: (input.customerName ?? "Peserta").slice(0, 50),
      email: input.customerEmail ?? undefined,
    },
    expiry: { unit: "minutes", duration: input.expiryMinutes },
  };

  const res = await fetch(`${cfg.baseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Midtrans memakai Basic auth dengan server key sebagai username dan
      // kata sandi kosong — titik dua di akhir itu wajib.
      Authorization: `Basic ${Buffer.from(`${cfg.serverKey}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    token?: string;
    error_messages?: string[];
  };

  if (!res.ok || !json.token) {
    throw new Error(json.error_messages?.join("; ") ?? `Midtrans menjawab ${res.status}`);
  }
  return json.token;
}

/**
 * Menghanguskan transaksi yang belum dibayar.
 *
 * Dipakai saat harga kursusnya berubah sementara pesanan lama masih hidup:
 * token lama tetap bisa dibayar sampai kedaluwarsa, dan siapa pun yang
 * masih membuka popup lamanya akan membayar harga yang sudah tidak berlaku.
 *
 * TIDAK melempar galat. Kegagalan di sini tidak boleh menghalangi pesanan
 * baru dibuat — penjaga yang sesungguhnya ada di sisi kita, yang berhenti
 * membagikan token lamanya. Ini lapis kedua, bukan satu-satunya.
 *
 * Mengembalikan true kalau Midtrans benar-benar menghanguskannya.
 */
export async function expireTransaction(orderId: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;

  try {
    const res = await fetch(`${cfg.apiUrl}/v2/${encodeURIComponent(orderId)}/expire`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${cfg.serverKey}:`).toString("base64")}`,
      },
    });

    // Kodenya dibaca dari BADAN jawaban, bukan dari status HTTP.
    //
    // Midtrans menjawab HTTP 200 bahkan saat transaksinya tidak ada —
    // kegagalannya diletakkan di dalam badan sebagai {"status_code":"404"}.
    // Mengandalkan res.ok membuat fungsi ini selalu melapor berhasil.
    const json = (await res.json().catch(() => null)) as {
      status_code?: unknown;
      status_message?: unknown;
    } | null;

    const kode = String(json?.status_code ?? res.status);

    // 200 = baru dihanguskan, 407 = memang sudah kedaluwarsa. Keduanya
    // berarti token itu tidak bisa dibayar lagi, dan itulah yang kita mau.
    if (kode === "200" || kode === "407") return true;

    // 404 itu WAJAR, bukan kegagalan: pembeli yang menutup popup tanpa
    // memilih metode pembayaran tidak pernah membuat transaksi apa pun di
    // Midtrans — yang ada baru tokennya.
    if (kode === "404") return false;

    console.warn(
      `[payment] gagal menghanguskan ${orderId}: ${kode} ${String(json?.status_message ?? "")}`,
    );
    return false;
  } catch (e) {
    console.warn(`[payment] gagal menghanguskan ${orderId}:`, e);
    return false;
  }
}

// ── Memeriksa notifikasi ────────────────────────────────────────────────

/** Bentuk notifikasi yang kita pedulikan; sisanya diabaikan. */
export interface Notification {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  fraud_status?: unknown;
  payment_type?: unknown;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Memeriksa keaslian notifikasi.
 *
 * Webhook adalah endpoint PUBLIK tanpa cookie sesi — tanda tangan inilah
 * satu-satunya autentikasinya. Tanpa pemeriksaan ini, siapa pun yang menebak
 * URL-nya bisa mengirim "sudah lunas" untuk pesanan mana pun dan memberi
 * dirinya akses ke seluruh kursus berbayar.
 *
 * Rumusnya: sha512(order_id + status_code + gross_amount + serverKey).
 * gross_amount ikut ditandatangani, jadi mengubah nominal juga merusak
 * tanda tangannya.
 */
export function verifySignature(payload: Notification): boolean {
  const cfg = config();
  if (!cfg) return false;

  const claimed = str(payload.signature_key);
  if (!claimed) return false;

  const expected = createHash("sha512")
    .update(
      str(payload.order_id) + str(payload.status_code) + str(payload.gross_amount) + cfg.serverKey,
    )
    .digest("hex");

  // Perbandingan waktu-tetap: `===` pada string keluar lebih cepat saat
  // karakter pertama berbeda, dan selisih waktu itu bisa dipakai menebak
  // tanda tangan karakter demi karakter.
  const a = Buffer.from(claimed, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Status Midtrans -> status pesanan kita.
 *
 * `capture` khusus kartu kredit dan BELUM tentu lunas: kalau
 * fraud_status-nya "challenge", transaksinya menunggu peninjauan manual dan
 * memperlakukannya sebagai lunas berarti memberi akses atas uang yang bisa
 * dibatalkan.
 */
export function normalizeStatus(payload: Notification): OrderStatus {
  const status = str(payload.transaction_status);
  const fraud = str(payload.fraud_status);

  if (status === "settlement") return "paid";
  if (status === "capture") return fraud === "challenge" ? "pending" : "paid";
  if (status === "pending") return "pending";
  if (status === "expire") return "expired";

  // deny, cancel, failure, dan apa pun yang tidak dikenal.
  return "failed";
}

export function paymentTypeOf(payload: Notification): string | null {
  return str(payload.payment_type) || null;
}

export function orderIdOf(payload: Notification): string {
  return str(payload.order_id);
}

/** Nominal yang diklaim notifikasi. Midtrans mengirimnya sebagai "50000.00". */
export function amountOf(payload: Notification): number {
  return Number(str(payload.gross_amount));
}
