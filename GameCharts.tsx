import React, { useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import type { Player, RoundScore } from './types';
import { placesOf, placeEmoji, hasAnyScore } from './shared/game';

// RANKING tablosu + Performance Trend grafiği. Canlı oyunun charts sekmesi ve arşivdeki oyun detayı aynı parçayı kullanır.
export const GameCharts: React.FC<{ players: Player[]; rounds: RoundScore[]; idPrefix?: string }> = ({ players, rounds, idPrefix = 'c' }) => {
  const started = hasAnyScore(rounds);
  const finalPlaces = useMemo(() => placesOf(players, rounds), [players, rounds]);

  // Grafik anahtarı oyuncu id'si: aynı isimli iki oyuncu çakışmasın
  const chartData = useMemo(() => {
    const runningTotals: Record<string, number> = {};
    players.forEach(p => runningTotals[p.id] = 0);
    return rounds.map((r) => {
      const dataPoint: Record<string, string | number> = { name: `R${r.round}` };
      players.forEach(p => {
        runningTotals[p.id] += typeof r.scores[p.id] === 'number' ? (r.scores[p.id] as number) : 0;
        dataPoint[p.id] = runningTotals[p.id];
      });
      return dataPoint;
    });
  }, [players, rounds]);

  // Her el için o ele kadarki toplama göre sıra (Excel SIRALAMA ile aynı mantık):
  // sadece puan girilmiş eller görünür, puanı olmayan oyuncu o elde '-' görünür
  const rankingTableData = useMemo(() => {
    return rounds.map((r, idx) => {
      const hasRoundData = players.some(p => typeof r.scores[p.id] === 'number');
      const places = placesOf(players, rounds.slice(0, idx + 1));
      const ranks: Record<string, number> = {};
      players.forEach(p => {
        ranks[p.id] = places[p.id] ?? 0;
      });
      return { round: r.round, ranks, isVisible: hasRoundData };
    });
  }, [players, rounds]);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
        <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-4 text-center">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">RANKING</h2>
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
                const rankValues = (Object.values(row.ranks) as number[]).filter(v => v > 0);
                const maxRank = rankValues.length > 0 ? Math.max(...rankValues) : 0;

                return (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 h-7 md:h-8">
                    <td className="py-0.5 px-3 text-[9px] font-black text-slate-300 border-r border-slate-100">{row.round}</td>
                    {players.map(p => {
                      const rank = row.ranks[p.id];
                      let bgClass = "bg-white text-slate-200";

                      if (row.isVisible && rank > 0) {
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
                          {row.isVisible && rank > 0 ? rank : '-'}
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
                {players.map(p => (
                  <td key={p.id} className="py-1 px-3 border-r border-slate-200 last:border-0">
                    <span className="text-sm md:text-xl drop-shadow-sm select-none leading-none">
                      {started ? placeEmoji(finalPlaces[p.id], finalPlaces) : ''}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-slate-50/30 rounded-2xl p-4 border border-slate-100 shadow-inner h-[220px] md:h-[300px] shrink-0">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Performance Trend</h2>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>{players.map(p => (<linearGradient key={p.id} id={`${idPrefix}-${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={p.color} stopOpacity={0.3}/><stop offset="95%" stopColor={p.color} stopOpacity={0}/></linearGradient>))}</defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 9, fontWeight: 700}} axisLine={false} tickLine={false} />
            <Tooltip />
            {players.map(p => (<Area key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={3} fill={`url(#${idPrefix}-${p.id})`} />))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};
