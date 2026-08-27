# Sardegna — real-rules extraction

**Source (primary):** official Playte/Gameology EN rulebook PDF,
`https://gamers-hq.de/media/pdf/2e/1e/e2/Sardegna_rule_EN_booklet.pdf` (11 pages, text layer extracted).
**Cross-checked:** Tabletopping review (https://tabletopping.games/2024/09/28/...), BGG #390589 (Stefan Dorra).

Verbatim/verified facts (used by RULES-AUDIT and `scripts/independent-rules-check.ts`):

## Identity
- **Sardegna**, designed by **Stefan Dorra**. Originally Goldsieber 2005; Playte (Gameology Inc.) reprint 2024.
- 2–4 players, ages 14+, ~30 min.

## Component inventory (rulebook p.2)
- 1 game board, **26 fort cards**, 28 character cards, 4 score markers, 4 priests, 8 ships, **12 forts**,
  16 villages, 20 villagers, **16 agriculture tokens**, 4 summary cards.
- Per player: 7 character cards, 15 pieces = 1 priest + 2 ships + 3 forts + 4 villages + 5 villagers.

## Board facts (rulebook p.3)
- **16 provinces**, each with an agriculture token.
- **Max 7 pieces per province** (priests/villages/villagers); full = nothing more added.
- Crossing a border costs 1 movement; priests/villagers move *through* full provinces but cannot *end* there.
- **26 square fort spaces** at intersections; max 1 fort per space.
- **7 harbors** (ship's wheel). Max 2 ships/harbor (1 in 2p); no player both ships in same harbor.

## Characters (rulebook p.4–6)
- Admiral / Commander / Priest / Farmer / Architect / Queen / Sentinel — exact effects transcribed in SCOPE.md.

## Scoring (rulebook p.7)
- Influence: 1 per priest or villager in province, 2 per village, 1 per ship in adjacent harbor, 1 per fort
  on border.
- Most influence → full province VP (laurel wreath); second-highest → half, rounded down.
- **2p or tie-for-most → no second place points.**

## Worked examples (rulebook p.7–8) — the numbers the audit replays
- **Province A** (worth 5): Blue 1 villager + Purple 1 fort = 1 influence each → **both 5**.
- **Province B** (worth 5): Yellow village+ship+fort = 4 influence; Purple & Green 3 each → Yellow **5**,
  Purple/Green **2 each**.
- **Province C** (worth 2): Blue 3 influence (village+fort), Yellow 2 (villager+fort), Purple 1 (fort) →
  Blue **2**, Yellow **1**, Purple **0**.
- Fort-card example: fort cards 6 & 17 face up at start; after Sentinel, discard #6, reveal #8, choose keep
  or discard+replace.

## End of game (rulebook p.9)
- Ends after the **11th fort card is scored**; most points wins.

## Important caveat — per-province VP values
The rulebook text does **not** list the 16 provinces' laurel-wreath values; they exist only on the board
artwork. The audit therefore does NOT assert a fixed VP distribution. (The engine's topology assigns
vp1 values 5/2/5/5/6/3/2/3/5/4/3/2/2/2/5/4; sum 56 — plausible but unverified against the board image.)
