import { GameState, Player, PlayerId, CharacterCard, Province, GamePhase, FortCard, FortSpace, Harbor } from '../types';

// The island of Sardegna is roughly rectangular with a north/south split.
// We assign exact topology matching the 16 regions.
const ISLAND_TOPOLOGY = [
  { id: 'p1', name: 'Sassari', resource: 'wine_olive', adj: ['p2', 'p5'], vp1: 5, vp2: 2 },
  { id: 'p2', name: 'Castelsardo', resource: 'thyme_cheese', adj: ['p1', 'p3', 'p5', 'p6'], vp1: 2, vp2: 1 },
  { id: 'p3', name: 'Olbia', resource: 'wine_olive', adj: ['p2', 'p4', 'p6'], vp1: 5, vp2: 2 },
  { id: 'p4', name: 'Alghero', resource: 'wine_olive', adj: ['p3', 'p7', 'p8'], vp1: 5, vp2: 2 },
  { id: 'p5', name: 'Bosa', resource: 'wheat', adj: ['p1', 'p2', 'p6', 'p9'], vp1: 6, vp2: 3 },
  { id: 'p6', name: 'Macomer', resource: 'wine_olive', adj: ['p2', 'p3', 'p5', 'p7', 'p9', 'p10'], vp1: 3, vp2: 1 },
  { id: 'p7', name: 'Nuoro', resource: 'thyme_cheese', adj: ['p4', 'p6', 'p8', 'p10'], vp1: 2, vp2: 1 },
  { id: 'p8', name: 'Dorgali', resource: 'wine_olive', adj: ['p4', 'p7', 'p11'], vp1: 3, vp2: 1 },
  { id: 'p9', name: 'Oristano', resource: 'wine_olive', adj: ['p5', 'p6', 'p10', 'p12'], vp1: 5, vp2: 2 },
  { id: 'p10', name: 'Sorgono', resource: 'thyme_cheese', adj: ['p6', 'p7', 'p9', 'p11', 'p12', 'p13'], vp1: 4, vp2: 2 },
  { id: 'p11', name: 'Lanusei', resource: 'wine_olive', adj: ['p8', 'p10', 'p13', 'p14'], vp1: 3, vp2: 1 },
  { id: 'p12', name: 'Iglesias', resource: 'thyme_cheese', adj: ['p9', 'p10', 'p13', 'p15'], vp1: 2, vp2: 1 },
  { id: 'p13', name: 'Sanluri', resource: 'thyme_cheese', adj: ['p10', 'p11', 'p12', 'p14', 'p15', 'p16'], vp1: 2, vp2: 1 },
  { id: 'p14', name: 'Muravera', resource: 'thyme_cheese', adj: ['p11', 'p13', 'p16'], vp1: 2, vp2: 1 },
  { id: 'p15', name: 'Carbonia', resource: 'wine_olive', adj: ['p12', 'p13', 'p16'], vp1: 5, vp2: 2 },
  { id: 'p16', name: 'Cagliari', resource: 'wheat', adj: ['p13', 'p14', 'p15'], vp1: 4, vp2: 2 }
];

const FORT_CONNECTIONS: Record<string, string[]> = {
  f1: ['p1', 'p2'],
  f2: ['p2', 'p3'],
  f3: ['p2', 'p3', 'p5'],
  f4: ['p3', 'p5'],
  f5: ['p1', 'p4'],
  f6: ['p1', 'p2', 'p4'],
  f7: ['p4', 'p2', 'p6', 'p7'],
  f8: ['p2', 'p5', 'p7'],
  f9: ['p5', 'p7', 'p8'],
  f10: ['p5', 'p7', 'p8'],
  f11: ['p4', 'p6'],
  f12: ['p6', 'p7', 'p9', 'p10'],
  f13: ['p7', 'p8', 'p10'],
  f14: ['p8', 'p10'],
  f15: ['p6', 'p9'],
  f16: ['p9', 'p10', 'p12', 'p13'],
  f17: ['p10', 'p13'],
  f18: ['p9', 'p11'],
  f19: ['p9', 'p11', 'p12'],
  f20: ['p12', 'p13', 'p16'],
  f21: ['p13', 'p16'],
  f22: ['p11', 'p14'],
  f23: ['p14', 'p11', 'p15'],
  f24: ['p11', 'p12', 'p15'],
  f25: ['p16', 'p12', 'p15'],
  f26: ['p14', 'p15'],
};

const HARBOR_CONNECTIONS: Record<string, string[]> = {
  h1: ['p1'],
  h2: ['p5'],
  h3: ['p4'],
  h4: ['p10'],
  h5: ['p9'],
};


export function createNewGame(id: string): GameState {
  
  const provinces: Record<string, Province> = {};
  
  const specificTokens = {
    'wheat': ['wheat', 'wheat'], // 2 wheat tokens total
    'wine_olive': ['wine', 'wine', 'wine', 'wine', 'olive', 'olive', 'olive', 'olive'], // 4 wine, 4 olive
    'thyme_cheese': ['thyme', 'thyme', 'thyme', 'cheese', 'cheese', 'cheese'] // 3 thyme, 3 cheese
  };

  // Shuffle the pools
  for (const key in specificTokens) {
    const arr = specificTokens[key as keyof typeof specificTokens];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  ISLAND_TOPOLOGY.forEach(t => {
    let specificToken: string | undefined = undefined;
    if (t.resource === 'wheat' && specificTokens['wheat'].length > 0) {
      specificToken = specificTokens['wheat'].pop();
    } else if (t.resource === 'wine_olive' && specificTokens['wine_olive'].length > 0) {
      specificToken = specificTokens['wine_olive'].pop();
    } else if (t.resource === 'thyme_cheese' && specificTokens['thyme_cheese'].length > 0) {
      specificToken = specificTokens['thyme_cheese'].pop();
    }
    
    provinces[t.id] = {
      id: t.id,
      name: t.name,
      resource: t.resource as any,
      pieces: [],
      adjacentProvinces: t.adj,
      adjacentHarbors: [],
      adjacentFortSpaces: [],
      hasAgricultureToken: true,
      specificToken: specificToken as any,
      vp1: t.vp1,
      vp2: t.vp2
    };
  });

  const harbors: Record<string, Harbor> = {};
  for (const [hId, pIds] of Object.entries(HARBOR_CONNECTIONS)) {
    harbors[hId] = {
      id: hId,
      ships: [],
      adjacentProvinces: pIds
    };
    pIds.forEach(pId => {
      if(provinces[pId]) {
        provinces[pId].adjacentHarbors.push(hId);
      }
    });
  }

  const fortSpaces: Record<string, FortSpace> = {};
  for (const [fId, pIds] of Object.entries(FORT_CONNECTIONS)) {
    fortSpaces[fId] = {
      id: fId,
      forts: [],
      adjacentProvinces: pIds
    };
    pIds.forEach(pId => {
      if(provinces[pId]) {
        provinces[pId].adjacentFortSpaces.push(fId);
      }
    });
  }


  return {
    id,
    phase: 'lobby',
    players: [],
    activePlayerId: null,
    playerOrder: [],
    provinces,
    harbors,
    fortSpaces,
    fortCardDeck: [], // Shuffled 26
    fortCardRow: [], // Dealt 11
    faceUpFortCards: 2,
    scoringEventsCount: 0,
    isScoringInProgress: false,
    currentScoringProvinceIndex: 0,
    log: []
  };
}

export function startGame(state: GameState): GameState {
  if (state.players.length < 2) throw new Error("Not enough players");
  state.phase = 'playing';
  state.activePlayerId = state.players[0].id;
  state.playerOrder = state.players.map(p => p.id);
  
  // Create 26 fort cards corresponding to the 26 forts
  const allFortCards: FortCard[] = Object.entries(FORT_CONNECTIONS).map(([fId, pIds]) => ({
    id: fId,
    scoringProvinceIds: [...pIds]
  }));

  // Shuffle the deck (simple Fisher-Yates for MVP)
  for (let i = allFortCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allFortCards[i], allFortCards[j]] = [allFortCards[j], allFortCards[i]];
  }

  // Deal 11 to the row, rest to deck
  state.fortCardRow = allFortCards.slice(0, 11);
  state.fortCardDeck = allFortCards.slice(11);
  state.faceUpFortCards = 2;
  
  return state;
}

export interface PlayerAction {
  type: 'PLAY_CARD' | 'RESOLVE_EFFECT' | 'SENTINEL_REVEAL';
  playerId: PlayerId;
  cardId?: string;
  // Payload would contain details like 'targetProvinceId', 'targetHarborId' based on effect type
  payload?: any;
}

export function applyAction(state: GameState, action: PlayerAction): GameState {
  if (state.phase !== 'playing' && state.phase !== 'scoring' && state.phase !== 'sentinel_reveal') {
    throw new Error(`Cannot perform actions in phase ${state.phase}`);
  }
  if (action.playerId !== state.activePlayerId) {
    throw new Error("Not active player's turn");
  }

  if (action.type === 'PLAY_CARD') {
    const player = state.players.find(p => p.id === action.playerId);
    if (!player) throw new Error("Player not found");
    const cardIndex = player.availableCards.findIndex(c => c.id === action.cardId);
    
    if (cardIndex === -1) throw new Error("Card not found in hand");

    const card = player.availableCards.splice(cardIndex, 1)[0];
    if (!player.playedCards) player.playedCards = [];
    player.playedCards.push(card);
    
    state.log.push(`Player ${player.name} played ${card.name}`);

    if (card.effectType === 'sentinel') {
      return triggerSentinel(state);
    }

    // Queen: copy a previously played card (since last Sentinel)
    if (card.effectType === 'queen') {
      const copiedCardId = action.payload?.copiedCardId;
      if (!copiedCardId) {
        throw new Error('Queen requires a copiedCardId in payload');
      }
      const copiedCard = player.playedCards.find(c => c.id === copiedCardId);
      if (!copiedCard) {
        throw new Error(`Copied card ${copiedCardId} not found in played cards`);
      }
      // Queen cannot copy Sentinel or itself
      if (copiedCard.effectType === 'sentinel') {
        throw new Error('Queen cannot copy the Sentinel card');
      }
      if (copiedCard.effectType === 'queen') {
        throw new Error('Queen cannot copy another Queen');
      }
      state.log.push(`${player.name} played Queen copying ${copiedCard.name}`);
      // Override card's effectType to the copied card's effect
      card.effectType = copiedCard.effectType;
      state.log.push(`${player.name} uses Queen to ${copiedCard.name}'s effect`);
      // Fall through to normal effect handling
    }

    // Architect: can place a fort OR a village depending on targetType
    if (card.effectType === 'architect') {
      if (action.payload?.targetType === 'fortSpace') {
        card.effectType = 'place_fort';
      } else if (action.payload?.targetType === 'province') {
        card.effectType = 'place_village';
      } else {
        throw new Error('Architect requires targetType "fortSpace" or "province"');
      }
      state.log.push(`${player.name} uses Architect to ${card.effectType === 'place_fort' ? 'place a fort' : 'place a village'}`);
      // Fall through to normal effect handling
    }

    if (action.payload && action.payload.targetId) {
      const { targetId, targetType } = action.payload;
      
      if (targetType === 'province' && state.provinces[targetId]) {
         
         // Handle Farmer card: Harvest agriculture token
         if (card.effectType === 'take_token') {
             const province = state.provinces[targetId];
             if (!province.hasAgricultureToken) {
                 throw new Error(`Province ${province.name} no longer has an agriculture token`);
             }
             
             // Check: farmer must have a villager in the target province
             const hasVillager = province.pieces.some(p => p.playerId === player.id && p.type === 'villager');
             if (!hasVillager) {
                 throw new Error(`Farmer requires one of your villagers in the target province (${province.name})`);
             }
             
             // Check: must choose a harbor with your ship, and province must be reachable
             const harborsWithShip = Object.values(state.harbors).filter(h => h.ships.some(s => s.playerId === player.id));
             if (harborsWithShip.length === 0) {
                 throw new Error('Farmer requires one of your ships in a harbor');
             }
             
             // BFS to find all provinces reachable from each harbor via unbroken chain of player's villagers
             const reachableProvinces = new Set<string>();
             for (const harbor of harborsWithShip) {
                 const queue = [...harbor.adjacentProvinces];
                 const visited = new Set<string>();
                 while (queue.length > 0) {
                     const pId = queue.shift()!;
                     if (visited.has(pId)) continue;
                     visited.add(pId);
                     
                     // This province is reachable (it's adjacent to harbor or connected via villager chain)
                     reachableProvinces.add(pId);
                     
                     // Can we continue the chain through this province?
                     const prov = state.provinces[pId];
                     if (prov && prov.pieces.some(p => p.playerId === player.id && p.type === 'villager')) {
                         for (const adjId of prov.adjacentProvinces) {
                             if (!visited.has(adjId)) {
                                 queue.push(adjId);
                             }
                         }
                     }
                 }
             }
             
             if (!reachableProvinces.has(targetId)) {
                 throw new Error(`Province ${province.name} is not reachable from any of your harbors via a chain of your villagers`);
             }
             
             // Take the token
             province.hasAgricultureToken = false;
             const specificToken = province.specificToken;
             let tokenType: string;
             if (specificToken) {
                 tokenType = specificToken;
                 player.tokens[specificToken]++;
             } else {
                 // Fallback for legacy game states
                 const res = province.resource;
                 if (res === 'wheat') { player.tokens.wheat++; tokenType = 'wheat'; }
                 else if (res === 'wine_olive') { player.tokens.wine++; tokenType = 'wine'; }
                 else if (res === 'thyme_cheese') { player.tokens.cheese++; tokenType = 'cheese'; }
                 else { tokenType = 'unknown'; }
             }
             
             // Score VP: 1st token of each type = 1 VP, 2nd = 2 VP, 3rd = 3 VP, 4th = 4 VP
             const count = player.tokens[tokenType] || 0;
             const vpGained = count; // count is after increment, so 1→1VP, 2→2VP, 3→3VP, 4→4VP
             player.score += vpGained;
             
             state.log.push(`${player.name} harvested a ${tokenType} token from ${province.name} for +${vpGained} VP (${count} total ${tokenType})`);
             nextTurn(state);
             return state;
         }

         const typeMap: Record<string, 'villager' | 'village' | 'priest'> = {
           'place_villager': 'villager',
           'place_village': 'village',
           'move_priest': 'priest'
         };
         const pieceType = typeMap[card.effectType] || 'villager';
         const reserveKey = pieceType === 'villager' ? 'villagers' : pieceType === 'village' ? 'villages' : 'priests';

         // Handle move mode (Commander or Priest moving existing pieces)
         if (action.payload?.mode === 'move') {
           const sourceProvinceId = action.payload.sourceProvinceId;
           if (!sourceProvinceId || !state.provinces[sourceProvinceId]) {
             throw new Error('Move requires a valid sourceProvinceId');
           }
           // Check source has player's piece of the right type
           const sourceProvince = state.provinces[sourceProvinceId];
           const pieceIndex = sourceProvince.pieces.findIndex(
             pc => pc.playerId === player.id && pc.type === pieceType
           );
           if (pieceIndex === -1) {
             throw new Error(`No ${pieceType} of yours found in ${sourceProvince.name} to move`);
           }
           // Check destination not full
           if (state.provinces[targetId].pieces.length >= 7) {
             throw new Error(`Province ${state.provinces[targetId].name} is full (max 7 pieces)`);
           }
           // Check movement distance
           const maxMove = pieceType === 'priest' ? 3 : 4;
           const dist = shortestPathLength(state, sourceProvinceId, targetId, maxMove);
           if (dist < 0 || dist > maxMove) {
             throw new Error(`Destination too far — ${pieceType} can move at most ${maxMove} steps (found ${dist < 0 ? 'no path' : dist})`);
           }
           // Priest blocking applies to villagers/villages moving INTO a province
           if (pieceType === 'villager' || pieceType === 'village') {
             const oppHasPriest = state.provinces[targetId].pieces.some(
               pc => pc.type === 'priest' && pc.playerId !== player.id
             );
             const weHavePriest = state.provinces[targetId].pieces.some(
               pc => pc.type === 'priest' && pc.playerId === player.id
             );
             if (oppHasPriest && !weHavePriest) {
               throw new Error(`An opponent's priest in ${state.provinces[targetId].name} blocks moving ${pieceType}s there`);
             }
           }
           // Execute move: remove from source, add to destination
           const [movedPiece] = sourceProvince.pieces.splice(pieceIndex, 1);
           state.provinces[targetId].pieces.push(movedPiece);
           state.log.push(`${player.name} moved ${pieceType} from ${sourceProvince.name} to ${state.provinces[targetId].name} (${dist} step${dist !== 1 ? 's' : ''})`);
           nextTurn(state);
           return state;
         }

         if (state.provinces[targetId].pieces.length >= 7) {
             throw new Error(`Province ${state.provinces[targetId].name} is full (max 7 pieces)`);
         }
         
         // Priest blocking rule: an opponent's priest in this province blocks placing villages/villagers
         // unless we also have a priest here
         if (pieceType === 'villager' || pieceType === 'village') {
           const oppHasPriest = state.provinces[targetId].pieces.some(
             pc => pc.type === 'priest' && pc.playerId !== player.id
           );
           const weHavePriest = state.provinces[targetId].pieces.some(
             pc => pc.type === 'priest' && pc.playerId === player.id
           );
           if (oppHasPriest && !weHavePriest) {
             throw new Error(`An opponent's priest in ${state.provinces[targetId].name} blocks placing villages or villagers there`);
           }
         }
         
         // Architect rule: max villages in play = harvested agriculture tokens
         if (pieceType === 'village') {
           const totalTokens = Object.values(player.tokens).reduce((sum, count) => sum + count, 0);
           const villagesOnBoard = Object.values(state.provinces)
             .flatMap(p => p.pieces)
             .filter(pc => pc.playerId === player.id && pc.type === 'village')
             .length;
           if (villagesOnBoard >= totalTokens) {
             throw new Error(`Maximum villages (${totalTokens}) reached — need more agriculture tokens (have ${totalTokens}, board has ${villagesOnBoard})`);
           }
         }
         
         if (player.reserves[reserveKey] <= 0) {
             throw new Error(`No ${reserveKey} left in your personal reserve`);
         }
         
         player.reserves[reserveKey]--;
         state.provinces[targetId].pieces.push({
           playerId: player.id,
           type: pieceType
         });
         state.log.push(`${player.name} placed a ${pieceType} in ${state.provinces[targetId].name}`);
      } else if (targetType === 'fortSpace' && state.fortSpaces[targetId] && card.effectType === 'place_fort') {
         if (state.fortSpaces[targetId].forts.length > 0) {
             throw new Error(`Fort space ${targetId} is already occupied`);
         }
         if (player.reserves.forts <= 0) {
             throw new Error(`No forts left in your personal reserve`);
         }
         player.reserves.forts--;
         state.fortSpaces[targetId].forts.push({
           playerId: player.id
         });
         state.log.push(`${player.name} placed a fort at ${targetId}`);
      } else if (targetType === 'harbor' && state.harbors[targetId] && card.effectType === 'place_ship') {
         const harbor = state.harbors[targetId];
         
         // Handle Admiral move mode: move a ship from one harbor to another
         if (action.payload?.mode === 'move') {
           const sourceHarborId = action.payload.sourceHarborId;
           if (!sourceHarborId || !state.harbors[sourceHarborId]) {
             throw new Error('Move requires a valid sourceHarborId');
           }
           const sourceHarbor = state.harbors[sourceHarborId];
           const shipIndex = sourceHarbor.ships.findIndex(s => s.playerId === player.id);
           if (shipIndex === -1) {
             throw new Error(`No ship of yours found in harbor ${sourceHarborId} to move`);
           }
           const maxShips = state.players.length === 2 ? 1 : 2;
           if (harbor.ships.length >= maxShips) {
             throw new Error(`Harbor ${targetId} is already full`);
           }
           if (harbor.ships.some(s => s.playerId === player.id)) {
             throw new Error(`You already have a ship in harbor ${targetId}`);
           }
           // Execute move
           const [movedShip] = sourceHarbor.ships.splice(shipIndex, 1);
           harbor.ships.push(movedShip);
           state.log.push(`${player.name} moved a ship from harbor ${sourceHarborId} to harbor ${targetId}`);
           nextTurn(state);
           return state;
         }
         
         // Max 2 ships per harbor (or 1 in a 2-player game)
         const maxShips = state.players.length === 2 ? 1 : 2;
         if (harbor.ships.length >= maxShips) {
             throw new Error(`Harbor ${targetId} is already full`);
         }
         if (harbor.ships.some(s => s.playerId === player.id)) {
             throw new Error(`You already have a ship in harbor ${targetId}`);
         }
         if (player.reserves.ships <= 0) {
             throw new Error(`No ships left in your personal reserve`);
         }
         player.reserves.ships--;
         harbor.ships.push({
             playerId: player.id
         });
         state.log.push(`${player.name} placed a ship at ${targetId}`);
      }
    } else {
       // Fallback for bot or error
       state.log.push(`${player.name} played ${card.name} but no valid target was provided.`);
    }

    nextTurn(state);
  } else if (action.type === 'SENTINEL_REVEAL') {
    if (state.phase !== 'sentinel_reveal') throw new Error("Not in sentinel reveal phase");
    
    const keep = action.payload?.keep;
    const player = state.players.find(p => p.id === action.playerId);
    
    if (!keep) {
        // Discard the newly revealed card (which is at index 1) to bottom of deck, draw a new one
        const rejectedCard = state.fortCardRow.splice(1, 1)[0];
        if (rejectedCard) {
           state.fortCardDeck.push(rejectedCard);
           const newCard = state.fortCardDeck.shift();
           if (newCard) {
               // insert new card at index 1
               state.fortCardRow.splice(1, 0, newCard);
               state.log.push(`${player?.name} discarded ${rejectedCard.id} to the deck and replaced it with ${newCard.id}.`);
           }
        }
    } else {
        state.log.push(`${player?.name} decided to keep ${state.fortCardRow[1]?.id}.`);
    }
    
    // Add a new face down card to the right side of the row so we always have 11
    const nextDeckCard = state.fortCardDeck.shift();
    if (nextDeckCard) {
        state.fortCardRow.push(nextDeckCard);
    }
    
    state.phase = 'playing';
    state.isScoringInProgress = false;
    nextTurn(state);
  }

  return state;
}

/** BFS to check if destination province is reachable from source within maxSteps. Returns shortest distance or -1. */
function shortestPathLength(state: GameState, fromId: string, toId: string, maxSteps: number): number {
  if (fromId === toId) return 0;
  const queue: { id: string; dist: number }[] = [{ id: fromId, dist: 0 }];
  const visited = new Set<string>([fromId]);
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (dist >= maxSteps) continue;
    const province = state.provinces[id];
    if (!province) continue;
    for (const adjId of province.adjacentProvinces) {
      if (adjId === toId) return dist + 1;
      if (!visited.has(adjId)) {
        visited.add(adjId);
        queue.push({ id: adjId, dist: dist + 1 });
      }
    }
  }
  return -1;
}

function nextTurn(state: GameState) {
  if (!state.activePlayerId) return;
  const currentIndex = state.playerOrder.indexOf(state.activePlayerId);
  state.activePlayerId = state.playerOrder[(currentIndex + 1) % state.playerOrder.length];
}

function triggerSentinel(state: GameState): GameState {
  state.phase = 'scoring';
  state.isScoringInProgress = true;
  state.currentScoringProvinceIndex = 0;
  
  if (state.fortCardRow.length === 0) {
     throw new Error("No fort cards left to score");
  }
  
  const scoringCard = state.fortCardRow[0];
  state.log.push(`Scoring triggered based on fort card ${scoringCard.id}`);
  
  // Actually score it
  scoreFortCard(state, scoringCard);

  // After scoring:
  state.scoringEventsCount++;
  
  if (state.scoringEventsCount >= 11) {
    state.phase = 'finished';
    state.log.push("Game Over! 11th scoring event completed.");
    return state;
  }

  // Retrieve cards for all players
  state.players.forEach(p => {
    if (p.playedCards && p.playedCards.length > 0) {
      p.availableCards.push(...p.playedCards);
      p.playedCards = [];
    }
  });

  // Discard leftmost, move it to bottom of deck
  const discarded = state.fortCardRow.shift();
  if (discarded) {
      state.fortCardDeck.push(discarded);
      state.log.push(`Scored card ${discarded.id} was discarded to the bottom of the deck.`);
  }
  
  // Transition to reveal phase so active player can keep or reject the new leftmost card
  state.phase = 'sentinel_reveal';
  
  return state;
}

function scoreFortCard(state: GameState, fortCard: FortCard) {
  state.log.push(`--- Scoring Fort Card ${fortCard.id} ---`);

  // Each fort card scores its adjacent provinces
  for (const provId of fortCard.scoringProvinceIds) {
    const province = state.provinces[provId];
    if (!province) continue;

    // Tally influence per player
    const influence: Record<string, number> = {};
    state.players.forEach(p => influence[p.id] = 0);

    // 1. Pieces in province
    for (const piece of province.pieces) {
      if (piece.type === 'villager') influence[piece.playerId] += 1;
      if (piece.type === 'village') influence[piece.playerId] += 2;
      if (piece.type === 'priest') influence[piece.playerId] += 1;
    }

    // 2. Adjacent Forts
    for (const fId of province.adjacentFortSpaces) {
      const fortSpace = state.fortSpaces[fId];
      if (fortSpace && fortSpace.forts.length > 0) {
        influence[fortSpace.forts[0].playerId] += 1;
      }
    }

    // 3. Adjacent Harbors
    for (const hId of province.adjacentHarbors) {
      const harbor = state.harbors[hId];
      if (harbor) {
        for (const ship of harbor.ships) {
          influence[ship.playerId] += 1;
        }
      }
    }

    // Evaluate standings
    const playersWithInfluence = state.players.filter(p => influence[p.id] > 0);
    
    if (playersWithInfluence.length === 0) {
      state.log.push(`Province ${province.name}: No influence.`);
      continue;
    }

    // Sort descending by influence
    const sorted = [...playersWithInfluence].sort((a, b) => influence[b.id] - influence[a.id]);
    
    const highestInfluence = influence[sorted[0].id];
    const tiedForFirst = sorted.filter(p => influence[p.id] === highestInfluence);
    
    // Scoring rules (per official rulebook):
    // - Players with most influence get FULL VP of the province.
    // - Players with second-highest influence get HALF VP (rounded down).
    // - If tied for most influence: all tied get FULL VP, no second place awarded.
    // - If tied for second-highest: all tied get half VP.
    // - Two-player game: no second place VP at all.

    const vp1 = province.vp1;
    const vp2 = Math.floor(province.vp1 / 2);

    if (tiedForFirst.length > 1) {
      // Tie for 1st — all tied get FULL VP (rulebook example A)
      tiedForFirst.forEach(p => {
        p.score += vp1;
        state.log.push(`Province ${province.name}: ${p.name} tied for 1st (${highestInfluence} inf) -> +${vp1} VP`);
      });
      // No second place awarded when first is tied
    } else {
      // Clear 1st
      const first = tiedForFirst[0];
      first.score += vp1;
      state.log.push(`Province ${province.name}: ${first.name} is 1st (${highestInfluence} inf) -> +${vp1} VP`);
      
      // Look for 2nd place (only if not a 2-player game)
      if (sorted.length > 1 && state.players.length !== 2) {
        const secondInfluence = influence[sorted[1].id];
        const tiedForSecond = sorted.filter(p => influence[p.id] === secondInfluence);
        
        // All tied for 2nd get half VP each (rulebook example B: both Purple and Green got 2 VP)
        tiedForSecond.forEach(p => {
          p.score += vp2;
        });
        if (tiedForSecond.length === 1) {
          state.log.push(`Province ${province.name}: ${tiedForSecond[0].name} is 2nd (${secondInfluence} inf) -> +${vp2} VP`);
        } else {
          state.log.push(`Province ${province.name}: ${tiedForSecond.map(p => p.name).join(', ')} tied for 2nd (${secondInfluence} inf) -> +${vp2} VP each`);
        }
      } else if (sorted.length > 1 && state.players.length === 2) {
        state.log.push(`Province ${province.name}: 2-player game -> no 2nd place VP`);
      }
    }
  }
}
