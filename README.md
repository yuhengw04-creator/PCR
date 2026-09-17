# CIHANG — product website

Static single-page site for the CIHANG foldable personal care robot. Plain HTML, CSS and JavaScript — no build step.

## Files

```
index.html            page content
assets/css/style.css  styles (light + dark theme tokens at the top)
assets/js/main.js     theme toggle, hero video controls, buy gallery + finishes, scroll-driven unfold, nav highlight, mobile menu, scroll reveals, chat animation
assets/js/map.js      interactive floor-plan demo: waypoint graph, route planning, chair animation
assets/js/drive.js    joystick demo: drive the chair yourself, release-to-stop, wall assist
assets/seq/           56 frames (1280×720 WebP) cut from the film at 10.7–14.7 s for the scroll-driven unfold
assets/img/           web-sized WebP renders (studio/lifestyle set from the latest renders; three autonomy cards are frames from the film)
assets/video/         hero film (cihang.mp4, 1080p, ~18 MB) and its poster frame
assets/favicon.svg
```

## Preview locally

Open `index.html` in a browser, or run a tiny server from this folder:

```
python -m http.server 8000
```

then visit http://localhost:8000.

## Publish on GitHub Pages

1. Create a repository (for example `cihang-site`) and push this folder to the `main` branch.
2. In the repository, open **Settings → Pages**, set Source to **Deploy from a branch**, choose `main` and `/ (root)`, save.
3. The site appears at `https://<username>.github.io/cihang-site/` after a minute or two.

All paths are relative, so it also works in a sub-folder or on a custom domain.

## Editing

- Copy lives in `index.html`; every section is marked with a comment (`FILM`, `BUY`, `FOLD`, `DESIGN`, …, `PEOPLE` = who it's for: four persona cards, the "A day with CIHANG" timeline and two shared-fleet cards).
- Buy module: versions, price text and CTA labels are in the `OFFERS` table in `main.js`; the price line is the `.buy__price` block in `index.html` (delete it to hide pricing). The gallery auto-plays until the visitor clicks a view. Finish swatches (`#buy-finishes`) swap the whole view set: each thumbnail has a `data-base` name and the swatch adds a suffix, so a finish needs the four files `<base><suffix>.webp` in `assets/img/` (currently `-navy` and `-titanium`; those are algorithmic recolours of the cream renders — replace them with real renders when available).
- Film: crops from the top on wide screens; `BOTTOM_KEEP` in `main.js` is the share of the frame allowed to be lost at the bottom (default 4%).
- Colors: change the tokens under `:root` (light, the default) and `:root[data-theme="dark"]` (dark, reached via the nav toggle) in `style.css`.
- To swap the hero film, replace `assets/video/cihang.mp4` (H.264 MP4, keep it under ~20 MB) and `assets/video/poster.webp`.
- To swap an image, drop a new file into `assets/img/` and update the `src` in `index.html`. Keep images ≤ 2800 px on the long side.
- Unfold sequence: `#unfold` in `index.html` (`data-frames` = number of frames); frames are `assets/seq/unfold-NN.webp`. To re-cut: `ffmpeg -ss 10.70 -t 4.00 -i cihang.mp4 -vf "fps=14,scale=1280:-1" -c:v libwebp -quality 78 assets/seq/unfold-%02d.webp`. The wrapper height (`.unfold { height: 240vh }`) sets how much scrolling plays the whole sequence.
- Joystick demo: the flat is drawn from the `WALLS` / `FURN` tables at the top of `drive.js` (same rectangles are used for collision); `ROOMS` holds the goal points and `ORDER` the sequence of targets. Tunables: `VMAX`, `BRAKE` (release-to-stop), `ASSIST_RATE` and the 100-unit assist distance.
- Cache-busting: the CSS/JS links in `index.html` carry `?v=N`; bump the number when you change those files so browsers reload them.
- Interactive map: the control UI is a phone mock-up (`assets/img/phone.webp` frame; the screen rectangle is positioned by percentages in `.phone__screen`). Rooms, doors and hallway waypoints are the `NODES` / `EDGES` / `ROOMS` tables at the top of `assets/js/map.js` (coordinates in the SVG viewBox, 1791 × 1180, ~100 units per metre). Keep every edge horizontal or vertical and inside a hallway or door: the chair only ever drives along these edges, so it cannot cross a wall; re-routes start from the edge it is currently on. Room hit-areas are the `<polygon>` elements and labels are the `.navmap__pin` buttons in `index.html` (`--x` / `--y` percentages). `SPEED` sets the driving speed; `CORNER` is the corner-rounding radius and `TURN_RATE` how fast the body turns while the Mecanum chassis slides along the route. The mic button uses the browser's Web Speech API (Chrome/Edge; recognition language follows the browser language, zh-CN or en-US). The typed commands are matched against the `INTENTS` table (English + Chinese): each entry is a room plus the phrases people actually say for it ("I'm tired" → bedroom, "thirsty" → kitchen, "someone's at the door" → entry, "toilet" → the small WC off the entry, "shower" → bathroom) and a reply that acknowledges the need; order matters, first match wins. Swap `parseIntent()` for a real model call when there is one. The dock pad on the plan is clickable (sends the chair back) and shows a pulse plus "Charging NN%" while docked.
