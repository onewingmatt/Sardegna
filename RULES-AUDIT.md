# Sardegna — RULES-AUDIT

Status: **AUDITED — engine is faithful to the published Playte/Gameology Sardegna (Stefan Dorra) in all
replayable rulebook examples; 1 real divergence (harbor count) + 1 documented structural divergence (Queen
copy) + 1 unverifiable-from-text item (province VP values).**
Run: `npm run audit` → **26 PASS / 1 FAIL (harbors) / exit 0 NOT met** (the 1 FAIL is the harbor gap, a
known real divergence; the rest of the gate is green).
Source of truth: `references/rulebook-extract.md` (official Playte EN rulebook PDF, gamers-hq.de).

## Real game identity
**Sardegna (Stefan Dorra)** — 2005 Goldsieber original; 2024 Playte/Gameology reprint (art Wanjin Gill).
2–4 players, ~30 min. Area-control/influence + hand management. This is the real game, not a house variant.

## Audit — rulebook facts replayed (PASS/FAIL)

| # | Rulebook fact (source: official PDF) | Engine | Status |
|---|---|---|---|
| A1 | 16 provinces | Object.keys(provinces).length = 16 | ✅ PASS |
| A2 | 26 fort spaces | 26 | ✅ PASS |
| A3 | **7 harbors** | **5 (h1..h5)** | ❌ FAIL |
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

### D1 — Harbors: engine models 5 of 7 (REAL, MEDIUM)
The rulebook (p.3) says "The island is surrounded by **7 harbors**"; the engine topology has only `h1..h5`.
Two harbors (and their province adjacencies) are missing, so ship placement/movement near them is impossible
or wrong. **Not trivially safe to fix** — requires adding the missing harbor entries to the topology and
confirming adjacency against the board image. Documented for follow-up.

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
