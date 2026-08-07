/**
 * Menguji halaman profil untuk akun yang TIDAK punya kata sandi — keadaan yang
 * muncul setelah akun berkata sandi masuk lewat Google dan kredensial lamanya
 * dilepas Firebase.
 *
 * Akun uji dibuat berkata sandi (supaya bisa masuk dan mendapat session
 * cookie), lalu kata sandinya dilepas lewat Admin SDK sehingga keadaannya sama
 * persis dengan akun Google-saja.
 *
 *   npx tsx scripts/verify-google-account.ts [baseUrl]
 */
import { BASE, auth, check, createTestUser, finish, freshCookie, probeText } from "./testSupport";
import { targetLabel } from "./project";

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const berkatasandi = await createTestUser("user", "berkatasandi");
  const tanpaSandi = await createTestUser("user", "tanpasandi");

  console.log(`berkata sandi : ${berkatasandi.email}`);
  console.log(`tanpa sandi   : ${tanpaSandi.email}\n`);

  try {
    // ── Akun biasa: perilaku lama tidak boleh berubah ──────────────
    {
      const page = await probeText("/dashboard", berkatasandi.cookie);
      check("akun berkata sandi -> 200", page.status === 200, String(page.status));
      check(
        "menawarkan Ganti Kata Sandi",
        page.html.includes("Ganti Kata Sandi") && !page.html.includes("Buat Kata Sandi"),
        "form kata sandi versi biasa",
      );
      // "Email baru" adalah label khas form ganti email — tidak dipakai kartu
      // lain, jadi aman dipakai sebagai penanda keberadaannya.
      check("form ganti email tersedia", page.html.includes("Email baru"), "email bisa diubah");
      // Isi form hapus akun ada di balik tombol dan baru dirender setelah
      // diklik, jadi cara konfirmasinya tidak bisa diperiksa dari HTML server —
      // yang bisa dipastikan hanya bagiannya ada.
      check(
        "bagian hapus akun tersedia",
        page.html.includes("Saya ingin menghapus akun"),
        "tombol pembuka",
      );
    }

    // ── Lepas kata sandinya, tiru akun Google-saja ─────────────────
    await auth.updateUser(tanpaSandi.uid, { providersToUnlink: ["password"] });

    const after = await auth.getUser(tanpaSandi.uid);
    check(
      "kata sandi benar-benar terlepas",
      !after.providerData.some((p) => p.providerId === "password"),
      after.providerData.map((p) => p.providerId).join(", ") || "(tidak ada metode masuk)",
    );

    {
      const page = await probeText("/dashboard", tanpaSandi.cookie);
      check("akun tanpa kata sandi -> 200", page.status === 200, String(page.status));

      check(
        "menawarkan Buat Kata Sandi",
        page.html.includes("Buat Kata Sandi"),
        "jalan keluar memulihkan masuk dengan kata sandi",
      );
      check(
        "tidak meminta kata sandi saat ini",
        !page.html.includes("Kata sandi saat ini"),
        "tidak mungkin diisi oleh akun ini",
      );
      check(
        "ganti email dijelaskan, bukan disodorkan rusak",
        page.html.includes("mengikuti akun") && !page.html.includes("Email baru"),
        "form email diganti keterangan",
      );
      check(
        "bagian hapus akun tetap tersedia",
        page.html.includes("Saya ingin menghapus akun"),
        "tombol pembuka",
      );
    }

    // ── Kartu "Cara Masuk" ────────────────────────────────────────
    {
      // Baru dibuat, email belum diverifikasi: inilah keadaan yang membuat
      // kata sandi terlepas saat masuk lewat Google.
      const belum = await createTestUser("user", "belumverif");

      const page = await probeText("/dashboard", belum.cookie);
      check(
        "email belum diverifikasi -> ada peringatan",
        page.html.includes("Email belum diverifikasi") &&
          page.html.includes("Kirim Tautan Verifikasi"),
        "peringatan beserta tombolnya",
      );
      check(
        "menawarkan Tautkan Akun Google",
        page.html.includes("Tautkan Akun Google"),
        "jalur menambah tanpa kehilangan kata sandi",
      );
      check(
        "menyebut menautkan itu aman",
        page.html.includes("Kata sandi Anda tetap bisa dipakai"),
        "membedakannya dari masuk lewat Google",
      );

      // Setelah diverifikasi, peringatannya harus hilang.
      await auth.updateUser(belum.uid, { emailVerified: true });
      const sudah = await probeText("/dashboard", await freshCookie(belum.email, belum.password));
      check(
        "email terverifikasi -> peringatan hilang",
        !sudah.html.includes("Email belum diverifikasi"),
        "tidak lagi berisiko",
      );

      // Google tertaut: tombol tautkan tidak boleh muncul lagi.
      await auth.updateUser(belum.uid, {
        providerToLink: {
          providerId: "google.com",
          uid: `google-uid-${belum.uid}`,
          email: belum.email,
        },
      });
      const tertaut = await probeText("/dashboard", await freshCookie(belum.email, belum.password));
      check(
        "Google tertaut -> tombol tautkan hilang",
        !tertaut.html.includes("Tautkan Akun Google"),
        "tidak menawarkan yang sudah ada",
      );
      check(
        "kata sandi TETAP ada setelah Google ditautkan",
        (await auth.getUser(belum.uid)).providerData.some((p) => p.providerId === "password"),
        "menautkan bersifat menambah, bukan mengganti",
      );

      await auth.deleteUser(belum.uid);
    }

    // ── Halaman masuk ─────────────────────────────────────────────
    {
      const login = await probeText("/login");
      check("halaman masuk punya tombol Google", login.html.includes("Masuk dengan Google"), "/login");
      check("halaman masuk punya Lupa kata sandi", login.html.includes("Lupa kata sandi?"), "/login");

      const register = await probeText("/register");
      check(
        "halaman daftar punya tombol Google",
        register.html.includes("Daftar dengan Google"),
        "/register",
      );
      check(
        "halaman daftar tidak menawarkan Lupa kata sandi",
        !register.html.includes("Lupa kata sandi?"),
        "hanya relevan saat masuk",
      );
    }
  } finally {
    await auth.deleteUsers([berkatasandi.uid, tanpaSandi.uid]);
    console.log("\nakun uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
