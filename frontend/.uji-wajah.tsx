import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync, writeFileSync } from "node:fs";
import WajahRobot, { type Ekspresi } from "./src/components/syrobo/WajahRobot";
const css = readFileSync("./src/app/globals.css", "utf8");
const blok = css.slice(css.indexOf("/* Wajah SyRobo"), css.indexOf("/* SyRobo tidur lalu diangkat"));
const daftar: Ekspresi[] = ["normal", "senang", "makan", "mandi", "lapar", "kotor", "laparKotor", "kaget", "sayu", "tidur", "tidurSenang", "tidurMarah"];
const html = daftar
  .map((e, i) => `<div style="display:inline-block;margin:4px;text-align:center;font:11px sans-serif;color:#fff"><div>${e}</div><svg viewBox="30 30 140 100" width="280" height="200"><path d="M66 38c-18 0-27 8-27 26v46c0 17 9 26 27 26h68c18 0 27-9 27-26V64c0-18-9-26-27-26z" fill="#F6F0E2" stroke="#2B2233" stroke-width="3.5"/><path d="M56 58c-1 0-2 1-2 2v52c0 2 2 4 4 4h84c2 0 4-2 4-4V60c0-1-1-2-2-2z" fill="#2B3350" stroke="#2B2233" stroke-width="3.5"/>${renderToStaticMarkup(<WajahRobot ekspresi={e} uid={"u" + i} />)}</svg></div>`)
  .join("");
writeFileSync(process.argv[2], `<body style="background:#538589;margin:0"><style>${blok}</style>${html}</body>`);
