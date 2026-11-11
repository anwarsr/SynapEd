/**
 * Ikon kartu Tanjakan Robo (menu Games): jip berpengendara robot menanjak bukit berumput di senja, dilukis di kanvas dengan gradasi,
 * bayangan, tekstur tanah, dan ban berpelek - bukan ikon datar. Persegi `u` px. Hanya tampilan.
 */
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const INK = "#2A1C22";

const tinggiBukit = (x: number) => 104 - 0.46 * x + 5 * Math.sin(x / 15);
const landaiBukit = (x: number) => -0.46 + (5 / 15) * Math.cos(x / 15);

export function ikonTanjakan(ctx: Ctx, u: number): void {
  const k = u / 120;
  ctx.save();
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.roundRect(0, 0, 120, 120, 18);
  ctx.clip();

  // langit senja + matahari berkabut
  const langit = ctx.createLinearGradient(0, 0, 0, 80);
  langit.addColorStop(0, "#3B5FA8");
  langit.addColorStop(0.5, "#E58F7A");
  langit.addColorStop(1, "#FFD08A");
  ctx.fillStyle = langit;
  ctx.fillRect(0, 0, 120, 120);
  const silau = ctx.createRadialGradient(92, 34, 2, 92, 34, 40);
  silau.addColorStop(0, "rgba(255,244,205,0.95)");
  silau.addColorStop(0.35, "rgba(255,214,140,0.4)");
  silau.addColorStop(1, "rgba(255,200,130,0)");
  ctx.fillStyle = silau;
  ctx.fillRect(40, 0, 80, 80);
  // pegunungan jauh (pucat) dan menengah
  ctx.fillStyle = "#9C7AA6";
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.lineTo(18, 46);
  ctx.lineTo(32, 60);
  ctx.lineTo(52, 38);
  ctx.lineTo(74, 62);
  ctx.lineTo(96, 48);
  ctx.lineTo(120, 66);
  ctx.lineTo(120, 120);
  ctx.lineTo(0, 120);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6E5688";
  ctx.beginPath();
  ctx.moveTo(0, 82);
  ctx.lineTo(24, 64);
  ctx.lineTo(44, 78);
  ctx.lineTo(70, 58);
  ctx.lineTo(120, 84);
  ctx.lineTo(120, 120);
  ctx.lineTo(0, 120);
  ctx.closePath();
  ctx.fill();

  // bukit: lapisan tanah + rumput bertepi terang
  ctx.beginPath();
  ctx.moveTo(0, 120);
  for (let x = 0; x <= 120; x += 2) ctx.lineTo(x, tinggiBukit(x));
  ctx.lineTo(120, 120);
  ctx.closePath();
  const tanah = ctx.createLinearGradient(0, 40, 0, 120);
  tanah.addColorStop(0, "#8A5A34");
  tanah.addColorStop(1, "#4A2E1C");
  ctx.fillStyle = tanah;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,230,190,0.14)";
  for (let i = 0; i < 12; i++) {
    const x = (i * 29) % 120;
    const y = tinggiBukit(x) + 14 + ((i * 17) % 22);
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + (i % 3) * 2, 2.4, -0.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(20,10,5,0.25)";
  for (let i = 0; i < 9; i++) {
    const x = (i * 41 + 9) % 120;
    ctx.fillRect(x, tinggiBukit(x) + 10 + ((i * 13) % 26), 8, 1.6);
  }
  ctx.restore();
  // rumput di tepi atas
  ctx.beginPath();
  for (let x = 0; x <= 120; x += 2) ctx.lineTo(x, tinggiBukit(x) - 1);
  for (let x = 120; x >= 0; x -= 2) ctx.lineTo(x, tinggiBukit(x) + 5);
  ctx.closePath();
  const rumput = ctx.createLinearGradient(0, 40, 120, 100);
  rumput.addColorStop(0, "#8FC45A");
  rumput.addColorStop(1, "#4C8A3A");
  ctx.fillStyle = rumput;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,244,190,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= 120; x += 2) ctx.lineTo(x, tinggiBukit(x) - 1);
  ctx.stroke();

  // jip di lereng, diputar mengikuti kemiringan
  const cx = 58;
  const cy = tinggiBukit(cx);
  const sudut = Math.atan(landaiBukit(cx));
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 2, 30, 3.6, sudut, 0, TAU);
  ctx.fill();
  for (const [dx, dy, r, a] of [
    [-34, -4, 6, 0.3],
    [-42, -9, 5, 0.22],
    [-49, -3, 4, 0.18],
    [-40, 0, 4.5, 0.24],
  ] as const) {
    ctx.fillStyle = `rgba(214,182,140,${a})`;
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sudut);
  const roda = (x: number) => {
    ctx.save();
    ctx.translate(x, -9);
    ctx.fillStyle = "#1E1A22";
    ctx.beginPath();
    ctx.arc(0, 0, 9.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3A343F";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 7.6, Math.sin(a) * 7.6);
      ctx.lineTo(Math.cos(a) * 9.6, Math.sin(a) * 9.6);
      ctx.stroke();
    }
    const pelek = ctx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5.6);
    pelek.addColorStop(0, "#EDEAF2");
    pelek.addColorStop(1, "#8A8698");
    ctx.fillStyle = pelek;
    ctx.beginPath();
    ctx.arc(0, 0, 5.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#4A4656";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.fillStyle = "#4A4656";
    ctx.beginPath();
    ctx.arc(0, 0, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  ctx.strokeStyle = "#3A343F";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-20, -9);
  ctx.lineTo(-18, -18);
  ctx.moveTo(20, -9);
  ctx.lineTo(18, -18);
  ctx.stroke();
  roda(-20);
  // badan jip: gradasi merah, kap mesin miring
  const badan = ctx.createLinearGradient(0, -34, 0, -14);
  badan.addColorStop(0, "#F0584A");
  badan.addColorStop(0.55, "#C9372D");
  badan.addColorStop(1, "#86221C");
  ctx.fillStyle = badan;
  ctx.beginPath();
  ctx.moveTo(-31, -17);
  ctx.lineTo(-31, -27);
  ctx.quadraticCurveTo(-31, -30, -27, -30);
  ctx.lineTo(-4, -30);
  ctx.lineTo(4, -37);
  ctx.lineTo(13, -37);
  ctx.lineTo(18, -30);
  ctx.lineTo(29, -28);
  ctx.quadraticCurveTo(34, -27, 33, -21);
  ctx.lineTo(33, -17);
  ctx.quadraticCurveTo(33, -14, 30, -14);
  ctx.lineTo(-28, -14);
  ctx.quadraticCurveTo(-31, -14, -31, -17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,210,190,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-26, -28);
  ctx.lineTo(-6, -28);
  ctx.stroke();
  ctx.strokeStyle = "rgba(60,10,8,0.5)";
  ctx.beginPath();
  ctx.moveTo(-28, -21);
  ctx.lineTo(30, -21);
  ctx.stroke();
  ctx.fillStyle = "#2D2833";
  ctx.fillRect(-33, -16, 6, 3);
  ctx.fillRect(29, -16, 6, 3);
  // kaca & robot pengemudi
  ctx.fillStyle = "#1C2540";
  ctx.beginPath();
  ctx.moveTo(-2, -29);
  ctx.lineTo(5, -35);
  ctx.lineTo(12, -35);
  ctx.lineTo(16, -29);
  ctx.closePath();
  ctx.fill();
  const kepala = ctx.createLinearGradient(2, -42, 12, -32);
  kepala.addColorStop(0, "#F7F2E4");
  kepala.addColorStop(1, "#CDC1A8");
  ctx.fillStyle = kepala;
  ctx.beginPath();
  ctx.roundRect(4, -44, 11, 10, 3.2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = "#1B2340";
  ctx.beginPath();
  ctx.roundRect(5.6, -42, 8, 5.6, 1.8);
  ctx.fill();
  ctx.fillStyle = "#B9F3FF";
  ctx.beginPath();
  ctx.arc(8, -39.2, 1.1, 0, TAU);
  ctx.arc(11.6, -39.2, 1.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(9.5, -44);
  ctx.lineTo(10.4, -48);
  ctx.stroke();
  ctx.fillStyle = "#F2C14E";
  ctx.beginPath();
  ctx.arc(10.4, -49, 1.5, 0, TAU);
  ctx.fill();
  // rangka pelindung
  ctx.strokeStyle = "#2D2833";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-2, -30);
  ctx.lineTo(-4, -41);
  ctx.lineTo(18, -41);
  ctx.lineTo(19, -30);
  ctx.stroke();
  // lampu depan menyala + berkas cahaya
  const berkas = ctx.createLinearGradient(32, -24, 58, -20);
  berkas.addColorStop(0, "rgba(255,244,190,0.7)");
  berkas.addColorStop(1, "rgba(255,244,190,0)");
  ctx.fillStyle = berkas;
  ctx.beginPath();
  ctx.moveTo(32, -26);
  ctx.lineTo(62, -34);
  ctx.lineTo(62, -12);
  ctx.lineTo(32, -21);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFF5C8";
  ctx.beginPath();
  ctx.ellipse(31, -23.5, 2.6, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  roda(20);
  ctx.restore();

  // vinyet halus
  const v = ctx.createRadialGradient(60, 60, 40, 60, 60, 86);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(20,8,16,0.3)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 120, 120);
  ctx.restore();
}
