/**
 * Menguji soal TABEL dan quiz KELOMPOK: aturan murni lebih dulu, lalu alur penuh lewat dev server
 * (npm run dev) - membuat quiz, mulai dengan/ tanpa nama kelompok, mengisi tabel, menilai, serta
 * yang paling penting: KUNCI SEL TIDAK BOCOR ke siswa sebelum quiz ditutup, dan mode kelompok
 * tidak bisa dilewati lewat panggilan langsung ke Server Action.
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

/** Tabel 3x3: baris & kolom pertama judul; 4 sel isian dengan kunci. */
function tabel3(): TabelSoal {
  const t = tabelBaru(3, 3);
  t.cells[0].text = "";
  t.cells[1].text = "Ibu kota";
  t.cells[2].text = "Mata uang";
  t.cells[3].text = "Jepang";
  t.cells[6].text = "Thailand";
  t.cells[4].key = "Tokyo";
  t.cells[5].key = "Yen";
  t.cells[7].key = "Bangkok";
  t.cells[8].key = "Baht";
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
  check("memperbesar mempertahankan sel lama", besar.cells[1 * 4 + 2].key === "Yen" && besar.cells[0 * 4 + 1].text === "Ibu kota" && besar.cells[1 * 4 + 1].key === "Tokyo", "isi tetap di baris/kolomnya");
  check("sel baru: judul di tepi, isian di dalam", besar.cells[3].fill === false && besar.cells[15].fill === true, "pola sel baru");
  const kecil = ubahUkuranTabel(tabel3(), 2, 2);
  check("memperkecil membuang ujung", kecil.rows === 2 && kecil.cols === 2 && kecil.cells.length === 4 && kecil.cells[3].key === "Tokyo", JSON.stringify(kecil.cells.map((c) => c.key)));
  const jepit = ubahUkuranTabel(tabel3(), 999, 0);
  check("ukuran dijepit ke batas", jepit.rows === MAX_BARIS_TABEL && jepit.cols === 1, `${jepit.rows}x${jepit.cols}`);
  check("hapus baris membuang barisnya", hapusBarisTabel(tabel3(), 1).cells.every((c) => c.key !== "Tokyo" && c.key !== "Yen") && hapusBarisTabel(tabel3(), 1).rows === 2, "baris 2");
  check("hapus kolom membuang kolomnya", hapusKolomTabel(tabel3(), 2).cells.every((c) => c.key !== "Yen" && c.key !== "Baht") && hapusKolomTabel(tabel3(), 2).cols === 2, "kolom 3");
  check("tidak bisa membuang baris/kolom terakhir", hapusBarisTabel(tabelBaru(1, 2), 0).rows === 1 && hapusKolomTabel(tabelBaru(2, 1), 0).cols === 1, "minimal 1");

  console.log("\nTabel: validasi saat membuat");
  const dasar = (q: Record<string, unknown>) => ({ title: "Quiz tabel", questions: [{ id: "t1", type: "table", text: "Lengkapi", points: 100, ...q }], settings: {} });
  const utuh = validasiQuiz(dasar({ table: tabel3() }), true);
  check("tabel lengkap diterbitkan", utuh.ok, utuh.ok ? "ok" : utuh.error);
  const tanpaKunci = tabel3();
  tanpaKunci.cells[7].key = "";
  const e1 = validasiQuiz(dasar({ table: tanpaKunci }), true);
  check("sel isian tanpa kunci ditolak saat terbit, menyebut posisinya", !e1.ok && e1.error.includes("baris 3, kolom 2"), e1.ok ? "lolos" : e1.error);
  check("...tetapi boleh sebagai draf", validasiQuiz(dasar({ table: tanpaKunci }), false).ok, "draf");
  const semuaTetap = tabelBaru(2, 2);
  semuaTetap.cells.forEach((c) => (c.fill = false));
  check("tanpa sel isian ditolak saat terbit", !validasiQuiz(dasar({ table: semuaTetap }), true).ok, "perlu isian");
  check("ukuran > batas ditolak", !validasiQuiz(dasar({ table: { rows: MAX_BARIS_TABEL + 1, cols: 2, cells: [] } }), false).ok && !validasiQuiz(dasar({ table: { rows: 2, cols: MAX_KOLOM_TABEL + 1, cells: [] } }), false).ok, "baris & kolom");
  check("jumlah sel tak cocok ukuran ditolak", !validasiQuiz(dasar({ table: { rows: 2, cols: 2, cells: [{ text: "a", fill: false, key: "" }] } }), false).ok, "9 vs 4");
  check("soal tabel tanpa tabel ditolak", !validasiQuiz(dasar({}), false).ok, "table hilang");
  const campur = validasiQuiz(dasar({ table: { rows: 1, cols: 2, cells: [{ text: "ISI", fill: true, key: " Kunci " }, { text: " Judul ", fill: false, key: "RAHASIA" }] } }), false);
  check(
    "sel isian membuang teksnya, sel tetap membuang kuncinya, spasi dirapikan",
    campur.ok && campur.value.questions[0].table?.cells[0].text === "" && campur.value.questions[0].table?.cells[0].key === "Kunci" && campur.value.questions[0].table?.cells[1].key === "" && campur.value.questions[0].table?.cells[1].text === "Judul",
    JSON.stringify(campur.ok ? campur.value.questions[0].table?.cells : null),
  );
  const mode = validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true }, rubric: rubrikBaru() }, false);
  check("pengaturan kelompok terbaca; bawaan individu", mode.ok && mode.value.settings.kelompok === true && (() => { const r = validasiQuiz({ title: "Quiz", questions: [], settings: {} }, false); return r.ok && r.value.settings.kelompok === false; })(), "kelompok");

  console.log("\nTabel: penilaian per sel");
  check("normalisasi: besar-kecil, spasi, bentuk huruf", normalisasiSel("  TOKYO  ") === "tokyo" && normalisasiSel("Kuala   Lumpur") === "kuala lumpur" && normalisasiSel("ＴＯＫＹＯ") === "tokyo", "NFKC");
  const q = soalTabel("t1", 40);
  const sk = skorTabel(q.table, masuk({ 4: "tokyo", 5: "yen ", 7: "Salah", 8: "" }));
  check("dua dari empat sel benar", sk.benar === 2 && sk.total === 4, `${sk.benar}/${sk.total}`);
  const quiz = quizUji([q, soalMcq("m1", 60)]);
  const n = hitungNilai(quiz, { answers: { t1: masuk({ 4: "Tokyo", 5: "Yen" }), m1: "a" }, essayScores: {} });
  check("kredit sebagian: 2/4 sel x 40 poin = 20, ditambah pilihan ganda 60", n.perSoal.t1 === 20 && n.total === 80 && n.esaiBelumDinilai === 0, JSON.stringify(n));
  const bulat = hitungNilai(quizUji([soalTabel("t1", 10, (() => { const x = tabelBaru(2, 4); x.cells.forEach((c) => (c.key = c.fill ? "a" : "")); return x; })())]), { answers: { t1: masuk({ 5: "a" }) }, essayScores: {} });
  check("pecahan dibulatkan 2 desimal (10 x 1/3 = 3,33)", bulat.perSoal.t1 === 3.33 && bulat.total === 3.33, String(bulat.total));
  const tigaSoal = hitungNilai(quizUji([soalTabel("a", 33), soalTabel("b", 33), soalTabel("c", 34)]), {
    answers: { a: masuk({ 4: "Tokyo" }), b: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok" }), c: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok", 8: "Baht" }) },
    essayScores: {},
  });
  check("total tanpa derau pecahan (8,25 + 24,75 + 34)", tigaSoal.total === 67, String(tigaSoal.total));
  check("kunci kosong (draf) tak pernah benar", skorTabel({ rows: 1, cols: 1, cells: [{ text: "", fill: true, key: "" }] }, masuk({ 0: "" })).benar === 0, "kosong ≠ benar");
  check("tidak dijawab = 0 poin", hitungNilai(quiz, { answers: {}, essayScores: {} }).perSoal.t1 === 0, "0");

  console.log("\nTabel: membersihkan jawaban dari browser");
  const bersih = bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "Tokyo", 0: "menimpa judul", 99: "di luar tabel", x: "bukan angka", 5: 123 }), m1: "a" });
  check("hanya sel isian yang sah tersimpan", Object.keys(uraiJawabanTabel(bersih.t1)).join() === "4", bersih.t1);
  check("teks rusak (bukan JSON) dibuang", bersihkanJawaban(quiz, { t1: "bukan json" }).t1 === undefined && bersihkanJawaban(quiz, { t1: "[1,2]" }).t1 === undefined, "dibuang");
  check("hanya spasi = tidak dijawab", bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "   " }) }).t1 === undefined, "kosong");
  check("isian panjang dipotong ke batas sel", (uraiJawabanTabel(bersihkanJawaban(quiz, { t1: JSON.stringify({ 4: "x".repeat(500) }) }).t1)[4] ?? "").length === 80, "80");

  console.log("\nTabel: kunci soal terkunci setelah dikerjakan");
  const lama = [soalTabel("t1", 40)];
  check("sama persis = sah", strukturSama(lama, [soalTabel("t1", 40)]), "sama");
  const ubahKunci = tabel3();
  ubahKunci.cells[4].key = "Osaka";
  check("mengubah kunci sel = berubah", !strukturSama(lama, [soalTabel("t1", 40, ubahKunci)]), "kunci");
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

  console.log("\nTabel: analisis soal");
  const an = analisisSoal(quizUji([soalTabel("t1", 100)]), [
    coba("a", { t1: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok", 8: "Baht" }) }),
    coba("b", { t1: masuk({ 4: "Tokyo", 5: "Yen", 7: "Bangkok", 8: "Salah" }) }),
    coba("c", {}),
    coba("d", { t1: masuk({ 4: "Tokyo" }) }, { submittedAt: null, finalizedBy: null }),
  ])[0];
  check("jenis tabel; peserta hanya yang terkumpul", an.jenis === "table" && an.peserta === 3, `${an.jenis}/${an.peserta}`);
  check("rata-rata sel benar = 7 dari 12 = 58%, persen tidak benar 42", an.rataSkorPersen === 58 && an.persenSalah === 42, `${an.rataSkorPersen}/${an.persenSalah}`);
  check("sel tersulit = baris 3 kolom 3 (Baht), 67% kurang tepat", an.selTersulit?.baris === 3 && an.selTersulit?.kolom === 3 && an.selTersulit?.kunci === "Baht" && an.selTersulit?.persenSalah === 67, JSON.stringify(an.selTersulit));
  check("yang tak mengisi dihitung", an.kosong === 1, String(an.kosong));

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
    const jawabId = await actionId("kelas/[id]/quiz/[quizId]", "saveQuizAnswers");
    const kirimId = await actionId("kelas/[id]/quiz/[quizId]", "submitQuiz");
    const nilaiManualId = await actionId("educator/classes/[id]", "gradeQuizEssay");

    // Tabel dengan kunci yang mudah dicari di HTML (kalau bocor, ketahuan).
    const t = tabel3();
    t.cells[4].key = RAHASIA[0];
    t.cells[5].key = RAHASIA[1];
    t.cells[7].key = RAHASIA[2];
    t.cells[8].key = RAHASIA[3];
    const soal = [
      { id: "t1", type: "table", text: "Lengkapi tabel negara", points: 60, options: [], correct: null, table: t },
      { id: "m1", type: "mcq", text: "Pilihan ganda", points: 40, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "a", table: null },
    ];
    const rubrik = { tables: [1, 2, 3].map((n) => ({ id: `r${n}`, title: `Rubrik ${n}`, criteria: [{ id: `r${n}k1`, text: `Poin ${n}` }] })), weight: 30 };
    const isi = (over: Record<string, unknown> = {}) => ({ title: "Quiz Tabel", description: "", questions: soal, rubric: rubrik, settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok: true }, ...over });
    const simpan = (cookie: string, qid: string | null, i: unknown, terbit = true) => callAction(`${jalur}/quiz/new`, simpanId, [classId, qid, i, terbit], cookie);

    console.log("\nMembuat quiz kelompok bertabel");
    check("siswa tak bisa membuat quiz", (await simpan(s1.cookie, null, isi())).includes("tidak berhak"), "penjaga pemilik");
    const kunciKurang = tabel3();
    kunciKurang.cells[8].key = "";
    check("server menolak sel isian tanpa kunci saat terbit", (await simpan(owner.cookie, null, isi({ questions: [{ ...soal[0], points: 100, table: kunciKurang }] }))).includes("belum ada kunci"), "validasi server");
    check("pemilik menerbitkan quiz kelompok bertabel", (await simpan(owner.cookie, null, isi())).includes("Quiz diterbitkan"), "terbit");
    const docs = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs;
    const quizId = docs[0]?.id ?? "";
    const tersimpan = docs[0]?.data();
    check("pengaturan kelompok & tabel tersimpan", tersimpan?.settings?.kelompok === true && tersimpan?.questions?.[0]?.table?.rows === 3, JSON.stringify(tersimpan?.settings));
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
    check("halaman pengerjaan TIDAK memuat kunci sel", RAHASIA.every((k) => !halaman.html.includes(k)), "tanpa kunci");
    check("nama kelompok tampil di bilah pengerjaan", halaman.html.includes("Kelompok Satu"), "bilah");

    console.log("\nMengisi & menilai tabel");
    const kirim = JSON.stringify({ 4: RAHASIA[0].toLowerCase(), 5: RAHASIA[1].toLowerCase(), 7: "Salah", 99: "di luar", 0: "menimpa judul" });
    const simpanSementara = await J(s1.cookie, jawabId, [classId, quizId, { t1: kirim, m1: "a" }]);
    check("simpan sementara diterima", simpanSementara.includes("Tersimpan"), "autosave");
    const tersimpanJawab = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.answers ?? {};
    check("hanya sel isian yang sah tersimpan", Object.keys(uraiJawabanTabel(tersimpanJawab.t1)).sort().join() === "4,5,7", String(tersimpanJawab.t1));
    check("kumpulkan quiz", (await J(s1.cookie, kirimId, [classId, quizId, { t1: kirim, m1: "a" }])).includes("Quiz dikumpulkan"), "ok");
    // Quiz KELOMPOK: soal tabel dinilai MANUAL oleh pengajar (menunggu persetujuan). Sebelum itu nilai sementara = pilihan ganda saja (40).
    const sementara = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("tabel pada quiz kelompok MENUNGGU penilaian: nilai sementara 40 + keterangan menunggu", sementara.html.includes(">40<") && sementara.html.includes("menunggu"), "manual");
    check("siswa tak bisa memberi poin tabel", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 60 }], s1.cookie)).includes("tidak berhak"), "penjaga pemilik");
    check("poin tabel di atas batas ditolak", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 61 }], owner.cookie)).includes("tidak sah"), "maks 60");
    check("pengajar memberi poin tabel 30 (2/4 sel x 60)", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { t1: 30 }], owner.cookie)).includes("Nilai esai disimpan"), "manual");
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
    const kunciBaru = tabel3();
    kunciBaru.cells[4].key = "Lain";
    check("kunci tabel tak bisa diubah setelah dikerjakan", (await simpan(owner.cookie, quizId, isi({ questions: [{ ...soal[0], table: kunciBaru }, soal[1]] }))).includes("tidak bisa diubah"), "soal terkunci");
    check("poin masih bisa diubah", (await simpan(owner.cookie, quizId, isi({ questions: [{ ...soal[0], points: 50 }, { ...soal[1], points: 50 }] }))).includes("Quiz diterbitkan"), "poin boleh");

    console.log("\nSetelah quiz ditutup");
    check("pemilik menutup quiz", (await callAction(jalur, tutupId, [classId, quizId, true], owner.cookie)).includes("Quiz ditutup"), "tutup");
    const terbuka = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("kunci tabel tampil setelah ditutup", RAHASIA.every((k) => terbuka.html.includes(k)) || (terbuka.html.includes(RAHASIA[2]) && terbuka.html.includes(RAHASIA[3])), "kunci terbuka");
    check("sel yang benar ditandai", terbuka.html.includes("Benar"), "penanda");

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
