# Roadmap & feature status

Feature letters match [`../blueprint.md`](../blueprint.md) §4.

| | Feature | Status | Where |
|---|---|---|---|
| A | One-tap static meals, portion scaling, recipe versions | ✅ Done | Food tab, Meals tab |
| B | Mom's meal by free text (Arabic/English) → macro estimate | ✅ Byte (on-device AI parses, USDA DB computes) + manual entry fallback | Byte tab; Food tab → "Ask Byte" |
| C | Mom's meal by photo | ⏳ Not started (likely cloud/LAN-only; see blueprint §6.10) | — |
| D | Macro dashboard vs target, weekly average & trend | 🟡 Daily plate + bars done; weekly/monthly averages in the Days report; trend chart missing | Food tab, Days tab |
| — | Calendar with a daily score /10 (food, water, sleep, creatine) + weekly/monthly report | ✅ Done | Days tab |
| E | Sleep log & dashboard | ✅ Done (7-day avg, quality, bedtime spread, streak, caffeine warning) | Sleep tab |
| F | Weight log, 7-day avg, automatic calorie recommendation | ✅ Done (+ "Apply") | Weight tab |
| G | Failure-day recovery suggestions | ✅ Done (rules text) | Food tab → "Something went wrong?" |
| H | Reminders (meals, creatine, shake, bedtime) | ⏳ Needs Capacitor local notifications | — |
| I | JSON backup/restore; CSV; Hadeedi import | 🟡 JSON done; CSV + Hadeedi import not started | Settings tab |
| J | Local AI food-macro agent | ✅ First version: wllama + small GGUF model downloaded in-app; DB-grounded numbers | Byte tab, Settings → AI brain |
| — | Sleep ↔ weight/performance insight (blueprint §3) | ⏳ Not started | — |

## Phases

1. **Phase 1 — MVP without AI** ✅ (current): templates, manual entry, dashboards, rules, backup, offline PWA.
2. **Phase 2 — polish & Android**
   - Weekly averages chart on Food tab; CSV export.
   - Vitest unit tests for `logic.ts`.
   - ✅ Capacitor wrap → test APK (debug-signed), now `0.0.5-pre`. ⏳ Local notifications (feature H).
   - ✅ 8-bit look: pixel burger logo, splash intro, retro sounds, pixel food icons (generated), page transitions, Look/Sound settings, immersive fullscreen on Android.
   - Hadeedi JSON import for weights (format unknown — inspect a real export first).
3. **Phase 3 — food database + AI agent** (blueprint §4.1, §5) — 🟡 core done: USDA DB shipped ([food-database.md](food-database.md)), Byte agent ([ai.md](ai.md)), ingredient builder for static meals. Still open:
   - Better Iraqi dish coverage (own recipes decomposed into USDA ingredients); raw↔cooked and oil-absorption factors.
   - Recipe memory for family dishes (confirmed decompositions reused next time).
   - Research report answering blueprint §6 still to be written before choosing model/runtime.

## Open decisions

- Stay PWA + Capacitor vs. go native Kotlin for the on-device LLM phase.
- Which food database(s) and how to get Iraqi dish coverage.
