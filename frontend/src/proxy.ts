import { NextResponse, type NextRequest } from "next/server";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_DAYS,
  REFERRAL_PARAM,
  normalizeReferralCode,
  validateReferralCode,
} from "./lib/referralRules";

/**
 * Mengingat kode referral dari tautan bagikan `/courses/{slug}?ref=KODE`.
 *
 * Tautannya bisa dibuka hari ini dan kursusnya baru dibeli minggu depan, jadi
 * kodenya disimpan di cookie selama 30 hari. Tautan referral berikutnya yang
 * dibuka menimpa yang lama.
 *
 * Yang diperiksa di sini HANYA bentuk kodenya — tanpa membaca database, karena
 * proxy berjalan di setiap permintaan. Keberadaan kode, pemiliknya, dan
 * larangan memakai kode sendiri diperiksa server saat pesanan dibuat.
 */
export function proxy(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get(REFERRAL_PARAM);
  const res = NextResponse.next();

  if (raw) {
    const code = normalizeReferralCode(raw);
    if (validateReferralCode(code) === null) {
      res.cookies.set(REFERRAL_COOKIE, code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      });
    }
  }

  return res;
}

export const config = {
  matcher: "/courses/:path*",
};
