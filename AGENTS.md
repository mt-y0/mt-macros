# MT Macro — agent guide & documentation index

Offline-first PWA tracking **food, sleep, body weight and habits** for one user on a bulking diet. Phase 1 (no AI) is built in `app/`. Product brief: [`blueprint.md`](blueprint.md).

## ⚠️ Documentation rule (mandatory)

**Every change must be documented — no matter how small** (feature, fix, design tweak, rule change, schema change, new script, new dependency):

1. Update the relevant file(s) in `docs/` so they match the code.
2. Add a dated line to [`docs/changelog.md`](docs/changelog.md) naming what changed and which doc covers it.
3. If you **add, rename or remove** a doc file, update the index below in `AGENTS.md`.
4. If a feature's status changes, update [`docs/roadmap.md`](docs/roadmap.md).

A change is not done until its docs are. Docs must describe the code as it is — never planned behaviour as if it exists.

## Documentation index

| File | Read it when you need… |
|---|---|
| [`blueprint.md`](blueprint.md) | The original product brief, diet targets, rules and research questions |
| [`docs/overview.md`](docs/overview.md) | What the app is, who it's for, scope, current phase, core principles |
| [`docs/architecture.md`](docs/architecture.md) | Stack, folder layout, data flow, offline/PWA setup |
| [`docs/food-database.md`](docs/food-database.md) | The bundled USDA food database: source, build script, format, search ranking, synonyms |
| [`docs/ai.md`](docs/ai.md) | Byte, the on-device AI agent: pipeline, prompt, model download, mascot, limits |
| [`docs/data-model.md`](docs/data-model.md) | Dexie tables, recipe versioning, seeding, targets, backup format, schema-change checklist |
| [`docs/logic.md`](docs/logic.md) | Every rule and calculation (min viable day, calorie adjustment, sleep stats, recovery advice) |
| [`docs/design.md`](docs/design.md) | Palette tokens, typography, the plate, illustrations, layout rules |
| [`docs/development.md`](docs/development.md) | Commands, screenshot script, definition of done, conventions, gotchas |
| [`docs/roadmap.md`](docs/roadmap.md) | Feature status (A–J), phases, open decisions |
| [`docs/changelog.md`](docs/changelog.md) | History of every change |

## Code map (quick)

| Path | What |
|---|---|
| `app/src/db.ts` | Schema, types, targets, `saveRecipeVersion`, backup |
| `app/src/logic.ts` | Pure rules — put numbers/rules here, not in pages |
| `app/src/seed.ts` | Default recipes + duplicate cleanup |
| `app/src/ui.tsx` / `art.tsx` | Shared components / SVG illustrations |
| `app/src/Splash.tsx` / `sound.ts` | Launch splash (4-column drop) / 8-bit WebAudio sounds |
| `app/src/prefs.ts` | Device prefs (theme, accent, transition, splash, sound, volume, vibrate) |
| `app/src/foodIcons.ts` + `scripts/food-icons.mjs` | SVG food icons generated from an emoji database |
| `app/src/foodDb.ts` + `scripts/food-db.mjs` | Bundled USDA food database: search, portions, macros |
| `app/src/ai/` | Byte: `engine.ts` (wllama), `models.ts`, `agent.ts` (prompt), `estimate.ts` (DB maths) |
| `app/src/palettes.ts` / `Mascot.tsx` | Theme palettes / Byte's face |
| `app/src/pages/*.tsx` | Today (Food), Chat (Byte), Calendar (Days: daily score + reports), Weight, Sleep, Recipes (Meals), Settings |
| `app/src/index.css` | Design tokens + styles |
| `app/scripts/screenshot.mjs` | Headless phone screenshots |
| `app/scripts/logo.mjs` | Pixel-art logo source → `app/public/` icons |
| `Makefile` | Build/APK/debug shortcuts (`make help`) |
| `app/android/` | Capacitor Android project (`MainActivity.java` = immersive fullscreen) |

## Essentials

- Run: `cd app && npm run dev -- --host`. Check: `npm run build && npm run lint`.
- Numbers come from deterministic code / a food database — **never** from an LLM.
- No workout tracking (the user's Hadeedi app does it). No medical claims.
- Offline only: no runtime network calls — **except** the user-initiated AI model search/download in Settings → AI brain. Bundle everything else and add its extension to Workbox `globPatterns`.
- The AI model is never bundled; the food database is.
- UI changes: screenshot light + dark at phone width before calling it done.
- **Testing is never headless:** run browser tests/screenshots in a **visible** Chromium window so the user can watch (`scripts/drive.mjs`, `scripts/screenshot.mjs` are headed by default) and say what the window will do first. See [`docs/development.md`](docs/development.md#testing).
