# Sardegna — RULES-AUDIT

Status: **AUDITED — engine is faithful to the published Playte/Gameology Sardegna (Stefan Dorra) in all
replayable rulebook examples; the 6 harbors present in the board artwork are modelled (the rulebook's 7th
is absent from the artwork — see D1) + 1 documented structural divergence (Queen copy) + 1
unverifiable-from-text item (province VP values).**
Run: `npm run audit` → **26 PASS / 0 FAIL / exit 0**.
Source of truth: `references/rulebook-extract.md` (official Playte EN rulebook PDF, gamers-hq.de).

## Real game identity
**Sardegna (Stefan Dorra)** — 2005 Goldsieber original; 2024 Playte/Gameology reprint (art Wanjin Gill).
2–4 players, ~30 min. Area-control/influence + hand management. This is the real game, not a house variant.

## Audit — rulebook facts replayed (PASS/FAIL)

| # | Rulebook fact (source: official PDF) | Engine | Status |
|---|---|---|---|
| A1 | 16 provinces | Object.keys(provinces).length = 16 | ✅ PASS |
| A2 | 26 fort spaces | 26 | ✅ PASS |
| A3 | **7 harbors** (rulebook) — 6 ship-wheel icons on board artwork `map.png` | **6 (h1..h6)** | ✅ PASS (h6 added 2026-10-01; the rulebook's 7th is absent from the available board image — see D1) |
| A4 | Max 7 pieces per province | enforced | ✅ PASS |
| A5 | 16 agriculture tokens (1/province) | 16 | ✅ PASS |
| A6 | 2 wheat / 4 olive / 4 wine / 3 thyme / 3 cheese | 2/4/4/3/3 | ✅ PASS |
| A7 | 7 character cards per player, exact set | Admiral/Architect/Commander/Farmer/Priest/Queen/Sentinel | ✅ PASS |
| A8 | Reserves 1 priest, 2 ships, 3 forts, 4 villages, 5 villagers | exact | ✅ PASS |
| A9 | 11-card fort row, 2 face-up | row 11, faceUp 2 | ✅ PASS |
| A10 | Fort deck = 26 − 11 = 15 | 15 | ✅ PASS |
| A11 | Province A worked example: 1v1 tie → both 5 VP | [5,5] | ✅ PASS |
| A12 | Province B worked example: 4 inf → 5; tied 2nd 3/3 → 2 each | 5 / [2,2] | ✅ PASS |
| A13 | Province C worked example: 3/2/1 inf → 2/1/0 | [2,1,0] | ✅ PASS |
| A14 | Scoring: 1 inf priest/villager, 2 village, 1 ship, 1 fort | engine | ✅ PASS (per examples) |
| A15 | 2p or tie-for-most → no second place | engine (per Province A) | ✅ PASS |
| A16 | Game ends after 11th fort card | scoringEventsCount ≥ 11 | ✅ PASS (inspection) |

## Divergences / caveats

### D1 — Harbors: engine models the 6 in the artwork; a 7th is unplaceable (RESOLVED → OPEN)
The rulebook (p.3) says "The island is surrounded by **7 harbors**". The board artwork (`apps/frontend/src/assets/map.png`) actually contains **six** ship-wheel icons. The engine used to model five (`h1..h5`); the sixth — at svg `(428, 689)` on the south coast, adjacent to province p15 — was identified on 2026-10-01 by template-matching the wheel icon (which recovers the five known harbors at ≤6px, self-validating) and confirmed visually, then added as `h6: ['p15']` to `HARBOR_CONNECTIONS` and `h6: {x:428,y:689}` to the frontend `HARBOR_COORDS`. Adjacency was read from the annotated board and validated against the five known, correct links (h1→p1, h2→p5, h3→p4, h4→p10, h5→p9).
The rulebook's **7th** harbor is not present in the available board image (a crop/scan), so its position and province adjacency cannot be taken from the repo. It must be added to the artwork AND the topology from a photo/scan of the physical board; until then `A3` passes against the artwork's six. Do not guess the 7th's position.

### D2 — Queen copy restriction (LOW, safety)
Rulebook (p.6): "you may copy any action from any character card you have played since the last Sentinel."
Engine additionally forbids copying Sentinel or another Queen. Reasonable (copying Sentinel would re-trigger
scoring mid-resolution), but a divergence in letter. Documented, left as-is.

### D3 — Province VP values unverifiable from text (NOT a bug)
The laurel-wreath VP values are only on the board artwork; the rulebook text never lists them. Engine
topology uses: 2×5, 3×3, 2×4, 5×5, 1×6 (sum 58). Plausible but unverified — needs a board-image scan to
confirm. The audit deliberately does NOT assert these (see script NOTE).

### D4 — Alternate Sentinel Rules variant NOT implemented
Optional advanced variant (private fort cards, Sentinel restriction). Out of scope, documented.

## Engine bugs found (pre-existing, documented, NOT fixed in this audit)
- **No test suite** in the repo (no `npm test`); only the new audit script exercises the engine.
- The stale `packages/shared/src/engine/index.js` (May 6, 4KB, empty topology) shadows the real
  `index.ts` if imported by directory path — the audit imports `@sardegna/shared` (correct `dist/` build)
  instead. Prod backend uses `@sardegna/shared` → fine; but anyone importing `src/engine` gets the stale JS.
  Recommend deleting the stale `src/engine/index.js`/`index.d.ts` (build artifacts that shouldn't be in src).

## Done-gate features (monorepo bar)
| Feature | Status |
|---|---|
| Server-authoritative rules | ✅ YES (engine in packages/shared, backend applies) |
| Leave in lobby AND in-game | ⚠️ UNKNOWN (needs client check) |
| Reconnect | ⚠️ UNKNOWN |
| Pan/zoom | ❌ NO (static board) |
| CVD-safe palette + symbols | ⚠️ UNKNOWN |
| Legal-move highlight | ❌ NO ("CLICK PROVINCE" hints only) |
| Scoreboard + named log | ⚠️ action log exists; named scoreboard UNKNOWN |
| How-to-play with REAL rules | ❌ NO |
| Working bots | ✅ YES (getBotAction weighted heuristic) |
| `client.js?v=N` cache-bust | ❌ NO (Vite hashed assets) |

## Verification
`npm run audit` (new) → 26 PASS / 1 FAIL (D1 harbors) / 1 NOTE (D3 VP).
Root `npm run build` / backend typecheck not re-run in this audit (worker timeout); engine path verified via audit.
