import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameState, createNewGame, startGame, applyAction, PlayerAction, Color, getBotAction } from '@sardegna/shared';
import path from 'path';

const app = express();
const server = http.createServer(app);

// Use wildcard cors for MVP
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// In-memory store
const games: Record<string, GameState> = {};

// Helper: check if active player is bot and take action
function handleBotTurn(gameId: string) {
  const game = games[gameId];
  if (!game || !game.activePlayerId) return;
  if (game.phase !== 'playing' && game.phase !== 'sentinel_reveal') return;

  const activePlayer = game.players.find((p: any) => p.id === game.activePlayerId);
  if (!activePlayer || !activePlayer.isBot) return;

  setTimeout(() => {
    const currentGameState = games[gameId];
    if (!currentGameState) return;
    if (currentGameState.phase !== 'playing' && currentGameState.phase !== 'sentinel_reveal') return;

    const botPlayer = currentGameState.players.find((p: any) => p.id === currentGameState.activePlayerId);
    if (!botPlayer || !botPlayer.isBot) return;

    const action = getBotAction(currentGameState, botPlayer.id);
    if (!action) {
      console.log(`Bot ${botPlayer.name} has no valid actions. Skipping turn.`);
      return;
    }

    try {
      games[gameId] = applyAction(currentGameState, action);
      io.to(gameId).emit('gameStateUpdate', games[gameId]);
      handleBotTurn(gameId);
    } catch (err) {
      console.error("Bot action error:", err);
    }
  }, 1500);
}

// REST Endpoints
app.post('/api/games', (req, res) => {
  const gameId = Math.random().toString(36).substring(2, 8);
  const newGame = createNewGame(gameId);
  games[gameId] = newGame;
  res.json({ gameId });
});

app.get('/api/games/:id', (req, res) => {
  const game = games[req.params.id];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

// WebSocket Logic
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinGame', ({ gameId, playerId, playerName, color }) => {
    let game = games[gameId];
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    socket.join(gameId);

    // If player doesn't exist, try to add them
    let player = game.players.find((p: any) => p.id === playerId);
    if (!player) {
      if (game.phase !== 'lobby') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      if (game.players.length >= 4) {
        socket.emit('error', { message: 'Game is full' });
        return;
      }
      
      // Starter hand skeleton (official Sardegna card set)
      const starterHand = [
        { id: 'c1', name: 'Commander', effectDescription: 'Add 1 villager to a province OR move your villagers up to 4 times', effectType: 'place_villager' },
        { id: 'c2', name: 'Sentinel', effectDescription: 'Initiate province scoring on the leftmost fort card', effectType: 'sentinel' },
        { id: 'c3', name: 'Admiral', effectDescription: 'Add 1 ship to a harbor OR move any of your ships', effectType: 'place_ship' },
        { id: 'c4', name: 'Priest', effectDescription: 'Add your priest to a province OR move your priest up to 3 times', effectType: 'move_priest' },
        { id: 'c5', name: 'Architect', effectDescription: 'Add 1 fort to an empty fort space OR add 1 village to a province', effectType: 'architect' },
        { id: 'c6', name: 'Queen', effectDescription: 'Copy any action from a character card you have played', effectType: 'queen' },
        { id: 'c7', name: 'Farmer', effectDescription: 'Harvest 1 agriculture token from a reachable province', effectType: 'take_token' }
      ];

      game.players.push({
        id: playerId,
        name: playerName,
        color,
        score: 0,
        availableCards: starterHand,
        playedCards: [],
        reserves: { priests: 1, villages: 4, villagers: 5, forts: 3, ships: 2 },
        tokens: { wheat: 0, wine: 0, olive: 0, thyme: 0, cheese: 0 },
        isBot: false
      });
      game.log.push(`${playerName} joined the game.`);
    }

    io.to(gameId).emit('gameStateUpdate', game);
  });
  
  // Add Bot Event
  socket.on('addBot', ({ gameId }) => {
    let game = games[gameId];
    if (!game) return;
    
    if (game.phase !== 'lobby') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    if (game.players.length >= 4) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    const botId = 'bot-' + Math.random().toString(36).substring(2, 6);
    const availableColors: Color[] = ['red', 'blue', 'yellow', 'green'];
    const usedColors = game.players.map((p: any) => p.color);
    const botColor = availableColors.find(c => !usedColors.includes(c)) || 'red';
    
    const starterHand = [
        { id: 'c1', name: 'Commander', effectDescription: 'Add 1 villager to a province OR move your villagers up to 4 times', effectType: 'place_villager' },
        { id: 'c2', name: 'Sentinel', effectDescription: 'Initiate province scoring on the leftmost fort card', effectType: 'sentinel' },
        { id: 'c3', name: 'Admiral', effectDescription: 'Add 1 ship to a harbor OR move any of your ships', effectType: 'place_ship' },
        { id: 'c4', name: 'Priest', effectDescription: 'Add your priest to a province OR move your priest up to 3 times', effectType: 'move_priest' },
        { id: 'c5', name: 'Architect', effectDescription: 'Add 1 fort to an empty fort space OR add 1 village to a province', effectType: 'architect' },
        { id: 'c6', name: 'Queen', effectDescription: 'Copy any action from a character card you have played', effectType: 'queen' },
        { id: 'c7', name: 'Farmer', effectDescription: 'Harvest 1 agriculture token from a reachable province', effectType: 'take_token' }
      ];

    game.players.push({
      id: botId,
      name: `${["Efisio", "Eleonora", "Gavino", "Salvatore", "Grazia", "Antonio", "Maria", "Giovanni", "Luigi", "Francesco"][Math.floor(Math.random() * 10)]} 🤖`,
      color: botColor,
      score: 0,
      availableCards: starterHand,
      playedCards: [],
      reserves: { priests: 1, villages: 4, villagers: 5, forts: 3, ships: 2 },
      tokens: { wheat: 0, wine: 0, olive: 0, thyme: 0, cheese: 0 },
      isBot: true
    });
    
    game.log.push(`Bot joined the game.`);
    io.to(gameId).emit('gameStateUpdate', game);
  });

  socket.on('startGame', ({ gameId, playerId }) => {
    let game = games[gameId];
    if (!game) return;
    
    // In a real game, restrict to host. For MVP, anyone can start if enough players.
    try {
      game = startGame(game);
      game.log.push('Game started!');
      io.to(gameId).emit('gameStateUpdate', game);
      
      // Kick off bot turn if a bot is first
      handleBotTurn(gameId);
    } catch (err: any) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('playerAction', ({ gameId, action }: { gameId: string, action: PlayerAction }) => {
    let game = games[gameId];
    if (!game) return;

    try {
      game = applyAction(game, action);
      io.to(gameId).emit('gameStateUpdate', game);
      
      // Kick off bot turn if the next player is a bot
      handleBotTurn(gameId);
    } catch (err: any) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
