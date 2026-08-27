# Sardegna — SCOPE

**Game:** Sardegna (2005, Stefan Dorra; Playte/Gameology 2024 reprint, art Wanjin Gill).
**Genre:** area-control / influence on an island map; hand-management via 7 character cards.
**Players:** 2–4. **Playtime:** ~30 min.
**Port:** `sardegna.onewing.top` (npm-workspace app, packages/shared engine + Express/Socket.IO backend + React/Vite frontend).

> Rules transcribed from the **official Playte EN rulebook PDF** (gamers-hq.de
> `Sardegna_rule_EN_booklet.pdf`), cross-checked with Tabletopping's review. Source of truth for
> RULES-AUDIT: `references/rulebook-extract.md`.

## Components
- 1 game board (the box unfolds into the board), 26 fort cards, 28 character cards, 4 score markers,
  4 priests, 8 ships, 12 forts, 16 villages, 20 villagers, 16 agriculture tokens, 4 summary cards.

## Setup
- Place the 16 agriculture tokens: 2 wheat on the 2 yellow provinces; 8 olive+wine randomly on the 8 green
  provinces; 6 thyme+cheese randomly on the 6 brown provinces.
- Each player: color, summary card, 7 character cards, 15 pieces (1 priest, 2 ships, 3 forts, 4 villages,
  5 villagers).
- Shuffle 26 fort cards; deal an 11-card face-down row; turn the 2 leftmost face up.

## The board
- 16 provinces separated by borders, each with an agriculture token.
- **Max 7 pieces per province** (priests+villages+villagers). Once full, nothing more may be added.
- Crossing a border = 1 movement. Priests/villagers may move *through* full provinces but not *end* there.
- **26 square fort spaces** at province intersections; each holds at most 1 fort.
- **7 harbors** (ship's wheel symbol). Max 2 ships per harbor (1 in 2-player game); no player places both
  their ships in the same harbor.

## Turns
Clockwise from the youngest player. On your turn play one character card face-up and take its action.
Played cards stay in front of you until someone plays the **Sentinel**.

Character cards (exact rulebook text, 7 per player):
- **Admiral:** add 1 ship to a harbor, OR move any of your ships to harbors of your choice.
- **Commander:** add 1 villager to any province, OR move your villagers up to 4 times (split freely).
- **Priest:** add your priest to any province, OR move your priest up to 3 times. A priest in a province
  blocks opponents from moving/adding villages+villagers there unless they also have a priest; you may
  always move/add your own there.
- **Farmer:** harvest 1 agriculture token to score. Choose a harbor with one of your ships; harvest from a
  province with ≥1 of your villager(s) + an agriculture token, adjacent to that harbor OR connected by an
  unbroken chain of provinces containing your villagers. Tokens score 1/2/3/4 for the 1st/2nd/3rd/4th of
  each type.
- **Architect:** add 1 fort to an empty fort space, OR add a village to any province. Max villages in play =
  harvested agriculture tokens.
- **Queen:** copy any action from any character card you have played since the last Sentinel (i.e. any card
  in front of you).
- **Sentinel:** initiate province scoring: score each province bordering the leftmost face-up fort card, one
  at a time; discard that fort card to the bottom of the deck; reveal the next face-down card, keeping or
  discarding+replacing it; all players collect their played cards back into hand.

## Scoring provinces
Influence: **1 per priest or villager in the province, 2 per village, 1 per ship in an adjacent harbor,
1 per fort on the province's border.**
- Player(s) with the most influence score the **full victory points** shown in the province (laurel wreath).
- Player(s) with the second-highest influence score **half**, rounded down.
- **In a 2-player game, or if players tie for most influence, no one scores for second place.**

Worked examples (replayed in RULES-AUDIT + audit script):
- Province A (worth 5): Blue 1 villager, Purple 1 fort → 1 influence each → **both score 5**.
- Province B (worth 5): Yellow 4 influence (village+ship+fort), Purple & Green 3 each → Yellow **5**,
  Purple/Green **2 each**.
- Province C (worth 2): Blue 3 influence, Yellow 2, Purple 1 → Blue **2**, Yellow **1**, Purple **0**.

## End of game
Game ends after the **11th fort card is scored**. Most points wins.

## Variant (not implemented)
**Alternate Sentinel Rules** — each player draws a private fort card; Sentinel only playable with 3+ other
cards played; more reveal options. Optional, not in the port.

## Intentional divergences (see RULES-AUDIT)
- **Engine models 5 of the 7 harbors** (h6/h7 missing from topology) — affects ship placement/movement.
- **Queen** additionally forbids copying Sentinel or another Queen (a safety restriction; rulebook's letter
  allows copying any card in front of you).
- Province VP (laurel) values live on the board artwork, not the rulebook text — engine's values are
  unverified against a board scan (see RULES-AUDIT).
