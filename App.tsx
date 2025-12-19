
import React, { useState, useMemo, useCallback } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { getInitialPlayers, getInitialRounds } from './constants';
import { Player, RoundScore, PlayerStats } from './types';
import { getGameAnalysis } from './geminiService';

// --- Sub-components ---

const Badge = ({ rank, size = 'large' }: { rank: number, size?: 'small' | 'large' }) => {
  const emojiSize = size === 'large' ? 'text-4xl md:text-5xl' : 'text-xl md:text-2xl';
  switch (rank) {
    case 1: return <span className={`${emojiSize} drop-shadow-lg select-none`} title="Winner">🏆</span>;
    case 2: return <span className={`${emojiSize} drop-shadow-lg select-none`} title="Second">🥈</span>;
    case 3: return <span className={`${emojiSize} drop-shadow-lg select-none`} title="Third">🥉</span>;
    default: return <span className={`${emojiSize} drop-shadow-lg select-none`} title="Last Place">💩</span>;
  }
};

interface StatCardProps {
  player: Player;
  stat: PlayerStats;
  onRemove: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ player, stat, onRemove }) => (
  <div className="group bg-white rounded-lg md:rounded-[1.5rem] shadow-sm p-1.5 md:p-6 border border-slate-100 flex flex-col items-center hover:shadow-md transition-all relative overflow-hidden text-center min-h-[110px] md:min-h-[240px] justify-center cursor-default">
    <button 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(player.id);
      }}
      className="opacity-0 group-hover:opacity-100 absolute top-0.5 right-0.5 md:top-2 md:right-2 w-5 h-5 md:w-8 md:h-8 bg-slate-900 text-white rounded-full flex items-center justify-center transition-all hover:bg-red-500 z-40 shadow-sm border border-slate-800 active:scale-90"
      title={`Remove ${player.name}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <div className="w-full mb-1 md:mb-4">
      <h3 className="font-black text-slate-900 text-lg md:text-5xl leading-tight truncate px-1 uppercase tracking-tighter">{player.name}</h3>
    </div>

    <div className="flex items-center md:flex-col gap-1 md:gap-2">
      <div className="text-base md:text-4xl font-black text-slate-500 tracking-tighter leading-none opacity-80">{stat.totalScore}</div>
      <div className="h-6 md:h-14 flex items-center justify-center">
        <Badge rank={stat.rank} size={window.innerWidth < 768 ? 'small' : 'large'} />
      </div>
    </div>
    
    <div className="absolute bottom-0 left-0 right-0 h-1 md:h-2" style={{ backgroundColor: player.color }} />
  </div>
);

// --- Game Logic Container ---

function GameDashboard({ onReset }: { onReset: () => void }) {
  const [players, setPlayers] = useState<Player[]>(getInitialPlayers);
  const [rounds, setRounds] = useState<RoundScore[]>(() => getInitialRounds(getInitialPlayers()));
  
  const [history, setHistory] = useState<{players: Player[], rounds: RoundScore[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'analysis'>('table');

  const pushState = useCallback((newPlayers: Player[], newRounds: RoundScore[]) => {
    setPlayers(newPlayers);
    setRounds(newRounds);
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      return [...nextHistory, { players: newPlayers, rounds: newRounds }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlayers(prevState.players);
      setRounds(prevState.rounds);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlayers(nextState.players);
      setRounds(nextState.rounds);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Final overall stats
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

  // Chart data (cumulative totals per round)
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

  /**
   * RANKING Calculation Logic
   * Revised: Each round 'r' is only ranked if it is "played" (has at least one score).
   * Cumulative total is calculated from Round 1 up to Round 'r'.
   */
  const cumulativeRanksPerRound = useMemo(() => {
    return rounds.map((r, i) => {
      // Step 1: Check if the round is played (at least one numeric score exists)
      const isRoundPlayed = Object.values(r.scores).some(v => typeof v === 'number');

      if (!isRoundPlayed) {
        return { round: r.round, ranks: null };
      }

      // Step 2: Calculate cumulative totals up to this round
      const currentRoundsSlice = rounds.slice(0, i + 1);
      const playersTotals = players.map(p => {
        const totalToThisRound = currentRoundsSlice.reduce((sum, rSlice) => {
          const val = rSlice.scores[p.id];
          return sum + (typeof val === 'number' ? val : 0);
        }, 0);
        return { id: p.id, total: totalToThisRound };
      });

      // Step 3: Sort players by cumulative total (Lowest Total = Rank 1)
      const sortedByTotal = [...playersTotals].sort((a, b) => a.total - b.total);

      const ranksMap: Record<string, number> = {};
      sortedByTotal.forEach((item, index) => {
        ranksMap[item.id] = index + 1;
      });

      return {
        round: r.round,
        ranks: ranksMap
      };
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
    
    const parsed = parseInt(sanitized, 10);
    if (!isNaN(parsed) || sanitized === '') {
      pushState(players, newRounds);
    } else {
      setRounds(newRounds);
    }
  };

  const handleNameChange = (playerId: string, newName: string) => {
    const newPlayers = players.map(p => p.id === playerId ? { ...p, name: newName } : p);
    pushState(newPlayers, rounds);
  };

  const addPlayer = () => {
    const newId = `p${Date.now()}`;
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const newPlayer: Player = {
      id: newId,
      name: `P${players.length + 1}`,
      color: colors[players.length % colors.length]
    };
    pushState([...players, newPlayer], rounds.map(r => ({ ...r, scores: { ...r.scores, [newId]: null } })));
  };

  const removePlayer = (id: string) => {
    pushState(
      players.filter(p => p.id !== id),
      rounds.map(r => {
        const s = { ...r.scores };
        delete s[id];
        return { ...r, scores: s };
      })
    );
  };

  const addNewRound = () => {
    const emptyScores: Record<string, number | null> = {};
    players.forEach(p => emptyScores[p.id] = null);
    pushState(players, [...rounds, { round: rounds.length + 1, scores: emptyScores }]);
  };

  const removeLastRound = () => {
    if (rounds.length > 0) {
      pushState(players, rounds.slice(0, -1));
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
    <div className="min-h-screen pb-10 md:pb-20 font-sans selection:bg-indigo-100 selection:text-indigo-900 bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-slate-900 w-6 h-6 md:w-8 md:h-8 rounded-md flex items-center justify-center text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xs md:text-lg font-black text-slate-900 uppercase tracking-tighter">Ace Tracker</h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onReset} 
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-black transition-all mr-2 uppercase tracking-tighter shadow-sm border border-red-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Reset Dashboard
            </button>

            <div className="flex bg-slate-50 border border-slate-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={undo} disabled={historyIndex <= 0} className="p-1 md:p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-20 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1 md:p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-20 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg></button>
            </div>

            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg font-bold text-xs ml-2">
              <button onClick={() => setActiveTab('table')} className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Table</button>
              <button onClick={() => setActiveTab('charts')} className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'charts' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Charts</button>
              <button onClick={() => setActiveTab('analysis')} className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'analysis' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>AI</button>
            </div>
          </div>
        </div>

        <div className="md:hidden flex bg-white border-t border-slate-100 px-1 py-1 justify-around text-[8px] font-black uppercase tracking-widest text-slate-400">
           <button onClick={() => setActiveTab('table')} className={`flex-1 py-1 rounded-md ${activeTab === 'table' ? 'text-indigo-600 bg-indigo-50/50' : ''}`}>Board</button>
           <button onClick={() => setActiveTab('charts')} className={`flex-1 py-1 rounded-md ${activeTab === 'charts' ? 'text-indigo-600 bg-indigo-50/50' : ''}`}>Stats</button>
           <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-1 rounded-md ${activeTab === 'analysis' ? 'text-indigo-600 bg-indigo-50/50' : ''}`}>AI Insights</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-1.5 md:px-6 mt-1.5 md:mt-4">
        <section className="grid grid-cols-4 md:grid-cols-4 gap-1 md:gap-4 mb-2 md:mb-8">
          {stats.map(stat => {
            const p = players.find(player => player.id === stat.id);
            if (!p) return null;
            return <StatCard key={stat.id} player={p} stat={stat} onRemove={removePlayer} />;
          })}
        </section>

        <div className="bg-white rounded-xl md:rounded-[2rem] shadow-md md:shadow-lg border border-slate-100 overflow-hidden">
          {activeTab === 'table' && (
            <div className="p-1.5 md:p-8">
              <div className="flex items-center justify-between mb-2 md:mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-[10px] md:text-2xl font-black text-slate-900 tracking-tight uppercase">SCORE</h2>
                  <button onClick={onReset} className="md:hidden text-[8px] font-black text-red-500 bg-red-50 px-2 py-1 rounded uppercase tracking-tighter border border-red-100">Reset All</button>
                </div>
                
                <div className="flex items-center gap-4 md:gap-8">
                  <button onClick={addPlayer} className="bg-indigo-600 text-white px-1.5 md:px-3 py-1 md:py-1.5 rounded-lg font-black hover:bg-indigo-700 transition-all shadow-sm text-[8px] md:text-xs flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg>
                    Player
                  </button>
                  <div className="flex items-center bg-indigo-600 rounded-lg p-0.5 md:p-1 gap-1 md:gap-2 shadow-sm px-1 md:px-2">
                    <button onClick={addNewRound} className="text-white hover:bg-indigo-500 p-1 md:p-1.5 rounded-md transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                    <span className="text-[8px] md:text-xs font-black text-white uppercase tracking-tighter select-none">Round</span>
                    <button onClick={removeLastRound} className="text-white hover:bg-indigo-500 p-1 md:p-1.5 rounded-md transition-colors" disabled={rounds.length === 0}><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg></button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto -mx-1.5 md:mx-0 rounded-none md:rounded-[1.5rem] border-y md:border border-slate-100">
                <table className="w-full text-left border-collapse min-w-[320px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-1.5 md:py-6 px-2 md:px-8 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 w-10 md:w-24">Rnd</th>
                      {players.map(p => (
                        <th key={p.id} className="py-1.5 md:py-6 px-1 md:px-6 text-center min-w-[70px] md:min-w-[160px]">
                          <div className="flex flex-col items-center justify-center gap-1 md:gap-3">
                            <div className="w-1.5 md:w-4 h-1.5 md:h-4 rounded-full shadow-sm" style={{ backgroundColor: p.color }} />
                            <input 
                              type="text" value={p.name} 
                              onChange={(e) => handleNameChange(p.id, e.target.value)}
                              className="text-[12px] md:text-3xl font-black text-slate-900 text-center bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-500 focus:ring-0 w-16 md:w-36 transition-all p-1 hover:bg-slate-200/50 rounded-md uppercase tracking-tighter"
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rounds.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-1 md:py-3 px-2 md:px-8 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-50">
                          <span className="text-[8px] md:text-base font-black text-slate-400 group-hover:text-indigo-600 transition-colors whitespace-nowrap">R{r.round}</span>
                        </td>
                        {players.map(p => {
                          const scores = Object.values(r.scores).filter(v => v !== null && typeof v === 'number') as number[];
                          const currentVal = r.scores[p.id];
                          const isLead = scores.length > 0 && typeof currentVal === 'number' && currentVal === Math.min(...scores);
                          return (
                            <td key={p.id} className="py-0.5 md:py-2 px-0.5 md:px-3">
                              <input 
                                type="text" inputMode="text" value={currentVal ?? ''}
                                onChange={(e) => handleScoreChange(rIdx, p.id, e.target.value)}
                                className={`w-full bg-slate-50/50 border-0 rounded-md md:rounded-xl px-1 md:px-4 py-1.5 md:py-3 text-center font-black text-slate-800 text-[10px] md:text-xl focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all ${isLead ? 'bg-indigo-50 ring-1 ring-indigo-200 shadow-sm text-indigo-700 font-black' : ''}`}
                                placeholder="—"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 font-black text-white">
                    <tr>
                      <td className="py-2 md:py-6 px-2 md:px-8 uppercase text-[6px] md:text-[10px] tracking-[0.2em] text-slate-500 sticky left-0 bg-slate-900 z-10">Total</td>
                      {players.map(p => {
                        const s = stats.find(stat => stat.id === p.id);
                        return (
                          <td key={p.id} className="py-2 md:py-6 px-1 md:px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] md:text-3xl text-white tracking-tighter mb-0.5 md:mb-1 leading-none">{s?.totalScore}</span>
                              <Badge rank={s?.rank || 0} size="small" />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="p-4 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-8 lg:gap-12">
                {/* RANKING Table - NARROWER (NOW ON THE LEFT) */}
                <div className="flex flex-col border-r border-slate-100 pr-0 lg:pr-8">
                  <h2 className="text-[10px] md:text-2xl font-black text-slate-900 mb-6 tracking-tight uppercase">RANKING</h2>
                  <div className="overflow-x-auto rounded-xl md:rounded-[1.5rem] border border-slate-100 shadow-sm bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="py-2 md:py-4 px-1 md:px-2 w-8 md:w-16 text-center text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Rnd</th>
                          {players.map(p => (
                            <th key={p.id} className="py-2 md:py-4 px-0.5 md:px-1 text-center text-[7px] md:text-[11px] font-black text-slate-700 uppercase truncate max-w-[40px] md:max-w-[80px]">
                              {p.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {cumulativeRanksPerRound.map((cr, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors h-10 md:h-14">
                            <td className="py-1 md:py-2.5 px-1 md:px-2 text-center font-black text-slate-400 text-[8px] md:text-xs">R{cr.round}</td>
                            {players.map(p => {
                              const rank = cr.ranks ? cr.ranks[p.id] : null;
                              
                              if (rank === null) {
                                return <td key={p.id} className="py-1 md:py-2.5 px-0.5 md:px-1"></td>;
                              }

                              const isFirst = rank === 1;
                              const isLast = rank === players.length && players.length > 1;
                              
                              return (
                                <td key={p.id} className="py-1 md:py-2.5 px-0.5 md:px-1 text-center">
                                  <div className={`mx-auto w-5 h-5 md:w-8 md:h-8 flex items-center justify-center rounded-lg font-black text-[9px] md:text-base transition-all ${
                                    isFirst ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' : 
                                    isLast ? 'bg-red-100 text-red-700 shadow-sm border border-red-200' : 
                                    'bg-white text-slate-500 border border-slate-100'
                                  }`}>
                                    {rank}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t border-slate-200">
                        <tr className="font-black">
                          <td className="py-2 md:py-4 px-1 md:px-2 text-center text-[7px] md:text-[9px] text-slate-500 uppercase tracking-widest">SCR</td>
                          {players.map(p => {
                            const playerStat = stats.find(s => s.id === p.id);
                            return (
                              <td key={p.id} className="py-2 md:py-4 px-0.5 md:px-1 text-center">
                                <div className="flex flex-col items-center">
                                  <div className="scale-[0.6] md:scale-90 mb-0.5">
                                    <Badge rank={playerStat?.rank || 0} size="small" />
                                  </div>
                                  <span className="text-[7px] md:text-[10px] text-slate-500 font-bold">{playerStat?.totalScore}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Visual Trends Right - EXTENDED (NOW ON THE RIGHT) */}
                <div className="flex flex-col h-full">
                  <h2 className="text-[10px] md:text-2xl font-black text-slate-900 mb-6 tracking-tight uppercase">Visual Trends</h2>
                  <div className="flex-1 min-h-[250px] md:min-h-[400px] w-full">
                    {players.length > 0 && rounds.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                          <defs>{players.map(p => (<linearGradient key={`g-${p.id}`} id={`c-${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={p.color} stopOpacity={0.3}/><stop offset="95%" stopColor={p.color} stopOpacity={0}/></linearGradient>))}</defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 7, fontWeight: 800}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 7, fontWeight: 800}} />
                          <Tooltip contentStyle={{ borderRadius: '0.4rem', border: 'none', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.1)', padding: '6px' }} labelStyle={{ fontWeight: '900', fontSize: '0.65rem', marginBottom: '2px' }} />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '8px' }} />
                          {players.map(p => (<Area key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={2} fillOpacity={1} fill={`url(#c-${p.id})`} activeDot={{ r: 3, strokeWidth: 0 }} />))}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="p-4 md:p-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] md:text-2xl font-black text-slate-900 tracking-tight uppercase">AI Report</h2>
                {isAnalyzing && <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-black animate-pulse shadow-sm text-[7px] md:text-sm"><span className="animate-spin">✨</span> Thinking...</div>}
              </div>
              {!aiInsight && !isAnalyzing ? (
                <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="text-4xl mb-4">🎙️</div>
                  <button onClick={runAnalysis} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-black hover:bg-black transition-all shadow-lg text-[10px] md:text-base mt-2">Generate Report</button>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                   <div className="bg-slate-900 text-white p-4 md:p-10 rounded-xl whitespace-pre-wrap font-medium leading-relaxed text-[10px] md:text-xl italic shadow-lg relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-24 md:w-48 h-24 md:h-48 bg-indigo-500 opacity-10 rounded-full -mr-12 md:-mr-24 -mt-12 md:-mt-24 group-hover:scale-110 transition-transform duration-1000"></div>
                     <span className="relative z-10">{aiInsight}</span>
                   </div>
                   <div className="mt-4 flex justify-center">
                      <button onClick={runAnalysis} className="text-[9px] md:text-sm font-black text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition-colors uppercase tracking-widest"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Refresh</button>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Main App Wrapper ---

export default function App() {
  const [gameKey, setGameKey] = useState(0);

  const handleReset = useCallback(() => {
    setGameKey(prev => prev + 1);
  }, []);

  return <GameDashboard key={gameKey} onReset={handleReset} />;
}
