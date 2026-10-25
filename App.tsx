
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Player, RoundScore, PlayerStats } from './types';
import type { CellValue } from './shared/protocol';
import { parseScoreInput, placesOf, placeEmoji, hasAnyScore } from './shared/game';
import { scoreTextClass, formatDay } from './ui';
import { useRoom } from './useRoom';
import { ConfirmDialog, JoinDialog, NameDialog } from './Dialogs';
import { ArchivePanel } from './ArchivePanel';
import { GapPanel } from './GapPanel';
import { GameCharts } from './GameCharts';

// --- Sub-components ---

// emoji: 🏆 🥈 🥉 🏅 💩 (shared/game.ts placeEmoji); boşsa henüz puanı yok, rozet gösterilmez
const Badge = ({ emoji, visible, size = 'small' }: { emoji: string, visible: boolean, size?: 'small' | 'large' }) => {
  if (!visible || !emoji) return <div className={`${size === 'large' ? 'h-[30px] md:h-[45px]' : 'h-4 md:h-6'}`} />;

  const emojiSize = size === 'large' ? 'text-xl md:text-3xl' : 'text-sm md:text-xl';

  return <span className={`${emojiSize} drop-shadow-sm select-none leading-none animate-in zoom-in duration-300`}>{emoji}</span>;
};

interface StatCardProps {
  player: Player;
  stat: PlayerStats;
  totalPlayers: number;
  gameStarted: boolean;
  onRemove: (id: string) => void;
  canRemove: boolean;
  occupied: boolean;
  isMine: boolean;
  onVacate?: (id: string) => void;
  onRename?: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ player, stat, totalPlayers, gameStarted, onRemove, canRemove, occupied, isMine, onVacate, onRename }) => {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isConfirming) {
      const timer = setTimeout(() => setIsConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirming]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isConfirming) {
      onRemove(player.id);
      setIsConfirming(false);
    } else {
      setIsConfirming(true);
    }
  };

  return (
    <div className={`group relative flex flex-col items-center justify-between rounded-lg border p-1 text-center transition-all md:p-3 h-full min-h-[70px] md:min-h-[120px] shadow-sm ${isConfirming ? 'border-red-500 bg-red-50 scale-105' : 'border-slate-100 bg-white hover:shadow-md'} ${isMine ? 'ring-2 ring-indigo-400' : ''}`}>

      {/* Sandalye durumu: dolu = yeşil nokta; odayı kuran boşaltabilir */}
      <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 flex items-center gap-0.5">
        <span className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${occupied ? 'bg-emerald-500' : 'bg-slate-200'}`} title={occupied ? 'Oturuyor' : 'Boş sandalye'} />
        {onVacate && occupied && !isMine && (
          <button onClick={() => onVacate(player.id)} className="text-[9px] md:text-xs leading-none text-slate-300 hover:text-red-500" title="Sandalyeyi boşalt" aria-label="Sandalyeyi boşalt">⏏</button>
        )}
      </div>

      {canRemove && <button
        onClick={handleDelete}
        className="absolute top-[-4px] right-[-4px] z-[110] p-1 transition-transform active:scale-90"
        aria-label={isConfirming ? "Confirm Delete" : "Remove Player"}
      >
        <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm transition-all md:h-7 md:w-7 ${isConfirming ? 'bg-red-600 scale-110' : 'bg-red-500'}`}>
          {isConfirming ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </button>}

      <div className="w-full px-0.5">
        <h3 className={`font-black uppercase tracking-tighter leading-none transition-colors ${isConfirming ? 'text-red-700' : 'text-slate-900'} text-[9px] md:text-sm truncate`}>
          {onRename ? <button onClick={() => onRename(player.id)} className="uppercase underline decoration-dotted decoration-slate-300 underline-offset-2">{player.name}</button> : player.name}
        </h3>
      </div>

      <div className="flex items-center justify-center leading-none h-5 md:h-10">
        <Badge emoji={stat.emoji ?? ''} visible={gameStarted} size="small" />
      </div>

      <div className="w-full">
        <div className={`font-black tracking-tighter leading-none transition-colors ${isConfirming ? 'text-red-800' : 'text-slate-600'} text-[12px] md:text-2xl`}>
          {stat.totalScore}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 md:h-2" style={{ backgroundColor: isConfirming ? '#dc2626' : player.color }} />
    </div>
  );
};

// --- Dice Component ---

const DiceRoller = () => {
  const [roll, setRoll] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [history, setRollHistory] = useState<{ value: number, time: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);

    const nextRoll = Math.floor(Math.random() * 6) + 1;
    const newX = rotation.x + 720 + Math.floor(Math.random() * 360);
    const newY = rotation.y + 720 + Math.floor(Math.random() * 360);

    setRotation({ x: newX, y: newY });

    setTimeout(() => {
      setRoll(nextRoll);
      setRollHistory(prev => [{ value: nextRoll, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev].slice(0, 50));

      const faceRotations: Record<number, {x: number, y: number}> = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: 180 },
        3: { x: 0, y: -90 },
        4: { x: 0, y: 90 },
        5: { x: -90, y: 0 },
        6: { x: 90, y: 0 }
      };

      const final = faceRotations[nextRoll];
      setRotation({
        x: Math.round(newX / 360) * 360 + final.x,
        y: Math.round(newY / 360) * 360 + final.y
      });
      setIsRolling(false);
    }, 600);
  };

  const Face = ({ num, rotate }: { num: number, rotate: string }) => {
    const dotsMap: Record<number, number[]> = {
      1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
    };
    return (
      <div
        className="absolute w-full h-full bg-[#fcd34d] border-2 border-[#b45309]/30 rounded-2xl flex items-center justify-center p-2 md:p-4 shadow-inner"
        style={{ transform: rotate + ' translateZ(50px)', backfaceVisibility: 'hidden' }}
      >
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5 md:gap-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              {dotsMap[num].includes(i) && (
                <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1e1b4b] rounded-full shadow-inner" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-[#310000] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#5a0000_0%,_#1a0000_100%)] pointer-events-none" />
      <div className="flex-1 flex flex-col items-center justify-center z-10 p-4 mb-24 md:mb-32">
        <div className="relative w-40 h-40 md:w-56 md:h-56 perspective-1000">
          <div
            className="relative w-full h-full transition-transform duration-700 ease-out preserve-3d"
            style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
          >
            <Face num={1} rotate="rotateY(0deg)" />
            <Face num={2} rotate="rotateY(180deg)" />
            <Face num={3} rotate="rotateY(90deg)" />
            <Face num={4} rotate="rotateY(-90deg)" />
            <Face num={5} rotate="rotateX(90deg)" />
            <Face num={6} rotate="rotateX(-90deg)" />
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/50 blur-xl rounded-full" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 flex flex-col items-center gap-4">
        <button onClick={() => setShowHistory(true)} className="absolute left-6 bottom-6 md:left-10 md:bottom-10 w-12 h-12 md:w-16 md:h-16 bg-white/5 border border-white/5 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-90">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        <div className="flex flex-col items-center gap-2 md:gap-4 w-full max-w-[200px] md:max-w-[320px]">
          <h2 className="text-[#fde68a] text-xl md:text-3xl font-serif tracking-tight drop-shadow-lg uppercase font-medium">King's Score: <span className="font-bold">{roll}</span></h2>
          <button onClick={rollDice} disabled={isRolling} className="w-full h-14 md:h-16 bg-gradient-to-b from-[#92400e] to-[#451a03] hover:from-[#b45309] hover:to-[#78350f] text-white rounded-full flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all border border-[#f59e0b]/20">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
            <span className="text-xl md:text-2xl font-black tracking-[0.15em] uppercase">Roll</span>
          </button>
        </div>
      </div>
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-[#1a0000]/98 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <h3 className="text-[#fde68a] text-xl font-black uppercase tracking-widest">Roll History</h3>
            <button onClick={() => setShowHistory(false)} className="text-white/40 hover:text-white p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="flex-1 overflow-auto space-y-3 pr-2 custom-scrollbar">
            {history.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-white/20 italic">No rolls yet...</div> : history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4"><span className="text-white/20 font-mono text-xs">{history.length - i}.</span><span className="text-white/40 text-[10px] font-bold uppercase tracking-tighter">{h.time}</span></div>
                <div className="flex items-center gap-3"><span className="text-white/30 text-[10px] font-black uppercase">Result:</span><span className="text-[#fcd34d] text-2xl font-black drop-shadow-sm">{h.value}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`.perspective-1000 { perspective: 1000px; } .preserve-3d { transform-style: preserve-3d; }`}</style>
    </div>
  );
};

// --- Main UI Component ---

interface GameActions {
  setScore: (roundIndex: number, playerId: string, value: CellValue) => void;
  setName: (playerId: string, name: string) => void;
  addRound: () => void;
  removeRound: () => void;
}

interface GameDashboardProps {
  players: Player[];
  rounds: RoundScore[];
  actions: GameActions;
  onReset: () => void;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canEdit: boolean;
  occupied: Record<string, boolean>;
  mySeat: string | null;
  onVacate: (id: string) => void;
  roomBar: React.ReactNode;
  archive: React.ReactNode;
}

const GameDashboard: React.FC<GameDashboardProps> = ({
  players, rounds, actions, onReset, onAddPlayer, onRemovePlayer, undo, redo, canUndo, canRedo,
  canEdit, occupied, mySeat, onVacate, roomBar, archive
}) => {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'fark' | 'dice' | 'archive'>('table');
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // Auto-reset confirmation state after 4 seconds
  useEffect(() => {
    if (isResetConfirming) {
      const timer = setTimeout(() => setIsResetConfirming(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isResetConfirming]);

  const handleResetClick = () => {
    if (isResetConfirming) {
      onReset();
      setIsResetConfirming(false);
    } else {
      setIsResetConfirming(true);
    }
  };

  // Check if any non-null input has been made across all rounds
  const hasGameStarted = useMemo(() => hasAnyScore(rounds), [rounds]);

  const stats: PlayerStats[] = useMemo(() => {
    const scoresMap = players.map(player => {
      const totalScore = rounds.reduce((sum, r) => {
        const val = r.scores[player.id];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      return { id: player.id, name: player.name, totalScore };
    });
    // Eşit toplam aynı sırayı alır; puanı olmayan oyuncunun sırası 0 (rozet yok)
    const places = placesOf(players, rounds);
    return players.map(player => {
      const rank = places[player.id] ?? 0;
      const pData = scoresMap.find(s => s.id === player.id)!;
      const emoji = placeEmoji(places[player.id], places);
      return { id: player.id, name: player.name, totalScore: pData.totalScore, rank, wins: 0, lastRoundRank: 0, emoji } as PlayerStats;
    });
  }, [players, rounds]);

  const handleScoreChange = (roundIndex: number, playerId: string, value: string) => {
    actions.setScore(roundIndex, playerId, parseScoreInput(value));
  };

  const handleNameChange = (playerId: string, newName: string) => {
    actions.setName(playerId, newName);
  };

  const addNewRound = () => {
    actions.addRound();
  };

  const removeLastRound = () => {
    if (rounds.length > 0) actions.removeRound();
  };

  return (
    <div className="h-screen font-sans bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-4 h-11 md:h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-slate-900 w-6 h-6 rounded flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
          <h1 className="text-[11px] md:text-sm font-black text-slate-900 uppercase tracking-tighter">Ace Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Enhanced Visibility Emoji Undo/Redo Controls */}
          <div className="flex bg-slate-100/90 rounded-lg p-0.5 border border-slate-300 shadow-inner">
            <button
              onClick={undo}
              disabled={!canUndo || !canEdit}
              title="Backward / Undo"
              className="px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-all active:scale-90 disabled:opacity-20 disabled:grayscale disabled:scale-100 hover:bg-white flex items-center justify-center"
            >
              <span className="text-sm md:text-xl" role="img" aria-label="Backward">⏪</span>
            </button>
            <div className="w-px h-5 md:h-7 bg-slate-300 self-center mx-1" />
            <button
              onClick={redo}
              disabled={!canRedo || !canEdit}
              title="Forward / Redo"
              className="px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-all active:scale-90 disabled:opacity-20 disabled:grayscale disabled:scale-100 hover:bg-white flex items-center justify-center"
            >
              <span className="text-sm md:text-xl" role="img" aria-label="Forward">⏩</span>
            </button>
          </div>

          <button
            onClick={handleResetClick}
            disabled={!canEdit}
            className={`h-8 md:h-10 px-2 md:px-3 rounded-lg border text-[9px] md:text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ml-1 disabled:opacity-30 ${isResetConfirming ? 'bg-red-600 text-white border-red-700 scale-105 shadow-lg' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 md:h-5 md:w-5 ${isResetConfirming ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden sm:inline">{isResetConfirming ? "SURE?" : "New Game"}</span>
            {isResetConfirming && <span className="inline sm:hidden font-black">SURE?</span>}
          </button>
        </div>
      </header>

      {roomBar}

      <nav className="flex bg-white border-b border-slate-100 px-2 py-1 justify-around text-[9px] md:text-[10px] font-black uppercase tracking-tight shrink-0">
        {['table', 'charts', 'fark', 'dice', 'archive'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-1.5 md:py-2 rounded-md transition-all ${activeTab === tab ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400'}`}>{tab}</button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto w-full px-1.5 md:px-6 py-1.5 md:py-3 pb-0 md:pb-3 flex flex-col flex-1 gap-1.5 md:gap-3 overflow-hidden">
        {activeTab === 'table' && (
          <div className="w-full shrink-0 bg-slate-100/30 rounded-xl">
            <section className="grid grid-cols-4 gap-1 p-1 md:flex md:flex-nowrap md:gap-4 md:p-4">
              {stats.map(stat => {
                const p = players.find(player => player.id === stat.id);
                if (!p) return null;
                return (
                  <div key={stat.id}>
                    <StatCard
                      player={p} stat={stat} totalPlayers={players.length} gameStarted={hasGameStarted} onRemove={onRemovePlayer}
                      canRemove={canEdit} occupied={!!occupied[p.id]} isMine={mySeat === p.id} onVacate={canEdit ? onVacate : undefined}
                      onRename={canEdit ? setRenameId : undefined}
                    />
                  </div>
                );
              })}
            </section>
          </div>
        )}

        <div className="bg-white rounded-xl rounded-b-none md:rounded-b-xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
          {activeTab === 'table' && (
            <div className="p-1.5 md:p-3 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1 px-1 shrink-0">
                <h2 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight">Leaderboard</h2>
                <div className="flex items-center gap-1">
                  {canEdit && <button
                    onClick={onAddPlayer}
                    className="flex bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-md p-0.5 items-center px-2 text-white shadow-sm transition-all h-6 md:h-10"
                  >
                    <span className="text-xs font-bold mr-1">+</span>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tighter">Player</span>
                  </button>}
                  <div className={`flex bg-slate-900 rounded-md p-0.5 gap-0.5 items-center px-2 h-6 md:h-10 ${canEdit ? '' : 'opacity-30'}`}>
                    <button onClick={addNewRound} disabled={!canEdit} className="text-white text-xs font-bold p-0.5">+</button>
                    <span className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter">Round</span>
                    <button onClick={removeLastRound} disabled={!canEdit || rounds.length === 0} className="text-white text-xs font-bold p-0.5 disabled:opacity-30">-</button>
                  </div>
                </div>
              </div>
              <div className="overflow-auto rounded-lg border border-slate-100 flex-1 bg-white">
                <table className="w-full text-left border-collapse min-w-[280px] min-h-full">
                  <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-100">
                      <th className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black text-slate-400 uppercase w-10 md:w-20 tracking-tighter">Rnd</th>
                      {players.map(p => (
                        <th key={p.id} className="py-1 md:py-2.5 text-center">
                          <button type="button" disabled={!canEdit} onClick={() => setRenameId(p.id)} className="text-[9px] md:text-sm font-black text-center bg-transparent border-0 w-full truncate uppercase tracking-tighter py-1" style={{ color: p.color }}>{p.name}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rounds.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-0.5 md:py-2 px-2 text-[8px] md:text-[10px] font-black text-slate-300">R{r.round}</td>
                        {players.map(p => (
                          <td key={p.id} className="p-0.5 md:p-1">
                            <input type="text" value={r.scores[p.id] ?? ''} readOnly={!canEdit} onChange={(e) => handleScoreChange(rIdx, p.id, e.target.value)} className={`w-full bg-slate-50/50 border-0 rounded-md py-1 md:py-2 text-center font-black ${scoreTextClass(r.scores[p.id])} text-[11px] md:text-base focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all placeholder:text-slate-200`} placeholder="0" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-900 text-white z-20 shadow-lg">
                    <tr>
                      <td className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Total</td>
                      {players.map(p => (
                        <td key={p.id} className="py-1 md:py-2.5 text-center text-[11px] md:text-xl font-black">{stats.find(s => s.id === p.id)?.totalScore}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="p-2 md:p-4 flex-1 flex flex-col gap-4 overflow-auto custom-scrollbar">
              <GameCharts players={players} rounds={rounds} />
            </div>
          )}

          {activeTab === 'fark' && <GapPanel players={players} rounds={rounds} />}

          {activeTab === 'dice' && <DiceRoller />}

          {activeTab === 'archive' && archive}
        </div>
      </main>
      <NameDialog
        open={renameId !== null}
        initial={players.find(p => p.id === renameId)?.name ?? ''}
        onCancel={() => setRenameId(null)}
        onSave={name => { if (renameId) handleNameChange(renameId, name); setRenameId(null); }}
      />
    </div>
  );
};

// --- App Root ---

const STATUS_LABEL = { online: 'Bağlı', connecting: 'Bağlanıyor', offline: 'Bağlantı koptu' } as const;
const STATUS_DOT = { online: 'bg-emerald-400', connecting: 'bg-amber-400 animate-pulse', offline: 'bg-red-500 animate-pulse' } as const;

export default function App() {
  const {
    code, room, game, status, error, sendOp,
    archiveItems, archiveGame, archiveSavedId, archiveDeletedId, openArchiveGame, saveArchiveGame, deleteArchiveGame,
  } = useRoom();
  const [joinOpen, setJoinOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const actions = useMemo<GameActions>(() => ({
    setScore: (round, playerId, value) => sendOp({ t: 'setScore', round, playerId, value }),
    setName: (playerId, name) => sendOp({ t: 'setName', playerId, name }),
    addRound: () => sendOp({ t: 'addRound' }),
    removeRound: () => sendOp({ t: 'removeRound' }),
  }), [sendOp]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (game && game.players.length <= 1) {
      alert("At least one player is required!");
      return;
    }
    sendOp({ t: 'removePlayer', playerId });
  }, [game, sendOp]);

  const copyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Linki kopyala', url);
    }
  }, []);

  if (!room || !game) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <span className={`h-3 w-3 rounded-full ${STATUS_DOT[status]}`} />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Oda {code} · {STATUS_LABEL[status]}…</span>
      </div>
    );
  }

  const canEdit = room.mySeat !== null; // masaya oturan her şeyi yapar, oturmayan sadece izler
  const hasScore = game.rounds.some(r => Object.values(r.scores).some(v => typeof v === 'number'));

  const roomBar = (
    <div className="bg-slate-900 text-white px-3 h-9 md:h-10 flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-tight shrink-0">
      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} title={STATUS_LABEL[status]} />
      <span className={status === 'online' ? 'hidden sm:inline text-white/60' : 'text-amber-300'}>{STATUS_LABEL[status]}</span>
      <span className="tracking-wide">{formatDay(new Date())}</span>
      <button onClick={copyLink} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" title="Linki kopyala">{copied ? '✓' : '🔗'}</button>
      <span className="text-white/40" title="Bağlı cihaz">👁 {room.viewers}</span>
      <div className="ml-auto flex items-center gap-1.5">
        {room.mySeat ? (
          <button onClick={() => sendOp({ t: 'leave' })} className="px-2 h-6 md:h-7 rounded bg-white/10 hover:bg-white/20">Ayrıl</button>
        ) : (
          <button onClick={() => setJoinOpen(true)} className="px-2.5 h-6 md:h-7 rounded bg-indigo-500 hover:bg-indigo-400 shadow">Katıl</button>
        )}
        <button onClick={() => setCloseConfirm(true)} disabled={!canEdit || !hasScore} className="px-2 h-6 md:h-7 rounded bg-amber-500 hover:bg-amber-400 text-slate-900 disabled:opacity-30">Oyunu kapat</button>
      </div>
    </div>
  );

  return (
    <>
      <GameDashboard
        players={game.players}
        rounds={game.rounds}
        actions={actions}
        onReset={() => sendOp({ t: 'newGame' })}
        onAddPlayer={() => sendOp({ t: 'addPlayer' })}
        onRemovePlayer={handleRemovePlayer}
        undo={() => sendOp({ t: 'undo' })}
        redo={() => sendOp({ t: 'redo' })}
        canUndo={room.canUndo}
        canRedo={room.canRedo}
        canEdit={canEdit}
        occupied={room.occupied}
        mySeat={room.mySeat}
        onVacate={playerId => sendOp({ t: 'vacate', playerId })}
        roomBar={roomBar}
        archive={
          <ArchivePanel
            items={archiveItems} game={archiveGame} savedId={archiveSavedId} deletedId={archiveDeletedId} canEdit={canEdit}
            onOpen={openArchiveGame} onSave={saveArchiveGame} onDelete={deleteArchiveGame}
          />
        }
      />
      <JoinDialog
        open={joinOpen}
        onCancel={() => setJoinOpen(false)}
        onJoin={name => { sendOp({ t: 'join', name }); setJoinOpen(false); }}
      />
      <ConfirmDialog
        open={closeConfirm}
        title="Oyunu kapat"
        message="Oyun kapatılıp arşive eklenecek ve masada yeni boş bir oyun açılacak. Emin misin?"
        confirmLabel="Evet, kapat"
        danger
        onCancel={() => setCloseConfirm(false)}
        onConfirm={() => { sendOp({ t: 'closeGame' }); setCloseConfirm(false); }}
      />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl">{error}</div>
      )}
    </>
  );
}
