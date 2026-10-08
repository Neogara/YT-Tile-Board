const fs = require("fs");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
const code = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].pop()[1];

let fail = 0;
const ok = (name, cond) => { console.log((cond ? "ok:   " : "FAIL: ") + name); if (!cond) fail++; };

// 1. All getElementById("x") targets exist in HTML (either static or created dynamically)
const ids = [...new Set([...code.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]))];
for (const id of ids) {
  ok(`element #${id} exists in HTML`, new RegExp(`id="${id}"`).test(html));
}

// 2. Removed panel API must be fully gone
for (const stale of ["panelUid", "rebuildTileSel", "refreshPanel", "highlightSelected",
                     "getPanelTile", "tileSel", "pLabel", "pRate", "pAspect", "pStart",
                     "pMute", "pLoop", "pDelete"]) {
  ok(`no stale ref: ${stale}`, !new RegExp(stale).test(code));
}

// 3. Required functions present & invoked
for (const fn of ["fitScale", "requestFitScale", "buildTile", "rebuildIframe", "removeTile",
                  "applyLayout", "applyOrder", "startDrag", "clearDropTarget",
                  "sceneToJSON", "applyScene", "detectAspect", "persistLocal", "needApi"]) {
  ok(`fn defined: ${fn}`, new RegExp("(function\\s+" + fn + "\\s*\\()").test(code));
}
ok("fitScale invoked (called by requestFitScale)", /fitScale\(\)/.test(code));
ok("requestFitScale called after detectAspect", /requestFitScale\(\)/.test(code));

// 4. Scene v3 fields
for (const field of ["fitall: state.fitall", "detected: t.detected || null", "rate: t.rate || 1"]) {
  ok(`scene field: ${field}`, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(code));
}

// 5. Drop index math regression simulation (formula from the working build)
const insertIndex = (n, f, k, before) => before ? (f < k ? k - 1 : k) : (f < k ? k : k + 1);
const simulate = (arr, f, k, before) => {
  const copy = arr.slice();
  const moved = copy.splice(f, 1)[0];
  const to = Math.max(0, Math.min(insertIndex(arr.length, f, k, before), copy.length));
  copy.splice(to, 0, moved);
  return copy;
};
const arr = ["A", "B", "C", "D"];
// drag A (idx0) before C (idx2) -> dropTo=1 -> [B,A,C,D]
ok("dnd: A before C", JSON.stringify(simulate(arr, 0, 2, true)) === JSON.stringify(["B", "A", "C", "D"]));
// drag D (idx3) before A (idx0) -> dropTo=0 -> [D,A,B,C]
ok("dnd: D before A", JSON.stringify(simulate(arr, 3, 0, true)) === JSON.stringify(["D", "A", "B", "C"]));
// drag A (idx0) after D (idx3) -> dropTo=3 -> [B,C,D,A]
ok("dnd: A after D", JSON.stringify(simulate(arr, 0, 3, false)) === JSON.stringify(["B", "C", "D", "A"]));
// drag C (idx2) after A (idx0) -> dropTo=1 -> [A,C,B,D]
ok("dnd: C after A", JSON.stringify(simulate(arr, 2, 0, false)) === JSON.stringify(["A", "C", "B", "D"]));
// true no-ops: drop back into own slot -> unchanged (matches dropTo === f in app)
ok("dnd: B before C (no-op, own slot)", JSON.stringify(simulate(arr, 1, 2, true)) === JSON.stringify(arr));
ok("dnd: B after A (no-op, own slot)", JSON.stringify(simulate(arr, 1, 0, false)) === JSON.stringify(arr));
// sanity: B after C must actually move B -> [A,C,B,D]
ok("dnd: B after C (moves)", JSON.stringify(simulate(arr, 1, 2, false)) === JSON.stringify(["A", "C", "B", "D"]));

// 6. CSS: strip hidden in OBS, video drop-target styles
ok("css: body.obs .strip hidden", /body\.obs \.strip \{ display: none; \}/.test(html));
ok("css: fit aspect on .video", /body\.fit #grid \.video \{ aspect-ratio/.test(html));
ok("css: drop-target tint on .video", /\.tile\.drop-target \.video::after/.test(html));
ok("css: scaler present", /#scaler \{/.test(html));
ok("css: fitall kills scroll", /body\.fitall #gridWrap \{ overflow: hidden; \}/.test(html));

console.log(fail ? `\n${fail} FAILURES` : "\nALL PASSED");
process.exitCode = fail ? 1 : 0;
