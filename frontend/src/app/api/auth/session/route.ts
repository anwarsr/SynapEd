import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/session";
import { ensureUsername } from "@/lib/usernames";

/**
 * Menukar ID token Firebase (dari SDK klien) menjadi session cookie httpOnly.
 *
 * ID token hanya berlaku 1 jam dan tersimpan di tempat yang bisa dibaca
 * JavaScript. Session cookie berlaku lebih lama, httpOnly sehingga kebal XSS,
 * dan bisa diverifikasi Server Component.
 */
export async function POST(request: Request) {
  let idToken: string | undefined;

  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    return NextResponse.json({ message: "Body tidak valid." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ message: "idToken wajib diisi." }, { status: 400 });
  }

  try {
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    // Setiap cara masuk melewati rute ini, jadi di sinilah akun baru — dan
    // akun lama yang terlewat backfill — mendapat username. Kegagalannya
    // hanya dicatat: tidak punya username bukan alasan untuk gagal masuk,
    // dan login berikutnya akan mencobanya lagi.
    try {
      const { uid } = await adminAuth().verifySessionCookie(sessionCookie);
      const hasil = await ensureUsername(uid);
      if (!hasil.ok) console.error(`[auth/session] username untuk ${uid}:`, hasil.error);
    } catch (err) {
      console.error("[auth/session] ensureUsername gagal:", err);
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return res;
  } catch (err) {
    // Alasannya dicatat di server, TIDAK dikirim ke browser.
    //
    // Yang sampai ke pengguna tetap kalimat umum: pesan Firebase bisa
    // menyebutkan project id, umur token, atau kekurangan izin service
    // account — keterangan yang berguna untuk menyerang, bukan untuk masuk.
    //
    // Sebelumnya blok ini `catch {}` tanpa nama, jadi kegagalan apa pun
    // tampil di layar hanya sebagai "Sesi gagal dibuat" dan tidak
    // meninggalkan jejak sama sekali di terminal.
    console.error("[auth/session] createSessionCookie gagal:", err);

    return NextResponse.json(
      { message: "Sesi tidak dapat dibuat. Silakan masuk lagi." },
      { status: 401 },
    );
  }
}

/** Keluar: cabut refresh token di Firebase lalu hapus cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });

  try {
    const { cookies } = await import("next/headers");
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;

    if (cookie) {
      const claims = await adminAuth().verifySessionCookie(cookie, false);
      // Tanpa ini, session cookie lain milik akun yang sama tetap hidup.
      await adminAuth().revokeRefreshTokens(claims.sub);
    }
  } catch {
    // Cookie sudah tidak sah — tetap lanjut menghapusnya.
  }

  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
