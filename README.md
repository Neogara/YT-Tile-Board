# **English** | [Русский](README.ru.md)

# YT Tile Board 🎬

**A multi-video YouTube board for OBS — one HTML file, zero plugins.**

Paste a bunch of YouTube links, arrange them into a grid, hit **OBS mode** — and you get a scene where up to 16 videos play side by side (the preset ships with 5): no black bars, no cropping, no ten separate Browser Sources.

![Demo: paste 3 links, board fills up](docs/demo.gif)

![Single HTML file](https://img.shields.io/badge/single-HTML%20file-ff4e45)
![Zero dependencies](https://img.shields.io/badge/zero%20dependencies-2d7ff9)
![Ready for OBS](https://img.shields.io/badge/ready%20for%20OBS-8b919c)

> **▶️ Ready to use:** [`neogara.github.io/YT-Tile-Board`](https://neogara.github.io/YT-Tile-Board/) — paste it into an OBS Browser Source; nothing to install or run locally.

## Why bother

- **One file instead of N Browser Sources** — `index.html` *is* the product: HTML + CSS + JS inline, no build step, no dependencies.
- **Scene = URL** — the entire layout is encoded in the link hash. Copy *URL сцены*, paste it into OBS, done.
- **Hosted on GitHub Pages** — no `start.bat`, no local server: the ready link works out of the box.
- **No black bars** — video aspect ratio is detected automatically; every tile hugs its content.
- **Reorder without reload** — drag tiles by the `⠿` grip; videos keep playing because only the flex order changes.
- **Errors don't go black** — a disabled embed shows a readable plaque (`code → reason → delete`) instead of a dead rectangle.
- **Ships with a preset** — first boot loads a ready 5-video sludge board from `preset.json`.

## Quick start

**🚀 Hosted on GitHub Pages (no install):**

1. In OBS: **Sources → + → Browser**
   - URL: `https://neogara.github.io/YT-Tile-Board/`
   - Size: **1920 × 1080**
   - ☑ *Refresh browser when scene becomes active*
2. Done — the bundled 5-video preset loads on first visit. No server needed at all.

**🔧 Local run (development / customization):**

1. Take `index.html` and `preset.json` (keep them in the same folder).
2. Run **`start.bat`** (or `node server.js`) → opens `http://localhost:8000`.
   > YouTube blocks embeds & autoplay on `file://` (error 153) — open the board through any HTTP server instead; `server.js` is a zero-dependency one.
3. Point OBS at `http://localhost:8000/index.html` as above.

Either way, click **📺 OBS mode** — all editor chrome disappears, videos fill the scene.

## Screenshots

| Editor | OBS mode |
|:--:|:--:|
| ![Editor: 5 videos in a grid with control strips](docs/editor.jpg) | ![OBS mode: clean board with title badges and exit bar](docs/obs.jpg) |

**Control panel** — pause/mute everything, master volume, title badges:

![Control panel with hotkey hints](docs/panel.jpg)

**Error plaque** instead of a black tile:

![Error plaque: video unavailable, embed forbidden, delete tile](docs/error.jpg)

## Controls

### Hotkeys

| Key | Action |
|---|---|
| `Space` | pause / resume **all** videos |
| `M` | mute / unmute everything (works in RU layout too) |
| `F` | fit the whole board to the screen (no scrolling) |
| `1`–`9` | toggle that tile fullscreen |
| `Esc` | close fullscreen / leave OBS mode |

Hotkeys are ignored while you're typing in a field. In OBS they work through the source's **Interact** window (right-click source → *Interact*).

### Control panel

- **⏸ Пауза / ▶ Пуск** — pause or resume every video at once
- **🔇 Звук / 🔊 Звук вкл** — global mute; when off, each tile returns to its own mute setting
- **Громкость** — master volume (0–100) applied to all players
- **🏷 Подписи** — toggle title badges over the videos (visible in OBS mode too)

Panel state travels with the scene (`allPaused`, `masterMuted`, `volume`, `labels`).

## Working with the scene

- **Add videos** — paste a link or an 11-char ID → `Enter`. Paste a whole **list** (separated by spaces, newlines, commas or semicolons) and every video is added at once — duplicates are skipped, cap is 16.
- **Reorder** — drag the `⠿` grip on a tile's control strip.
- **Per-tile strip** under each video:
  - label (becomes the badge over the video),
  - playback speed (`0.25×`–`2×`),
  - aspect — `auto` (auto-detected) or fixed `16/9`, `9/16`, `4/3`, `1/1`, `21/9`,
  - start offset (seconds), mute, loop, delete.
- **Layout** — columns `1`–`4` or `auto` (picks the count by window width), **По размеру видео** (tiles hug aspect ratios → no bars) or stretch, **Вписать в экран** (scale everything to fit, no scroll).
- **Save & share**
  - **💾 Сохранить .json** / **📂 Загрузить** — scene files;
  - **drag & drop a `.json` anywhere on the page** — loads it;
  - **🔗 URL сцены** — one link with the whole scene in the hash (best for OBS);
  - **🎬 Пресет** — reload the bundled 5-video board.
- Everything is auto-saved to `localStorage`; on next open the last scene is restored (hash URL wins).
- **🗑 Очистить** — wipe the whole board (asks for confirmation first).

## OBS setup tips

- Use **1920×1080** — the board scales, but the layout is designed for 16:9.
- The hosted link needs no server at all; for a local URL keep `server.js` running (add `start.bat` to startup).
- **📺 OBS mode** hides the editor; the thin top bar (hint + `✕ Выход`) stays *above* the grid so it never covers video.
- Videos autoplay **muted** (browser policy). Unmute with **🔊** — OBS's CEF respects it.
- `Refresh browser when scene becomes active` re-syncs everything on scene switch.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Black tiles, **error 153** in console | You opened it via `file://` — use the hosted link or run `start.bat` |
| Plaque *Видео недоступно (2 / 5 / 100 / 101 / 150)* | Bad ID (2), the player can't play it (5), video deleted (100) or embedding banned (101/150) — swap the link, the plaque has a delete button |
| Aspect looks wrong | The automatic probe can fail (CORS) and falls back to 16:9 — pick the format manually in the tile strip |
| Scene "forgot" itself | State lives in `localStorage`; an URL hash overrides it — check the address bar |
| No sound | Everything starts muted by design; press **🔊 Звук** and check the master slider |

## Project structure

```
index.html      the whole app (HTML + CSS + JS inline)
preset.json     bundled 5-video preset
server.js       zero-dependency dev server (start.bat wraps it)
docs/           screenshots and the demo GIF for this README
tests/          regression checks: node tests/check.js && node tests/check2.js
```

## License

**Not (yet) specified.** Issues and PRs are welcome.
