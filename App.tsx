
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { getInitialPlayers, getInitialRounds } from './constants';
import { Player, RoundScore, PlayerStats } from './types';

// Storage Keys
const STORAGE_KEY_PLAYERS = 'ace_tracker_players_v1';
const STORAGE_KEY_ROUNDS = 'ace_tracker_rounds_v1';

// --- Helper for random colors ---
const PLAYER_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#84cc16'
];

// --- Sub-components ---

const Badge = ({ rank, total, size = 'small' }: { rank: number, total: number, size?: 'small' | 'large' }) => {
  const emojiSize = size === 'large' ? 'text-xl md:text-3xl' : 'text-sm md:text-xl';
  
  if (rank === 1) return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Winner">🏆</span>;
  if (rank === 2) return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Second">🥈</span>;
  if (rank === 3) return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Third">🥉</span>;
  
  if (rank === total && total >= 4) return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Last Place">💩</span>;
  
  return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Ranking">💪</span>;
};

interface StatCardProps {
  player: Player;
  stat: PlayerStats;
  totalPlayers: number;
  onRemove: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ player, stat, totalPlayers, onRemove }) => {
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
    <div className={`group relative flex flex-col items-center justify-between rounded-lg border p-1 text-center transition-all md:p-3 h-full min-h-[70px] md:min-h-[120px] shadow-sm ${isConfirming ? 'border-red-500 bg-red-50 scale-105' : 'border-slate-100 bg-white hover:shadow-md'}`}>
      
      <button 
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
      </button>

      <div className="w-full px-0.5">
        <h3 className={`font-black uppercase tracking-tighter leading-none transition-colors ${isConfirming ? 'text-red-700' : 'text-slate-900'} text-[9px] md:text-sm truncate`}>
          {player.name}
        </h3>
      </div>

      <div className="flex items-center justify-center leading-none h-5 md:h-10">
        <Badge rank={stat.rank} total={totalPlayers} size="small" />
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

interface GameDashboardProps {
  players: Player[];
  rounds: RoundScore[];
  onUpdateGameState: (p: Player[], r: RoundScore[]) => void;
  onReset: () => void;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const GameDashboard: React.FC<GameDashboardProps> = ({ 
  players, rounds, onUpdateGameState, onReset, onAddPlayer, onRemovePlayer, undo, redo, canUndo, canRedo 
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'dice'>('table');

  const stats: PlayerStats[] = useMemo(() => {
    const scoresMap = players.map(player => {
      const totalScore = rounds.reduce((sum, r) => {
        const val = r.scores[player.id];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      return { id: player.id, name: player.name, totalScore };
    });
    const sorted = [...scoresMap].sort((a, b) => a.totalScore - b.totalScore);
    return players.map(player => {
      const rank = sorted.findIndex(s => s.id === player.id) + 1;
      const pData = scoresMap.find(s => s.id === player.id)!;
      return { id: player.id, name: player.name, totalScore: pData.totalScore, rank, wins: 0, lastRoundRank: 0 } as PlayerStats;
    });
  }, [players, rounds]);

  const chartData = useMemo(() => {
    let runningTotals: Record<string, number> = {};
    players.forEach(p => runningTotals[p.id] = 0);
    return rounds.map((r) => {
      const dataPoint: any = { name: `R${r.round}` };
      players.forEach(p => {
        runningTotals[p.id] += typeof r.scores[p.id] === 'number' ? (r.scores[p.id] as number) : 0;
        dataPoint[p.name] = runningTotals[p.id];
      });
      return dataPoint;
    });
  }, [players, rounds]);

  // Logic for the SIRALAMA (Ranking) Table
  const rankingTableData = useMemo(() => {
    let cumulativeScores: Record<string, number> = {};
    players.forEach(p => cumulativeScores[p.id] = 0);

    return rounds.map((r) => {
      const hasRoundData = Object.values(r.scores).some(v => v !== null);
      
      players.forEach(p => {
        cumulativeScores[p.id] += typeof r.scores[p.id] === 'number' ? (r.scores[p.id] as number) : 0;
      });

      const totalEnteredSoFar = Object.values(cumulativeScores).some(v => v !== 0);

      const currentScores = players.map(p => ({ id: p.id, score: cumulativeScores[p.id] }));
      const sorted = [...currentScores].sort((a, b) => a.score - b.score);
      
      const ranks: Record<string, number> = {};
      players.forEach(p => {
        ranks[p.id] = sorted.findIndex(s => s.id === p.id) + 1;
      });

      return { 
        round: r.round, 
        ranks, 
        isVisible: hasRoundData || (r.round === 1 && totalEnteredSoFar)
      };
    });
  }, [players, rounds]);

  const handleScoreChange = (roundIndex: number, playerId: string, value: string) => {
    let sanitized = value.replace(/[^0-9-]/g, '');
    if (sanitized.indexOf('-', 1) !== -1) {
      sanitized = sanitized.charAt(0) + sanitized.slice(1).replace(/-/g, '');
    }

    const newRounds = rounds.map((r, idx) => 
      idx === roundIndex ? { 
        ...r, 
        scores: { 
          ...r.scores, 
          [playerId]: sanitized === '' ? null : (sanitized === '-' ? '-' as any : parseInt(sanitized, 10)) 
        } 
      } : r
    );
    onUpdateGameState(players, newRounds);
  };

  const handleNameChange = (playerId: string, newName: string) => {
    const newPlayers = players.map(p => p.id === playerId ? { ...p, name: newName } : p);
    onUpdateGameState(newPlayers, rounds);
  };

  const addNewRound = () => {
    const emptyScores: Record<string, number | null> = {};
    players.forEach(p => emptyScores[p.id] = null);
    onUpdateGameState(players, [...rounds, { round: rounds.length + 1, scores: emptyScores }]);
  };

  const removeLastRound = () => {
    if (rounds.length > 0) onUpdateGameState(players, rounds.slice(0, -1));
  };

  return (
    <div className="h-screen font-sans bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-4 h-11 md:h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-slate-900 w-6 h-6 rounded flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
          <h1 className="text-[11px] md:text-sm font-black text-slate-900 uppercase tracking-tighter">Ace Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-50 rounded-lg p-0.5 border border-slate-100 shadow-inner">
            <button onClick={undo} disabled={!canUndo} title="Undo" className="p-1 rounded disabled:opacity-20 hover:bg-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
            <button onClick={redo} disabled={!canRedo} title="Redo" className="p-1 rounded disabled:opacity-20 hover:bg-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg></button>
          </div>
          <button 
            onClick={onReset}
            className="h-7 md:h-8 px-2 md:px-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-[9px] md:text-[10px] font-black uppercase tracking-tighter hover:bg-red-100 transition-colors flex items-center gap-1.5 ml-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="hidden sm:inline">New Game</span>
          </button>
        </div>
      </header>

      <nav className="flex bg-white border-b border-slate-100 px-2 py-1 justify-around text-[9px] md:text-[10px] font-black uppercase tracking-tight shrink-0">
        {['table', 'charts', 'dice'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-1.5 md:py-2 rounded-md transition-all ${activeTab === tab ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400'}`}>{tab}</button>
        ))}
      </nav>

      {/* pb-0 ensures main fills the bottom on mobile */}
      <main className="max-w-7xl mx-auto w-full px-1.5 md:px-6 py-1.5 md:py-3 pb-0 md:pb-3 flex flex-col flex-1 gap-1.5 md:gap-3 overflow-hidden">
        {activeTab === 'table' && (
          <div className="w-full shrink-0 bg-slate-100/30 rounded-xl">
            <section className="grid grid-cols-4 gap-1 p-1 md:flex md:flex-nowrap md:gap-4 md:p-4">
              {stats.map(stat => {
                const p = players.find(player => player.id === stat.id);
                if (!p) return null;
                return (
                  <div key={stat.id}>
                    <StatCard player={p} stat={stat} totalPlayers={players.length} onRemove={onRemovePlayer} />
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* rounded-b-none on mobile helps it feel like it extends to the very end */}
        <div className="bg-white rounded-xl rounded-b-none md:rounded-b-xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
          {activeTab === 'table' && (
            <div className="p-1.5 md:p-3 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1 px-1 shrink-0">
                <h2 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight">Leaderboard</h2>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={onAddPlayer}
                    className="flex bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-md p-0.5 items-center px-2 text-white shadow-sm transition-all h-6 md:h-10"
                  >
                    <span className="text-xs font-bold mr-1">+</span>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tighter">Player</span>
                  </button>
                  <div className="flex bg-slate-900 rounded-md p-0.5 gap-0.5 items-center px-2 h-6 md:h-10">
                    <button onClick={addNewRound} className="text-white text-xs font-bold p-0.5">+</button>
                    <span className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter">Round</span>
                    <button onClick={removeLastRound} disabled={rounds.length === 0} className="text-white text-xs font-bold p-0.5 disabled:opacity-30">-</button>
                  </div>
                </div>
              </div>
              {/* Added flex-1 to the table container and min-h-full to the table to ensure footer is at bottom */}
              <div className="overflow-auto rounded-lg border border-slate-100 flex-1 bg-white">
                <table className="w-full text-left border-collapse min-w-[280px] min-h-full">
                  <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-100">
                      <th className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black text-slate-400 uppercase w-10 md:w-20 tracking-tighter">Rnd</th>
                      {players.map(p => (
                        <th key={p.id} className="py-1 md:py-2.5 text-center">
                          <input type="text" value={p.name} onChange={(e) => handleNameChange(p.id, e.target.value)} maxLength={8} className="text-[9px] md:text-sm font-black text-center bg-transparent border-0 focus:ring-0 w-full truncate uppercase tracking-tighter" style={{ color: p.color }} />
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
                            <input type="text" value={r.scores[p.id] ?? ''} onChange={(e) => handleScoreChange(rIdx, p.id, e.target.value)} className="w-full bg-slate-50/50 border-0 rounded-md py-1 md:py-2 text-center font-black text-slate-800 text-[11px] md:text-base focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all placeholder:text-slate-200" placeholder="0" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer will now always stick to the bottom of the container thanks to min-h-full on table */}
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
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-4 text-center">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">SIRALAMA</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white">
                        <th className="py-1 px-3 text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-tighter w-12 border-r border-slate-100">Rnd</th>
                        {players.map(p => (
                          <th key={p.id} className="py-1 px-3 text-[9px] md:text-xs font-black text-slate-800 uppercase tracking-tighter truncate border-r border-slate-100 last:border-0">
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rankingTableData.map((row, idx) => {
                        const rankValues = Object.values(row.ranks) as number[];
                        const maxRank = rankValues.length > 0 ? Math.max(...rankValues) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 h-7 md:h-8">
                            <td className="py-0.5 px-3 text-[9px] font-black text-slate-300 border-r border-slate-100">{row.round}</td>
                            {players.map(p => {
                              const rank = row.ranks[p.id];
                              let bgClass = "bg-white text-slate-200";
                              
                              if (row.isVisible) {
                                if (rank === 1) {
                                  bgClass = "bg-[#c6efce] text-[#006100]";
                                } else if (rank === maxRank && maxRank > 1) {
                                  bgClass = "bg-[#ffc7ce] text-[#9c0006]";
                                } else {
                                  bgClass = "bg-white text-slate-800";
                                }
                              }
                              
                              return (
                                <td key={p.id} className={`py-0.5 px-3 text-[10px] md:text-sm font-black border-r border-slate-100 last:border-0 transition-colors ${bgClass}`}>
                                  {row.isVisible ? rank : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100">
                      <tr className="border-t-2 border-slate-300 shadow-inner h-9 md:h-10">
                        <td className="py-1.5 px-3 text-[10px] font-black text-slate-900 uppercase tracking-widest border-r border-slate-200">SCR</td>
                        {players.map(p => {
                          const playerStat = stats.find(s => s.id === p.id);
                          return (
                            <td key={p.id} className="py-1 px-3 border-r border-slate-200 last:border-0">
                              <div className="flex items-center justify-center">
                                <Badge rank={playerStat?.rank ?? 4} total={players.length} size="small" />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50/30 rounded-2xl p-4 border border-slate-100 shadow-inner h-[220px] md:h-[300px] shrink-0">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Performance Trend</h2>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>{players.map(p => (<linearGradient key={p.id} id={`c-${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={p.color} stopOpacity={0.3}/><stop offset="95%" stopColor={p.color} stopOpacity={0}/></linearGradient>))}</defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Tooltip />
                    {players.map(p => (<Area key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} fill={`url(#c-${p.id})`} />))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'dice' && <DiceRoller />}
        </div>
      </main>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYERS);
    return saved ? JSON.parse(saved) : getInitialPlayers();
  });
  
  const [rounds, setRounds] = useState<RoundScore[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROUNDS);
    if (saved) return JSON.parse(saved);
    return getInitialRounds(getInitialPlayers());
  });

  const [undoStack, setUndoStack] = useState<{players: Player[], rounds: RoundScore[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
    localStorage.setItem(STORAGE_KEY_ROUNDS, JSON.stringify(rounds));
  }, [players, rounds]);

  const pushState = useCallback((newPlayers: Player[], newRounds: RoundScore[]) => {
    setPlayers(newPlayers);
    setRounds(newRounds);
    setUndoStack(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      return [...nextHistory, { players: newPlayers, rounds: newRounds }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = undoStack[historyIndex - 1];
      setPlayers(prevState.players);
      setRounds(prevState.rounds);
      setHistoryIndex(historyIndex - 1);
    }
  }, [undoStack, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < undoStack.length - 1) {
      const nextState = undoStack[historyIndex + 1];
      setPlayers(nextState.players);
      setRounds(nextState.rounds);
      setHistoryIndex(historyIndex + 1);
    }
  }, [undoStack, historyIndex]);

  const handleReset = useCallback(() => {
    if (window.confirm("Start New Game? This will wipe all current scores.")) {
      const defaultPlayers = getInitialPlayers();
      const defaultRounds = getInitialRounds(defaultPlayers);
      pushState(defaultPlayers, defaultRounds);
    }
  }, [pushState]);

  const handleAddPlayer = useCallback(() => {
    const newId = `p-${Date.now()}`;
    const colorIndex = players.length % PLAYER_COLORS.length;
    const newPlayer: Player = {
      id: newId,
      name: `P${players.length + 1}`,
      color: PLAYER_COLORS[colorIndex]
    };
    
    const newPlayers = [...players, newPlayer];
    const newRounds = rounds.map(r => ({
      ...r,
      scores: { ...r.scores, [newId]: null }
    }));
    
    pushState(newPlayers, newRounds);
  }, [players, rounds, pushState]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (players.length <= 1) {
      alert("At least one player is required!");
      return;
    }
    
    const newPlayers = players.filter(p => p.id !== playerId);
    const newRounds = rounds.map(r => {
      const newScores = { ...r.scores };
      delete newScores[playerId];
      return { ...r, scores: newScores };
    });
    pushState(newPlayers, newRounds);
  }, [players, rounds, pushState]);

  return (
    <GameDashboard 
      players={players} 
      rounds={rounds} 
      onUpdateGameState={pushState}
      onReset={handleReset}
      onAddPlayer={handleAddPlayer}
      onRemovePlayer={handleRemovePlayer}
      undo={undo}
      redo={redo}
      canUndo={historyIndex > 0}
      canRedo={historyIndex < undoStack.length - 1}
    />
  );
}
