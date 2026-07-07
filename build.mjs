// Build a single self-contained suspension-card.js:
//   - card source (src/suspension-card.js)
//   - van side/back images embedded as base64 data URIs
// HACS only ships the one entry file for a plugin, so embedding the images
// means the card works after a plain HACS install with no companion files,
// and offline.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const srcPath = join(root, "src", "suspension-card.js");
const outPath = join(root, "suspension-card.js");

let card = readFileSync(srcPath, "utf8");

function dataUri(rel) {
  const b64 = readFileSync(join(root, rel)).toString("base64");
  return `data:image/png;base64,${b64}`;
}

function inject(placeholder, value) {
  const re = new RegExp(`const ${placeholder} = "";`);
  const before = card;
  card = card.replace(re, `const ${placeholder} = "${value}";`);
  if (card === before) throw new Error(`Could not find placeholder ${placeholder} in card source`);
}

inject("VAN_SIDE_B64", dataUri("img/van_side.png"));
inject("VAN_BACK_B64", dataUri("img/van_back.png"));

const banner = `/* suspension-card — self-contained build (van images inlined). Do not edit; edit src/suspension-card.js and run: node build.mjs */\n`;
const out = banner + card;
writeFileSync(outPath, out);

console.log(`Built ${outPath} (${(out.length / 1024).toFixed(0)} KB)`);
