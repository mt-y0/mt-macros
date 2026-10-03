# blueprint.md — Food + Sleep Tracker with a Local Food-Macro AI Agent (RESEARCH ONLY)

## 0. Instructions to the model (Opus 5.5)

You are a senior software architect and sports-nutrition-informatics researcher.
**Do NOT write the app yet.** This document is a research brief. Your job is to answer the questions in section 6 and return a feasibility report. Be honest and critical: if part of the idea is not possible, or only possible with trade-offs, say so and propose an alternative. Verify current library versions, model sizes, licenses and database availability with live web search where you can, and cite sources. Do not invent numbers or APIs.

Required output:
1. A verdict (possible / possible with trade-offs / not realistic) for every feature in section 4.
2. A recommended tech stack, with reasons and rejected alternatives.
3. The agents involved and what each does (section 5).
4. The databases/datasets to use, with licenses, coverage of Middle-Eastern/Iraqi food, and how to load them offline.
5. A phased MVP roadmap and a rough effort estimate.
6. Risks and unknowns.

## 1. User profile

- Male, 20.8 years, 167 cm, about 55–57 kg (unsure). Student in Iraq, low budget, uses an Android phone (model unknown, assume mid-range, 4–8 GB RAM).
- Goal: gain muscle and weight as fast as is reasonable. Bulk target about 3,000 kcal/day, adjustable.
- Already uses the **Hadeedi** app for workout/weight tracking. The new app must NOT duplicate workout tracking. It covers **food, sleep, body weight trend and habits only**.
- Language: UI in English; the user may type food names in Arabic (Iraqi dialect) or English. Assume Arabic input must work.
- Prefers offline/local operation; low cost or free.

## 2. Diet course the app must support

### Daily targets (training days Sun/Mon/Wed/Thu; same on rest days ±200 kcal)
| | Standard bulk | Aggressive bulk |
|---|---|---|
| Calories | ~3,000 | ~3,300 |
| Protein | 110–115 g (about 2 g/kg) | 115–125 g |
| Fat | ~90 g | ~95 g |
| Carbs | ~430 g | ~490 g |
| Creatine monohydrate | 3–5 g daily, any time | same |
| Water | 3 L+ | same |

Adjustment rule: if the 7-day average weight rises less than 0.15 kg/week for 2 weeks, add about 250 kcal. If it rises more than 0.6 kg/week, remove about 200 kcal.

### The 3 static meals (approximate macros, to be stored as editable "recipes")
1. **Breakfast:** omelet of 2–3 eggs with 1 tbsp (≈14 g) butter, plus tea. About 240–310 kcal, 12–18 g protein. Tip: tea 1 h away from meals (iron absorption).
2. **Lunch:** either 1 chicken thigh or 150–200 g raw chicken breast (cooked/grilled/fried) with 200–300 g **cooked** rice. About 430–650 kcal, 30–50 g protein.
3. **Night shake (550 ml water):**
   - v1: 200 g banana, 100 g oats, 30 g powdered milk, 30 g peanut butter, 10 g sugar ≈ 940 kcal, 31 g P, 139 g C, 30 g F.
   - v2: 220 g banana, 80 g oats, 30 g powdered milk, 50 g peanut butter, 1 date ≈ 1,020 kcal, 34 g P, 142 g C, 38 g F.
   - The app must store **versions** of a recipe and allow quick "varied slightly" edits, because the user does not weigh precisely every time.

### The 2 dynamic meals
Cooked by the user's mother; different every day (Iraqi/Arab home cooking: rice dishes, stews, lentils, beans, bread, yogurt, etc.). The user can describe them in text (Arabic or English), and maybe by photo. Each should be about 450–600 kcal. The app must estimate calories and macros with an honest confidence level.

### Meal skipping / failure rules (the app should encode these as "recovery suggestions")
- Missed one meal: do not make it up in one sitting; add a drink (milk + oats + banana + peanut butter, ~500 kcal) or increase the next meal about 20%.
- Day under 2,200 kcal: log it, "minimum viable day" is 2,200 kcal and 90 g protein. Resume normally next day; the weekly average matters, not a single day.
- Missed gym: shift the session to the next free day, never double up. Missed 2+ sessions in a week: keep only the main lifts.
- Sick or travel: maintain protein and creatine, ignore the calorie target.

## 3. Sleep habit to support

- Target 7–9 h per night, with a consistent bed/wake time (variation under 30–45 min).
- Last caffeine 8 h before bed. Screen/phone off 30 min before sleep. Night shake 60–90 min before bed.
- Track: bedtime, wake time, duration, subjective quality 1–5, caffeine time, nap. Show a 7-day average and a streak.
- Show the correlation between sleep and next-day weight trend / training performance only as a gentle insight, without false precision.

## 4. Features to evaluate (give a verdict for each)

A. Daily food log with the 3 static meals as one-tap templates (scaling and version history).
B. Dynamic-meal entry by free text (Arabic/English) → macro estimate.
C. Dynamic-meal entry by photo (optional, evaluate feasibility on-device).
D. Macro and calorie dashboard vs target, with weekly average and trend.
E. Sleep log and dashboard.
F. Daily body-weight entry with a 7-day moving average and an automatic calorie recommendation (rule in section 2).
G. "Failure day" assistant that suggests the recovery action (section 2).
H. Reminders for meals, creatine, shake and bedtime.
I. Export/import JSON backup; optionally CSV. Check whether importing Hadeedi's JSON exports (weights) is practical. Treat their format as unknown.
J. **Local AI agent** (the core research question), described next.

### 4.1 The local AI agent idea

The user wants an AI agent that runs **locally on the phone (or at least is free and private)**, and that is "trained" on food sources, so that when he types something like "my mom made okra stew with rice, one plate" it:
1. understands the dish and the portion;
2. breaks it into ingredients and quantities (with cooking-oil and raw/cooked assumptions);
3. looks up **exact macros from a real food database** rather than guessing;
4. returns calories/protein/carbs/fat, a confidence level, and asks a short clarifying question when needed;
5. learns the family's recurring dishes, so the next occurrence is faster and more accurate.

Design principle to evaluate: **the LLM should parse and reason, but the numbers must come from a database and deterministic code**, never generated by the model.

## 5. Agents / components to design (propose the real list; this is a starting guess)

- **Parser agent:** text/Arabic → structured dish + ingredients + grams + cooking method.
- **Matcher agent:** ingredient → best database food item (retrieval, embeddings, fuzzy and Arabic transliteration matching).
- **Calculator tool (no LLM):** raw↔cooked conversion, oil absorption, portion → macros.
- **Recipe memory:** stores the family's dishes after confirmation; retrieved first next time.
- **Coach agent (optional):** weekly weight/calorie adjustment, the failure-day suggestions. Rules-based first; LLM only for wording.
- **Vision agent (optional):** photo → dish guess → feed into the parser.

## 6. Research questions for the model to answer

1. **Feasibility:** can a useful version of 4.1 run fully on a mid-range Android phone? What is realistic for RAM, latency, battery and storage? Which part must stay deterministic?
2. **Models:** compare small on-device LLMs (for example Gemma family, Qwen family, Phi family, Llama small variants), their quantization, size, Arabic ability and licensing. Compare runtimes: llama.cpp, MLC-LLM, MediaPipe LLM Inference, ExecuTorch, ONNX Runtime Mobile, and Android AICore/Gemini Nano. State which actually run on Android today and how to bundle them in an app.
3. **"Trained into food sources":** does the user need fine-tuning, or is **RAG + tool calling over a local SQLite database** enough? Explain why. Say what (if any) fine-tuning would add and what it costs.
4. **Databases:** evaluate USDA FoodData Central, Open Food Facts, FAO/INFOODS regional composition tables, any Arabic/Middle-Eastern/Iraqi food composition datasets, and others you find. For each: license, size, offline loading, coverage of cooked home dishes, Arabic names. What to do about coverage gaps (crowd-sourced "my family dish" entries, ingredient-level decomposition)?
5. **Accuracy:** how accurate is LLM + database estimation of home-cooked mixed dishes? Cite literature on dietary self-reporting and AI food-logging error. How should the app show uncertainty and let the user correct it?
6. **Hybrid option:** if on-device is too weak, evaluate a free-tier cloud API fallback (cost, privacy, offline behavior), and a local-network option (PC at home running a model).
7. **Platform:** compare native Android (Kotlin + Jetpack Compose + Room), Flutter, React Native, and a PWA/web app with Capacitor. Pick one for a solo developer using an AI coding assistant. Include how each would run the local model and local DB.
8. **Data:** propose the schema (foods, recipes with versions, meal logs, sleep logs, weight logs, settings, corrections) in SQLite. Backup and restore approach.
9. **Arabic:** how to handle Iraqi dialect food names and mixed Arabic/English input, transliteration, and common home-cooking units (spoon, cup, plate, handful, "kuba").
10. **Photo input:** is on-device portion/dish recognition realistic? If not, say so clearly.
11. **MVP:** what is the smallest version delivering value in 1–2 weeks without the AI (templates + manual macros), and which AI features come in later phases?
12. **Privacy/cost:** estimate cost to run (should be about zero) and list anything that needs a paid account.

## 7. Constraints

- Low or zero budget. Offline-first. Fast to open and log in under 15 seconds.
- Solo developer, built with AI assistance.
- No medical claims; the app gives informational guidance only.

## 8. Final deliverable format

A single structured report with headings matching the sections of "Required output" (section 0), a comparison table for models/runtimes and for databases, an architecture diagram in Mermaid, and a ranked recommendation with a clear "do this first" list.
