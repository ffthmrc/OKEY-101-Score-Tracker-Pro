import React, { useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import type { Player, RoundScore } from './types';
import { placesOf, placeEmoji, hasAnyScore, hasPlayerScore, totalOf } from './shared/game';
import { CARD, SECTION_HEAD, SECTION_TITLE, SECTION_NOTE, DARK_HEAD, TH_LABEL, PlayerTag } from './PlayerTag';

// RANKING tablosu + Performance Trend grafiği. Canlı oyunun charts sekmesi ve arşivdeki oyun detayı aynı parçayı kullanır.
// show: 'ranking' sadece RANKING tablosu, 'trend' sadece grafik (arşivde grafik en altta durur)
export const GameCharts: React.FC<{ players: Player[]; rounds: RoundScore[]; idPrefix?: string; show?: 'both' | 'ranking' | 'trend' }> = ({ players, rounds, idPrefix = 'c', show = 'both' }) => {
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
      {show !== 'trend' && (
      <div className={`${CARD} shrink-0`}>
        <div className={SECTION_HEAD}>
          <h2 className={SECTION_TITLE}>Sıralama</h2>
          <span className={SECTION_NOTE}>el el sıra</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className={DARK_HEAD}>
              <tr>
                <th className={`py-1.5 px-2 w-10 ${TH_LABEL}`}>Rnd</th>
                {players.map(p => (
                  <th key={p.id} className="py-1.5 px-1 text-[11px] xs:text-xs md:text-sm font-bold">
                    <PlayerTag color={p.color} name={p.name} onDark center />
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
                    <td className="py-0.5 px-2 text-[11px] md:text-sm font-semibold text-slate-400 tabular-nums border-r border-slate-100">R{row.round}</td>
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
                        <td key={p.id} className={`py-0.5 px-2 text-xs md:text-base font-bold tabular-nums border-r border-slate-100 last:border-0 transition-colors ${bgClass}`}>
                          {row.isVisible && rank > 0 ? rank : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={DARK_HEAD}>
              <tr className="h-9 md:h-10">
                <td className={`py-1.5 px-2 ${TH_LABEL}`}>SCR</td>
                {players.map(p => (
                  <td key={p.id} className="py-1 px-2">
                    <span className="text-base md:text-xl select-none leading-none">
                      {started ? placeEmoji(finalPlaces[p.id], finalPlaces) : ''}
                    </span>
                  </td>
                ))}
              </tr>
              {/* SCR altında oyuncuların toplam puanı */}
              <tr className="border-t border-white/10 h-9 md:h-10">
                <td className={`py-1 px-2 ${TH_LABEL}`}>Total</td>
                {players.map(p => (
                  <td key={p.id} className="py-1 px-1 text-[15px] md:text-xl font-black tabular-nums">
                    {hasPlayerScore(rounds, p.id) ? totalOf(rounds, p.id) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {show !== 'ranking' && (
      <div className={`${CARD} shrink-0`}>
        <div className={SECTION_HEAD}>
          <h2 className={SECTION_TITLE}>Performans Grafiği</h2>
          <span className={SECTION_NOTE}>toplam puan, el el</span>
        </div>
        {/* renk açıklaması: çizgiler adla eşleşsin */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-2 text-[11px] md:text-xs font-bold text-slate-700">
          {players.map(p => <PlayerTag key={p.id} color={p.color} name={p.name} />)}
        </div>
        <div className="h-[200px] md:h-[280px] px-1 pb-2 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
            <defs>{players.map(p => (<linearGradient key={p.id} id={`${idPrefix}-${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={p.color} stopOpacity={0.25}/><stop offset="95%" stopColor={p.color} stopOpacity={0}/></linearGradient>))}</defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }} />
            {players.map(p => (<Area key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={3} fill={`url(#${idPrefix}-${p.id})`} />))}
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>
      )}
    </>
  );
};
