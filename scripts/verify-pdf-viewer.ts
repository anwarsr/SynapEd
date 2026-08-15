/**
 * Menguji penampil PDF dan tata letak halaman belajar di peramban SUNGGUHAN.
 *
 * Harus peramban asli: PDF.js merender ke canvas dan seluruh yang diuji di
 * sini — jumlah halaman, ukuran canvas, lebar kolom — hanya ada setelah tata
 * letak dihitung. jsdom tidak menghitungnya, jadi semua pengukuran di sana
 * bernilai nol.
 *
 * Butuh dev server berjalan dan Chrome terpasang.
 *
 *   npx tsx scripts/verify-pdf-viewer.ts [baseUrl]
 */
import { existsSync } from "node:fs";
import { getFirestore } from "firebase-admin/firestore";
import puppeteer from "puppeteer-core";
import { BASE, COOKIE, app, auth, check, createTestUser, finish } from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
].find((p) => existsSync(p));

/**
 * Pelajaran berlampiran PDF, dari kursus dengan pelajaran TERBANYAK.
 *
 * Sengaja yang terpanjang: daftar materi harus cukup panjang untuk bisa
 * digulir, kalau tidak pengujian gulir terpisah di bawah tidak membuktikan
 * apa-apa.
 */
async function findPdfLesson() {
  const snap = await db.collection("courses").get();

  let best: { course: string; lesson: string; lessons: number } | null = null;

  for (const doc of snap.docs) {
    const sections = doc.data().sections ?? [];
    const total = sections.reduce(
      (n: number, s: { lessons?: unknown[] }) => n + (s.lessons?.length ?? 0),
      0,
    );

    for (const section of sections) {
      for (const lesson of section.lessons ?? []) {
        const pdf = (lesson.attachments ?? []).find((a: { name?: string }) =>
          String(a.name ?? "").toLowerCase().endsWith(".pdf"),
        );
        if (pdf && (!best || total > best.lessons)) {
          best = { course: doc.id, lesson: lesson.slug as string, lessons: total };
        }
      }
    }
  }
  return best;
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  if (!CHROME) {
    console.error("Chrome tidak ditemukan — pengujian ini butuh peramban sungguhan.");
    process.exit(1);
  }

  const target = await findPdfLesson();
  if (!target) {
    console.error("Tidak ada pelajaran berlampiran PDF untuk diuji.");
    process.exit(0);
  }

  console.log(`kursus  : ${target.course}`);
  console.log(`pelajaran: ${target.lesson}\n`);

  // Admin punya akses penuh ke kursus mana pun tanpa perlu mendaftar.
  const admin = await createTestUser("admin");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1000 });

    // Galat runtime apa pun dicatat. Bug pertama penampil ini justru muncul
    // saat komponennya DILEPAS, bukan saat dimuat — memeriksa halaman yang
    // baru terbuka saja tidak akan pernah menemukannya.
    const errors: string[] = [];
    page.on("pageerror", (e: unknown) =>
      errors.push(e instanceof Error ? e.message : String(e)),
    );

    // console.error juga dicatat, BUKAN hanya exception. Peringatan React —
    // atribut yang salah bentuk, kunci ganda, keadaan yang tidak sinkron —
    // semuanya lewat sini dan tidak pernah melempar; memantau exception saja
    // membuat kelas kesalahan itu tak terlihat sampai dilaporkan pengguna.
    const warnings: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") warnings.push(m.text());
    });

    const url = new URL(BASE);
    await page.setCookie({ name: COOKIE, value: admin.cookie, domain: url.hostname, path: "/" });

    await page.goto(`${BASE}/courses/${target.course}/learn/${target.lesson}`, {
      waitUntil: "networkidle0",
    });

    // Halaman pertama baru muncul setelah worker mengurai dokumennya.
    await page.waitForSelector("[data-page='1'] canvas", { timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 2500));

    const before = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-page='1'] canvas");
      return {
        pages: document.querySelectorAll("[data-page]").length,
        canvasPainted: (canvas?.width ?? 0) > 0 && (canvas?.height ?? 0) > 0,
        // Bilah alat sendiri, bukan bawaan peramban.
        hasToolbar: Boolean(document.querySelector("[aria-label='Halaman berikutnya']")),
        // Viewer bawaan selalu dalam <iframe>; milik kita tidak.
        noBrowserViewer: document.querySelectorAll("iframe[src*='/asset']").length === 0,
        railVisible: Boolean(
          document.querySelector("aside")?.getBoundingClientRect().width,
        ),
        contentWidth: Math.round(
          document.querySelector("main > div")?.getBoundingClientRect().width ?? 0,
        ),
      };
    });

    check("PDF dirender sendiri, bukan viewer bawaan", before.noBrowserViewer, "tanpa iframe");
    check("bilah alat SynapEd tersedia", before.hasToolbar, "tombol navigasi sendiri");
    check("halaman pertama benar-benar tergambar", before.canvasPainted, "canvas terisi");
    check("seluruh halaman terdaftar", before.pages > 1, `${before.pages} halaman`);
    check("daftar materi awalnya tampil", before.railVisible, "rail terlihat");

    // ── Gulir terpisah ────────────────────────────────────────────
    //
    // Jendela dipendekkan dulu: dengan layar tinggi, daftar materi kursus ini
    // muat seluruhnya sehingga tidak ada yang bisa digulir, dan pengujian arah
    // sebaliknya tidak membuktikan apa pun.
    await page.setViewport({ width: 1400, height: 420 });
    await new Promise((r) => setTimeout(r, 400));

    const scroll = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("main");
      const rail = document.querySelector<HTMLElement>("aside > div");
      if (!main || !rail) return null;

      // Halaman itu sendiri tidak boleh ikut bergulir — kalau ia yang
      // bergerak, keduanya pasti bergerak bersama.
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 1;

      main.scrollTop = 400;
      const railAfterMain = rail.scrollTop;

      rail.scrollTop = 200;
      const mainAfterRail = main.scrollTop;

      return {
        pageScrolls,
        railCanScroll: rail.scrollHeight > rail.clientHeight + 1,
        mainCanScroll: main.scrollHeight > main.clientHeight + 1,
        mainMoved: main.scrollTop,
        railAfterMain,
        mainAfterRail,
        railMoved: rail.scrollTop,
      };
    });

    check("elemen halaman ditemukan", scroll !== null, "main & rail");

    if (scroll) {
      check(
        "halaman itu sendiri tidak bergulir",
        !scroll.pageScrolls,
        "tinggi dipatok layar, bukan mengikuti isi",
      );
      check(
        "keduanya memang bisa digulir sendiri",
        scroll.railCanScroll && scroll.mainCanScroll,
        `rail=${scroll.railCanScroll} materi=${scroll.mainCanScroll}`,
      );
      check(
        "menggulir materi tidak menggeser daftar",
        scroll.mainMoved > 0 && scroll.railAfterMain === 0,
        `materi=${scroll.mainMoved} daftar=${scroll.railAfterMain}`,
      );
      check(
        "menggulir daftar tidak menggeser materi",
        scroll.railMoved > 0 && scroll.mainAfterRail === scroll.mainMoved,
        `daftar=${scroll.railMoved} materi tetap=${scroll.mainAfterRail}`,
      );
    }

    await page.setViewport({ width: 1500, height: 1000 });
    await new Promise((r) => setTimeout(r, 400));

    // ── Animasi ───────────────────────────────────────────────────
    const anim = await page.evaluate(() => {
      const aside = document.querySelector<HTMLElement>("aside");
      if (!aside) return null;
      const s = getComputedStyle(aside);
      return { property: s.transitionProperty, duration: s.transitionDuration };
    });

    check(
      "penciutan dianimasikan, bukan hilang seketika",
      Boolean(anim?.property.includes("width")) && anim?.duration !== "0s",
      `${anim?.property} / ${anim?.duration}`,
    );

    // ── Menciutkan daftar materi ──────────────────────────────────
    await page.click("[aria-label='Sembunyikan daftar materi']");
    await new Promise((r) => setTimeout(r, 700));

    const after = await page.evaluate(() => ({
      railVisible: Boolean(document.querySelector("aside")?.getBoundingClientRect().width),
      contentWidth: Math.round(
        document.querySelector("main > div")?.getBoundingClientRect().width ?? 0,
      ),
    }));

    check("daftar materi bisa diciutkan", !after.railVisible, "rail tersembunyi");
    check(
      "kolom materi jadi lebih luas",
      after.contentWidth > before.contentWidth,
      `${before.contentWidth}px -> ${after.contentWidth}px`,
    );

    // Daftar materi harus SELALU terbuka saat kelas dibuka. Membukanya dalam
    // keadaan terciut membuat orang kehilangan pegangan di mana dirinya
    // berada — jadi pilihan ciut sengaja tidak diingat antar kunjungan.
    await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));

    const reloaded = await page.evaluate(() =>
      Boolean(document.querySelector("aside")?.getBoundingClientRect().width),
    );
    check("kelas selalu dibuka dengan daftar materi terbuka", reloaded, "tidak diingat terciut");

    // ── Pindah pelajaran: di sinilah penampilnya dilepas ───────────
    // Railnya sudah terbuka sendiri setelah muat ulang. Diciutkan lagi lebih
    // dulu supaya sekalian terbukti: pilihan itu bertahan selama menjelajah
    // antar pelajaran, dan hanya kembali terbuka saat kelas dibuka lagi.
    await page.waitForSelector("[data-page='1'] canvas", { timeout: 60_000 });
    await page.click("[aria-label='Sembunyikan daftar materi']");
    await new Promise((r) => setTimeout(r, 700));

    const from = new URL(page.url()).pathname;

    const moved = await page.evaluate(() => {
      const here = window.location.pathname;
      // Rail-nya terciut (lebar 0), jadi tautannya diambil dari DOM langsung
      // lalu diklik — tidak bisa mengandalkan klik lewat kursor.
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("aside a"));
      const other = links.find((a) => new URL(a.href).pathname !== here);
      other?.click();
      return Boolean(other);
    });

    // Ditunggu sampai alamatnya BENAR-BENAR berganti, bukan menunggu sekian
    // detik lalu berharap. Navigasi di sini memuat dokumen PDF berikutnya dan
    // bisa makan waktu lebih lama dari tebakan mana pun — pemeriksaan yang
    // keburu jalan hanya membaca halaman lama lalu lulus secara palsu, dan
    // itulah yang sempat terjadi.
    await page
      .waitForFunction((prev: string) => window.location.pathname !== prev, { timeout: 30_000 }, from)
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 1200));

    const now = new URL(page.url()).pathname;
    check("bisa pindah pelajaran", moved && now !== from, `${from} -> ${now}`);

    const stillHidden = await page.evaluate(
      () => !document.querySelector("aside")?.getBoundingClientRect().width,
    );
    check(
      "pilihan ciut bertahan saat pindah pelajaran",
      stillHidden,
      "tidak membuka sendiri tiap ganti materi",
    );
    check(
      "tidak ada galat runtime saat penampil dilepas",
      errors.length === 0,
      errors.length ? errors[0].slice(0, 120) : "bersih",
    );
    check(
      "konsol bersih dari peringatan React",
      warnings.length === 0,
      warnings.length ? `${warnings.length}: ${warnings[0].slice(0, 110)}` : "tanpa console.error",
    );
  } finally {
    await browser.close();
    await auth.deleteUser(admin.uid).catch(() => undefined);
    console.log("\nakun uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
