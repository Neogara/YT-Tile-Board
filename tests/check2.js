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

// 7. Maximize (1-9) auto-pauses the rest, resumes what was playing
ok("fn defined: pauseOthersForMaximize", /function\s+pauseOthersForMaximize\s*\(/.test(code));
ok("fn defined: resumeOthersAfterMaximize", /function\s+resumeOthersAfterMaximize\s*\(/.test(code));
ok("maxPauseMap declared", /let maxPauseMap = null/.test(code));
ok("toggleMaximize pauses others on open", /pauseOthersForMaximize\(uid\)/.test(code));
ok("toggleMaximize resumes others on close", /maximizedUid = null;\s*resumeOthersAfterMaximize\(\)/.test(code));
ok("onReady pauses late player while maximized", /maximizedUid && maximizedUid !== uid/.test(code));
ok("removeTile of maximized resumes others", /maximizedUid = null; resumeOthersAfterMaximize\(\)/.test(code));
ok("applyScene resets maximize state", /maximizedUid = null;\s*maxPauseMap = null;/.test(code));
ok("btnClear resets maxPauseMap", /state\.tiles = \[\];\s*maximizedUid = null;\s*maxPauseMap = null;/.test(code));
ok("resume skipped while allPaused", /if \(state\.allPaused\) return;/.test(code));
ok("only PLAYING/BUFFERING counts as playing", /st === 1 \|\| st === 3/.test(code));

// 9. Live stream links: youtube.com/live/ID
ok("live link parsed: /live/ID", code.includes("/live\\/([A-Za-z0-9_-]{11})/"));
ok("live id returned", code.includes("if (mLive) return mLive[1];"));

// 10. Раскладка «Герой»
ok("hero: option in layout select", /<option value="hero"/.test(html));
ok("hero: fn defined: heroPlacements", /function\s+heroPlacements\s*\(/.test(code));
ok("hero: fn defined: applyHeroLayout", /function\s+applyHeroLayout\s*\(/.test(code));
ok("hero: fn defined: setHero", /function\s+setHero\s*\(/.test(code));
ok("hero: fn defined: syncHeroStars", /function\s+syncHeroStars\s*\(/.test(code));
ok("hero: applyLayout branch", /if \(n === "hero"\) \{\s*applyHeroLayout\(\);/.test(code));
ok("hero: body class toggled", /classList\.toggle\("hero", state\.cols === "hero"\)/.test(code));
ok("hero: grid-area cleared on exit", /el\.style\.gridArea = ""/.test(code));
ok("hero: gridTemplateRows cleared on exit", /grid\.style\.gridTemplateRows = ""/.test(code));
ok("hero: sceneToJSON field", /hero: t\.hero \|\| undefined/.test(code));
ok("hero: applyScene field", /hero: !!t\.hero/.test(code));
ok("hero: single-hero dedupe on load", /if \(seenHero\) t\.hero = false/.test(code));
ok("hero: star button created", code.includes('heroBtn.textContent = "⭐"'));
ok("hero: dnd slot transfer (dropOnHeroUid)", /dropOnHeroUid/.test(code));
ok("hero: dnd slot drop swaps + transfers star", /state\.tiles\[to\]\.hero = true/.test(code));
ok("hero: reorder re-layouts in hero mode", /if \(state\.cols === "hero"\) applyLayout\(\);/.test(code));
ok("hero: removeTile re-layouts (ring shrinks)", /updateEmpty\(\);\s*applyLayout\(\);/.test(code));
ok("hero: css grid display", /body\.hero #grid \{ display: grid; height: 100%; align-items: stretch; \}/.test(html));
ok("hero: css scaler full height", /body\.hero #scaler \{ height: 100%; \}/.test(html));
ok("hero: css video fills cell in fit", /body\.hero\.fit #grid \.video \{ aspect-ratio: auto; \}/.test(html));
ok("hero: css tile fills cell", /body\.hero #grid \.tile \{ width: auto; height: auto; \}/.test(html));
ok("hero: css hero-main marker", /body:not\(\.obs\) \.tile\.hero-main/.test(html));
ok("hero: css drop-hero cue", /\.tile\.drop-hero/.test(html));

// heroPlacements — чистая функция: полнота кольца и порядок проверяются без браузера
{
  const src = code.match(/function heroPlacements[\s\S]*?\n\}/)[0];
  const heroPlacements = eval("(" + src + ")");
  const parse = a => a.split("/").map(x => parseInt(x.trim(), 10)); // "r1 / c1 / r2 / c2"
  const cells = a => { const [r1, c1, r2, c2] = parse(a); const out = [];
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) out.push(r + ":" + c); return out; };
  for (let S = 0; S <= 27; S++) {
    const spec = heroPlacements(S);
    const { cols, rows, areas, heroArea } = spec;
    ok(`hero S=${S}: ровно S спутников`, areas.length === S);
    const owner = new Map();
    let valid = true;
    for (const a of [...areas, heroArea]) {
      for (const k of cells(a)) {
        const [r, c] = k.split(":").map(Number);
        if (r < 1 || c < 1 || r > rows || c > cols || owner.has(k)) { valid = false; break; }
        owner.set(k, true);
      }
      if (!valid) break;
    }
    ok(`hero S=${S}: сетка заполнена ровно один раз (${cols}×${rows})`, valid && owner.size === cols * rows);
    // равномерность: видео в одной строке (верх/низ) одинаковой ширины.
    // Гарантируется в рабочем диапазоне: сцена ≤15 тайлов = ≤14 спутников = один
    // слой кольца, где cols кратен 3 и 4. Многослойность (S>14) продукту недостижима.
    if (S <= 14) {
      const band = new Map();
      for (let i = 0; i < S; i++) {
        const [r1, c1, r2, c2] = parse(areas[i]);
        const k = r1 + ":" + r2;
        if (!band.has(k)) band.set(k, []);
        band.get(k).push(c2 - c1);
      }
      ok(`hero S=${S}: видео в одном ряду одинаковой ширины`,
         [...band.values()].every(g => new Set(g).size === 1));
    }
  }
  // порядок сторон: top(4) → bottom(4) → лево/право поочерёдно (L,R,L,R…), слой2
  const p8 = heroPlacements(8);
  ok("hero order: 0-3 сверху (строка 1)", [0, 1, 2, 3].every(i => parse(p8.areas[i])[0] === 1));
  ok("hero order: 4-7 снизу (последняя строка)", [4, 5, 6, 7].every(i => parse(p8.areas[i])[0] === p8.rows));
  // лево/право — поочерёдно: сразу по одному на сторону (плавное заполнение)
  const p10 = heroPlacements(10);
  ok("hero order: 8 слева", parse(p10.areas[8])[1] === 1);
  ok("hero order: 9 справа", parse(p10.areas[9])[3] === p10.cols + 1);
  // полное кольцо: лево = 8,10,12; право = 9,11,13
  const p14 = heroPlacements(14);
  ok("hero order: 8,10,12 слева", [8, 10, 12].every(i => parse(p14.areas[i])[1] === 1));
  ok("hero order: 9,11,13 справа", [9, 11, 13].every(i => parse(p14.areas[i])[3] === p14.cols + 1));
  // слой2: 14-й спутник снова сверху, но во внешнем слое (выше внутреннего)
  const p17 = heroPlacements(17);
  ok("hero order: 14-16 во внешнем слое сверху (строка 1)", [14, 15, 16].every(i => parse(p17.areas[i])[0] === 1));
  ok("hero order: 0 во внутреннем слое сверху (строка 2)", parse(p17.areas[0])[0] === 2);
}

console.log(fail ? `\n${fail} FAILURES` : "\nALL PASSED");
process.exitCode = fail ? 1 : 0;
