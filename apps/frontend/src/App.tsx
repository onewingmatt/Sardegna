import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId, Color, PlayerAction } from '@sardegna/shared';
import mapImage from "./assets/map.png";


const PROVINCE_COORDS = {
  p1: { x: 278, y: 148, token_x: 281, token_y: 181 },
  p2: { x: 381, y: 149, token_x: 405, token_y: 209 },
  p3: { x: 427, y: 89, token_x: 470, token_y: 115 },
  p4: { x: 290, y: 235, token_x: 325, token_y: 266 },
  p5: { x: 473, y: 164, token_x: 492, token_y: 195 },
  p6: { x: 357, y: 313, token_x: 342, token_y: 349 },
  p7: { x: 450, y: 267, token_x: 489, token_y: 290 },
  p8: { x: 574, y: 224, token_x: 604, token_y: 266 },
  p9: { x: 375, y: 389, token_x: 397, token_y: 433 },
  p10: { x: 456, y: 375, token_x: 543, token_y: 371 },
  p11: { x: 330, y: 528, token_x: 353, token_y: 553 },
  p12: { x: 441, y: 477, token_x: 460, token_y: 554 },
  p13: { x: 517, y: 462, token_x: 564, token_y: 492 },
  p14: { x: 267, y: 588, token_x: 294, token_y: 651 },
  p15: { x: 381, y: 606, token_x: 391, token_y: 641 },
  p16: { x: 501, y: 603, token_x: 546, token_y: 641 },
};



const HARBOR_COORDS = {
  h1: { x: 277, y: 106 },
  h2: { x: 621, y: 111 },
  h3: { x: 205, y: 255 },
  h4: { x: 621, y: 371 },
  h5: { x: 206, y: 441 },
};

const FORT_COORDS = {
  f1: { x: 317, y: 113 },
  f2: { x: 380, y: 95 },
  f3: { x: 421, y: 153 },
  f4: { x: 543, y: 61 },
  f5: { x: 218, y: 222 },
  f6: { x: 327, y: 194 },
  f7: { x: 388, y: 251 },
  f8: { x: 460, y: 219 },
  f9: { x: 527, y: 216 },
  f10: { x: 600, y: 176 },
  f11: { x: 254, y: 305 },
  f12: { x: 409, y: 338 },
  f13: { x: 521, y: 301 },
  f14: { x: 588, y: 325 },
  f15: { x: 230, y: 393 },
  f16: { x: 478, y: 431 },
  f17: { x: 604, y: 399 },
  f18: { x: 262, y: 476 },
  f19: { x: 398, y: 460 },
  f20: { x: 516, y: 519 },
  f21: { x: 576, y: 559 },
  f22: { x: 218, y: 551 },
  f23: { x: 304, y: 611 },
  f24: { x: 395, y: 560 },
  f25: { x: 446, y: 643 },
  f26: { x: 276, y: 718 },
};

const socket: Socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin);


function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<PlayerId>('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [color, setColor] = useState<Color>('red');
  const [gameId, setGameId] = useState('');
  
  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Basic session persistence
    const savedId = localStorage.getItem('sardegna-player-id');
    if (savedId) setPlayerId(savedId);
    else {
      const newId = Math.random().toString(36).substring(2, 9);
      localStorage.setItem('sardegna-player-id', newId);
      setPlayerId(newId);
    }

    socket.on('gameStateUpdate', (state: GameState) => {
      setGameState(state);
    });

    socket.on('error', (err: { message: string }) => {
      alert(err.message);
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('error');
    };
  }, []);

  // Sync browser title
  useEffect(() => {
    if (gameState && gameState.id) {
      document.title = `Sardegna [${gameState.id}]`;
    } else {
      document.title = 'Sardegna';
    }
  }, [gameState?.id]);

  const createGame = async () => {
    const res = await fetch('/api/games', { method: 'POST' });
    const data = await res.json();
    setGameId(data.gameId);
  };

  const joinGame = () => {
    if (!gameId || !playerName) return alert('Enter game ID and your name');
    socket.emit('joinGame', { gameId, playerId, playerName, color });
  };

  const startGame = () => {
    if (!gameState) return;
    socket.emit('startGame', { gameId: gameState.id, playerId });
  };

  

  const getCardIcon = (effectType: string) => {
    switch(effectType) {
      case 'move_priest': return '🔺';
      case 'sentinel': return '🛡️';
      case 'place_villager': return '🧑‍🌾';
      case 'place_village': return '🏘️';
      case 'place_ship': return '⛵';
      case 'place_fort': return '🏰';
      case 'take_token': return '🌾';
      default: return '🃏';
    }
  };

  const addBot = () => {
    if (!gameState) return;
    socket.emit('addBot', { gameId: gameState.id });
  };

  const playCard = (card: any) => {
    if (!gameState) return;
    
    // If it's the Sentinel card, it doesn't need a target, just play it
    if (card.effectType === 'sentinel') {
      const action: PlayerAction = {
        type: 'PLAY_CARD',
        playerId,
        cardId: card.id
      };
      socket.emit('playerAction', { gameId: gameState.id, action });
      setSelectedCardId(null);
      return;
    }
    
    // Otherwise, we wait for the user to click a target on the map
    if (selectedCardId === card.id) {
       setSelectedCardId(null); // toggle off
    } else {
       setSelectedCardId(card.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Determine scroll direction and magnitude
    // e.deltaY is usually 100 for a typical mouse wheel click
    const direction = e.deltaY < 0 ? 1 : -1;
    
    // Scale exponentially rather than linearly to make zooming feel natural
    const zoomFactor = 1.15; // 15% zoom per tick
    
    setScale(s => {
       let newScale = direction > 0 ? s * zoomFactor : s / zoomFactor;
       return Math.min(Math.max(0.5, newScale), 5); // Restrict between 0.5x and 5x zoom
    });
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingMap(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setLastMousePos({ x: clientX, y: clientY });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingMap) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const dx = clientX - lastMousePos.x;
    const dy = clientY - lastMousePos.y;
    
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    setLastMousePos({ x: clientX, y: clientY });
  };

  const handleMouseUp = () => {
    setIsDraggingMap(false);
  };

  const handleSentinelReveal = (keep: boolean) => {
    if (!gameState) return;
    const action: PlayerAction = {
      type: 'SENTINEL_REVEAL',
      playerId,
      payload: { keep }
    };
    socket.emit('playerAction', { gameId: gameState.id, action });
  };

  const handleMapClick = (targetId: string, type: 'province' | 'fortSpace' | 'harbor') => {
    if (!gameState || !selectedCardId) return;

    // We have a pending card to play, and the user just clicked a map target
    const action: PlayerAction = {
      type: 'PLAY_CARD',
      playerId,
      cardId: selectedCardId,
      payload: { targetId, targetType: type }
    };
    
    socket.emit('playerAction', { gameId: gameState.id, action });
    setSelectedCardId(null); // reset UI state after sending
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
        <h1 className="text-4xl font-bold mb-8 text-blue-900">Sardegna Multiplayer</h1>
        
        <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Your Name</label>
            <input 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              placeholder="e.g. John Doe"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">Color</label>
            <select 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
              value={color} 
              onChange={e => setColor(e.target.value as Color)}
            >
              <option value="red">Red</option>
              <option value="blue">Blue</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
            </select>
          </div>

          <div className="flex gap-2 mb-6">
            <input 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight" 
              value={gameId} 
              onChange={e => setGameId(e.target.value)} 
              placeholder="Game ID"
            />
            <button 
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={joinGame}
            >
              Join
            </button>
          </div>

          <div className="border-t pt-4 text-center">
            <p className="mb-2 text-sm text-gray-600">Or start a new game</p>
            <button 
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
              onClick={createGame}
            >
              Create Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);

  return (
    <div className="flex flex-col h-screen bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-gray-100">
      {/* Header / Score Track */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-3 sm:px-6 shadow-xl border-b-[6px] border-yellow-500 flex flex-col md:flex-row justify-between items-center gap-3 z-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
        <div className="flex items-center gap-3">
            <div className="bg-yellow-500 text-blue-900 font-black px-3 py-1 rounded shadow drop-shadow text-sm uppercase tracking-widest">
              Sardegna
            </div>
            <span className="text-sm opacity-80 font-mono bg-black bg-opacity-30 px-2 py-0.5 rounded">ID: {gameState.id}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {gameState.players.map(p => {
             const colorMap: Record<string, string> = { red: 'bg-red-500', blue: 'bg-blue-500', yellow: 'bg-yellow-400', green: 'bg-green-500' };
             const bg = colorMap[p.color] || 'bg-gray-500';
             const isTurn = gameState.activePlayerId === p.id;
             const isMe = p.id === playerId;
             
             return (
              <div key={p.id} className={`relative flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border-[3px] transition-all duration-500 transform ${isTurn ? 'border-yellow-400 bg-gradient-to-r from-black/60 to-black/20 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-110 z-10' : 'border-transparent bg-black/20 hover:bg-black/30'}`}>
                <div className={`w-5 h-5 rounded-full ${bg} shadow-[inset_0_-2px_4px_rgba(0,0,0,0.4)] border border-white/80 ring-2 ring-black/50`}></div>
                <div className="flex flex-col min-w-[70px]">
                  <span className="text-xs font-black tracking-wide leading-tight drop-shadow-md">
                    {p.name} {isMe && <span className="text-[9px] text-blue-200 ml-1">(YOU)</span>}
                  </span>
                  {isTurn && <span className="text-[9px] uppercase tracking-widest text-yellow-400 font-black leading-none animate-pulse mt-0.5">Thinking...</span>}
                </div>
                <div className="ml-1 bg-gradient-to-b from-white to-gray-200 text-blue-950 font-black px-2.5 py-1 rounded shadow-[inset_0_1px_0_white,0_2px_4px_rgba(0,0,0,0.3)] text-sm border border-gray-300">
                  {p.score} <span className="text-[9px] text-gray-500 tracking-tighter">VP</span>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-grow flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden relative">
      
        {/* Subtle Sentinel Banner */}
        {gameState.phase === 'sentinel_reveal' && (
          <div className="w-full bg-blue-900 text-white p-3 rounded shadow-md z-40 flex flex-col md:flex-row items-center justify-between px-4 sm:px-6 flex-shrink-0 gap-3">
            <div className="text-center md:text-left">
              <h2 className="font-bold text-base sm:text-lg flex justify-center md:justify-start items-center gap-2">
                🛡️ Sentinel Scoring Complete
              </h2>
              <p className="text-xs sm:text-sm opacity-90">Revealed next card: <span className="font-bold text-yellow-300">{gameState.fortCardRow[1]?.id}</span></p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full md:w-auto">
              {playerId === gameState.activePlayerId ? (
                <>
                  <span className="mr-2 text-sm font-bold">Keep or Replace?</span>
                  <button onClick={() => handleSentinelReveal(true)} className="px-4 py-1.5 bg-green-500 text-white text-sm font-bold rounded hover:bg-green-600 transition shadow">Keep Card</button>
                  <button onClick={() => handleSentinelReveal(false)} className="px-4 py-1.5 bg-red-500 text-white text-sm font-bold rounded hover:bg-red-600 transition shadow">Discard & Replace</button>
                </>
              ) : (
                <span className="text-sm italic opacity-80">Waiting for active player to decide...</span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex-grow flex flex-col lg:flex-row gap-2 sm:gap-4 overflow-y-auto lg:overflow-hidden w-full max-w-full">
          {/* Left: Board View */}
          <div 
            className="flex-grow bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] bg-[#0c2f4d] rounded-2xl border-4 border-[#2b5275] shadow-inner relative p-0 lg:p-4 overflow-hidden min-h-[300px] lg:min-h-[400px] flex justify-center items-center select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            style={{ cursor: isDraggingMap ? 'grabbing' : 'grab' }}
          >
          <div className="absolute inset-0 bg-blue-900/30 mix-blend-multiply pointer-events-none"></div>
          
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex flex-col gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] opacity-50 select-none pointer-events-none">Sardegna</h2>
              <div className="flex gap-2 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm pointer-events-auto">
                 <button onClick={() => setScale(s => Math.min(5, s * 1.5))} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white rounded font-bold transition">+</button>
                 <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white rounded font-bold transition">⟲</button>
                 <button onClick={() => setScale(s => Math.max(0.5, s / 1.5))} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white rounded font-bold transition">-</button>
              </div>
          </div>
          
          {/* We now lock the SVG to the same aspect ratio container. The map image is rendered INSIDE the SVG to guarantee the coordinate system perfectly matches the pixels of the calibration. */}
          <svg 
            className="w-full h-full max-w-[800px] max-h-[800px] absolute inset-0 m-auto drop-shadow-xl transition-transform duration-75 ease-out" 
            viewBox="0 0 800 800" 
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          >
            <defs>
              <filter id="tokenShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.5" />
              </filter>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="white" floodOpacity="0.8" />
              </filter>
            </defs>
            
            <image href={mapImage} x="0" y="0" width="800" height="800" preserveAspectRatio="xMidYMid meet" opacity="0.9" />
                                    {/* Draw harbors */}
            {Object.values(gameState.harbors || {}).map((harbor) => {
              const p = HARBOR_COORDS[harbor.id as keyof typeof HARBOR_COORDS];
              if (!p) return null;
              
              return (
                <g key={harbor.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => handleMapClick(harbor.id, 'harbor')} style={{cursor: 'pointer', touchAction: 'manipulation'}} filter={selectedCardId ? 'url(#glow)' : ''} className={selectedCardId ? 'animate-pulse hover:opacity-75 transition' : ''}>
                  <circle cx="0" cy="0" r="20" fill="transparent" style={{cursor: "pointer", pointerEvents: "all"}} />
                  
                  {/* Any placed ships */}
                  {harbor.ships?.map((piece: any, idx: number) => {
                    const owner = gameState.players.find(pl => pl.id === piece.playerId);
                    const colorMap: Record<string, string> = { red: '#ef4444', blue: '#3b82f6', yellow: '#facc15', green: '#22c55e' };
                    const fill = colorMap[owner?.color || 'red'];
                    return (
                      <ellipse key={idx} cx={-8 + (idx * 16)} cy="0" rx="8" ry="4" fill={fill} stroke="white" strokeWidth="1" filter="url(#tokenShadow)" />
                    );
                  })}
                </g>
              );
            })}

            {/* Draw forts */}
            {Object.values(gameState.fortSpaces || {}).map((fortSpace) => {
              const p = FORT_COORDS[fortSpace.id as keyof typeof FORT_COORDS];
              if (!p) return null;
              
              return (
                <g key={fortSpace.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => handleMapClick(fortSpace.id, 'fortSpace')} style={{cursor: 'pointer', touchAction: 'manipulation'}} filter={selectedCardId ? 'url(#glow)' : ''} className={selectedCardId ? 'animate-pulse hover:opacity-75 transition' : ''}>
                  {/* Small fort marker removed per user request */}
                  <circle cx="0" cy="0" r="20" fill="transparent" style={{cursor: "pointer", pointerEvents: "all"}} />
                  
                  {/* Any placed fort pieces */}
                  {fortSpace.forts?.map((piece: any, idx: number) => {
                    const owner = gameState.players.find(pl => pl.id === piece.playerId);
                    const colorMap: Record<string, string> = { red: '#ef4444', blue: '#3b82f6', yellow: '#facc15', green: '#22c55e' };
                    const fill = colorMap[owner?.color || 'red'];
                    return (
                      <rect key={idx} x={-6 + (idx * 4)} y={-6 + (idx * 4)} width="12" height="12" fill={fill} stroke="white" strokeWidth="1" rx="1" filter="url(#tokenShadow)" />
                    );
                  })}
                </g>
              );
            })}

            {/* Draw nodes */}
            {Object.values(gameState.provinces).map((province) => {
              const p = PROVINCE_COORDS[province.id as keyof typeof PROVINCE_COORDS];
              if (!p) return null;
              
              

              return (
                <g key={province.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => handleMapClick(province.id, 'province')} style={{cursor: 'pointer', touchAction: 'manipulation'}} filter={selectedCardId ? 'url(#glow)' : ''} className={selectedCardId ? 'animate-pulse hover:opacity-75 transition' : ''}>
                  {/* We only draw the pieces directly over the map coordinate */}
                  {/* Center the pieces grid relative to the coordinate */}
                  <circle cx="0" cy="0" r="30" fill="transparent" style={{cursor: "pointer", pointerEvents: "all"}} />
                  
                  {/* Render the specific token using an emoji if available */}
                  {(province.hasAgricultureToken || province.hasAgricultureToken === undefined) && (
                    <g transform={`translate(${(p as any).token_x - p.x}, ${(p as any).token_y - p.y})`}>
                      <circle cx="0" cy="0" r="12" fill={
                        province.specificToken === 'wheat' ? '#fde047' : 
                        province.specificToken === 'wine' ? '#d8b4fe' : 
                        province.specificToken === 'olive' ? '#86efac' : 
                        province.specificToken === 'thyme' ? '#fdba74' : 
                        province.specificToken === 'cheese' ? '#fef08a' : '#ccc'
                      } stroke="black" strokeWidth="2" filter="url(#tokenShadow)" />
                      <text x="0" y="4" textAnchor="middle" fontSize="12px">
                         {province.specificToken === 'wheat' ? '🌾' : 
                          province.specificToken === 'wine' ? '🍇' : 
                          province.specificToken === 'olive' ? '🫒' : 
                          province.specificToken === 'thyme' ? '🌿' : 
                          province.specificToken === 'cheese' ? '🧀' : '?'}
                      </text>
                    </g>
                  )}
                  
                  <g transform="translate(0, 0)">
                    {province.pieces.map((piece: any, idx: number) => {
                      const owner = gameState.players.find(pl => pl.id === piece.playerId);
                      const colorMap: Record<string, string> = {
                        red: '#ef4444',
                        blue: '#3b82f6',
                        yellow: '#facc15',
                        green: '#22c55e'
                      };
                      const fill = colorMap[owner?.color || 'red'];
                      
                      // Wrap pieces into multiple rows if needed
                      // Calculate the grid of pieces
                      const maxPerRow = 5;
                      const total = province.pieces.length;
                      const rows = Math.ceil(total / maxPerRow);
                      
                      // Center the entire block around (0,0)
                      // If there is 1 piece, xOffset=0, yOffset=0
                      const rowWidth = Math.min(total, maxPerRow) * 12;
                      const blockHeight = rows * 12;
                      
                      const baseX = (idx % maxPerRow) * 12;
                      const baseY = Math.floor(idx / maxPerRow) * 12;
                      
                      const x = baseX - (rowWidth / 2) + 6; // +6 is half the 12px cell size
                      const y = baseY - (blockHeight / 2) + 6;
                      
                      if (piece.type === 'village') {
                        // Village = Cube (Square)
                        return <rect key={idx} x={x - 5} y={y - 5} width="10" height="10" fill={fill} stroke="white" strokeWidth="1" filter="url(#tokenShadow)"><title>{piece.type} ({owner?.name})</title></rect>;
                      } else if (piece.type === 'priest') {
                        // Priest = Cylinder (Triangle)
                        return <polygon key={idx} points={`${x},${y - 6} ${x - 5},${y + 5} ${x + 5},${y + 5}`} fill={fill} stroke="white" strokeWidth="1" filter="url(#tokenShadow)"><title>{piece.type} ({owner?.name})</title></polygon>;
                      } else {
                        // Villager = Disc (Circle)
                        return <circle key={idx} cx={x} cy={y} r="5" fill={fill} stroke="white" strokeWidth="1" filter="url(#tokenShadow)"><title>{piece.type} ({owner?.name})</title></circle>;
                      }
                    })}
                  </g>
                </g>
              );
            })}
          </svg>

          {gameState.phase === 'lobby' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center overflow-hidden p-4">
              <div className="bg-white/90 backdrop-blur border border-white/20 p-5 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full mx-auto transform transition-all max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl sm:text-3xl font-black text-center mb-1 sm:mb-2 text-blue-900 tracking-tight">Sardegna Lobby</h3>
                <p className="text-center text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base font-medium">Waiting for players to join... ({gameState.players.length}/4)</p>
                
                <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {gameState.players.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm transition hover:shadow-md">
                      <div className={`w-8 h-8 rounded-full shadow-inner border-2 border-white flex items-center justify-center text-white font-bold text-xs ${p.color === 'red' ? 'bg-red-500' : p.color === 'blue' ? 'bg-blue-500' : p.color === 'green' ? 'bg-green-500' : 'bg-yellow-400 text-yellow-900'}`}>P{i+1}</div>
                      <div className="flex-1 font-bold text-gray-800">{p.name} {p.id === playerId && <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full ml-2 font-black">YOU</span>}</div>
                      {p.isBot && <div className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider">BOT</div>}
                    </div>
                  ))}
                  
                  {/* Empty slots placeholders */}
                  {Array.from({ length: 4 - gameState.players.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center gap-4 bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-300 opacity-60">
                      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                      <div className="flex-1 font-medium text-gray-400 italic">Waiting for player...</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  {gameState.players.length < 4 && (
                    <button 
                      className="flex-1 bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold px-4 py-3 rounded-xl shadow-lg border border-blue-400/50 transition-all active:scale-95 flex items-center justify-center gap-2"
                      onClick={addBot}
                    >
                      <span>🤖</span> Add Bot
                    </button>
                  )}
                  {gameState.players.length >= 2 && (
                    <button 
                      className="flex-1 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-4 py-3 rounded-xl shadow-lg border border-green-400/50 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
                      onClick={startGame}
                    >
                      <span>⛵</span> Start Game
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Right: Fort Cards & Logs */}
        <div className={`w-full lg:w-72 flex flex-col gap-4 flex-shrink-0 z-20 transition-all duration-300 ${isSidebarCollapsed ? 'max-h-[40px] lg:max-h-full overflow-hidden lg:overflow-visible' : 'max-h-[800px]'}`}>
           {/* Mobile Collapse Toggle */}
           <button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className="lg:hidden w-full bg-blue-900 text-white font-bold py-2 rounded-lg shadow-md flex justify-between items-center px-4"
           >
             <span>🏰 Forts & Logs</span>
             <span>{isSidebarCollapsed ? '▼ Expand' : '▲ Collapse'}</span>
           </button>

          {gameState.phase !== 'lobby' ? (<>
           {/* Fort Cards Compact View */}
           <div className={`bg-white rounded-lg shadow-md border-t-4 border-orange-400 overflow-hidden flex-col flex-shrink-0 ${isSidebarCollapsed ? 'hidden lg:flex' : 'flex'}`}>
             <div className="bg-orange-50 px-4 py-2 border-b flex justify-between items-center text-sm font-bold text-orange-900">
               <span>🏰 Fort Cards</span>
             </div>
             
             <div className="p-4 flex gap-4 items-center justify-center bg-gray-50/50">
               {/* Deck/Face Down Summary */}
               <div className="flex flex-col gap-2 border-r border-gray-200 pr-4">
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Row Left</div>
                 <div className="text-3xl font-black text-gray-800 text-center">{Math.max(0, gameState.fortCardRow.length - gameState.faceUpFortCards)}</div>
                 <div className="text-[10px] text-gray-400 text-center">Deck: {gameState.fortCardDeck.length}</div>
               </div>

               {/* Face Up Cards */}
               <div className="flex gap-3 px-2">
                 {gameState.fortCardRow.slice(0, gameState.faceUpFortCards).map((card: any, idx: number) => (
                   <div key={card.id} className={`relative min-w-[85px] bg-[#f8f5e6] border-2 border-[#d4c5a9] rounded-lg shadow-sm p-2 flex flex-col items-center justify-center transition ${idx === 0 ? 'ring-2 ring-red-400 ring-offset-2 scale-110 z-10 shadow-md' : 'opacity-80 scale-95 hover:opacity-100 hover:scale-100'}`}>
                     {idx === 0 && <div className="absolute -top-2.5 -left-2.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap tracking-wider">NEXT</div>}
                     <div className="text-xl opacity-80 mb-0.5">🛡️</div>
                     <div className="font-black text-lg text-gray-800 mb-1 leading-none">{card.id.toUpperCase()}</div>
                     <div className="w-full border-t border-[#d4c5a9] opacity-50 mb-1"></div>
                     <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Scores</div>
                     <div className="font-bold text-gray-800 text-xs text-center leading-tight">{card.scoringProvinceIds.map((pid: string) => pid.replace('p', 'P')).join(', ')}</div>
                   </div>
                 ))}
                 {gameState.faceUpFortCards === 0 && (
                    <div className="w-20 h-full border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400 italic text-center p-2">No Face Up Cards</div>
                 )}
               </div>
             </div>
           </div>

           {/* Log View */}
           <div className={`bg-white rounded-lg shadow-md border-t-4 border-gray-400 flex-grow overflow-hidden flex-col min-h-[200px] ${isSidebarCollapsed ? 'hidden lg:flex' : 'flex'}`}>
             <div className="bg-gray-50 px-4 py-2 border-b text-sm font-bold text-gray-700 flex justify-between items-center">
               <span>📜 Game Log</span>
               <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600">Event {gameState.scoringEventsCount}/11</span>
             </div>
             <div className="flex-1 overflow-y-auto p-0">
               <ul className="text-sm">
                 {[...gameState.log].reverse().map((entry, idx) => (
                   <li key={idx} className={`p-3 border-b border-gray-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} flex gap-3 items-start`}>
                     <span className="text-gray-400 text-xs font-mono mt-0.5 flex-shrink-0 select-none">{(gameState.log.length - idx).toString().padStart(2, '0')}</span>
                     <span className="text-gray-800 leading-snug">{entry}</span>
                   </li>
                 ))}
               </ul>
             </div>
           </div>
        </>) : (
            <div className="bg-white rounded-lg shadow-md border-t-4 border-gray-300 overflow-hidden flex-col flex-shrink-0 p-6 text-center text-gray-400 italic text-sm">
              Game not started yet
            </div>
          )}
        </div>
      </div>

      </main>

      {/* Footer / Player Hand */}
      <footer className="bg-white/80 backdrop-blur-md border-t-2 border-white/50 flex flex-col justify-start sm:justify-center items-center z-40 relative flex-shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        
        {currentPlayer && (
          <div className="flex gap-3 sm:gap-4 items-stretch overflow-x-auto w-full max-w-full px-4 pt-2 pb-4 justify-start md:justify-center min-h-[170px] sm:min-h-[180px]" style={{ WebkitOverflowScrolling: 'touch' }}>
            {currentPlayer.availableCards.map(card => {
              const isSelected = selectedCardId === card.id;
              return (
              <button
                key={card.id}
                disabled={gameState.activePlayerId !== playerId || gameState.phase !== 'playing'}
                onClick={() => playCard(card)}
                className={`flex-shrink-0 w-[120px] sm:w-[130px] h-[150px] sm:h-[160px] bg-white rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex flex-col items-center justify-start p-2 transition-all duration-200 relative overflow-hidden border-[3px] 
                  ${isSelected ? 'border-yellow-400 -translate-y-2 shadow-[0_8px_20px_rgba(250,204,21,0.4)]' : 'border-gray-200 hover:-translate-y-1 hover:shadow-[0_6px_12px_rgba(0,0,0,0.2)] hover:border-blue-300'} 
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] disabled:hover:border-gray-200`}
              >
                {/* Decorative card header */}
                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-blue-100 to-transparent pointer-events-none"></div>
                
                <div className="z-10 flex flex-col items-center w-full mb-auto mt-0.5">
                  <div className="text-2xl sm:text-3xl mb-0.5 drop-shadow-sm">{getCardIcon(card.effectType)}</div>
                  <div className="font-extrabold text-[10px] sm:text-xs text-gray-800 text-center uppercase tracking-wide border-b border-gray-200 w-full pb-0.5 mb-1 leading-tight min-h-[24px] flex items-center justify-center">{card.name}</div>
                </div>
                
                <div className="text-[9px] sm:text-[10px] text-gray-600 w-full text-center font-medium leading-snug px-0.5 line-clamp-3">
                   {card.effectDescription}
                </div>
                
                {isSelected && card.effectType !== 'sentinel' && (
                   <div className="absolute bottom-0 left-0 w-full bg-yellow-400 text-yellow-900 text-[9px] font-bold py-1 text-center animate-pulse shadow-inner">
                     {
                       card.effectType === 'place_fort' ? 'CLICK FORT SPACE' :
                       card.effectType === 'place_ship' ? 'CLICK HARBOR' :
                       card.effectType === 'take_token' ? 'CLICK PROVINCE W/ TOKEN' :
                       'CLICK PROVINCE'
                     }
                   </div>
                )}
              </button>
              );
            })}
            
            {currentPlayer.playedCards && currentPlayer.playedCards.length > 0 && (
              <div className="flex-shrink-0 relative w-[120px] sm:w-[130px] h-[150px] sm:h-[160px]">
                {currentPlayer.playedCards.map((playedCard: any, idx: number) => {
                  const isTop = idx === currentPlayer.playedCards.length - 1;
                  return (
                    <div 
                      key={idx} 
                      className={`absolute top-0 left-0 w-full h-full bg-gray-100 border-[3px] border-dashed border-gray-400 rounded-xl shadow-md flex flex-col items-center justify-center p-2 opacity-70 overflow-hidden saturate-50`}
                      style={{ transform: `translate(${idx * 4}px, ${idx * -4}px)`, zIndex: idx }}
                    >
                      <div className="absolute inset-0 bg-gray-300 opacity-20 bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:10px_10px] pointer-events-none"></div>
                      <div className="text-3xl grayscale opacity-50 mb-2 drop-shadow-sm">{getCardIcon(playedCard.effectType)}</div>
                      <div className="font-extrabold text-xs sm:text-sm text-gray-500 text-center uppercase mb-2 leading-tight">{playedCard.name}</div>
                      {isTop && <div className="bg-gray-800 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow">PLAYED</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </footer>
      

        
    </div>
  );
}

export default App;
