
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { getInitialPlayers, getInitialRounds } from './constants';
import { Player, RoundScore, PlayerStats } from './types';
import { getGameAnalysis } from './geminiService';

// Storage Keys
const STORAGE_KEY_PLAYERS = 'ace_tracker_players_v1';
const STORAGE_KEY_ROUNDS = 'ace_tracker_rounds_v1';

// --- Sub-components ---

const Badge = ({ rank, size = 'small' }: { rank: number, size?: 'small' | 'large' }) => {
  const emojiSize = size === 'large' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';
  switch (rank) {
    case 1: return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Winner">🏆</span>;
    case 2: return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Second">🥈</span>;
    case 3: return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Third">🥉</span>;
    default: return <span className={`${emojiSize} drop-shadow-sm select-none leading-none`} title="Last Place">💩</span>;
  }
};

interface StatCardProps {
  player: Player;
  stat: PlayerStats;
  onRemove: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ player, stat, onRemove }) => (
  <div className="group bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-all relative overflow-hidden text-center cursor-default h-full min-h-[85px] md:min-h-[110px] justify-between py-2 md:py-3">
    {/* Remove button */}
    <button 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(player.id);
      }}
      className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 w-5 h-5 bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-all z-40 border border-slate-200 shadow-sm"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <div className="w-full px-1">
      <h3 className="font-black text-slate-900 text-[10px] md:text-xs truncate uppercase tracking-tighter leading-none">
        {player.name}
      </h3>
    </div>

    <div className="flex items-center justify-center leading-none h-6 md:h-8">
      <Badge rank={stat.rank} size="small" />
    </div>

    <div className="w-full">
      <div className="text-[13px] md:text-xl font-black text-slate-600 tracking-tighter leading-none">
        {stat.totalScore}
      </div>
    </div>
    
    <div className="absolute bottom-0 left-0 right-0 h-1 md:h-1.5" style={{ backgroundColor: player.color }} />
  </div>
);

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

  const handleClearHistory = () => {
    if (window.confirm("Purge history logs?")) {
      setRollHistory([]);
    }
  };

  const Face = ({ num, rotate }: { num: number, rotate: string }) => {
    const dotsMap: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    return (
      <div 
        className="absolute w-full h-full bg-gradient-to-br from-[#fcd34d] to-[#d97706] border-2 border-[#92400e]/50 rounded-2xl flex items-center justify-center p-2 md:p-4 shadow-inner"
        style={{ transform: rotate + ' translateZ(50px)', backfaceVisibility: 'hidden' }}
      >
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5 md:gap-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              {dotsMap[num].includes(i) && (
                <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1e1b4b] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-[#0a191f] flex flex-col relative overflow-hidden">
      {/* Background radial gradient and grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#162e38_0%,_#0a191f_100%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 1. Main Dice King Emblem Section */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 p-4 mb-32">
        
        {/* HUGE Golden Circle Frame */}
        <div className="relative w-80 h-80 md:w-[560px] md:h-[560px] flex items-center justify-center transition-all duration-500 scale-110 md:scale-100">
          
          {/* Animated Glow Rings */}
          <div className="absolute inset-0 rounded-full border-[6px] border-[#fcd34d]/20 scale-105 animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-0 rounded-full border-[2px] border-[#0ea5e9]/30 scale-110 animate-[spin_15s_linear_infinite_reverse]" />
          <div className="absolute inset-0 rounded-full border-[14px] border-[#fcd34d] shadow-[0_0_60px_rgba(252,211,77,0.5)]" />

          {/* DICE Text */}
          <div className="absolute top-4 md:top-10 left-1/2 -translate-x-1/2 z-10">
             <h1 className="text-6xl md:text-[140px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 drop-shadow-[0_8px_0px_#475569] tracking-[0.1em] italic uppercase">
               Dice
             </h1>
          </div>

          {/* The Crown - Bouncing on top of the circle rim */}
          <div className="absolute -top-16 md:-top-24 left-1/2 -translate-x-1/2 z-30 drop-shadow-2xl animate-bounce">
             <svg width="100" height="75" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="md:w-40 md:h-32">
                <path d="M30 0L42 12L60 6L54 34H6L0 6L18 12L30 0Z" fill="url(#crown_grad)" stroke="#92400e" strokeWidth="2"/>
                <defs>
                  <linearGradient id="crown_grad" x1="30" y1="0" x2="30" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FDE68A"/>
                    <stop offset="1" stopColor="#B45309"/>
                  </linearGradient>
                </defs>
             </svg>
          </div>

          {/* 3D Dice Scene */}
          <div className="relative w-36 h-36 md:w-64 md:h-64 perspective-1000 z-20 mt-6">
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
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 h-10 bg-[#0ea5e9]/25 blur-3xl rounded-full" />
          </div>

          {/* KING Text */}
          <div className="absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 z-10">
             <h1 className="text-6xl md:text-[140px] font-black text-transparent bg-clip-text bg-gradient-to-b from-[#fcd34d] to-[#d97706] drop-shadow-[0_8px_0px_#92400e] tracking-[0.1em] uppercase">
               King
             </h1>
          </div>
        </div>
      </div>

      {/* 2. Control Cluster */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 flex flex-col items-center gap-6">
        
        {/* History Button - Repositioned to avoid overlap */}
        <button 
          onClick={() => setShowHistory(true)}
          className="absolute left-6 bottom-8 md:left-12 md:bottom-12 w-14 h-14 md:w-24 md:h-24 bg-white/5 border border-white/20 rounded-full flex items-center justify-center text-white/40 hover:bg-white/15 hover:text-white transition-all active:scale-90 shadow-2xl backdrop-blur-md z-30"
          aria-label="View History"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-12 md:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Score and Roll Action */}
        <div className="flex flex-col items-center gap-4 w-full max-w-[200px] md:max-w-[320px]">
          {/* Score Badge - Matching Font Sizes */}
          <div className="flex items-center justify-center gap-4 px-6 py-3 bg-black/80 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl w-full">
            <span className="text-slate-400 text-3xl font-black uppercase tracking-tight">Score</span>
            <span className="text-[#fcd34d] text-3xl font-black drop-shadow-[0_0_15px_rgba(252,211,77,0.7)]">
              {roll}
            </span>
          </div>
          
          {/* ROLL Button */}
          <button 
            onClick={rollDice}
            disabled={isRolling}
            className="w-full h-14 md:h-18 bg-gradient-to-b from-[#f59e0b] to-[#d97706] hover:from-[#fbbf24] hover:to-[#b45309] text-[#451a03] rounded-full flex items-center justify-center gap-4 shadow-[0_15px_30px_rgba(217,119,6,0.4)] active:scale-95 active:shadow-inner transition-all border-b-4 border-[#92400e] overflow-hidden group"
          >
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-[#451a03] border-b-[8px] border-b-transparent ml-1 group-active:translate-x-1 transition-transform" />
            <span className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase">Roll</span>
          </button>
        </div>
      </div>

      {/* History Overlay - Blurred Background for Visibility */}
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-[#0a191f]/90 backdrop-blur-[24px] flex flex-col p-6 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <h3 className="text-[#fde68a] text-3xl font-black uppercase tracking-widest italic drop-shadow-lg">History Logs</h3>
            <button onClick={() => setShowHistory(false)} className="bg-white/10 text-white hover:bg-white/20 p-2 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-auto space-y-4 pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 italic">
                <p className="text-xl">No battles recorded yet...</p>
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex items-center justify-between bg-black/40 p-6 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-md">
                  <div className="flex flex-col">
                    <span className="text-white/30 font-mono text-[10px] uppercase tracking-[0.2em]">Entry #{history.length - i}</span>
                    <span className="text-[#0ea5e9] text-sm font-black uppercase tracking-tighter">{h.time}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-white/40 text-sm font-bold uppercase tracking-widest">Result:</span>
                    <span className="text-[#fcd34d] text-5xl font-black drop-shadow-[0_0_15px_rgba(252,211,77,0.5)]">{h.value}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Functional Clear History Button */}
          <button 
            onClick={handleClearHistory}
            className="mt-6 w-full py-5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-black uppercase tracking-[0.4em] border border-red-500/20 transition-all active:scale-[0.98]"
          >
            Clear All History
          </button>
        </div>
      )}
      
      {/* CSS for 3D & Custom Scrollbar */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .animate-bounce { animation: bounce 3s infinite; }
        @keyframes bounce {
          0%, 100% { transform: translate(-50%, 0); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
          50% { transform: translate(-50%, -25px); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
        }
      `}</style>
    </div>
  );
};

// --- Main UI Component ---

interface GameDashboardProps {
  players: Player[];
  rounds: RoundScore[];
  onPlayersChange: (p: Player[]) => void;
  onRoundsChange: (r: RoundScore[]) => void;
  onReset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const GameDashboard: React.FC<GameDashboardProps> = ({ 
  players, rounds, onPlayersChange, onRoundsChange, onReset, undo, redo, canUndo, canRedo 
}) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'analysis' | 'dice'>('table');

  const stats = useMemo(() => {
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
      return {
        id: player.id,
        name: player.name,
        totalScore: pData.totalScore,
        rank,
        wins: 0,
        lastRoundRank: 0
      } as PlayerStats;
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

  const cumulativeRanksPerRound = useMemo(() => {
    return rounds.map((r, i) => {
      const isRoundPlayed = Object.values(r.scores).some(v => typeof v === 'number');
      if (!isRoundPlayed) return { round: r.round, ranks: null };
      const currentRoundsSlice = rounds.slice(0, i + 1);
      const playersTotals = players.map(p => {
        const totalToThisRound = currentRoundsSlice.reduce((sum, rSlice) => {
          const val = rSlice.scores[p.id];
          return sum + (typeof val === 'number' ? val : 0);
        }, 0);
        return { id: p.id, total: totalToThisRound };
      });
      const sortedByTotal = [...playersTotals].sort((a, b) => a.total - b.total);
      const ranksMap: Record<string, number> = {};
      sortedByTotal.forEach((item, index) => {
        ranksMap[item.id] = index + 1;
      });
      return { round: r.round, ranks: ranksMap };
    });
  }, [players, rounds]);

  const handleScoreChange = (roundIndex: number, playerId: string, value: string) => {
    let sanitized = value.replace(/[^0-9-]/g, '');
    if (sanitized.indexOf('-', 1) !== -1) {
      sanitized = sanitized.slice(0, 1) + sanitized.slice(1).replace(/-/g, '');
    }
    const newRounds = rounds.map((r, idx) => 
      idx === roundIndex ? { ...r, scores: { ...r.scores, [playerId]: sanitized === '' ? null : (sanitized === '-' ? '-' as any : parseInt(sanitized, 10)) } } : r
    );
    onRoundsChange(newRounds);
  };

  const handleNameChange = (playerId: string, newName: string) => {
    const newPlayers = players.map(p => p.id === playerId ? { ...p, name: newName } : p);
    onPlayersChange(newPlayers);
  };

  const addPlayer = () => {
    const newId = `p${Date.now()}`;
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const newPlayer: Player = {
      id: newId,
      name: `P${players.length + 1}`,
      color: colors[players.length % colors.length]
    };
    onPlayersChange([...players, newPlayer]);
    onRoundsChange(rounds.map(r => ({ ...r, scores: { ...r.scores, [newId]: null } })));
  };

  const removePlayer = (id: string) => {
    onPlayersChange(players.filter(p => p.id !== id));
    onRoundsChange(rounds.map(r => {
      const s = { ...r.scores };
      delete s[id];
      return { ...r, scores: s };
    }));
  };

  const addNewRound = () => {
    const emptyScores: Record<string, number | null> = {};
    players.forEach(p => emptyScores[p.id] = null);
    onRoundsChange([...rounds, { round: rounds.length + 1, scores: emptyScores }]);
  };

  const removeLastRound = () => {
    if (rounds.length > 0) {
      onRoundsChange(rounds.slice(0, -1));
    }
  };

  const runAnalysis = async () => {
    if (players.length === 0 || rounds.length === 0) return;
    setIsAnalyzing(true);
    const result = await getGameAnalysis(players, rounds, stats);
    setAiInsight(result || "Error.");
    setIsAnalyzing(false);
    setActiveTab('analysis');
  };

  return (
    <div className="h-screen font-sans bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-4 h-11 md:h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-slate-900 w-6 h-6 rounded flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-[11px] md:text-sm font-black text-slate-900 uppercase tracking-tighter">Ace Tracker</h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onReset} className="hidden md:block text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-lg uppercase border border-red-100 hover:bg-red-500 hover:text-white transition-all">New Game</button>
          <div className="flex bg-slate-50 rounded-lg p-0.5 border border-slate-100 shadow-inner">
            <button onClick={undo} disabled={!canUndo} className="p-1 rounded disabled:opacity-20 hover:bg-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
            <button onClick={redo} disabled={!canRedo} className="p-1 rounded disabled:opacity-20 hover:bg-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg></button>
          </div>
        </div>
      </header>

      <nav className="flex bg-white border-b border-slate-100 px-2 py-1 justify-around text-[10px] font-black uppercase tracking-tight shrink-0">
        {['table', 'charts', 'analysis', 'dice'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-2 rounded-md transition-all ${activeTab === tab ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400'}`}>{tab}</button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto w-full px-2 md:px-6 py-2 md:py-3 flex flex-col flex-1 gap-2 md:gap-3 overflow-hidden">
        {activeTab !== 'dice' && (
          <section className="grid grid-cols-4 gap-2 md:gap-4 shrink-0">
            {stats.map(stat => {
              const p = players.find(player => player.id === stat.id);
              if (!p) return null;
              return <StatCard key={stat.id} player={p} stat={stat} onRemove={removePlayer} />;
            })}
          </section>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
          {activeTab === 'table' && (
            <div className="p-2 md:p-3 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <h2 className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-tight">Leaderboard</h2>
                <div className="flex items-center gap-2">
                  <button onClick={onReset} className="md:hidden text-[9px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 uppercase transition-all active:bg-red-500 active:text-white">New Game</button>
                  <button onClick={addPlayer} className="bg-indigo-600 text-white px-3 py-1 rounded-md text-[9px] md:text-[11px] font-black hover:bg-indigo-700 transition-colors uppercase tracking-tighter">+ Player</button>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 gap-1 items-center px-2">
                    <button onClick={addNewRound} className="text-white text-xs font-bold p-1">+</button>
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter">Round</span>
                    <button onClick={removeLastRound} disabled={rounds.length === 0} className="text-white text-xs font-bold p-1 disabled:opacity-30">-</button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-auto rounded-xl border border-slate-100 flex-1">
                <table className="w-full text-left border-collapse min-w-[320px]">
                  <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase w-12 md:w-20 tracking-tighter">Rnd</th>
                      {players.map(p => (
                        <th key={p.id} className="py-2.5 text-center">
                          <input 
                            type="text" value={p.name} 
                            onChange={(e) => handleNameChange(p.id, e.target.value)}
                            maxLength={8}
                            className="text-[11px] md:text-sm font-black text-center bg-transparent border-0 focus:ring-0 w-full truncate uppercase tracking-tighter"
                            style={{ color: p.color }}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rounds.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-2.5 px-3 text-[10px] font-black text-slate-300">R{r.round}</td>
                        {players.map(p => (
                          <td key={p.id} className="p-1">
                            <input 
                              type="text" value={r.scores[p.id] ?? ''}
                              onChange={(e) => handleScoreChange(rIdx, p.id, e.target.value)}
                              className="w-full bg-slate-50/50 border-0 rounded-lg py-1.5 md:py-2 text-center font-black text-slate-800 text-[12px] md:text-base focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all placeholder:text-slate-200"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-900 text-white z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <tr>
                      <td className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest">Total</td>
                      {players.map(p => (
                        <td key={p.id} className="py-2.5 text-center text-[12px] md:text-xl font-black">
                          {stats.find(s => s.id === p.id)?.totalScore}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="p-2 md:p-3 flex-1 flex flex-col gap-3 overflow-hidden h-full">
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-3 h-full overflow-hidden">
                <div className="flex flex-col h-full overflow-hidden min-h-0">
                  <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase mb-2 ml-1 tracking-tighter">Ranking Progress</h3>
                  <div className="rounded-2xl border border-slate-100 flex-1 bg-slate-50/30 min-h-0 overflow-hidden flex flex-col shadow-inner">
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-center border-collapse text-[10px] md:text-xs">
                        <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="py-2 px-2 font-black text-slate-400 uppercase tracking-tighter">Rnd</th>
                            {players.map(p => (
                              <th key={p.id} className="py-2 px-1 font-black truncate max-w-[50px] uppercase tracking-tighter" style={{ color: p.color }}>
                                {p.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/50">
                          {cumulativeRanksPerRound.map((cr, idx) => (
                            <tr key={idx} className="h-9 md:h-11">
                              <td className="py-0.5 text-slate-300 font-bold text-[9px]">R{cr.round}</td>
                              {players.map(p => {
                                const rank = cr.ranks ? cr.ranks[p.id] : null;
                                return (
                                  <td key={p.id} className="py-0.5 px-0.5">
                                    {rank ? (
                                      <span className={`w-6 h-6 md:w-8 md:h-8 inline-flex items-center justify-center rounded-lg font-black text-[10px] md:text-xs transition-all ${rank === 1 ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' : 'bg-white text-slate-400 border border-slate-100 shadow-xs'}`}>
                                        {rank}
                                      </span>
                                    ) : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full overflow-hidden min-h-0">
                  <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase mb-2 ml-1 tracking-tighter">Score Trends</h3>
                  <div className="flex-1 min-h-0 bg-slate-50/30 rounded-2xl p-3 border border-slate-100 shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>{players.map(p => (<linearGradient key={p.id} id={`c-${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={p.color} stopOpacity={0.3}/><stop offset="95%" stopColor={p.color} stopOpacity={0}/></linearGradient>))}</defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: '10px', fontWeight: 'bold', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingTop: '15px', color: '#64748b' }} />
                        {players.map(p => (<Area key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={3} fill={`url(#c-${p.id})`} activeDot={{r: 6, strokeWidth: 2, stroke: '#fff'}} />))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-400">Match Insights</h2>
                <button onClick={runAnalysis} disabled={isAnalyzing} className="bg-slate-900 text-white text-[10px] md:text-xs px-5 py-2 rounded-xl font-black hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  {isAnalyzing ? "Processing..." : "Generate Analysis"}
                </button>
              </div>
              <div className="bg-slate-50 p-5 md:p-8 rounded-3xl border border-slate-100 text-[13px] md:text-base italic leading-relaxed text-slate-700 flex-1 overflow-auto whitespace-pre-wrap font-medium shadow-inner">
                {aiInsight || "Ready for some tactical wisdom? Tap 'Generate Analysis' to see the AI's breakdown of the standings!"}
              </div>
            </div>
          )}

          {activeTab === 'dice' && (
            <DiceRoller />
          )}
        </div>
      </main>
    </div>
  );
};

// --- App Root: State Lifted for Perfect Resets ---

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

  const [history, setHistory] = useState<{players: Player[], rounds: RoundScore[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Persistence management in App level
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
    localStorage.setItem(STORAGE_KEY_ROUNDS, JSON.stringify(rounds));
  }, [players, rounds]);

  const pushState = useCallback((newPlayers: Player[], newRounds: RoundScore[]) => {
    setPlayers(newPlayers);
    setRounds(newRounds);
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      return [...nextHistory, { players: newPlayers, rounds: newRounds }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlayers(prevState.players);
      setRounds(prevState.rounds);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlayers(nextState.players);
      setRounds(nextState.rounds);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  const handleReset = useCallback(() => {
    if (window.confirm("Confirm: Start a New Game? All scores, names, and history will be permanently cleared.")) {
      // 1. Clear storage immediately
      localStorage.removeItem(STORAGE_KEY_PLAYERS);
      localStorage.removeItem(STORAGE_KEY_ROUNDS);
      
      // 2. Overwrite state with initial defaults
      const defaultPlayers = getInitialPlayers();
      const defaultRounds = getInitialRounds(defaultPlayers);
      
      setPlayers(defaultPlayers);
      setRounds(defaultRounds);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  return (
    <GameDashboard 
      players={players} 
      rounds={rounds} 
      onPlayersChange={(p) => pushState(p, rounds)}
      onRoundsChange={(r) => pushState(players, r)}
      onReset={handleReset}
      undo={undo}
      redo={redo}
      canUndo={historyIndex > 0}
      canRedo={historyIndex < history.length - 1}
    />
  );
}
