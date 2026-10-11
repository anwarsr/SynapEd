"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { paymentSettingsRef } from "@/lib/paymentSettings";
import { QRIS_IMAGES } from "@/lib/storagePaths";
import { validateRevenueSplit } from "@/lib/royaltyTerms";

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
 * Mengubah potongan platform dan bagian referral — SELALU bersamaan.
 *
 * Satu action untuk keduanya, supaya aturan "referral tidak lebih besar dari
 * potongan" diperiksa terhadap pasangan yang benar-benar akan tersimpan,
 * bukan terhadap angka lama di dokumen yang mungkin sudah diubah tab lain.
 *
 * Terpisah dari saklar metode pembayaran, supaya menyimpan saklar tidak ikut
 * mengirim ulang angka dari form yang basi.
 */
export async function updateRevenueSettings(input: {
  platformFeePercent: unknown;
  referralPercent: unknown;
}): Promise<SettingsResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat mengubah potongan platform." };
  }

  const invalid = validateRevenueSplit(input?.platformFeePercent, input?.referralPercent);
  if (invalid) return { ok: false, error: invalid };

  const platformFeePercent = input.platformFeePercent as number;
  const referralPercent = input.referralPercent as number;

  await paymentSettingsRef().set(
    {
      platformFeePercent,
      referralPercent,
      updatedAt: new Date().toISOString(),
      updatedByUid: admin.uid,
    },
    { merge: true },
  );

  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pendapatan");
  return {
    ok: true,
    message: `Potongan ${platformFeePercent}% dan referral ${referralPercent}% berlaku untuk pesanan berikutnya.`,
  };
}
