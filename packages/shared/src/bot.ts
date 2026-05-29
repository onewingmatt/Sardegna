import { GameState, Player, Province, FortSpace, Harbor, CharacterCard } from './types';
import { PlayerAction } from './engine';

/** Weighted random: returns index into array based on numeric weights. */
function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Calculate a player's influence in a province (pieces + adjacent forts + adjacent harbors). */
function playerInfluence(state: GameState, playerId: string, provinceId: string): number {
  const province = state.provinces[provinceId];
  if (!province) return 0;
  let inf = 0;
  for (const piece of province.pieces) {
    if (piece.playerId !== playerId) continue;
    if (piece.type === 'villager') inf += 1;
    else if (piece.type === 'village') inf += 2;
    else if (piece.type === 'priest') inf += 3;
  }
  for (const fId of province.adjacentFortSpaces) {
    const fs = state.fortSpaces[fId];
    if (fs && fs.forts.length > 0 && fs.forts[0].playerId === playerId) inf += 2;
  }
  for (const hId of province.adjacentHarbors) {
    const h = state.harbors[hId];
    if (h) {
      for (const ship of h.ships) {
        if (ship.playerId === playerId) inf += 1;
      }
    }
  }
  return inf;
}

/** Score a province as a target for piece placement. Higher = better. */
function scoreProvince(state: GameState, player: Player, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p) return -1;
  if (p.pieces.length >= 7) return -1;
  const myInf = playerInfluence(state, player.id, provinceId);
  let topInf = 0;
  for (const pl of state.players) {
    const inf = playerInfluence(state, pl.id, provinceId);
    if (inf > topInf) topInf = inf;
  }
  const gap = topInf - myInf;
  const vpValue = p.vp1;
  // Prefer provinces where we're close to winning (small gap), high VP
  // If we're already ahead, still good to reinforce (gap is negative, score goes up)
  return vpValue * 2 + (topInf > 0 ? (10 - Math.min(gap, 10)) * 3 : 5);
}

/** Score a fort space. */
function scoreFortSpace(state: GameState, player: Player, fortId: string): number {
  const fs = state.fortSpaces[fortId];
  if (!fs || fs.forts.length > 0) return -1;
  let score = 0;
  for (const pId of fs.adjacentProvinces) {
    score += scoreProvince(state, player, pId);
  }
  return score;
}

/** Score a harbor. */
function scoreHarbor(state: GameState, player: Player, harborId: string): number {
  const h = state.harbors[harborId];
  if (!h) return -1;
  const maxShips = state.players.length === 2 ? 1 : 2;
  if (h.ships.length >= maxShips) return -1;
  if (h.ships.some(s => s.playerId === player.id)) return -1;
  let score = 0;
  for (const pId of h.adjacentProvinces) {
    score += scoreProvince(state, player, pId);
  }
  return score;
}

/** Score a province for taking an agriculture token. */
function scoreTokenProvince(state: GameState, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p || !p.hasAgricultureToken) return -1;
  // Prefer high-VP provinces to deny others
  return p.vp1;
}

/** Should this bot play the sentinel card now? */
function shouldPlaySentinel(state: GameState, player: Player): boolean {
  if (state.fortCardRow.length === 0) return false;
  const nextCard = state.fortCardRow[0];
  // Count how many of the card's provinces we're winning
  let winning = 0;
  let total = 0;
  for (const pId of nextCard.scoringProvinceIds) {
    total++;
    const myInf = playerInfluence(state, player.id, pId);
    let best = 0;
    for (const pl of state.players) {
      const inf = playerInfluence(state, pl.id, pId);
      if (inf > best) best = inf;
    }
    if (myInf > 0 && myInf >= best) winning++;
  }
  // Play sentinel if we're winning at least half the provinces on the next card
  return winning >= Math.ceil(total / 2);
}

/** Get the best action for a bot player. Returns null if no valid action is possible. */
export function getBotAction(state: GameState, playerId: string): PlayerAction | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.availableCards.length === 0) return null;

  // Sentinel reveal phase
  if (state.phase === 'sentinel_reveal') {
    const revealedCard = state.fortCardRow[1];
    if (!revealedCard) return { type: 'SENTINEL_REVEAL', playerId, payload: { keep: false } };
    // Evaluate the revealed card: keep if it scores our provinces
    let ourProvinces = 0;
    let total = 0;
    for (const pId of revealedCard.scoringProvinceIds) {
      total++;
      const myInf = playerInfluence(state, playerId, pId);
      let best = 0;
      for (const pl of state.players) {
        const inf = playerInfluence(state, pl.id, pId);
        if (inf > best) best = inf;
      }
      if (myInf > 0 && myInf >= best) ourProvinces++;
    }
    const keep = ourProvinces >= Math.ceil(total / 2);
    return { type: 'SENTINEL_REVEAL', playerId, payload: { keep } };
  }

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
  }
  const candidates: ScoredAction[] = [];

  for (const card of actionCards) {
    if (card.effectType === 'place_villager' || card.effectType === 'place_village' || card.effectType === 'move_priest') {
      const reserveKey = card.effectType === 'place_villager' ? 'villagers' : card.effectType === 'place_village' ? 'villages' : 'priests';
      if (player.reserves[reserveKey] <= 0) continue;
      for (const pId of Object.keys(state.provinces)) {
        const s = scoreProvince(state, player, pId);
        if (s >= 0) {
          candidates.push({ cardId: card.id, targetId: pId, targetType: 'province', score: s });
        }
      }
    } else if (card.effectType === 'place_fort') {
      if (player.reserves.forts <= 0) continue;
      for (const fId of Object.keys(state.fortSpaces)) {
        const s = scoreFortSpace(state, player, fId);
        if (s >= 0) {
          candidates.push({ cardId: card.id, targetId: fId, targetType: 'fortSpace', score: s });
        }
      }
    } else if (card.effectType === 'place_ship') {
      if (player.reserves.ships <= 0) continue;
      for (const hId of Object.keys(state.harbors)) {
        const s = scoreHarbor(state, player, hId);
        if (s >= 0) {
          candidates.push({ cardId: card.id, targetId: hId, targetType: 'harbor', score: s });
        }
      }
    } else if (card.effectType === 'take_token') {
      for (const pId of Object.keys(state.provinces)) {
        const s = scoreTokenProvince(state, pId);
        if (s >= 0) {
          candidates.push({ cardId: card.id, targetId: pId, targetType: 'province', score: s });
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Weighted random selection (introduces variety, still respects strategy)
    const weights = candidates.map(c => Math.max(c.score, 1));
    const idx = weightedRandom(weights);
    const chosen = candidates[idx];
    return {
      type: 'PLAY_CARD',
      playerId,
      cardId: chosen.cardId,
      payload: { targetId: chosen.targetId, targetType: chosen.targetType }
    };
  }

  // Fallback: if no action cards have valid targets but we have sentinel, play it
  if (sentinelCard) {
    return { type: 'PLAY_CARD', playerId, cardId: sentinelCard.id };
  }

  return null;
}
