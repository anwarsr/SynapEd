/**
 * Menambahkan domain ke daftar Authorized domains Firebase Authentication.
 *
 * Tanpa ini, masuk dengan Google GAGAL di domain tersebut dengan
 * auth/unauthorized-domain — gejala yang membingungkan, karena situsnya
 * terbuka normal dan hanya tombol Google-nya yang tidak berfungsi.
 *
 *   npx tsx scripts/authorize-domain.ts synaped--synap-ed.asia-southeast1.hosted.app
 *   npx tsx scripts/authorize-domain.ts            # hanya menampilkan daftarnya
 *
 * Aman dijalankan berkali-kali: domain yang sudah ada tidak digandakan.
 */
import { initAdmin, resolveProjectId, targetLabel } from "./project";

const projectId = resolveProjectId();
const app = initAdmin();

async function accessToken(): Promise<string> {
  const credential = app.options.credential;
  if (!credential) throw new Error("Kredensial Admin SDK tidak tersedia.");
  return (await credential.getAccessToken()).access_token;
}

const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

async function call(token: string, init?: RequestInit) {
  const res = await fetch(init?.method === "PATCH" ? `${BASE}?updateMask=authorizedDomains` : BASE, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // ADC berbasis akun pengguna tidak membawa proyek penagih sendiri;
      // tanpa header ini identitytoolkit menjawab 403.
      "x-goog-user-project": projectId,
    },
  });

  const body = (await res.json()) as { authorizedDomains?: string[]; error?: { message: string } };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.error?.message ?? "gagal"}`);
  return body;
}

async function main() {
  const domain = process.argv[2]?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  console.log(`\nTarget: ${targetLabel()}\n`);

  const token = await accessToken();
  const current = await call(token);
  const domains = current.authorizedDomains ?? [];

  console.log("Domain yang diizinkan sekarang:");
  domains.forEach((d) => console.log(`  - ${d}`));

  if (!domain) {
    console.log("\nBeri argumen domain untuk menambahkannya.\n");
    return;
  }

  if (domains.includes(domain)) {
    console.log(`\n"${domain}" sudah ada — tidak ada yang diubah.\n`);
    return;
  }

  // updateMask dipatok ke authorizedDomains saja. Tanpa mask, PATCH ke
  // endpoint config berisiko menimpa setelan lain yang tidak ikut dikirim.
  await call(token, {
    method: "PATCH",
    body: JSON.stringify({ authorizedDomains: [...domains, domain] }),
  });

  const after = await call(token);
  const ok = after.authorizedDomains?.includes(domain);

  console.log(`\n${ok ? "+" : "X"} "${domain}" ${ok ? "ditambahkan" : "GAGAL ditambahkan"}.`);
  console.log("\nDaftar terbaru:");
  after.authorizedDomains?.forEach((d) => console.log(`  - ${d}`));
  console.log();

  if (!ok) process.exit(1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
