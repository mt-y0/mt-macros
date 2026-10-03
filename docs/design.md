# Design system

Direction: **"Tigris at dusk", 8-bit cut** — calm, cool river tones with an arcade-orange accent; a clean normal font (pixel art lives in the logo/splash, not the text); hard pixel shadows, 2 px borders and small radii; 8-bit sound effects; illustrations drawn in the palette. Colours come from the chosen **palette** (`app/src/palettes.ts`, applied by `prefs.ts`); `index.css` only holds first-paint defaults (Tigris). Components must use the variables, never raw hex.

## Color tokens

Values below are the default **Tigris** palette; every palette sets the same tokens (see [Palettes](#palettes-settings--look)).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#e6efed` | `#0b1615` | Page background (river mist) |
| `--surface` | `#f6faf9` | `#12201e` | Cards, tab bar |
| `--ink` | `#17302e` | `#dbeae7` | Text, dark illustration parts |
| `--muted` | `#5b7572` | `#87a29e` | Secondary text, labels |
| `--line` | `#c9dbd8` | `#24403c` | Dividers, plate track |
| `--accent` | `#2f7d74` | `#6fc2b4` | Primary buttons, progress (eucalyptus teal) |
| `--accent-soft` | `#d5e8e4` | `#1b3531` | Chips, bar tracks, selected tab |
| `--lavender` | `#7d80c6` | `#a3a6e8` | Sleep accents |
| `--orange` | `#e8772e` | `#f39a4f` | Arcade accent: quick-add `+` buttons, eyebrow labels, active-tab underline, logo bun |
| `--orange-deep` / `--orange-soft` / `--orange-ink` / `--orange-text` | | | Orange 3-D button edge / chip background / chip text / text on orange |
| `--sand` | `#d4ad68` | `#ddb876` | Date-gold: **target reached / over**, food art |
| `--warn` / `--low` | amber / red | lighter variants | Medium / low confidence, warnings |
| `--night-*`, `--star` | indigo gradient | deeper indigo | Sleep header scene |
| `--plate`, `--plate-well`, `--rice`, `--banana` | | | Illustration fills |
| `--splash` | `#10201e` | same | Splash screen, Android window/splash background, PWA theme colour |
| `--shadow` | hard `4px 4px 0` | darker | Pixel drop shadow on cards / tab bar |
| `--radius` / `--radius-sm` | `8px` / `6px` | | Cards, hero, tab bar / buttons, chips, badges — set by the Corners pref |
| `--safe-top` / `--safe-bottom` | | | Cutout / system-bar insets (see [architecture.md](architecture.md#android-fullscreen)) |

## Palettes (Settings → Look)

Omarchy-style theming. `palettes.ts` defines **families**, each with a light and/or dark variant of ten core colours (`bg, surface, ink, muted, line, accent, orange, lavender, sand, red`):

| Family | Variants |
|---|---|
| Tigris (default) | light + dark |
| Catppuccin (Latte / Mocha) | light + dark |
| Gruvbox | light + dark |
| Tokyo Night (Day / Night) | light + dark |
| Nord | light + dark |
| Rosé Pine (Dawn / Main) | light + dark |
| Everforest | light + dark |
| Kanagawa (Lotus / Wave) | light + dark |
| Matte Black, Osaka Jade, Ristretto (Omarchy themes) | dark only |

`paletteVars()` derives every token from the core: `*-soft` = 18–22 % colour mixed into `surface`, `*-deep` = 70 % with black, text-on-colour = black or white by luminance, `--plate-well`, `--banana`, `--rice`, the night-sky gradient, and the shadow/radius tokens. `applyPrefs()` writes them inline on `<html>` (so they beat `index.css`), sets `data-theme` (`light`/`dark`, resolved) and re-applies when the phone switches dark mode.

Look options (all in `prefs.ts`):

| Pref | Options | Effect |
|---|---|---|
| `palette` | family id | colours |
| `theme` (Mode) | Auto / Light / Dark | which variant; one-mode families ignore it |
| `accent` | Palette / Orange / Lavender / Gold / Rose | which core colour drives `--accent*` (buttons, rings, bars, user chat bubbles) |
| `corners` | Square (2/2 px) / Soft (8/6 px) / Round (20/12 px) | `--radius` / `--radius-sm` |
| `shadows` | Pixel (hard 4 px offset) / Soft (blurred) / Flat | `--shadow` |
| `transition` | Slide / Pixel / None | page transitions |

**New palette:** add a `Family` to `PALETTES` (light and/or dark `c(...)` with the ten colours). Nothing else to change.

## Typography

One normal, readable font everywhere: **Readex Pro Variable** (`--display` and `--body` both point to it) — it also covers Arabic, so Arabic food names render properly. Inputs use `dir="auto"` for mixed Arabic/English. (Pixel fonts were tried and dropped — the user preferred a normal font.)

- Page titles `h1` 30 px / 700; card titles `h2` 18 px / 600; section titles 19 px / 600; body 15 px.
- Big numbers: plate 40 px / 700, stats 24 px / 600, `tabular-nums`.
- Eyebrow labels: 12 px uppercase, `letter-spacing: .06em`, `--orange`, 700. Stat labels and badges: 11 px uppercase.

## Retro details

- Cards, hero, quick meals and tab bar: 2 px `--line` border + hard `--shadow`.
- Primary buttons have a 4 px ink "3-D" edge that disappears when pressed; other buttons shift 2 px on press.
- Active tab: `--accent-soft` fill + 3 px orange underline.

## Splash (`Splash.tsx`)

Shown on every launch over the app (which loads underneath). Dark `--splash` screen with faint scanlines: the logo pops in (stepped scale), "MT MACRO" in orange Readex Pro 800 with a double hard shadow, a 10-block loading bar fills, "PRESS START" blinks. After **1.6 s** the screen splits into **4 columns** that fall off the bottom **left → right**: delays 0/140/280/420 ms, durations 620/560/500/440 ms (each column falls faster than the one before but still lands after it), each with a "thud" sound. Total ≈ 2.5 s. `prefers-reduced-motion`: no drop, just a fade. Uses fixed hex colours (same in both themes).

## Sound (`sound.ts`)

8-bit effects synthesized with WebAudio (square/triangle oscillators + sample-and-hold noise, stepped envelopes) — no files. One delegated click listener in `App.tsx` picks the sound by button type:

| Sound | Plays on |
|---|---|
| `select` | bottom tab |
| `coin` | `.primary` buttons and quick-meal logging (`.quick-main`) |
| `down` | `.ghost` buttons (delete, cancel, archive) |
| `blip` | any other button |
| `intro`, `thud` | splash |

Settings → **Sound & feel**: on/off, **volume** (0–100 %, squared onto the master gain; max gain 0.3; plays a coin on release as a preview) and **vibrate on tap** (`navigator.vibrate(12)` via `buzz()` in the same click listener; Android needs the `VIBRATE` permission, which the manifest has).

## Signature: the plate

`Plate` in `ui.tsx` — calorie progress drawn as a **dinner plate from above**: the rim is the progress ring (teal, turns `--sand` when over target), the well shows eaten kcal, target and "X to go". The arc is hidden at 0 to avoid a stray dot.

## Page transitions

Switching tabs remounts `<main>` (`key={tab}`) with `.page-in.from-right` or `.from-left` (new tab to the right of the old one → enters from the right), plus scroll to top. Styles (Settings → Look → Page transition):

| Pref | Effect |
|---|---|
| `slide` (default) | 280 ms fade + 36 px slide, eased |
| `pixel` | same move in 5 hard `steps()` — choppy on purpose, 8-bit feel |
| `none` | no animation |

`prefers-reduced-motion` disables it regardless. Uses `animation-fill-mode: backwards` so no transform stays on `main` after the animation.

## Settings prefs (`prefs.ts`)

Device-only UI preferences in `localStorage` key `mt-prefs` (JSON), **not** in Dexie and not in backups. `usePrefs()` (React, `useSyncExternalStore`), `getPrefs()` (non-React, e.g. `sound.ts`), `setPref()`, `resetPrefs()`. Older `mt-sound=off` and the 0.0.3 accent `teal` are migrated.

| Pref | Default | Settings card |
|---|---|---|
| `palette` | `tigris` | Look → Palette |
| `theme` | `auto` | Look → Mode (Auto / Light / Dark) |
| `accent` | `accent` | Look → Accent colour (Palette / Orange / Lavender / Gold / Rose) |
| `corners` / `shadows` | `pixel` / `hard` | Look → Corners / Shadows |
| `transition` | `slide` | Look → Page transition |
| `splash` | `true` | Look → Intro splash on launch |
| `sound` / `volume` | `true` / `60` | Sound & feel |
| `vibrate` | `true` | Sound & feel → Vibrate on tap |
| `aiModel` | `''` | AI brain → the downloaded model in use (URL); kept by *Reset look & sound* |
| `aiGpu` | `true` | AI brain → Use the GPU (off = CPU only); kept by *Reset look & sound* |

"Reset look & sound" restores the defaults. New pref ⇒ add it to `Prefs` + `DEFAULT_PREFS` and a control in `Settings.tsx`.

## Food icons (`foodIcons.ts`, `FoodIcon` in `ui.tsx`)

Not hand-drawn: flat **SVG** icons **generated** from open emoji databases by `scripts/food-icons.mjs`.

- Source: every *Food & Drink* emoji in `unicode-emoji-json` (+ 🐟), artwork from **Microsoft Fluent Emoji Flat** (`@iconify-json/fluent-emoji-flat`, **MIT**, credited in Settings), search words from **emojilib** + emoji names + the script's `EXTRA` list (gym foods, Iraqi dishes, Arabic words like دجاج / رز / بيض / شاي).
- Output: one SVG per food in `app/public/food/<slug>.svg` (~122 files, ~490 KB, precached) and `src/food-icons.json` (`icons`: slug per index, `words`: word → index, `slots`: per-slot fallback).
- `foodIconIndex(name, slot)`: the **first** word or two-word phrase in the meal name that matches (with simple plural stripping) wins — "Omelet & tea" → 🍳, "Chicken breast & rice" → 🍗; nothing matches → slot fallback (breakfast 🍳, lunch 🍛, shake 🥤, mom's meals 🍲, snack 🥜).
- `<FoodIcon name slot size>` renders `<img src="/food/<slug>.svg">` (default 48 px). Used for usual meals, the eaten list, Meals cards and Byte's estimate rows.
- To add words or foods: edit `EXTRA` in the script, run `node scripts/food-icons.mjs`, commit both outputs. Never hand-edit the SVGs/JSON.

## Illustrations (`art.tsx`)

Hand-made inline SVG for page headers and tabs, colored only with CSS variables (so they follow dark mode), `aria-hidden`.

| Component | Used for |
|---|---|
| `Scale` | Weight header |
| `NightPalms` | Sleep header (moon, stars, date palms; `xMaxYMax slice` so the scene stays right-aligned behind the text) |
| `TabIcons` | bottom tab bar (stroke icons, `currentColor`); `calendar` is the Days tab |

**New meal slot ⇒** add its fallback in `slots` in `scripts/food-icons.mjs` and regenerate.

## Logo

Pixel-art **burger**: a 16×16 burger (orange sesame bun, lettuce, tomato, cheese drip, patty) with an ink outline on a teal (`--accent`) tile — the orange bun is the logo's link to `--orange`.

- Source of truth: the ASCII pixel map in `app/scripts/logo.mjs` — edit it there and run `node scripts/logo.mjs`; never hand-edit the outputs.
- Outputs in `app/public/`: `logo.svg` (favicon, `shape-rendering="crispEdges"`), `logo-192.png`, `logo-512.png`, `logo-maskable-512.png` (full-bleed for Android launchers), `apple-touch-icon.png`. Wired up in `index.html` and the PWA manifest in `vite.config.ts`. The same script writes the Android launcher icons and native splash images.
- It's an asset, not a component, so it uses fixed hex values copied from the light palette.

## Layout rules

- Max width 600 px, 16 px side gutters, cards with `--radius` and hard `--shadow`.
- Every page starts with `.page-head` (eyebrow + `h1`) or a hero (`.hero` plate, `.night` scene).
- Floating bottom tab bar; `main` has 104 px bottom padding (+ `--safe-bottom`) and 20 px top padding (+ `--safe-top`).
- Touch targets ≥ 42 px; visible focus outlines; `prefers-reduced-motion` disables transitions.

## Visual check

Run the dev server, then e.g. `node app/scripts/screenshot.mjs http://localhost:5173/ /tmp/food.png dark LOG` (see [development.md](development.md)). Check light **and** dark at phone width after any UI change.

## Days (calendar tab)

`pages/Calendar.tsx`, styles under `/* Calendar */` in `index.css`. Header (eyebrow *Monthly/Weekly report*, month or date range, ‹ › nav; › disabled once the period reaches today) → Week/Month segmented chips → calendar card → tapped day's breakdown → *Report* card.

- Grid: 7 columns Mon–Sun; month view pads to whole weeks (days outside the month dimmed to 40 %). Each cell: day number top-left, rounded score, three square dots (food `--orange`, water `--teal`, sleep `--lavender`; creatine `--sand` appears only in the breakdown/report).
- Score tiers tint the cell: `t0` `--orange-soft`, `t1` `--accent-soft`, `t2` accent 50 % mixed into surface, `t3` solid `--accent` with `--accent-text`. On `t2`/`t3` the dots switch to `currentColor` so they stay visible. No score → dashed `--line` border; today → `--orange` border; picked → ink outline + shadow; future days disabled.
- Breakdown: one row per part with a dot, *good* badge, the raw numbers (e.g. "2,640 / 3,000 kcal · 100 / 112 g protein"), a bar and "points / max".

## Byte (AI tab)

Chat layout: header with a big animated mascot + status line; Byte's bubbles left (surface, 2 px border, small mascot avatar), user bubbles right (`--accent`); a sticky input bar above the tab bar; **estimate cards** under Byte's replies (food icon, "2 × egg", database food picker, grams input, per-item kcal and how grams were worked out, total, slot picker, *Add to today* / *Skip*). Bubbles and cards pop in. Mascot moods and animations: [ai.md](ai.md#the-mascot-mascottsx).
