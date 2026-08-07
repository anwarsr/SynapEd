/**
 * Memeriksa kesiapan "Masuk dengan Google" pada proyek Firebase.
 *
 * Hanya membaca — tidak mengubah apa pun. Berguna karena bagian ini tidak bisa
 * disetel dari kode: provider Google diaktifkan lewat Firebase Console, dan
 * kalau belum, tombolnya akan gagal dengan auth/operation-not-allowed.
 *
 *   npx tsx scripts/check-google-signin.ts
 *   npx tsx scripts/check-google-signin.ts seseorang@gmail.com
 *
 * Dengan email, skrip juga menampilkan metode masuk yang menempel pada akun
 * itu. Itulah cara tercepat melihat apa yang terjadi setelah sebuah akun
 * berkata sandi dipakai masuk lewat Google: apakah uid-nya tetap, dan apakah
 * kata sandinya masih ada.
 */
import { getAuth } from "firebase-admin/auth";
import { initAdmin, resolveProjectId, targetLabel } from "./project";

const projectId = resolveProjectId();
const app = initAdmin();

async function accessToken(): Promise<string> {
  const credential = app.options.credential;
  if (!credential) throw new Error("Kredensial Admin SDK tidak tersedia.");
  return (await credential.getAccessToken()).access_token;
}

async function get(path: string, token: string) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      // ADC berbasis akun pengguna tidak membawa proyek penagih sendiri;
      // tanpa header ini identitytoolkit menjawab 403.
      "x-goog-user-project": projectId,
    },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function main() {
  console.log(`\nMemeriksa ${targetLabel()}\n`);
  const token = await accessToken();

  // ── Provider ────────────────────────────────────────────────────
  const idps = await get(`projects/${projectId}/defaultSupportedIdpConfigs`, token);

  if (idps.status !== 200) {
    console.log(`  ! Tidak dapat membaca daftar provider (HTTP ${idps.status}).`);
    console.log(`    ${JSON.stringify(idps.body).slice(0, 300)}`);
  } else {
    const configs = (idps.body.defaultSupportedIdpConfigs ?? []) as Array<{
      name?: string;
      enabled?: boolean;
      clientId?: string;
    }>;

    const google = configs.find((c) => c.name?.endsWith("google.com"));

    if (!google) {
      console.log("  X Provider Google BELUM ditambahkan.");
    } else if (!google.enabled) {
      console.log("  X Provider Google sudah ada tetapi TIDAK aktif.");
    } else {
      console.log("  v Provider Google AKTIF.");
      console.log(`    client ID: ${google.clientId ?? "(tidak terbaca)"}`);
    }
  }

  // ── Domain & penanganan email ganda ─────────────────────────────
  const config = await get(`projects/${projectId}/config`, token);

  if (config.status !== 200) {
    console.log(`\n  ! Tidak dapat membaca konfigurasi (HTTP ${config.status}).`);
  } else {
    const domains = (config.body.authorizedDomains ?? []) as string[];
    console.log("\n  Domain yang diizinkan:");
    domains.forEach((d) => console.log(`    - ${d}`));
    console.log(
      domains.includes("localhost")
        ? "  v localhost termasuk — popup Google jalan saat pengembangan."
        : "  X localhost TIDAK termasuk — popup akan ditolak saat pengembangan.",
    );

    const signIn = config.body.signIn as { allowDuplicateEmails?: boolean } | undefined;
    console.log(
      signIn?.allowDuplicateEmails
        ? "\n  ! Email ganda DIIZINKAN — satu email bisa punya dua akun terpisah."
        : "\n  v Satu email = satu akun.",
    );
  }

  // ── Satu akun tertentu ──────────────────────────────────────────
  const email = process.argv[2];
  if (email) {
    const user = await getAuth(app).getUserByEmail(email).catch(() => null);

    console.log(`\n  Akun ${email}`);
    if (!user) {
      console.log("    tidak ditemukan.");
    } else {
      const providers = user.providerData.map((p) => p.providerId);
      console.log(`    uid           : ${user.uid}`);
      console.log(`    role          : ${(user.customClaims?.role as string) ?? "user"}`);
      console.log(`    email verified: ${user.emailVerified}`);
      console.log(`    metode masuk  : ${providers.join(", ") || "(tidak ada)"}`);

      if (!providers.includes("password")) {
        console.log("    ! Kata sandi TIDAK lagi menempel — akun ini hanya bisa masuk lewat Google.");
      }
    }
  }

  console.log();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
