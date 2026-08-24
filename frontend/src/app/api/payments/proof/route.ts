import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getOrder } from "@/lib/orders";
import { PAYMENT_PROOFS } from "@/lib/storagePaths";

/**
 * Menyajikan bukti bayar sebuah pesanan.
 *
 * Berkasnya tertutup di storage.rules (`allow read: if false`), jadi tidak ada
 * URL yang bisa dibagikan atau ditebak. Satu-satunya jalan masuk adalah route
 * ini — pola yang sama dengan /api/courses/[slug]/asset.
 *
 * Yang diminta pemanggil adalah `orderId`, BUKAN path berkas. Itu disengaja:
 * kalau path yang diterima, penjaganya harus menebak berkas ini milik pesanan
 * siapa, dan tebakan semacam itu selalu bisa dikelabui. Dengan orderId, yang
 * berwenang dibaca langsung dari dokumen pesanannya.
 */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ message: "Parameter orderId wajib diisi." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const order = await getOrder(orderId);
  if (!order?.proofPath) {
    return NextResponse.json({ message: "Bukti bayar tidak ditemukan." }, { status: 404 });
  }

  // Admin meninjau; pembeli boleh melihat kembali buktinya sendiri. Selain
  // keduanya, tidak ada.
  const berhak = user.role === "admin" || user.uid === order.uid;
  if (!berhak) {
    return NextResponse.json({ message: "Anda tidak berhak melihat berkas ini." }, { status: 403 });
  }

  // Penjaga kedua. Path tersimpan sudah diperiksa awalannya saat ditulis, tapi
  // dokumen bisa saja disunting langsung lewat Console — dan tanpa baris ini,
  // route ini berubah jadi pembaca isi bucket mana pun.
  if (!order.proofPath.startsWith(`${PAYMENT_PROOFS}/${order.uid}/`)) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  const file = adminStorage().bucket().file(order.proofPath);

  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": metadata.contentType ?? "image/jpeg",
      "Content-Length": String(buffer.length),
      "Content-Disposition": "inline",
      // Berisi data rekening orang. Cache bersama seperti CDN tidak boleh
      // menyimpannya.
      "Cache-Control": "private, no-store",
    },
  });
}
