/**
 * Menguji soal TABEL dan quiz KELOMPOK: aturan murni lebih dulu, lalu alur penuh lewat dev server
 * (npm run dev) - membuat quiz, mulai dengan/ tanpa nama kelompok, mengisi tabel, menilai. Sel isian tabel
 * TIDAK punya kunci jawaban: pengajar memeriksa isiannya dan memberi poin sendiri (di quiz individu maupun
 * kelompok), jadi yang dijaga: kunci kiriman lama tak pernah tersimpan/tampil, tabel selalu menunggu penilaian
 * pengajar, dan mode kelompok tidak bisa dilewati lewat panggilan langsung ke Server Action.
 *
 *   npx tsx scripts/verify-quiz-tabel.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe, probeText } from "./testSupport";
import { targetLabel } from "./project";
import {
  JUDUL_EKSPOR_KELOMPOK,
  MAX_BARIS_TABEL,
  MAX_KOLOM_TABEL,
  analisisSoal,
  rubrikBaru,
  bersihkanJawaban,
  barisEkspor,
  hapusBarisTabel,
  hapusKolomTabel,
  hitungNilai,
  indeksIsian,
  normalisasiSel,
  ringkasKelompok,
  skorTabel,
  strukturSama,
  susunJawabanTabel,
  tabelBaru,
  toQuiz,
  ubahUkuranTabel,
  uraiJawabanTabel,
  validasiNamaKelompok,
  validasiQuiz,
  type PercobaanQuiz,
  type Quiz,
  type SoalQuiz,
  type TabelSoal,
} from "../frontend/src/lib/classQuizRules";

const db = getFirestore(app);

// ── Bahan uji ───────────────────────────────────────────────────────────

/** Tabel 3x3: baris & kolom pertama judul; 4 sel isian (tanpa kunci jawaban). */
function tabel3(): TabelSoal {
  const t = tabelBaru(3, 3);
  t.cells[0].text = "";
  t.cells[1].text = "Ibu kota";
  t.cells[2].text = "Mata uang";
  t.cells[3].text = "Jepang";
  t.cells[6].text = "Thailand";
  return t;
}

const soalTabel = (id: string, points: number, table = tabel3()): SoalQuiz => ({ id, type: "table", text: `Lengkapi ${id}`, points, options: [], correct: null, table });
const soalMcq = (id: string, points: number): SoalQuiz => ({
  id, type: "mcq", text: `Soal ${id}`, points, options: ["a", "b"].map((o) => ({ id: o, text: `Opsi ${o}` })), correct: "a", table: null,
});

const quizUji = (questions: SoalQuiz[], kelompok = false): Quiz => ({
  id: "q1", classId: "c1", authorUid: "o", title: "Uji", description: "", questions,
  settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok },
  published: true, bannerURL: null, opensAt: null, closed: false, extraMin: 0, createdAt: "", updatedAt: "",
});

const coba = (uid: string, answers: Record<string, string>, over: Partial<PercobaanQuiz> = {}): PercobaanQuiz => ({
  id: `c1_q1_${uid}`, classId: "c1", quizId: "q1", uid, startedAt: "2026-01-01T00:00:00.000Z",
  submittedAt: "2026-01-01T00:05:00.000Z", finalizedBy: "siswa", answers, order: { q: [], opt: {} }, extraSec: 0, essayScores: {}, groupName: null, ...over,
});

const masuk = (m: Record<number, string>) => susunJawabanTabel(m);

function aturanMurni() {
  console.log("\nTabel: bentuk & ukuran");
  const t = tabelBaru(3, 3);
  check("tabel awal 3x3, 9 sel", t.rows === 3 && t.cols === 3 && t.cells.length === 9, `${t.cells.length}`);
  check("baris & kolom pertama = judul (tetap), sisanya isian", t.cells.every((c, i) => c.fill === (Math.floor(i / 3) !== 0 && i % 3 !== 0)), "pola");
  check("empat sel isian", indeksIsian(t).join() === "4,5,7,8", indeksIsian(t).join());

  const besar = ubahUkuranTabel(tabel3(), 4, 4);
  check("memperbesar mempertahankan sel lama", besar.cells[0 * 4 + 2].text === "Mata uang" && besar.cells[0 * 4 + 1].text === "Ibu kota" && besar.cells[1 * 4 + 0].text === "Jepang" && besar.cells[1 * 4 + 1].fill, "isi tetap di baris/kolomnya");
  check("sel baru: judul di tepi, isian di dalam", besar.cells[3].fill === false && besar.cells[15].fill === true, "pola sel baru");
  const kecil = ubahUkuranTabel(tabel3(), 2, 2);
  check("memperkecil membuang ujung", kecil.rows === 2 && kecil.cols === 2 && kecil.cells.length === 4 && kecil.cells[1].text === "Ibu kota" && kecil.cells[3].fill, JSON.stringify(kecil.cells.map((c) => c.text)));
  const jepit = ubahUkuranTabel(tabel3(), 999, 0);
  check("ukuran dijepit ke batas", jepit.rows === MAX_BARIS_TABEL && jepit.cols === 1, `${jepit.rows}x${jepit.cols}`);
  check("hapus baris membuang barisnya", hapusBarisTabel(tabel3(), 1).cells.every((c) => c.text !== "Jepang") && hapusBarisTabel(tabel3(), 1).rows === 2, "baris 2");
  check("hapus kolom membuang kolomnya", hapusKolomTabel(tabel3(), 2).cells.every((c) => c.text !== "Mata uang") && hapusKolomTabel(tabel3(), 2).cols === 2, "kolom 3");
  check("tidak bisa membuang baris/kolom terakhir", hapusBarisTabel(tabelBaru(1, 2), 0).rows === 1 && hapusKolomTabel(tabelBaru(2, 1), 0).cols === 1, "minimal 1");

  console.log("\nTabel: validasi saat membuat");
  const dasar = (q: Record<string, unknown>) => ({ title: "Quiz tabel", questions: [{ id: "t1", type: "table", text: "Lengkapi", points: 100, ...q }], settings: {} });
  const utuh = validasiQuiz(dasar({ table: tabel3() }), true);
  check("tabel lengkap diterbitkan", utuh.ok, utuh.ok ? "ok" : utuh.error);
  const kunciKiriman = tabel3();
  kunciKiriman.cells[4].key = "Tokyo";
  const e1 = validasiQuiz(dasar({ table: kunciKiriman }), true);
  check("terbit TANPA kunci jawaban lolos; kunci kiriman lama dibuang", e1.ok && e1.value.questions[0].table?.cells.every((c) => c.key === "") === true, e1.ok ? "ok" : e1.error);
  const semuaTetap = tabelBaru(2, 2);
  semuaTetap.cells.forEach((c) => (c.fill = false));
  check("tanpa sel isian ditolak saat terbit", !validasiQuiz(dasar({ table: semuaTetap }), true).ok, "perlu isian");
  check("ukuran > batas ditolak", !validasiQuiz(dasar({ table: { rows: MAX_BARIS_TABEL + 1, cols: 2, cells: [] } }), false).ok && !validasiQuiz(dasar({ table: { rows: 2, cols: MAX_KOLOM_TABEL + 1, cells: [] } }), false).ok, "baris & kolom");
  check("jumlah sel tak cocok ukuran ditolak", !validasiQuiz(dasar({ table: { rows: 2, cols: 2, cells: [{ text: "a", fill: false, key: "" }] } }), false).ok, "9 vs 4");
  check("soal tabel tanpa tabel ditolak", !validasiQuiz(dasar({}), false).ok, "table hilang");
  const campur = validasiQuiz(dasar({ table: { rows: 1, cols: 2, cells: [{ text: "ISI", fill: true, key: " Kunci " }, { text: " Judul ", fill: false, key: "RAHASIA" }] } }), false);
  check(
    "sel isian membuang teksnya, sel tetap membuang kuncinya, spasi dirapikan",
    campur.ok && campur.value.questions[0].table?.cells[0].text === "" && campur.value.questions[0].table?.cells[0].key === "" && campur.value.questions[0].table?.cells[1].key === "" && campur.value.questions[0].table?.cells[1].text === "Judul",
    JSON.stringify(campur.ok ? campur.value.questions[0].table?.cells : null),
  );
  const mode = validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true }, rubric: rubrikBaru() }, false);
  check("pengaturan kelompok terbaca; bawaan individu", mode.ok && mode.value.settings.kelompok === true && (() => { const r = validasiQuiz({ title: "Quiz", questions: [], settings: {} }, false); return r.ok && r.value.settings.kelompok === false; })(), "kelompok");

  console.log("\nTabel: penilaian MANUAL oleh pengajar (tanpa kunci)");
  check("normalisasi teks: besar-kecil, spasi, bentuk huruf (untuk data lama)", normalisasiSel("  TOKYO  ") === "tokyo" && normalisasiSel("Kuala   Lumpur") === "kuala lumpur" && normalisasiSel("ＴＯＫＹＯ") === "tokyo", "NFKC");
  const q = soalTabel("t1", 40);
  const quiz = quizUji([q, soalMcq("m1", 60)]);
  const n = hitungNilai(quiz, { answers: { t1: masuk({ 4: "Tokyo", 5: "Yen" }), m1: "a" }, essayScores: {} });
  check("tabel menunggu pengajar: 0 poin, 1 belum dinilai, total = pilihan ganda 60", n.perSoal.t1 === 0 && n.esaiBelumDinilai === 1 && n.total === 60, JSON.stringify(n));
  const dinilai = hitungNilai(quiz, { answers: { t1: masuk({ 4: "Tokyo" }), m1: "a" }, essayScores: { t1: 25 } });
  check("poin dari pengajar dipakai apa adanya: 25 + 60 = 85", dinilai.perSoal.t1 === 25 && dinilai.esaiBelumDinilai === 0 && dinilai.total === 85, JSON.stringify(dinilai));
  check("isian tak diperiksa otomatis: jawaban kosong pun tetap menunggu penilaian", hitungNilai(quiz, { answers: {}, essayScores: {} }).esaiBelumDinilai === 1, "menunggu");
  check("poin pengajar dijepit ke poin soal (99 → 40)", hitungNilai(quiz, { answers: {}, essayScores: { t1: 99 } }).perSoal.t1 === 40, "dijepit");
  check("pecahan tetap dibulatkan bila ada (bagi rata manual tak berpecahan)", hitungNilai(quizUji([soalTabel("a", 33), soalTabel("b", 33), soalTabel("c", 34)]), { answers: {}, essayScores: { a: 11, b: 22, c: 34 } }).total === 67, "11+22+34");

  console.log("\nTabel: membersihkan jawaban dari browser");
  const bersih = bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "Tokyo", 0: "menimpa judul", 99: "di luar tabel", x: "bukan angka", 5: 123 }), m1: "a" });
  check("hanya sel isian yang sah tersimpan", Object.keys(uraiJawabanTabel(bersih.t1)).join() === "4", bersih.t1);
  check("teks rusak (bukan JSON) dibuang", bersihkanJawaban(quiz, { t1: "bukan json" }).t1 === undefined && bersihkanJawaban(quiz, { t1: "[1,2]" }).t1 === undefined, "dibuang");
  check("hanya spasi = tidak dijawab", bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "   " }) }).t1 === undefined, "kosong");
  check("isian panjang dipotong ke batas sel", (uraiJawabanTabel(bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "x".repeat(500) }) }).t1)[4] ?? "").length === 80, "80");

  console.log("\nTabel: kunci soal terkunci setelah dikerjakan");
  const lama = [soalTabel("t1", 40)];
  check("sama persis = sah", strukturSama(lama, [soalTabel("t1", 40)]), "sama");
  const ubahTeks = tabel3();
  ubahTeks.cells[1].text = "Ibu kota negara";
  check("mengubah teks sel tetap = berubah", !strukturSama(lama, [soalTabel("t1", 40, ubahTeks)]), "teks sel");
  const ubahJenis = tabel3();
  ubahJenis.cells[4].fill = false;
  check("mengubah sel isian jadi tetap = berubah", !strukturSama(lama, [soalTabel("t1", 40, ubahJenis)]), "jenis sel");
  check("mengubah ukuran tabel = berubah", !strukturSama(lama, [soalTabel("t1", 40, ubahUkuranTabel(tabel3(), 4, 3))]), "ukuran");
  check("mengubah poin tetap sah", strukturSama(lama, [soalTabel("t1", 77)]), "poin bebas");

  console.log("\nQuiz kelompok: nama");
  check("nama dirapikan (spasi ganda, tepi)", (() => { const r = validasiNamaKelompok("  Kelompok    Tiga  "); return r.ok && r.value === "Kelompok Tiga"; })(), "dirapikan");
  check("karakter kontrol dibuang", (() => { const r = validasiNamaKelompok("Tim\u0000 A\u0007"); return r.ok && r.value === "Tim A"; })(), "kontrol");
  check("terlalu pendek / kosong / bukan teks ditolak", !validasiNamaKelompok("a").ok && !validasiNamaKelompok("   ").ok && !validasiNamaKelompok(undefined).ok && !validasiNamaKelompok(42).ok, "min 2");
  check("terlalu panjang ditolak", !validasiNamaKelompok("x".repeat(41)).ok && validasiNamaKelompok("x".repeat(40)).ok, "maks 40");

  const kel = quizUji([soalMcq("m1", 100)], true);
  const rk = ringkasKelompok(kel, [
    coba("a", { m1: "a" }, { groupName: "Alfa" }),
    coba("b", { m1: "b" }, { groupName: "alfa" }),
    coba("c", { m1: "a" }, { groupName: "Beta" }),
    coba("d", {}, { groupName: "Beta", submittedAt: null, finalizedBy: null }),
    coba("e", { m1: "a" }, { groupName: null }),
  ]);
  check("ringkasan menggabungkan nama tanpa beda huruf besar-kecil", rk.length === 2 && rk.find((k) => k.nama === "Alfa")?.anggota === 2, JSON.stringify(rk));
  check("rata-rata hanya dari yang terkumpul; tanpa kelompok diabaikan", rk.find((k) => k.nama === "Alfa")?.rata === 50 && rk.find((k) => k.nama === "Beta")?.terkumpul === 1 && rk.find((k) => k.nama === "Beta")?.anggota === 2, JSON.stringify(rk));
  check("urut rata-rata tertinggi", rk[0].nama === "Beta", rk[0].nama);

  console.log("\nQuiz kelompok: ekspor spreadsheet");
  const baris = barisEkspor(kel, [
    { nama: "Budi", p: coba("b", { m1: "a" }, { groupName: "Alfa" }) },
    { nama: "Ani", p: null },
  ]);
  check("judul kolom memuat Kelompok", baris[0].join("|") === JUDUL_EKSPOR_KELOMPOK.join("|"), baris[0].join("|"));
  check("nama kelompok ikut baris; yang belum mulai kosong", baris[1][2] === "Alfa" && baris[1][3] === 100 && baris[2][2] === "", JSON.stringify(baris));
  check("quiz individu: kolom lama tak berubah", barisEkspor(quizUji([soalMcq("m1", 100)]), [{ nama: "Budi", p: coba("b", { m1: "a" }) }])[0].join("|") === "No|Nama|Poin|Status", "tanpa kolom Kelompok");

  console.log("\nTabel: analisis soal (rata-rata poin dari pengajar)");
  const an = analisisSoal(quizUji([soalTabel("t1", 100)]), [
    coba("a", { t1: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok", 8: "Baht" }) }, { essayScores: { t1: 80 } }),
    coba("b", { t1: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok", 8: "Salah" }) }, { essayScores: { t1: 40 } }),
    coba("c", {}),
    coba("d", { t1: masuk({ 4: "Tokyo" }) }, { submittedAt: null, finalizedBy: null }),
  ])[0];
  check("jenis tabel; peserta hanya yang terkumpul", an.jenis === "table" && an.peserta === 3, `${an.jenis}/${an.peserta}`);
  check("rata-rata poin 60%, persen kurang 40, 2 jawaban dinilai", an.rataSkorPersen === 60 && an.persenSalah === 40 && an.dinilai === 2, `${an.rataSkorPersen}/${an.persenSalah}/${an.dinilai}`);
  check("yang tak mengisi dihitung", an.kosong === 1, String(an.kosong));
  check("tak ada lagi petunjuk sel tersulit/kunci pada analisis", !("selTersulit" in an), "tanpa kunci");

  console.log("\nKompatibilitas data lama");
  const lamaDoc = toQuiz("x", { title: "Lama", questions: [{ id: "s1", type: "mcq", text: "t", points: 100, options: [{ id: "a", text: "A" }], correct: "a" }], settings: { shuffleQuestions: true } });
  check("quiz lama (tanpa tabel & kelompok) terbaca sebagai pilihan ganda individu", lamaDoc.questions[0].type === "mcq" && !lamaDoc.questions[0].table && lamaDoc.settings.kelompok === false, JSON.stringify(lamaDoc.settings));
  const rusak = toQuiz("x", { title: "R", questions: [{ id: "s1", type: "table", text: "t", points: 10, table: { rows: 2, cols: 2, cells: [] } }] });
  check("tabel rusak terbaca null, tak melempar", rusak.questions[0].type === "table" && rusak.questions[0].table === null && hitungNilai(rusak, { answers: {}, essayScores: {} }).total === 0, "aman");
}

// ── Alur lewat server ───────────────────────────────────────────────────

const RAHASIA = ["KUNCI-TOKYO-RAHASIA", "KUNCI-YEN-RAHASIA", "KUNCI-BANGKOK-RAHASIA", "KUNCI-BAHT-RAHASIA"];

async function alur() {
  const owner = await createTestUser("educator", "tabel-pemilik");
  const admin = await createTestUser("admin", "tabel-admin");
  const s1 = await createTestUser("user", "tabel-siswa1");
  const s2 = await createTestUser("user", "tabel-siswa2");
  const luar = await createTestUser("user", "tabel-luar");

  const classId = `tabel-${Date.now().toString(36)}`;
  const waktu = new Date().toISOString();
  await db.collection("classes").doc(classId).set({ name: "Uji Tabel", description: "", ownerUid: owner.uid, joinCode: "UJITABEL", memberCount: 2, postCount: 0, createdAt: waktu, updatedAt: waktu });
  for (const s of [s1, s2]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).set({ uid: s.uid, classId, role: "member", joinedAt: waktu });

  try {
    const jalur = `/educator/classes/${classId}`;
    await probe(jalur, owner.cookie);
    await probe(`${jalur}/quiz/new`, owner.cookie);
    await probe(`/kelas/${classId}/quiz/x`, s1.cookie);
    const simpanId = await actionId("educator/classes/[id]/quiz/new", "saveQuiz");
    const tutupId = await actionId("educator/classes/[id]", "setQuizClosed");
    const mulaiId = await actionId("kelas/[id]/quiz/[quizId]", "startQuiz");
    const jawabId = await actionId("kelas/[id]/quiz/[quizId]", "sinkronJawaban");
    const kirimId = await actionId("kelas/[id]/quiz/[quizId]", "submitQuiz");
    const nilaiManualId = await actionId("educator/classes/[id]", "gradeQuizEssay");

    // Kunci kiriman (klien lama / panggilan langsung) harus DIBUANG server; bila tersimpan lalu bocor, ketahuan di HTML.
    const t = tabel3();
    t.cells[4].key = RAHASIA[0];
    t.cells[5].key = RAHASIA[1];
    t.cells[7].key = RAHASIA[2];
    t.cells[8].key = RAHASIA[3];
    const soal = [
      { id: "t1", type: "table", text: "Lengkapi tabel negara", points: 60, options: [], correct: null, table: t },
      { id: "m1", type: "mcq", text: "Pilihan ganda", points: 40, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "a", table: null },
    ];
    const rubrik = { tables: [1, 2, 3].map((n) => ({ id: `r${n}`, title: `Rubrik ${n}`, criteria: [{ id: `r${n}k1`, text: `Poin ${n}` }] })) };
    const isi = (over: Record<string, unknown> = {}) => ({ title: "Quiz Tabel", description: "", questions: soal, rubric: rubrik, settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok: true }, ...over });
    const simpan = (cookie: string, qid: string | null, i: unknown, terbit = true) => callAction(`${jalur}/quiz/new`, simpanId, [classId, qid, i, terbit], cookie);

    console.log("\nMembuat quiz kelompok bertabel");
    check("siswa tak bisa membuat quiz", (await simpan(s1.cookie, null, isi())).includes("tidak berhak"), "penjaga pemilik");
    const semuaTetap = tabelBaru(2, 2);
    semuaTetap.cells.forEach((c) => (c.fill = false));
    check("server tetap menolak tabel tanpa sel isian saat terbit", (await simpan(owner.cookie, null, isi({ questions: [{ ...soal[0], points: 100, table: semuaTetap }] }))).includes("sel isian"), "validasi server");
    check("pemilik menerbitkan quiz kelompok bertabel", (await simpan(owner.cookie, null, isi())).includes("Quiz diterbitkan"), "terbit");
    const docs = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs;
    const quizId = docs[0]?.id ?? "";
    const tersimpan = docs[0]?.data();
    check("pengaturan kelompok & tabel tersimpan", tersimpan?.settings?.kelompok === true && tersimpan?.questions?.[0]?.table?.rows === 3, JSON.stringify(tersimpan?.settings));
    check("kunci kiriman TIDAK tersimpan di dokumen (semua key kosong)", (tersimpan?.questions?.[0]?.table?.cells ?? []).every((c: { key: string }) => c.key === ""), "kunci dibuang");
    check("admin juga boleh membuat quiz di kelas orang lain", (await simpan(admin.cookie, null, isi({ title: "Quiz Admin", settings: { kelompok: false } }), false)).includes("Draf quiz disimpan"), "admin lolos requireOwnedClass");

    const J = (cookie: string, fn: string, args: unknown[]) => callAction(`/kelas/${classId}/quiz/${quizId}`, fn, args, cookie);

    console.log("\nMode kelompok: nama wajib");
    const tanpaNama = await J(s1.cookie, mulaiId, [classId, quizId]);
    check("mulai tanpa nama ditolak", tanpaNama.includes("Nama kelompok minimal"), "ditolak server");
    check("...dan tak ada percobaan terbentuk", !(await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).exists, "tak ada dokumen");
    check("nama 1 karakter ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "A"])).includes("Nama kelompok minimal"), "min 2");
    check("nama bukan teks ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, { x: 1 }])).includes("Nama kelompok minimal"), "bukan string");
    check("mulai dengan nama sah (dirapikan)", (await J(s1.cookie, mulaiId, [classId, quizId, "  Kelompok    Satu ", { names: ["Budi"] }])).includes("Quiz dimulai"), "ok");
    const a1 = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data();
    check("nama kelompok tercatat di percobaan siswa itu", a1?.groupName === "Kelompok Satu", String(a1?.groupName));
    await J(s1.cookie, mulaiId, [classId, quizId, "Nama Lain"]);
    check("klik ganda Mulai tak menimpa nama kelompok", (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.groupName === "Kelompok Satu", "nama tetap");
    check("anggota kedua memakai nama kelompok yang sama", (await J(s2.cookie, mulaiId, [classId, quizId, "kelompok satu", { names: ["Ani"] }])).includes("Quiz dimulai"), "ok");
    check("bukan anggota tak bisa mulai", (await J(luar.cookie, mulaiId, [classId, quizId, "Tim Luar"])).includes("Hanya peserta"), "ditolak");

    console.log("\nKunci tabel tidak bocor");
    const halaman = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("halaman pengerjaan memuat tabel (teks sel tetap)", halaman.status === 200 && halaman.html.includes("Ibu kota") && halaman.html.includes("Thailand"), String(halaman.status));
    check("halaman pengerjaan TIDAK memuat kunci kiriman", RAHASIA.every((k) => !halaman.html.includes(k)), "tanpa kunci");
    check("nama kelompok tampil di bilah pengerjaan", halaman.html.includes("Kelompok Satu"), "bilah");

    console.log("\nMengisi & menilai tabel");
    const kirim = JSON.stringify({ 4: RAHASIA[0].toLowerCase(), 5: RAHASIA[1].toLowerCase(), 7: "Salah", 99: "di luar", 0: "menimpa judul" });
    const simpanSementara = await J(s1.cookie, jawabId, [classId, quizId, { t1: kirim, m1: "a" }]);
    check("simpan sementara (sinkron kelompok) diterima", simpanSementara.includes('"ok":true'), "autosave");
    const tersimpanJawab = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.answers ?? {};
    check("hanya sel isian yang sah tersimpan", Object.keys(uraiJawabanTabel(tersimpanJawab.t1)).sort().join() === "4,5,7", String(tersimpanJawab.t1));
    check("kumpulkan quiz", (await J(s1.cookie, kirimId, [classId, quizId, { t1: kirim, m1: "a" }])).includes("Quiz dikumpulkan"), "ok");
    // Quiz KELOMPOK: soal tabel dinilai MANUAL oleh pengajar (menunggu persetujuan). Sebelum itu nilai sementara = pilihan ganda saja (40).
    const sementara = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("tabel pada quiz kelompok MENUNGGU penilaian: nilai sementara 40 + keterangan menunggu", sementara.html.includes(">40<") && sementara.html.includes("menunggu"), "manual");
    check("siswa tak bisa memberi poin tabel", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 60 }], s1.cookie)).includes("tidak berhak"), "penjaga pemilik");
    check("poin tabel di atas batas ditolak", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 61 }], owner.cookie)).includes("tidak sah"), "maks 60");
    check("pengajar memeriksa isian dan memberi poin tabel 30 (dari 60)", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 30 }], owner.cookie)).includes("Nilai esai disimpan"), "manual");
    const hasil = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("nilai = 70 (tabel 30 dari pengajar + pilihan ganda 40)", hasil.html.includes(">70<"), "setelah dinilai");
    check("sebelum quiz ditutup: kunci tabel TIDAK tampil di halaman hasil", RAHASIA.every((k) => !hasil.html.includes(k)) && hasil.html.includes("Kunci jawaban dibuka setelah"), "tertutup");
    check("jawaban siswa sendiri tampil", hasil.html.includes(RAHASIA[0].toLowerCase()), "jawaban sendiri");
    check("kunci tak bocor ke siswa lain yang belum selesai", RAHASIA.every((k) => !(halaman.html + hasil.html).includes(k)), "tanpa kunci");

    console.log("\nPemantauan, ekspor, dan penguncian");
    const pantau = await probeText(`${jalur}?tab=pantau&quiz=${quizId}`, owner.cookie);
    check("Pantau menampilkan nama kelompok & ringkasannya", pantau.html.includes("Per kelompok") && pantau.html.includes("Kelompok Satu"), "ringkasan");
    check("analisis soal memuat soal tabel", pantau.html.includes("Tabel") && pantau.html.includes("Analisis soal"), "analisis");
    check("siswa tak bisa membuka Pantau", !(await probeText(`/kelas/${classId}?tab=pantau&quiz=${quizId}`, s1.cookie)).html.includes("Per kelompok"), "pengelola saja");

    check("jenis quiz tak bisa diubah setelah ada yang mengerjakan", (await simpan(owner.cookie, quizId, isi({ settings: { kelompok: false } }))).includes("tidak bisa diubah"), "mode terkunci");
    const teksBaru = tabel3();
    teksBaru.cells[1].text = "Ibu kota lain";
    check("struktur tabel tak bisa diubah setelah dikerjakan", (await simpan(owner.cookie, quizId, isi({ questions: [{ ...soal[0], table: teksBaru }, soal[1]] }))).includes("tidak bisa diubah"), "soal terkunci");
    check("poin masih bisa diubah", (await simpan(owner.cookie, quizId, isi({ questions: [{ ...soal[0], points: 50 }, { ...soal[1], points: 50 }] }))).includes("Quiz diterbitkan"), "poin boleh");

    console.log("\nSetelah quiz ditutup");
    check("pemilik menutup quiz", (await callAction(jalur, tutupId, [classId, quizId, true], owner.cookie)).includes("Quiz ditutup"), "tutup");
    const terbuka = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("setelah ditutup pun tabel TIDAK menampilkan kunci apa pun (tidak ada)", RAHASIA.every((k) => !terbuka.html.includes(k)) && !terbuka.html.includes("Kunci: "), "tanpa kunci");

    console.log("\nQuiz individu mengabaikan nama kelompok");
    check("quiz individu diterbitkan", (await simpan(owner.cookie, null, isi({ title: "Quiz Individu", settings: { kelompok: false } }))).includes("Quiz diterbitkan"), "terbit");
    const indiv = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs.find((d) => d.data().title === "Quiz Individu");
    const idIndiv = indiv?.id ?? "";
    await probe(`/kelas/${classId}/quiz/${idIndiv}`, s2.cookie);
    check("mulai tanpa nama diterima", (await callAction(`/kelas/${classId}/quiz/${idIndiv}`, mulaiId, [classId, idIndiv], s2.cookie)).includes("Quiz dimulai"), "individu");
    check("nama kelompok tidak dicatat", (await db.collection("classQuizAttempts").doc(`${classId}_${idIndiv}_${s2.uid}`).get()).data()?.groupName === null, "null");
  } finally {
    await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
    const sisa = await db.collection("classQuizAttempts").where("classId", "==", classId).get();
    await Promise.all(sisa.docs.map((d) => d.ref.delete()));
    for (const s of [s1, s2]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).delete().catch(() => undefined);
    await auth.deleteUsers([owner.uid, admin.uid, s1.uid, s2.uid, luar.uid]).catch(() => undefined);
    console.log("\nakun, kelas & percobaan uji dihapus.");
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  aturanMurni();
  await alur();
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
