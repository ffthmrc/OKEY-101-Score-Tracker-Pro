import React, { useMemo } from 'react';
import type { Player, RoundScore } from './types';
import { standings, placesOf, placeEmoji, hasAnyScore } from './shared/game';

// Excel'deki "Fark?" tablosunun uygulama karşılığı: puan girildikçe sıra ve farklar canlı değişir.
// Excel'den farkı: eşit toplamda iki kişi de görünür (Excel'de biri kayboluyor, bir satır #N/A oluyordu).

export const GapPanel: React.FC<{ players: Player[]; rounds: RoundScore[] }> = ({ players, rounds }) => {
  const rows = useMemo(() => standings(players, rounds), [players, rounds]);
  const places = useMemo(() => placesOf(players, rounds), [players, rounds]);
  const waiting = players.filter(p => places[p.id] === null);
  const started = hasAnyScore(rounds);
  const playedRounds = rounds.filter(r => players.every(p => typeof r.scores[p.id] === 'number')).length;

  if (!started) {
    return <div className="flex-1 flex items-center justify-center text-slate-300 text-xs font-bold uppercase italic">Puan girilince farklar burada görünür</div>;
  }

  const badge = (place: number) => placeEmoji(place, places);

  return (
    <div className="p-2 md:p-4 flex-1 overflow-auto custom-scrollbar space-y-3">
      {/* Sıralama: lidere ve bir üsttekine fark */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-3 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Sıralama</h2>
          <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">{playedRounds}/{rounds.length} el tamam</span>
        </div>
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="text-[9px] md:text-[11px] font-black uppercase text-slate-400 tracking-tighter border-b border-slate-100">
              <th className="py-1.5 pl-3 text-left">Oyuncu</th>
              <th className="py-1.5">Puan</th>
              <th className="py-1.5">Lidere</th>
              <th className="py-1.5 pr-3">Üsttekine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => {
              const above = rows.slice(0, i).reverse().find(x => x.place < r.place);
              return (
                <tr key={r.player.id} className="text-xs md:text-base font-black text-slate-800">
                  <td className="py-2 pl-3 text-left">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center text-sm md:text-lg leading-none">{badge(r.place)}</span>
                      <span className="h-3 w-1 rounded-full shrink-0" style={{ backgroundColor: r.player.color }} />
                      <span className="uppercase truncate tracking-tight">{r.player.name}</span>
                    </div>
                  </td>
                  <td className="py-2">{r.total}</td>
                  <td className={`py-2 ${r.place === 1 ? 'text-slate-200' : 'text-red-500'}`}>{r.place === 1 ? '—' : `+${r.total - rows[0].total}`}</td>
                  <td className={`py-2 pr-3 ${above ? 'text-amber-600' : 'text-slate-200'}`}>{above ? `+${r.total - above.total}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {waiting.length > 0 && (
          <div className="px-3 py-1.5 border-t border-slate-100 text-[9px] md:text-[11px] font-bold text-slate-400 uppercase">
            Henüz puanı yok: {waiting.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {/* Herkesin herkese farkı (Excel'deki matris) */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-3 text-center">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Fark?</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1.5 px-2" />
                {rows.map(c => (
                  <th key={c.player.id} className="py-1.5 px-1 text-[9px] md:text-xs font-black uppercase tracking-tighter truncate" style={{ color: c.player.color }}>
                    {c.place}. {c.player.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.player.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 px-2 text-left text-[9px] md:text-xs font-black uppercase tracking-tighter truncate" style={{ color: r.player.color }}>
                    {r.place}. {r.player.name}
                  </td>
                  {rows.map(c => (
                    <td key={c.player.id} className={`py-1.5 px-1 text-[11px] md:text-sm font-black ${c.player.id === r.player.id ? 'text-slate-200 bg-slate-50' : 'text-slate-700'}`}>
                      {c.player.id === r.player.id ? '—' : Math.abs(r.total - c.total)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
