export type PlayerId = string;
export type Color = 'red' | 'blue' | 'yellow' | 'green';

export interface Player {
  id: PlayerId;
  name: string;
  color: Color;
  score: number;
  availableCards: CharacterCard[];
  playedCards: CharacterCard[];
  // Track remaining pieces to place (if needed for setup or reserves)
  reserves: {
    priests: number;
    villages: number;
    villagers: number;
    forts: number;
    ships: number;
  };
  tokens: {
    wheat: number;
    wine: number;
    olive: number;
    thyme: number;
    cheese: number;
  };
  isBot?: boolean;
}

export type ResourceType = 'wheat' | 'wine' | 'olive' | 'thyme' | 'cheese' | 'wine_olive' | 'thyme_cheese';

export interface Province {
  id: string; // e.g., 'p1', 'p2' ... 'p16'
  name: string;
  resource: ResourceType;
  // pieces currently in this province
  pieces: {
    playerId: PlayerId;
    type: 'priest' | 'village' | 'villager' | 'fort';
  }[];
  adjacentProvinces: string[]; // IDs of adjacent provinces
  adjacentHarbors: string[]; // IDs of adjacent harbors
  adjacentFortSpaces: string[]; // IDs of fort spaces bordering this province
  hasAgricultureToken: boolean;
  specificToken?: ResourceType;
  vp1: number;
  vp2: number;
}

export interface Harbor {
  id: string; // e.g., 'h1', 'h2'
  ships: { playerId: PlayerId }[];
  adjacentProvinces: string[];
}

export interface FortSpace {
  id: string; // e.g., 'f1', 'f2'
  forts: { playerId: PlayerId }[]; // Should usually be max 1 fort
  adjacentProvinces: string[];
}

export interface CharacterCard {
  id: string;
  name: string;
  effectDescription: string;
  // A string ID for the effect logic to parse
  effectType: 'move_ship' | 'place_villager' | 'sentinel' | 'move_priest' | 'place_fort' | 'place_village' | 'queen' | 'architect' | string;
}

export interface FortCard {
  id: string;
  scoringProvinceIds: string[]; // Which provinces score when this is the leftmost card
  imageUrl?: string;
}

export type GamePhase = 'lobby' | 'setup' | 'playing' | 'scoring' | 'sentinel_reveal' | 'finished';

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  activePlayerId: PlayerId | null;
  playerOrder: PlayerId[];
  
  provinces: Record<string, Province>;
  harbors: Record<string, Harbor>;
  fortSpaces: Record<string, FortSpace>;

  fortCardDeck: FortCard[];
  fortCardRow: FortCard[]; // The 11 cards dealt
  faceUpFortCards: number; // Initially 2

  scoringEventsCount: number; // Max 11
  
  // Sentinel specific state
  isScoringInProgress: boolean;
  currentScoringProvinceIndex: number; // Tracks which province of the fort card is currently scoring
  
  log: string[];
}
