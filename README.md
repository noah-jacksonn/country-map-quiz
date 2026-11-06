# Country map quiz

A fullscreen, browser-local Asia quiz with the same 48-country selection as [Seterra's Asia quiz](https://www.geoguessr.com/vgp/3167).

## Run

`npm install` then `npm run dev`. Open http://localhost:5197.

`npm run build` makes a static production build in `dist/`. `npm run preview` serves that build. No backend, credentials, or accounts are needed.

## Hosting

ChatGPT Sites hosts the static `dist/` build. `.openai/hosting.json` links this checkout to its Site. Publishing uses the Sites workflow to build, save the matching source revision, and deploy that revision. The Site starts private; its audience is managed separately in Sites.

Game data stays in the visitor's browser. Moving to a new hostname does not automatically copy history from localhost, and progress does not sync across devices. No hosted database or file-storage binding is required.

## Play

- Hover to highlight, click to answer. The high-contrast prompt shows the flag and country name. It follows the pointer; on touch it stays near the bottom. Each wrong guess turns one of its three dots red.
- Three incorrect guesses reveal the answer with a gold color pulse. The color cue continues at a slower pace with reduced motion enabled. Wrong clicks briefly flash the country red and identify it in a top-center message. Country focus follows the shape without a rectangular outline.
- Correct answers retain a small, muted label fitted inside the country. Labels scale with the map; assisted answers use a lighter shade of the same green.
- Accuracy is completed countries divided by total guesses. Water, completed countries, and countries outside the current practice set don't count as guesses.
- Practice includes countries found without a reveal, including second or third guesses. Practice is unscored and can be repeated freely. Each past attempt can also launch practice for its own unassisted answers.
- The current round, known countries, theme and mute preferences, and all completed or interrupted quizzes are stored in localStorage under `country-map-quiz.v1`.
- The palette button switches between Ocean, Forest, Dusk, and Paper; the chosen theme is saved locally. Country borders use brighter strokes on dark themes and darker strokes on Paper. The cursor prompt includes the target country flag.
- Scroll or pinch to zoom, drag to move, or use the bottom-right controls. The initial and reset view is zoomed to 150% and centered on the countries below Russia, leaving northern and eastern Russia partly offscreen. Country shapes also support Tab and Enter/Space.
- Controls and score statistics have hover tooltips.
- Short synthesized right/wrong sounds are enabled by default. The speaker button mutes them. There is no speech.

## Sources and development

Geography is public-domain [Natural Earth data redistributed by world-atlas](https://github.com/topojson/world-atlas), projected ahead of time with D3. `npm run generate:map` regenerates `src/data/map.json` from the retained source package. Label positions and sizes are fitted to each country polygon at generation time. The browser does not load a mapping library or fetch map tiles. Selection follows the referenced game; the dataset provides the boundaries.

Cursor SVGs are copied unchanged from Harmony's landing-page `public/cursors` folder. Water uses the rounded arrow, countries use the pointing hand, and dragging uses the closed hand.

The shared `@noah/segtest` package is included as a committed vendor archive. Vite provides its development-only `/api/debug/segtest` route and the app has a `next-themes` provider. No comparison is active. Follow `/Users/noahjackson/segtest/src/DebugSegtestPanel.tsx` when adding one.
