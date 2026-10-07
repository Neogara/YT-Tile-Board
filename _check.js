const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
if (!scripts.length) { console.log("NO INLINE SCRIPT"); process.exit(1); }
const code = scripts[scripts.length - 1][1];
fs.writeFileSync(require("os").tmpdir() + "/inline-check.js", code);
console.log("extracted", code.length, "chars");
// structural checks
const checks = [
  ["scaler in HTML", /<div id="scaler">/.test(html)],
  ["btnFitAll in HTML", /id="btnFitAll"/.test(html)],
  ["no #panel", !/id="panel"/.test(html)],
  ["no panelUid", !/panelUid/.test(code)],
  ["no rebuildTileSel", !/rebuildTileSel/.test(code)],
  ["fitScale fn", /function fitScale\(\)/.test(code)],
  ["requestFitScale fn", /function requestFitScale\(\)/.test(code)],
  ["detected in scene", /detected: t\.detected \|\| null/.test(code)],
  ["fitall in scene", /fitall: state\.fitall/.test(code)],
  ["strip in buildTile", /className = "strip"/.test(code)],
  ["video div", /className = "video"/.test(code)],
  ["drop-noop cleanup", /classList\.remove\("drop-target", "drop-before", "drop-after", "drop-noop"\)/.test(code)],
  ["no leftover .grip class", !/className = "grip"/.test(code)]
];
let fail = false;
for (const [name, ok] of checks) {
  if (!ok) { console.log("FAIL: " + name); fail = true; } else { console.log("ok: " + name); }
}
if (fail) process.exitCode = 1;
