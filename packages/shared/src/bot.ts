import { GameState, Player, Province, FortSpace, Harbor, CharacterCard } from './types';
import { PlayerAction } from './engine';

// ─── Configuration ───────────────────────────────────────────────
const MAX_PIECES_PER_PROVINCE = 7;
const INF_VILLAGER = 1;
const INF_VILLAGE = 2;
const INF_PRIEST = 1;
const INF_FORT = 1;
const INF_SHIP = 1;

// ─── Helpers ──────────────────────────────────────────────────────

/** Weighted random: returns index into array based on numeric weights. */
function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  // Edge case: all-zero or degenerate weights → uniform random
  if (total <= 0 || !isFinite(total)) {
    return Math.floor(Math.random() * weights.length);
  }
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ─── Influence Queries ───────────────────────────────────────────

/** Calculate a player's total influence in a province (pieces + adjacent forts + adjacent harbors). */
function playerInfluence(state: GameState, playerId: string, provinceId: string): number {
  const province = state.provinces[provinceId];
  if (!province) return 0;
  let inf = 0;
  for (const piece of province.pieces) {
    if (piece.playerId !== playerId) continue;
    if (piece.type === 'villager') inf += INF_VILLAGER;
    else if (piece.type === 'village') inf += INF_VILLAGE;
    else if (piece.type === 'priest') inf += INF_PRIEST;
  }
  for (const fId of province.adjacentFortSpaces) {
    const fs = state.fortSpaces[fId];
    if (fs && fs.forts.length > 0 && fs.forts[0].playerId === playerId) inf += INF_FORT;
  }
  for (const hId of province.adjacentHarbors) {
    const h = state.harbors[hId];
    if (h) {
      for (const ship of h.ships) {
        if (ship.playerId === playerId) inf += INF_SHIP;
      }
    }
  }
  return inf;
}

/** Get influence breakdown for all players in a province. */
function allPlayerInfluence(state: GameState, provinceId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const pl of state.players) {
    map.set(pl.id, playerInfluence(state, pl.id, provinceId));
  }
  return map;
}

/** Get the winning player(s) and their influence in a province. Returns { bestInfluence, winners: playerIds tied for first }. */
function provinceWinner(state: GameState, provinceId: string): { bestInfluence: number; winners: string[] } {
  const infMap = allPlayerInfluence(state, provinceId);
  let best = 0;
  const winners: string[] = [];
  for (const [pid, inf] of infMap) {
    if (inf > best) { best = inf; winners.length = 0; winners.push(pid); }
    else if (inf === best && inf > 0) { winners.push(pid); }
  }
  return { bestInfluence: best, winners };
}

/** Calculates how much VP a player would earn if a fort card scored RIGHT NOW for the given province. */
function vpIfScoredNow(state: GameState, provinceId: string, playerId: string): number {
  const infMap = allPlayerInfluence(state, provinceId);
  const sorted = [...infMap.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 0;
  const province = state.provinces[provinceId];
  if (!province) return 0;
  const vp1 = province.vp1;
  const vp2 = Math.floor(vp1 / 2);

  const firstInf = sorted[0][1];
  const tiedForFirst = sorted.filter(([, v]) => v === firstInf);

  if (tiedForFirst.length > 1) {
    // Tie for first → all tied get FULL VP (rulebook example A)
    return tiedForFirst.some(([pid]) => pid === playerId) ? vp1 : 0;
  }

  // Clear first
  if (sorted[0][0] === playerId) return vp1;

  // Check second place (only if not a 2-player game)
  if (sorted.length > 1 && state.players.length !== 2) {
    const secondInf = sorted[1][1];
    const tiedForSecond = sorted.filter(([, v]) => v === secondInf);
    // All tied for second get half VP each (rulebook example B)
    if (tiedForSecond.some(([pid]) => pid === playerId)) {
      return vp2;
    }
  }
  return 0;
}

// ─── Fort Card Analysis ──────────────────────────────────────────

/** Compute how many provinces on a fort card the given player wins / would benefit from. */
function fortCardWinRate(state: GameState, playerId: string, fortCard: { scoringProvinceIds: string[] }): { winning: number; total: number; potentialVp: number; totalVp: number } {
  let winning = 0;
  let total = fortCard.scoringProvinceIds.length;
  let potentialVp = 0;
  let totalVp = 0;
  for (const pId of fortCard.scoringProvinceIds) {
    const { winners } = provinceWinner(state, pId);
    if (winners.includes(playerId)) winning++;
    potentialVp += vpIfScoredNow(state, pId, playerId);
    const province = state.provinces[pId];
    if (province) totalVp += province.vp1;
  }
  return { winning, total, potentialVp, totalVp };
}

/** Get the next N fort cards that will score (the leftmost in the row + any future). */
function upcomingFortCards(state: GameState, count: number): { scoringProvinceIds: string[] }[] {
  const cards: { scoringProvinceIds: string[] }[] = [];
  for (let i = 0; i < Math.min(count, state.fortCardRow.length); i++) {
    cards.push(state.fortCardRow[i]);
  }
  return cards;
}

/** Score how important a province is across all upcoming fort cards (future scoring value). */
function futureScoringWeight(state: GameState, provinceId: string, lookahead: number = 3): number {
  let weight = 0;
  for (const card of upcomingFortCards(state, lookahead)) {
    if (card.scoringProvinceIds.includes(provinceId)) {
      weight += 1;
    }
  }
  return weight;
}

// ─── Opponent Analysis ───────────────────────────────────────────

/** Sum of all opponent influence in a province (how contested it is). */
function opponentInfluenceSum(state: GameState, playerId: string, provinceId: string): number {
  let total = 0;
  for (const pl of state.players) {
    if (pl.id === playerId) continue;
    total += playerInfluence(state, pl.id, provinceId);
  }
  return total;
}

/** How much VP an opponent would gain if they win this province (denial value). */
function denyValue(state: GameState, playerId: string, provinceId: string): number {
  const province = state.provinces[provinceId];
  if (!province) return 0;
  let totalDeny = 0;
  for (const pl of state.players) {
    if (pl.id === playerId) continue;
    const inf = playerInfluence(state, pl.id, provinceId);
    if (inf === 0) continue;
    const myInf = playerInfluence(state, playerId, provinceId);
    // If opponent would be first or second, denying them is valuable
    const oppVp = vpIfScoredNow(state, provinceId, pl.id);
    if (oppVp > 0) {
      // If we can overtake them, full denial value
      const infNeeded = inf - myInf + 1;
      if (infNeeded <= 3 && myInf > 0) {
        // We're close to overtaking - high deny value
        totalDeny += oppVp * 2;
      } else {
        // They're solidly ahead - still worth denying but less
        totalDeny += oppVp;
      }
    }
  }
  return totalDeny;
}

// ─── Scoring Functions ───────────────────────────────────────────

/**
 * Score a province for piece placement.
 *
 * Factors (weighted):
 *  - VP value (base)
 *  - How close WE are to winning it (low gap = high score)
 *  - How contested it is (opponent presence = opportunity)
 *  - Denial value (stopping opponents from scoring)
 *  - Future fort card scoring potential
 *  - Already winning? diminishing returns (reinforce, but not over-invest)
 */
function scoreProvince(state: GameState, player: Player, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p) return -1;
  if (p.pieces.length >= MAX_PIECES_PER_PROVINCE) return -1;

  const myInf = playerInfluence(state, player.id, provinceId);
  const oppInf = opponentInfluenceSum(state, player.id, provinceId);
  const { bestInfluence } = provinceWinner(state, provinceId);
  const vpValue = p.vp1;

  // Gap to the winner (negative = we're winning, positive = we're behind)
  const gap = bestInfluence - myInf;

  // 1. Base VP value (0-6)
  let score = vpValue * 2;

  // 2. Proximity to winning: prefer provinces where we're close to taking the lead
  //    Small positive gap (1-3) = high priority (one good placement flips it)
  if (gap > 0 && gap <= 3) {
    score += (4 - gap) * 8; // 24, 16, 8 for gaps 1,2,3
  } else if (gap <= 0) {
    // We're winning or tied - reinforce to maintain, but diminishing returns
    if (myInf <= 3) {
      score += 10; // Worth reinforcing if lead is small
    } else {
      score += Math.max(2, 8 - myInf); // Taper off as we over-invest
    }
  } else {
    // Large gap - low priority unless very high VP
    score += Math.max(0, 6 - gap);
  }

  // 3. Contested value: provinces with multiple opponents are valuable battlegrounds
  if (oppInf > 0) {
    score += Math.min(oppInf * 3, 12);
  } else {
    // Undefended province - easy pickings but also easy to take
    score += 4;
  }

  // 4. Denial value: blocking opponents from scoring
  const deny = denyValue(state, player.id, provinceId);
  score += deny * 1.5;

  // 5. Future fort card scoring potential
  const futureW = futureScoringWeight(state, provinceId, 3);
  score += futureW * 5;

  return score;
}

/** Score a fort space (for placing a fort). */
function scoreFortSpace(state: GameState, player: Player, fortId: string): number {
  const fs = state.fortSpaces[fortId];
  if (!fs || fs.forts.length > 0) return -1;

  let score = 0;
  const adjProvinces = fs.adjacentProvinces;

  // A fort influences ALL adjacent provinces - this is powerful area control
  for (const pId of adjProvinces) {
    const provinceScore = scoreProvince(state, player, pId);
    if (provinceScore >= 0) {
      score += provinceScore * 1.5; // Forts are multiplicative - they affect many provinces
    }
  }

  // Bonus for centrality (more adjacent provinces = more value)
  score += adjProvinces.length * 4;

  // Check if any adjacent province has an opponent fort - contest it!
  for (const pId of adjProvinces) {
    const p = state.provinces[pId];
    if (!p) continue;
    for (const fId of p.adjacentFortSpaces) {
      const ofs = state.fortSpaces[fId];
      if (ofs && ofs.forts.length > 0 && ofs.forts[0].playerId !== player.id) {
        score += 8; // Contest opponent fort
      }
    }
  }

  return score;
}

/** Score a harbor (for placing a ship). */
function scoreHarbor(state: GameState, player: Player, harborId: string): number {
  const h = state.harbors[harborId];
  if (!h) return -1;
  const maxShips = state.players.length === 2 ? 1 : 2;
  if (h.ships.length >= maxShips) return -1;
  if (h.ships.some(s => s.playerId === player.id)) return -1;

  let score = 0;
  for (const pId of h.adjacentProvinces) {
    const provinceScore = scoreProvince(state, player, pId);
    if (provinceScore >= 0) {
      score += provinceScore;
    }
  }

  // Ships provide 1 influence to adjacent provinces - less impactful than forts
  // But they're often easy to place and contest key areas
  score += h.adjacentProvinces.length * 2;

  return score;
}

/**
 * Compute all provinces reachable from any of the player's harbors
 * via an unbroken chain of the player's villagers (for Farmer card).
 */
function villagerReachableProvinces(state: GameState, playerId: string): Set<string> {
  const reachable = new Set<string>();

  const harborsWithShip = Object.values(state.harbors).filter(h => h.ships.some(s => s.playerId === playerId));
  if (harborsWithShip.length === 0) return reachable;

  for (const harbor of harborsWithShip) {
    const queue = [...harbor.adjacentProvinces];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const pId = queue.shift()!;
      if (visited.has(pId)) continue;
      visited.add(pId);
      reachable.add(pId);
      const prov = state.provinces[pId];
      if (prov && prov.pieces.some(p => p.playerId === playerId && p.type === 'villager')) {
        for (const adjId of prov.adjacentProvinces) {
          if (!visited.has(adjId)) queue.push(adjId);
        }
      }
    }
  }
  return reachable;
}

/** Score a province for harvesting an agriculture token via the Farmer card. */
function scoreTokenProvince(state: GameState, player: Player, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p || !p.hasAgricultureToken) return -1;

  // Must have a villager in the target province
  const hasMyVillager = p.pieces.some(pc => pc.playerId === player.id && pc.type === 'villager');
  if (!hasMyVillager) return -1;

  // Must be reachable from a harbor with the player's ship via villager chain
  const reachable = villagerReachableProvinces(state, player.id);
  if (!reachable.has(provinceId)) return -1;

  const tokenType = p.specificToken ||
    (p.resource === 'wheat' ? 'wheat' :
     p.resource === 'wine_olive' ? 'wine' :
     p.resource === 'thyme_cheese' ? 'thyme' : undefined);
  if (!tokenType) return -1;

  // VP the player would gain: count AFTER harvest (so current count + 1)
  const currentCount = player.tokens[tokenType] || 0;
  const vpGained = currentCount + 1; // 1st=1VP, 2nd=2VP, 3rd=3VP, 4th=4VP

  let score = 0;

  // 1. Immediate VP value (primary factor)
  score += vpGained * 10;

  // 2. Token scarcity: how many of this type remain on the board
  let remainingOfType = 0;
  for (const opId of Object.keys(state.provinces)) {
    const op = state.provinces[opId];
    if (op.hasAgricultureToken && op.specificToken === tokenType) {
      remainingOfType++;
    }
  }
  if (remainingOfType <= 1) {
    score += 8; // Last one of this type
  } else if (remainingOfType <= 2) {
    score += 4;
  }

  // 3. Diversification: first of each type gives 1 VP now AND unlocks future VP
  if (currentCount === 0) {
    score += 10;
  }

  // 4. Denial: opponents who already have some of this token type
  for (const pl of state.players) {
    if (pl.id === player.id) continue;
    const oppCount = pl.tokens[tokenType] || 0;
    if (oppCount > 0) {
      score += oppCount * 4;
    }
  }

  // 5. Future scoring potential of the province
  const futureW = futureScoringWeight(state, provinceId, 3);
  score += futureW * 2;

  return score;
}

// ─── Sentinel Logic ──────────────────────────────────────────────

/** Should this bot play the sentinel card now? */
function shouldPlaySentinel(state: GameState, player: Player): boolean {
  if (state.fortCardRow.length === 0) return false;

  const card = state.fortCardRow[0];
  const { winning, total, potentialVp, totalVp } = fortCardWinRate(state, player.id, card);

  // --- Baseline: VP-aware check (better than just province count) ---
  if (totalVp > 0 && potentialVp >= totalVp * 0.4) return true;
  if (total === 0) return false;

  // --- Game phase awareness ---
  const eventsRemaining = 11 - state.scoringEventsCount;
  const pctComplete = state.scoringEventsCount / 11;

  // --- Score gap ---
  const myScore = player.score;
  const maxOppScore = Math.max(...state.players.filter(p => p.id !== player.id).map(p => p.score));
  const scoreGap = myScore - maxOppScore;

  // --- Hand pressure ---
  const handSize = player.availableCards.length;
  const maxHandSize = state.players.length === 2 ? 8 : 6; // Typical max cards

  // --- Late game urgency ---
  // In late game, every scoring event counts - be more aggressive
  if (eventsRemaining <= 3) {
    // Last few scorings - play sentinel if we're winning at least 1 province
    if (winning >= 1) return true;
    // Or if we're behind and need a comeback
    if (scoreGap < -5 && winning >= 0) return true;
  }

  // --- Mid game strategy ---
  if (eventsRemaining <= 6) {
    // Mid game: play if we're at least competitive
    if (winning >= Math.floor(total / 2)) return true;
    // If hand is about to overflow, play sentinel to cycle
    if (handSize >= maxHandSize - 1) return true;
  }

  // --- Early game ---
  // In early game, we might want to build up before scoring
  if (pctComplete < 0.25) {
    // Only play sentinel if we dominate the next card
    if (winning >= total - 1) return true;
    // Or if we have a strong lead and want to press
    if (scoreGap > 5 && winning > 0) return true;
    // Or if hand is full
    if (handSize >= maxHandSize) return true;
    return false;
  }

  // --- Default: play if winning at least half ---
  return winning >= Math.ceil(total / 2);
}

/** Decide whether to keep or reject the revealed card during sentinel_reveal phase. */
function decideSentinelReveal(state: GameState, playerId: string, revealedCard: { scoringProvinceIds: string[] }): boolean {
  const { winning, total } = fortCardWinRate(state, playerId, revealedCard);

  // Evaluate the revealed card: keep if it scores our provinces
  if (winning >= Math.ceil(total / 2)) return true;

  // Late game: be more conservative - keep if it's not terrible
  const eventsRemaining = 11 - state.scoringEventsCount;
  if (eventsRemaining <= 3) {
    if (winning > 0) return true;
  }

  // If the card is very bad for us, reject it
  return false;
}

// ─── Card-specific helpers ───────────────────────────────────────

/** Check if an opponent's priest blocks placing villagers/villages in this province. */
function isPriestBlocked(state: GameState, playerId: string, provinceId: string, pieceType: string): boolean {
  if (pieceType !== 'villager' && pieceType !== 'village') return false;
  const province = state.provinces[provinceId];
  if (!province) return false;
  const oppHasPriest = province.pieces.some(pc => pc.type === 'priest' && pc.playerId !== playerId);
  if (!oppHasPriest) return false;
  const weHavePriest = province.pieces.some(pc => pc.type === 'priest' && pc.playerId === playerId);
  return !weHavePriest;
}

/**
 * How many influence points a piece type provides per card.
 * Returns a DIFFERENTIAL bonus on top of the province base score,
 * NOT re-evaluating the province from scratch.
 */
function pieceTypeBonus(effectType: string, myInf: number, gap: number): number {
  // The influence this piece type provides (per official rules: priest=1, village=2, villager=1)
  const infProvided = effectType === 'place_village' ? 2 : 1;

  // If placing this piece would win/tie the province, big bonus
  if (gap > 0 && gap <= infProvided) {
    return 12; // This single placement flips the province
  }

  // If it significantly narrows the gap
  if (gap > infProvided && gap <= infProvided + 2) {
    return 6;
  }

  // Already winning - reinforce proportional to piece strength
  if (gap <= 0) {
    return infProvided * 3; // 3 for villager, 6 for village, 9 for priest
  }

  // Large gap - low return
  return Math.max(0, infProvided - Math.floor(gap / 2));
}

/** Score a specific card type action. */
function scoreCardAction(
  state: GameState,
  player: Player,
  card: CharacterCard,
  targetId: string,
  targetType: 'province' | 'fortSpace' | 'harbor',
  baseScore: number
): number {
  // Different piece types have different strategic weights
  let multiplier = 1;
  let bonus = 0;

  if (card.effectType === 'place_villager') {
    // Villagers are cheap - good for spreading
    multiplier = 1;
    bonus = 2; // Small bonus for flexibility
  } else if (card.effectType === 'place_village') {
    // Villages are efficient (2 inf per card)
    multiplier = 1.2;
  } else if (card.effectType === 'move_priest') {
    // Priests are powerful but limited (usually 2 per player)
    multiplier = 1.5;
    const priestsRemaining = player.reserves.priests;
    if (priestsRemaining <= 1) {
      bonus += 5; // Last priest - use it well!
    }
  } else if (card.effectType === 'place_fort') {
    // Forts are area control - already scored higher via scoreFortSpace
    multiplier = 1.3;
  } else if (card.effectType === 'place_ship') {
    // Ships are support pieces
    multiplier = 0.9;
  } else if (card.effectType === 'take_token') {
    // Tokens handled separately
    multiplier = 1;
  } else if (card.effectType === 'architect') {
    // Architect is flexible (fort OR village) - slight bonus
    multiplier = 1.1;
    bonus = 3;
  } else if (card.effectType === 'queen') {
    // Queen's value depends on what's being copied - handled via copiedCardId
    multiplier = 1;
  }

  return baseScore * multiplier + bonus;
}

// ─── Main Bot Action ─────────────────────────────────────────────

/** Get the best action for a bot player. Returns null if no valid action is possible. */
export function getBotAction(state: GameState, playerId: string): PlayerAction | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.availableCards.length === 0) return null;

  // ── SENTINEL REVEAL PHASE ──
  if (state.phase === 'sentinel_reveal') {
    const revealedCard = state.fortCardRow[1];
    if (!revealedCard) return { type: 'SENTINEL_REVEAL', playerId, payload: { keep: false } };
    const keep = decideSentinelReveal(state, playerId, revealedCard);
    return { type: 'SENTINEL_REVEAL', playerId, payload: { keep } };
  }

  // ── PLAYING PHASE ──

  // Separate sentinel from other cards
  const sentinelCard = player.availableCards.find(c => c.effectType === 'sentinel');
  const actionCards = player.availableCards.filter(c => c.effectType !== 'sentinel');

  // Consider playing sentinel
  if (sentinelCard && shouldPlaySentinel(state, player)) {
    return { type: 'PLAY_CARD', playerId, cardId: sentinelCard.id };
  }

  // Score all valid (card, target) pairs
  interface ScoredAction {
    cardId: string;
    targetId: string;
    targetType: 'province' | 'fortSpace' | 'harbor';
    score: number;
    copiedCardId?: string; // For Queen card — which card to copy
    sourceProvinceId?: string; // For move mode
    sourceHarborId?: string; // For Admiral move
    mode?: 'place' | 'move'; // Place or move mode
  }
  const candidates: ScoredAction[] = [];

  for (const card of actionCards) {
    // --- Piece placement cards (Commander, Architect village, Priest) ---
    if (card.effectType === 'place_villager' || card.effectType === 'place_village' || card.effectType === 'move_priest') {
      const reserveKey = card.effectType === 'place_villager' ? 'villagers'
        : card.effectType === 'place_village' ? 'villages' : 'priests';
      const pieceType = card.effectType === 'move_priest' ? 'priest'
        : card.effectType === 'place_village' ? 'village' : 'villager';
      const maxMove = pieceType === 'priest' ? 3 : 4;

      // --- Place mode ---
      if (player.reserves[reserveKey] > 0) {
        for (const pId of Object.keys(state.provinces)) {
          // Priest blocking rule: can't place villagers/villages in provinces with opponent priest
          if (isPriestBlocked(state, player.id, pId, pieceType)) continue;

          const baseScore = scoreProvince(state, player, pId);
          if (baseScore < 0) continue;

          const myInf = playerInfluence(state, player.id, pId);
          const { bestInfluence } = provinceWinner(state, pId);
          const gap = bestInfluence - myInf;
          const adjustedScore = baseScore + pieceTypeBonus(card.effectType, myInf, gap);

          const finalScore = scoreCardAction(state, player, card, pId, 'province', adjustedScore);
          candidates.push({ cardId: card.id, targetId: pId, targetType: 'province', score: finalScore });
        }
      }

      // --- Move mode ---
      // Find all existing pieces of this type that the player owns
      const ownedPieces: { provinceId: string }[] = [];
      for (const pId of Object.keys(state.provinces)) {
        const prov = state.provinces[pId];
        if (prov.pieces.some(pc => pc.playerId === player.id && pc.type === pieceType)) {
          ownedPieces.push({ provinceId: pId });
        }
      }
      for (const source of ownedPieces) {
        // BFS from source to find reachable provinces within maxMove steps
        const reachable = new Map<string, number>(); // provinceId -> distance
        const queue: { id: string; dist: number }[] = [{ id: source.provinceId, dist: 0 }];
        const visited = new Set<string>([source.provinceId]);
        while (queue.length > 0) {
          const { id, dist } = queue.shift()!;
          if (dist > 0) reachable.set(id, dist);
          if (dist >= maxMove) continue;
          const prov = state.provinces[id];
          if (!prov) continue;
          for (const adjId of prov.adjacentProvinces) {
            if (!visited.has(adjId)) {
              visited.add(adjId);
              queue.push({ id: adjId, dist: dist + 1 });
            }
          }
        }
        // Score each reachable destination
        for (const [destId, dist] of reachable) {
          const destProv = state.provinces[destId];
          if (!destProv || destProv.pieces.length >= 7) continue;
          // Priest blocking check for moving INTO the destination
          if ((pieceType === 'villager' || pieceType === 'village') && isPriestBlocked(state, player.id, destId, pieceType)) continue;

          // Evaluate the destination
          const destScore = scoreProvince(state, player, destId);
          if (destScore < 0) continue;
          // Moving is often slightly less valuable than placing (uses existing pieces)
          const moveScore = destScore * 0.8 - dist; // Penalize longer moves
          candidates.push({
            cardId: card.id,
            targetId: destId,
            targetType: 'province',
            score: moveScore + 5, // Small bonus for flexibility
            sourceProvinceId: source.provinceId,
            mode: 'move'
          });
        }
      }
    }

    // --- Fort placement ---
    else if (card.effectType === 'place_fort') {
      if (player.reserves.forts <= 0) continue;
      for (const fId of Object.keys(state.fortSpaces)) {
        const baseScore = scoreFortSpace(state, player, fId);
        if (baseScore < 0) continue;
        const finalScore = scoreCardAction(state, player, card, fId, 'fortSpace', baseScore);
        candidates.push({ cardId: card.id, targetId: fId, targetType: 'fortSpace', score: finalScore });
      }
    }

    // --- Ship placement / Admiral ---
    else if (card.effectType === 'place_ship') {
      // Place mode
      if (player.reserves.ships > 0) {
        for (const hId of Object.keys(state.harbors)) {
          const baseScore = scoreHarbor(state, player, hId);
          if (baseScore < 0) continue;
          const finalScore = scoreCardAction(state, player, card, hId, 'harbor', baseScore);
          candidates.push({ cardId: card.id, targetId: hId, targetType: 'harbor', score: finalScore });
        }
      }
      // Move mode: move a ship from one harbor to another
      for (const [sourceHarborId, harbor] of Object.entries(state.harbors)) {
        if (!harbor.ships.some(s => s.playerId === player.id)) continue;
        for (const [destHarborId, destHarbor] of Object.entries(state.harbors)) {
          if (destHarborId === sourceHarborId) continue;
          const maxShips = state.players.length === 2 ? 1 : 2;
          if (destHarbor.ships.length >= maxShips) continue;
          if (destHarbor.ships.some(s => s.playerId === player.id)) continue;
          const baseScore = scoreHarbor(state, player, destHarborId);
          if (baseScore < 0) continue;
          candidates.push({
            cardId: card.id,
            targetId: destHarborId,
            targetType: 'harbor',
            score: baseScore + 3, // Slight bonus for move flexibility
            sourceHarborId: sourceHarborId,
            mode: 'move'
          });
        }
      }
    }

    // --- Token taking (Farmer) ---
    else if (card.effectType === 'take_token') {
      for (const pId of Object.keys(state.provinces)) {
        const baseScore = scoreTokenProvince(state, player, pId);
        if (baseScore < 0) continue;
        candidates.push({ cardId: card.id, targetId: pId, targetType: 'province', score: baseScore });
      }
    }

    // --- Architect: acts as BOTH place_fort AND place_village ---
    else if (card.effectType === 'architect') {
      // Option 1: Place a fort
      if (player.reserves.forts > 0) {
        for (const fId of Object.keys(state.fortSpaces)) {
          const baseScore = scoreFortSpace(state, player, fId);
          if (baseScore < 0) continue;
          const finalScore = scoreCardAction(state, player, card, fId, 'fortSpace', baseScore);
          candidates.push({ cardId: card.id, targetId: fId, targetType: 'fortSpace', score: finalScore });
        }
      }
      // Option 2: Place a village
      if (player.reserves.villages > 0) {
        // Enforce village limit: max villages = harvested agriculture tokens
        const totalTokens = Object.values(player.tokens).reduce((sum, count) => sum + count, 0);
        const villagesOnBoard = Object.values(state.provinces)
          .flatMap(p => p.pieces)
          .filter(pc => pc.playerId === player.id && pc.type === 'village')
          .length;
        if (villagesOnBoard < totalTokens) {
          for (const pId of Object.keys(state.provinces)) {
            const baseScore = scoreProvince(state, player, pId);
            if (baseScore < 0) continue;
            const myInf = playerInfluence(state, player.id, pId);
            const { bestInfluence } = provinceWinner(state, pId);
            const gap = bestInfluence - myInf;
            // For village placement, use 'place_village' as the piece type for bonus calculation
            const adjustedScore = baseScore + pieceTypeBonus('place_village', myInf, gap);
            const finalScore = scoreCardAction(state, player, card, pId, 'province', adjustedScore);
            candidates.push({ cardId: card.id, targetId: pId, targetType: 'province', score: finalScore });
          }
        }
      }
    }

    // --- Queen: copy the best action from played cards ---
    else if (card.effectType === 'queen') {
      for (const playedCard of (player.playedCards || [])) {
        // Cannot copy Sentinel or another Queen
        if (playedCard.effectType === 'sentinel' || playedCard.effectType === 'queen') continue;

        // Generate candidates for the copied card's effect
        const copiedEffectType = playedCard.effectType;

        if (copiedEffectType === 'place_villager' || copiedEffectType === 'place_village' || copiedEffectType === 'move_priest') {
          const reserveKey = copiedEffectType === 'place_villager' ? 'villagers'
            : copiedEffectType === 'place_village' ? 'villages' : 'priests';
          if (player.reserves[reserveKey] <= 0) continue;
          for (const pId of Object.keys(state.provinces)) {
            // Priest blocking rule
            const pieceTypeForBlock = copiedEffectType === 'move_priest' ? 'priest'
              : copiedEffectType === 'place_village' ? 'village' : 'villager';
            if (isPriestBlocked(state, player.id, pId, pieceTypeForBlock)) continue;
            const baseScore = scoreProvince(state, player, pId);
            if (baseScore < 0) continue;
            const myInf = playerInfluence(state, player.id, pId);
            const { bestInfluence } = provinceWinner(state, pId);
            const gap = bestInfluence - myInf;
            const adjustedScore = baseScore + pieceTypeBonus(copiedEffectType, myInf, gap);
            candidates.push({
              cardId: card.id,
              targetId: pId,
              targetType: 'province',
              score: adjustedScore,
              copiedCardId: playedCard.id
            });
          }
        } else if (copiedEffectType === 'place_fort') {
          if (player.reserves.forts <= 0) continue;
          for (const fId of Object.keys(state.fortSpaces)) {
            const baseScore = scoreFortSpace(state, player, fId);
            if (baseScore < 0) continue;
            candidates.push({
              cardId: card.id,
              targetId: fId,
              targetType: 'fortSpace',
              score: baseScore,
              copiedCardId: playedCard.id
            });
          }
        } else if (copiedEffectType === 'place_ship') {
          if (player.reserves.ships <= 0) continue;
          for (const hId of Object.keys(state.harbors)) {
            const baseScore = scoreHarbor(state, player, hId);
            if (baseScore < 0) continue;
            candidates.push({
              cardId: card.id,
              targetId: hId,
              targetType: 'harbor',
              score: baseScore,
              copiedCardId: playedCard.id
            });
          }
        } else if (copiedEffectType === 'take_token') {
          for (const pId of Object.keys(state.provinces)) {
            const baseScore = scoreTokenProvince(state, player, pId);
            if (baseScore < 0) continue;
            candidates.push({
              cardId: card.id,
              targetId: pId,
              targetType: 'province',
              score: baseScore,
              copiedCardId: playedCard.id
            });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Weighted random selection (introduces variety, still respects strategy)
    const positiveScores = candidates.filter(c => c.score > 0).map(c => c.score);
    const minScore = positiveScores.length > 0 ? Math.min(...positiveScores) : 0;
    const weights = candidates.map(c => Math.max(c.score, minScore > 0 ? minScore * 0.5 : 1));
    const idx = weightedRandom(weights);
    const chosen = candidates[idx];
    const payload: any = { targetId: chosen.targetId, targetType: chosen.targetType };
    if (chosen.copiedCardId) {
      payload.copiedCardId = chosen.copiedCardId;
    }
    if (chosen.mode) {
      payload.mode = chosen.mode;
    }
    if (chosen.sourceProvinceId) {
      payload.sourceProvinceId = chosen.sourceProvinceId;
    }
    if (chosen.sourceHarborId) {
      payload.sourceHarborId = chosen.sourceHarborId;
    }
    return {
      type: 'PLAY_CARD',
      playerId,
      cardId: chosen.cardId,
      payload
    };
  }

  // Fallback: if no action cards have valid targets but we have sentinel, play it
  if (sentinelCard) {
    return { type: 'PLAY_CARD', playerId, cardId: sentinelCard.id };
  }

  return null;
}
