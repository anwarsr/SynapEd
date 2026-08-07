import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { GOOGLE_PROVIDER, PASSWORD_PROVIDER } from "@/lib/providerIds";

export interface SignInMethods {
  password: boolean;
  google: boolean;
}

/**
 * Metode masuk yang menempel pada sebuah akun.
 *
 * Tidak ikut ditaruh di dalam session cookie: cookie itu dibaca pada SETIAP
 * halaman terproteksi, dan menambah satu panggilan ke Firebase di sana berarti
 * memperlambat seluruh aplikasi demi satu halaman yang membutuhkannya.
 */
export async function getSignInMethods(uid: string): Promise<SignInMethods> {
  const user = await adminAuth().getUser(uid).catch(() => null);
  const ids = user?.providerData.map((p) => p.providerId) ?? [];

  return {
    password: ids.includes(PASSWORD_PROVIDER),
    google: ids.includes(GOOGLE_PROVIDER),
  };
}
