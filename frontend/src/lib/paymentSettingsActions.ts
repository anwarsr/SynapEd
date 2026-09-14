"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { paymentSettingsRef } from "@/lib/paymentSettings";
import { QRIS_IMAGES } from "@/lib/storagePaths";
import { parseFeePercent } from "@/lib/royaltyTerms";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_NOTE = 300;

/**
 * Menyimpan saklar metode pembayaran.
 *
 * Khusus admin, diperiksa di dalam action — bukan mengandalkan halamannya
 * tidak terbuka. Server Action bisa dipanggil lewat POST langsung, dan
 * menyalakan jalur pembayaran adalah hal terakhir yang boleh bisa dilakukan
 * sembarang orang.
 */
export async function updatePaymentSettings(input: {
  midtransEnabled: boolean;
  manualQrisEnabled: boolean;
  qrisImagePath: string | null;
  qrisNote: string;
}): Promise<SettingsResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat mengubah setelan pembayaran." };
  }

  const qrisImagePath =
    typeof input.qrisImagePath === "string" ? input.qrisImagePath.trim() : "";

  // Path dipaksa berada di folder QRIS. Tanpa penjaga ini, satu panggilan
  // mentah bisa menunjuk berkas mana pun di bucket — termasuk bukti bayar
  // milik orang lain — lalu menyiarkannya di halaman kursus, karena folder
  // QRIS memang boleh dibaca publik.
  if (qrisImagePath && !qrisImagePath.startsWith(`${QRIS_IMAGES}/`)) {
    return { ok: false, error: "Berkas QRIS tidak sah." };
  }

  const manualQrisEnabled = Boolean(input.manualQrisEnabled);
  if (manualQrisEnabled && !qrisImagePath) {
    return {
      ok: false,
      error: "Unggah dulu gambar QRIS sebelum menyalakan pembayaran QRIS manual.",
    };
  }

  await paymentSettingsRef().set(
    {
      midtransEnabled: Boolean(input.midtransEnabled),
      manualQrisEnabled,
      qrisImagePath: qrisImagePath || null,
      qrisNote: typeof input.qrisNote === "string" ? input.qrisNote.trim().slice(0, MAX_NOTE) : "",
      updatedAt: new Date().toISOString(),
      updatedByUid: admin.uid,
    },
    { merge: true },
  );

  // Halaman kursus merender tombol belinya dari setelan ini.
  revalidatePath("/admin/payments");
  revalidatePath("/courses", "layout");

  return { ok: true, message: "Setelan pembayaran tersimpan." };
}

/**
 * Mengubah potongan platform.
 *
 * Action terpisah dari saklar metode pembayaran, supaya menyimpan saklar
 * tidak pernah ikut mengirim ulang angka potongan dari form yang mungkin
 * sudah basi di tab lain.
 */
export async function updatePlatformFee(raw: unknown): Promise<SettingsResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat mengubah potongan platform." };
  }

  const feePercent = parseFeePercent(raw);
  if (feePercent === null) {
    return { ok: false, error: "Potongan harus bilangan bulat antara 0 dan 100." };
  }

  await paymentSettingsRef().set(
    {
      platformFeePercent: feePercent,
      updatedAt: new Date().toISOString(),
      updatedByUid: admin.uid,
    },
    { merge: true },
  );

  revalidatePath("/admin/payments");
  return { ok: true, message: `Potongan platform ${feePercent}% berlaku untuk pesanan berikutnya.` };
}
