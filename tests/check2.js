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

// 5. Drop = обмен тайлов местами (симуляция механики из приложения)
const swap = (arr, f, k) => {
  if (f === k) return arr.slice();
  const copy = arr.slice();
  [copy[f], copy[k]] = [copy[k], copy[f]];
  return copy;
};
const arr = ["A", "B", "C", "D"];
// drag A (idx0) на C (idx2) -> [C,B,A,D]
ok("dnd: A на C", JSON.stringify(swap(arr, 0, 2)) === JSON.stringify(["C", "B", "A", "D"]));
// drag D (idx3) на B (idx1) -> [A,D,C,B]
ok("dnd: D на B", JSON.stringify(swap(arr, 3, 1)) === JSON.stringify(["A", "D", "C", "B"]));
// drag A (idx0) на B (idx1) -> [B,A,C,D]
ok("dnd: A на B", JSON.stringify(swap(arr, 0, 1)) === JSON.stringify(["B", "A", "C", "D"]));
// drag C (idx2) на D (idx3) -> [A,B,D,C]
ok("dnd: C на D", JSON.stringify(swap(arr, 2, 3)) === JSON.stringify(["A", "B", "D", "C"]));
// дроп на себя -> без изменений
ok("dnd: B на себя (no-op)", JSON.stringify(swap(arr, 1, 1)) === JSON.stringify(arr));
// симметричность: A на D == D на A
ok("dnd: симметричность обмена",
  JSON.stringify(swap(arr, 0, 3)) === JSON.stringify(swap(arr, 3, 0)));
// маркеры самой механики в коде/CSS
ok("dnd: drop = swap в state.tiles",
  /const tmp = state\.tiles\[from\];[\s\S]{0,80}state\.tiles\[to\] = tmp;/.test(code));
ok("dnd: цель-обменник dropOnUid", /let dropOnUid = null/.test(code));
ok("dnd: старая вставки-со-сдвигом вычищена",
  !/drop-before|drop-after|drop-noop|setDropTarget/.test(code) &&
  !/drop-before|drop-after|drop-noop/.test(html));
ok("dnd: тост «Видео поменялись местами»", code.includes("Видео поменялись местами"));
ok("dnd: плашка ⇄ по центру цели", /\.tile\.drop-target \.video::before \{\s*content: "⇄"/.test(html));
ok("dnd: плашка ⭐ для слота героя", /\.tile\.drop-hero \.video::before \{ content: "⭐"; \}/.test(html));
ok("dnd: обводка цели — на pseudo-слое выше iframe (иначе её перекрывает плеер)",
  /\.tile\.drop-target \.video::after \{[\s\S]*?outline: 2px solid var\(--accent\)[\s\S]*?z-index: 4/.test(html) &&
  !/\.tile\.drop-target \.video \{ outline-color/.test(html));

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
ok("hero: dnd slot transfer (dropOnHero)", /dropOnHero = onHero/.test(code));
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

// 11. Плейлисты: парсинг ссылок, модалка, тайл, сцена, автопропуск
{
  // --- extractList: чистая функция, вырезаем и гоняем без браузера ---
  const srcId = code.match(/function extractId[\s\S]*?\n\}/)[0];
  const srcList = code.match(/function extractList[\s\S]*?\n\}/)[0];
  const location = { href: "http://localhost:8000/index.html" };
  const extractId = eval("(" + srcId + ")");
  const extractList = eval("(" + srcList + ")");
  const PL = "PLnvEBIEMe10kMGIDhrSEeRpalQ0vWpjpA";
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ok("list: watch?v=ID&list=PL → list + videoId",
    eq(extractList("https://www.youtube.com/watch?v=ycGDR752fT0&list=" + PL),
       { list: PL, videoId: "ycGDR752fT0" }));
  ok("list: /playlist?list=PL → только list",
    eq(extractList("https://www.youtube.com/playlist?list=" + PL), { list: PL, videoId: null }));
  ok("list: youtu.be/ID?list=PL → list + videoId",
    eq(extractList("https://youtu.be/ycGDR752fT0?list=" + PL),
       { list: PL, videoId: "ycGDR752fT0" }));
  ok("list: голый ID плейлиста → list",
    eq(extractList(PL), { list: PL, videoId: null }));
  ok("list: голый ID видео (11 символов) — не плейлист", extractList("ycGDR752fT0") === null);
  ok("list: обычное видео без list → null",
    extractList("https://www.youtube.com/watch?v=ycGDR752fT0") === null);
  ok("list: чужой домен с list= → null",
    extractList("https://example.com/playlist?list=" + PL) === null);
  ok("list: пусто → null", extractList("") === null && extractList("   ") === null);

  // --- iframeSrc: у плейлиста videoseries и всегда с начала ---
  const srcFns = code.match(/function iframeSrc[\s\S]*?\n\}/)[0];
  const FILE_MODE = false;
  const location2 = { origin: "http://localhost:8000" };
  const iframeSrc = eval("(" + srcFns + ")");
  const plSrc = iframeSrc({ list: PL, id: "", muted: true, start: 0, loop: false });
  ok("iframe: плейлист → /embed/videoseries? c list=",
    plSrc.includes("/embed/videoseries?") && plSrc.includes("list=" + PL));
  ok("iframe: плейлист + enablejsapi", plSrc.includes("enablejsapi=1"));
  ok("iframe: плейлист играет с первого видео (без старта)", !plSrc.includes("start="));
  ok("iframe: 🔁 плейлиста → loop=1 в URL",
    iframeSrc({ list: PL, id: "", loop: true }).includes("loop=1"));
  ok("iframe: обычный тайл не задет",
    iframeSrc({ id: "ycGDR752fT0", muted: true, start: 5, loop: false })
      .includes("/embed/ycGDR752fT0?"));

  // --- функции ---
  for (const fn of ["extractList", "fetchPlaylistInfo", "fetchPlaylistMeta", "getPlaylistIds",
                    "openPlaylistModal", "addPlaylistTile",
                    "insertSeveralFromPlaylist", "updatePlNav", "badgeText", "handleTileError",
                    "onTilePlaying", "onTileEnded", "currentVideoId", "pushTile"]) {
    ok(`pl fn defined: ${fn}`, new RegExp("(function\\s+" + fn + "\\s*\\()").test(code));
  }

  // --- модалка: нативный <dialog> ---
  ok("dialog: <dialog id=playlistDialog>", /<dialog id="playlistDialog"/.test(html));
  ok("dialog: form method=dialog (закрытие без JS)", /<form method="dialog">/.test(html));
  ok("dialog: aria-labelledby", /aria-labelledby="plTitle"/.test(html));
  ok("dialog: кнопки video/playlist/several",
    /id="plBtnVideo" value="video"/.test(html) &&
    /id="plBtnPlaylist" value="playlist"/.test(html) &&
    /id="plBtnSeveral" value="several"/.test(html));
  ok("dialog: showModal()", /plDialog\.showModal\(\)/.test(code));
  ok("dialog: автофокус showModal перехвачен (иначе Enter сразу жмёт кнопку)",
    /plDialog\.showModal\(\);[\s\S]{0,320}?plDialog\.focus\(\);/.test(code) &&
    /requestAnimationFrame\(\(\) => \{ if \(plDialog\.open\) plEls\.btnPlaylist\.focus\(\); \}\)/.test(code));
  ok("dialog: returnValue сбрасывается перед открытием", /plDialog\.returnValue = "";/.test(code));
  ok("dialog: действие по submit/e.submitter (close не диспатчится в Electron)",
    /querySelector\("form"\)\.addEventListener\("submit"/.test(code) && /e\.submitter && e\.submitter\.value/.test(code));
  ok("dialog: нет завязки на close-событие", !/plDialog\.addEventListener\("close"/.test(code));
  ok("dialog: кнопки во всю ширину модалки", /#playlistDialog button \{ width: 100%/.test(html));
  ok("dialog: разделитель перед секцией количества", /class="dlg-sep"/.test(html) && /\.dlg-sep \{/.test(html));
  ok("dialog: отступ перед «Отмена»", /class="dlg-gap"/.test(html) && /\.dlg-gap \{ height: 22px; \}/.test(html));
  ok("dialog: центр по ширине, сверху по вертикали",
    /#playlistDialog \{[\s\S]{0,400}?position: fixed;[\s\S]{0,120}?top: 24px;[\s\S]{0,80}?margin: 0 auto;/.test(html));
  ok("dialog: секция «Вставить несколько» единым блоком",
    /id="plSeveral" hidden/.test(html) && /plEls\.several\.hidden = !pure/.test(code));
  ok("dialog: название плейлиста отдельной строкой, без «— выбери…»",
    /Ссылка ведёт на видео внутри плейлиста:\\n«" \+ r\.title/.test(code) && !code.includes("— выбери, что вставить."));
  ok("dialog: .dlg-info рендерит \\n как перенос", /#playlistDialog \.dlg-info \{[^}]*white-space: pre-line/.test(html));
  ok("dialog: клик по подложке закрывает окно",
    /plDialog\.addEventListener\("click"/.test(code) && /if \(outside\) plDialog\.close\(\)/.test(code));
  ok("dialog: заголовок/права через oembed (CORS-дружелюбный)", code.includes("youtube.com/oembed?format=json&url="));
  ok("dialog: состав через cuePlaylist + getPlaylist", 
    code.includes("cuePlaylist({ list: listId") && code.includes("player.getPlaylist()"));
  ok("dialog: временный плеер уничтожается после чтения", code.includes("player.destroy()"));
  ok("dialog: контейнер временного плеера вставляется в DOM", code.includes("document.body.appendChild(holder)"));
  ok("dialog: file:// → состав недоступен (error api)", code.includes('resolve({ error: "api" })'));
  ok("нет CORS-мёртвых запросов: youtubei browse вычищен", !code.includes("youtubei/v1/browse"));
  ok("css: ::backdrop модалки", /#playlistDialog::backdrop/.test(html));
  ok("css: счётчик .pl-pos", /\.strip \.pl-pos/.test(html));

  // --- тайл-плейлист ---
  ok("pl: листание previousVideo/nextVideo вызывается",
    /pl\.previousVideo\(\)/.test(code) && /pl\.nextVideo\(\)/.test(code));
  ok("pl: кнопки ⏮/⏭ в полоске",
    code.includes('prevBtn.className = "pl-prev"') && code.includes('nextBtn.className = "pl-next"'));
  ok("pl: счётчик позиции", code.includes('pos.className = "pl-pos"'));
  ok("pl: playVideo после листания (иначе CUED-залипание)",
    /dir < 0 \? pl\.previousVideo\(\) : pl\.nextVideo\(\);[\s\S]{0,200}if \(!state\.allPaused\) pl\.playVideo\(\)/.test(code));
  ok("pl: playVideo после автопропуска ошибки",
    /pl\.nextVideo\(\);\s+if \(!state\.allPaused\) pl\.playVideo\(\);[\s\S]{0,60}чтобы пропущенное/.test(code));
  ok("pl: setLoop при готовности", /pl\.setLoop\(!!tile\.loop\)/.test(code));
  ok("pl: позиция в бейдже", /base \+ " · " \+ t\._plPos/.test(code));
  ok("pl: «Старт» скрыт у плейлиста", /if \(!t\.list\) \{/.test(code));

  // --- права: автопропуск с ограничителем, заглушка ---
  ok("pl: onError → handleTileError (не сразу заглушка)",
    /onError: ev => handleTileError\(uid, ev\.data\)/.test(code));
  ok("pl: ENDED → onTileEnded", /PlayerState\.ENDED\) \{\s*onTileEnded\(uid\)/.test(code));
  ok("pl: максимум 3 ошибки подряд", /\(plErrCount\[uid\] \|\| 0\) < 3/.test(code));
  ok("pl: счётчик сбрасывается на PLAYING", /plErrCount\[uid\] = 0; \/\/ видео пошло/.test(code));
  ok("pl: заглушка с пометкой плейлиста", /showVideoError\(uid, code, !!\(t && t\.list\)\)/.test(code));
  ok("pl: ручной сброс при rebuildIframe", /plErrCount\[t\.uid\] = 0; \/\/ новая попытка/.test(code));

  // --- сцена: version 3, поле list опциональное ---
  ok("scene: list сохраняется", /list: t\.list \|\| undefined/.test(code));
  ok("scene: filter пускает тайл-плейлист", /filter\(t => t && \(t\.id \|\| t\.list\)\)/.test(code));
  ok("scene: валидация id плейлиста", /typeof t\.list === "string"/.test(code));
  ok("scene: detectAspect только при t.id", /if \(!t\.detected && t\.id\) detectAspect/.test(code));

  // --- массовая вставка: только обычные видео ---
  ok("paste: чистые плейлисты считаются отдельно",
    /const plCount = parts\.filter\(p => extractList\(p\) && !extractId\(p\)\)\.length;/.test(code));
  ok("paste: тост сообщает о пропущенных плейлистах", code.includes("· плейлистов пропущено: "));
  ok("hotkeys: guard при открытой модалке", /if \(plDialog\.open\) return;/.test(code));

  // 12. Пропорции: oembed вместо innertube, рилс → 9/16
  ok("aspect: innertube player вычищен", !code.includes("youtubei/v1/player"));
  ok("aspect: нет остатков мёртвых gcd/ratioStr", !/function gcd\(|ratioStr/.test(code));
  ok("aspect: detectAspect через oembed (источник без CORS-проблем)",
    /function detectAspect[\s\S]*?oembed\?format=json&url=/.test(code));
  ok("aspect: пропорции приводятся к ближайшему формату",
    /function nearAspect\(/.test(code) && /nearAspect\(d\.width, d\.height\)/.test(code));
  ok("aspect: рилс-уточнение через shorts-форму oembed",
    /d\.width === 200 && d\.height === 113/.test(code) && /oe\("https:\/\/www\.youtube\.com\/shorts\/" \+ id\)/.test(code));
  ok("aspect: недоступное видео → остаёмся на 16/9",
    /if \(!d \|\| !d\.width \|\| !d\.height\) return;/.test(code));
  ok("aspect: метка «авто (…)» обновляется после детекта", /option\[value="auto"\]/.test(code));
  ok("aspect: рилс-ссылка распознаётся", /function isShortsUrl\(/.test(code));
  ok("aspect: addVideo ставит 9/16 для рилса без сети",
    /isShortsUrl\(raw\) \? "9\/16"/.test(code) && /pushTile\(t, known \? null : id\)/.test(code));
  ok("aspect: массовая вставка прокидывает рилс-флаг из ссылок",
    /v\.short \? "9\/16" : null/.test(code));
}

console.log(fail ? `\n${fail} FAILURES` : "\nALL PASSED");
process.exitCode = fail ? 1 : 0;
