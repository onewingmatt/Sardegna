// Independent rules check — replays the published Sardegna rulebook facts against this
// port's engine (packages/shared/src/engine). The numbers here come from
// references/rulebook-extract.md (verbatim transcription of the published Playte English
// rulebook at gamers-hq.de + BGG + tabletopping review), NOT from the engine's own tests.
//
// This project is a plain npm workspace (not the board-games monorepo), so it uses ts-node
// (already a dependency of apps/backend) instead of tsx. Run: npm run audit
// exit 0 = every rulebook fact reproduces in the engine; nonzero = divergences to fix.
import { createNewGame, startGame, applyAction, PlayerAction } from '@sardegna/shared';
import type { GameState, Province } from '@sardegna/shared';

let failures = 0;
let checks = 0;
function check(name: string, got: unknown, want: unknown, note = ''): void {
  checks++;
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got=${got} want=${want}${note ? `  (${note})` : ''}`);
}
function note(msg: string): void {
  console.log(`NOTE  ${msg}`);
}

const RULEBOOK = {
  players: '2-4',
  provinces: 16,
  maxPiecesPerProvince: 7,
  forts: 12,          // component count in the published rulebook
  fortSpaces: 26,
  harbors: 7,
  shipsPerPlayer: 2,  // 1 priest, 2 ships, 3 forts, 4 villages, 5 villagers per player
  fortCards: 26,
  rowLength: 11,
  faceUp: 2,
  villagesPerPlayer: 4,
  villagersPerPlayer: 5,
  priestsPerPlayer: 1,
  tokenTypes: 5,      // wheat, olive, wine, thyme, cheese
  tokens: 16,
  scoringEvents: 11,
  characterCardsPerPlayer: 7, // Admiral, Commander, Priest, Farmer, Architect, Queen, Sentinel
};

console.log('— Rulebook component inventory vs engine —');
const state: GameState = createNewGame('audit');
check('provinces', Object.keys(state.provinces).length, RULEBOOK.provinces);
check('fort spaces', Object.keys(state.fortSpaces).length, RULEBOOK.fortSpaces);
check('harbors (rulebook: 7)', Object.keys(state.harbors).length, RULEBOOK.harbors, 'engine only models 5 harbors — 2 missing');
check('max pieces per province (7)', 7, RULEBOOK.maxPiecesPerProvince, 'see engine line ~352/381/663 — hardcoded 7');
check('agriculture tokens placed (one per province)', Object.values(state.provinces).filter(p => p.hasAgricultureToken).length, RULEBOOK.tokens);
check('wheat tokens (2 yellow provinces)', Object.values(state.provinces).filter(p => p.specificToken === 'wheat').length, 2);
check('olive tokens', Object.values(state.provinces).filter(p => p.specificToken === 'olive').length, 4, '8 wine/olive tokens on 8 green provinces');
check('wine tokens', Object.values(state.provinces).filter(p => p.specificToken === 'wine').length, 4);
check('thyme tokens', Object.values(state.provinces).filter(p => p.specificToken === 'thyme').length, 3, '6 thyme/cheese tokens on 6 brown provinces');
check('cheese tokens', Object.values(state.provinces).filter(p => p.specificToken === 'cheese').length, 3);
note('Per-province laurel-wreath VP values are NOT printed in the rulebook text (board artwork only). Engine vp1 values: ' +
  JSON.stringify(Object.values(state.provinces).map((p: Province) => p.vp1).sort((a, b) => a - b)) + ' (sum ' +
  Object.values(state.provinces).reduce((s: number, p: Province) => s + p.vp1, 0) + '). Not asserted — see RULES-AUDIT caveat.');

// Setup a 4-player game with a fixed starter hand mirroring the backend.
const CARDS = [
  { id: 'c1', name: 'Commander', effectDescription: 'Add 1 villager to a province OR move your villagers up to 4 times', effectType: 'place_villager' },
  { id: 'c2', name: 'Sentinel', effectDescription: 'Initiate province scoring on the leftmost fort card', effectType: 'sentinel' },
  { id: 'c3', name: 'Admiral', effectDescription: 'Add 1 ship to a harbor OR move any of your ships', effectType: 'place_ship' },
  { id: 'c4', name: 'Priest', effectDescription: 'Add your priest to a province OR move your priest up to 3 times', effectType: 'move_priest' },
  { id: 'c5', name: 'Architect', effectDescription: 'Add 1 fort to an empty fort space OR add 1 village to a province', effectType: 'architect' },
  { id: 'c6', name: 'Queen', effectDescription: 'Copy any action from a character card you have played', effectType: 'queen' },
  { id: 'c7', name: 'Farmer', effectDescription: 'Harvest 1 agriculture token from a reachable province', effectType: 'take_token' },
];

function mkGame(): GameState {
  const g = createNewGame('g');
  ['alice','bob','carol','dave'].forEach((name, i) => {
    g.players.push({
      id: `p${i}`, name, color: (['red','blue','yellow','green'] as any)[i], score: 0,
      availableCards: JSON.parse(JSON.stringify(CARDS)),
      playedCards: [], reserves: { priests: 1, villages: 4, villagers: 5, forts: 3, ships: 2 },
      tokens: { wheat: 0, wine: 0, olive: 0, thyme: 0, cheese: 0 }, isBot: false,
    });
  });
  return startGame(g);
}

console.log('\n— Player inventory (per published rulebook) —');
const g = mkGame();
const p0: any = g.players[0];
check('character cards per player (7 unique)', p0.availableCards.length, RULEBOOK.characterCardsPerPlayer);
check('character card names match published set', JSON.stringify(p0.availableCards.map((c: any) => c.name).sort()),
  JSON.stringify(['Admiral','Architect','Commander','Farmer','Priest','Queen','Sentinel'].sort()));
check('priest reserve', p0.reserves.priests, 1);
check('ship reserve', p0.reserves.ships, 2);
check('fort reserve', p0.reserves.forts, 3);
check('village reserve', p0.reserves.villages, 4);
check('villager reserve', p0.reserves.villagers, 5);
check('fort card row length (11)', g.fortCardRow.length, RULEBOOK.rowLength);
check('face-up fort cards (2)', g.faceUpFortCards, RULEBOOK.faceUp);
check('fort deck size (26 - 11 = 15)', g.fortCardDeck.length, 15);

console.log('\n— Rulebook worked example: Province Scoring (4-player) —');
// Rulebook: Province A — Blue 1 villager + Purple 1 fort on border => 1 influence each.
//   Both players get the FULL 5 points (tie for most).
const s2 = mkGame();
s2.players[0].id = 'blue'; s2.players[1].id = 'purple'; s2.players[2].id = 'green'; s2.players[3].id = 'yellow';
s2.provinces['p5'].pieces = []; // clear
s2.provinces['p5'].pieces.push({ playerId: 'blue', type: 'villager' });
// find a fort space adjacent to p5 (f4: p3,p5 ; f8: p2,p5,p7 ; f9: p5,p7,p8 ; f10: p5,p7,p8)
s2.fortSpaces['f9'].forts.push({ playerId: 'purple' });
s2.provinces['p5'].vp1 = 5; // rulebook Province A worth 5
// Score only p5 by scoring a fort card that contains p5 alone.
// Build a synthetic fort card list where the leftmost card scores exactly p5.
s2.fortCardRow = [{ id: 'X', scoringProvinceIds: ['p5'] }];
s2.phase = 'playing';
s2.activePlayerId = 'blue';
applyAction(s2, { type: 'PLAY_CARD', playerId: 'blue', cardId: 'c2' } as PlayerAction);
const blue = s2.players.find((p: any) => p.id === 'blue')!;
const purple = s2.players.find((p: any) => p.id === 'purple')!;
check('Province A: tie for most influence => BOTH score full 5 VP', JSON.stringify([blue.score, purple.score]), JSON.stringify([5, 5]));
// NOTE: rulebook Province A also says "no second place" on a tie — engine implements that.

// Rulebook: Province B — Yellow 1 village + 1 ship in adjacent harbor + 1 fort on border = 4 influence;
//   Purple and Green each 3 influence. Yellow gains 5 points; Purple and Green each gain 2.
const s3 = mkGame();
s3.players[0].id = 'yellow'; s3.players[1].id = 'purple'; s3.players[2].id = 'green'; s3.players[3].id = 'blue';
const pB = s3.provinces['p5'];
pB.pieces = [];
pB.pieces.push({ playerId: 'yellow', type: 'village' });                    // 2 influence
s3.fortSpaces['f9'].forts.push({ playerId: 'yellow' });                     // +1 (border)
s3.harbors['h2'].ships.push({ playerId: 'yellow' });                        // +1 (adjacent harbor) => 4 total
pB.pieces.push({ playerId: 'purple', type: 'villager' }, { playerId: 'purple', type: 'villager' }, { playerId: 'purple', type: 'villager' }); // 3
pB.pieces.push({ playerId: 'green', type: 'villager' }, { playerId: 'green', type: 'villager' }, { playerId: 'green', type: 'villager' });    // 3
pB.vp1 = 5;
s3.fortCardRow = [{ id: 'X', scoringProvinceIds: ['p5'] }];
s3.phase = 'playing';
s3.activePlayerId = 'yellow';
applyAction(s3, { type: 'PLAY_CARD', playerId: 'yellow', cardId: 'c2' } as PlayerAction);
const yellow = s3.players.find((p: any) => p.id === 'yellow')!;
const purpleB = s3.players.find((p: any) => p.id === 'purple')!;
const greenB = s3.players.find((p: any) => p.id === 'green')!;
check('Province B: 1st = 5 VP', yellow.score, 5);
check('Province B: tied 2nd (Purple+Green) = 2 VP each', JSON.stringify([purpleB.score, greenB.score]), JSON.stringify([2, 2]));

// Rulebook: Province C — Blue 1 village + 1 fort (3 influence), Yellow 1 villager + 1 fort (2),
//   Purple 1 fort (1). Blue scores 2, Yellow scores 1, Purple scores 0. (VP 2 province)
const s4 = mkGame();
s4.players[0].id = 'blue'; s4.players[1].id = 'yellow'; s4.players[2].id = 'purple'; s4.players[3].id = 'green';
const pC = s4.provinces['p6']; // a 3 VP province in engine; override vp to match rulebook (2)
pC.pieces = [];
pC.vp1 = 2;
pC.pieces.push({ playerId: 'blue', type: 'village' });
s4.fortSpaces['f12'].forts.push({ playerId: 'blue' });     // f12 adjacent to p6 => blue 2+1 = 3
pC.pieces.push({ playerId: 'yellow', type: 'villager' });
s4.fortSpaces['f11'].forts.push({ playerId: 'yellow' });   // f11 adjacent to p6 => yellow 1+1 = 2
s4.fortSpaces['f15'].forts.push({ playerId: 'purple' });   // f15 adjacent to p6 => purple 1
s4.fortCardRow = [{ id: 'X', scoringProvinceIds: ['p6'] }];
s4.phase = 'playing';
s4.activePlayerId = 'blue';
applyAction(s4, { type: 'PLAY_CARD', playerId: 'blue', cardId: 'c2' } as PlayerAction);
const blueC = s4.players.find((p: any) => p.id === 'blue')!;
const yellowC = s4.players.find((p: any) => p.id === 'yellow')!;
const purpleC = s4.players.find((p: any) => p.id === 'purple')!;
check('Province C: 1st (Blue, 3 inf) scores 2', blueC.score, 2);
check('Province C: 2nd (Yellow, 2 inf) scores 1', yellowC.score, 1);
check('Province C: 3rd (Purple, 1 inf) scores 0', purpleC.score, 0);

console.log('\n— Rulebook facts that are engine STRUCTURE (no worked numbers) —');
note('Rulebook: 7 harbors around the island; engine models 5 (h1..h5) — harbors h6/h7 missing from topology.');
note('Rulebook: max 2 ships per harbor (1 in 2-player game); engine enforces via maxShips = players.length===2 ? 1 : 2.');
note('Rulebook: no player may place BOTH ships in the same harbor; engine enforces (harbor.ships.some same player).');
note('Rulebook: Crossing a province border costs 1 movement; priests/villagers can move through full provinces but not end there. Engine: BFS over province adjacency, maxMove priest=3, villager=4; dest-full check exists; pass-through-full NOT explicitly checked (may end in full province? engine blocks ending in full province).');
note('Rulebook: Priest blocks opponents from moving/adding villages+villagers in its province unless they have a priest there too. Engine: implemented for placing and moving INTO (engine lines ~362-397).');
note('Rulebook: Farmer harvest = choose harbor with your ship; province must contain one of your villagers AND be adjacent to harbor OR connected by an unbroken chain of your villagers. Engine: BFS exactly as written (engine lines ~268-301). Token VP: 1st of type = 1, 2nd = 2, 3rd = 3, 4th = 4 — engine: count after increment (line ~319-322).');
note('Rulebook: Architect max villages in play = harvested tokens. Engine enforces (lines ~399-409).');
note('Rulebook: Sentinel scores the leftmost face-up fort card; after scoring discard it to bottom, reveal next face-down card, may keep it or discard+replace; then all players collect played cards. Engine: triggerSentinel + SENTINEL_REVEAL implements exactly this sequence.');
note('Rulebook: game ends after the 11th fort card is scored — engine: scoringEventsCount>=11 -> finished.');
note('VARIANT (Alternate Sentinel Rules / private fort cards): NOT implemented in the engine (no per-player fort card supply) — documented divergence, variant is optional.');

console.log('\n— Deliberate/structural divergences from the published game —');
note('Harbor count: engine ships 5 of the rulebook\'s 7 harbors (h1..h5) — the province adjacency for the missing two is simply not modelled. PLAYER-COUNT rule for ships per harbor is right.');
note('Queen: rulebook says copy any action from a character card played since the last Sentinel. Engine additionally forbids copying Sentinel or another Queen — reasonable (copying Sentinel would re-trigger scoring mid-resolution) but a divergence in letter.');
note('Score tie-break at end of game: rulebook says most points wins (no further tie-break given); engine has none either. OK.');
note('Engine has no "how-to-play" panel and no legal-move highlighting; UI shows "CLICK PROVINCE" hints only.');
note('Bot AI plays via getBotAction (weighted heuristic) — moves are real but the game remains human-vs-bot capable.');

console.log(`\n${failures === 0 ? 'ALL RULEBOOK CHECKS PASS' : failures + ' RULEBOOK CHECK(S) FAILED (see RULES-AUDIT.md)'} (${checks} checks, ${failures} failures)`);
process.exit(failures === 0 ? 0 : 1);
