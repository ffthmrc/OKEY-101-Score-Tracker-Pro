import React, { useMemo } from 'react';
import type { Player, RoundScore } from './types';
import { standings, placesOf, placeEmoji, hasAnyScore } from './shared/game';
import { CARD, SECTION_HEAD, SECTION_TITLE, SECTION_NOTE, DARK_HEAD, TH_LABEL, PlayerTag } from './PlayerTag';

// Excel'deki "Fark?" tablosunun uygulama karşılığı: puan girildikçe sıra ve farklar canlı değişir.
// Excel'den farkı: eşit toplamda iki kişi de görünür (Excel'de biri kayboluyor, bir satır #N/A oluyordu).

// embedded: arşiv detayında sayfanın içinde (kendi kaydırması olmadan) gösterilir
export const GapPanel: React.FC<{ players: Player[]; rounds: RoundScore[]; embedded?: boolean }> = ({ players, rounds, embedded }) => {
  const rows = useMemo(() => standings(players, rounds), [players, rounds]);
  const places = useMemo(() => placesOf(players, rounds), [players, rounds]);
  const waiting = players.filter(p => places[p.id] === null);
  const started = hasAnyScore(rounds);
  const playedRounds = rounds.filter(r => players.every(p => typeof r.scores[p.id] === 'number')).length;

  if (!started) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-semibold">Puan girilince farklar burada görünür</div>;
  }

  const badge = (place: number) => placeEmoji(place, places);

  return (
    <div className={embedded ? 'space-y-3 shrink-0' : 'p-2 md:p-4 flex-1 overflow-auto custom-scrollbar space-y-3'}>
      {/* Sıralama: lidere ve bir üsttekine fark */}
      <div className={CARD}>
        <div className={SECTION_HEAD}>
          <h2 className={SECTION_TITLE}>Sıralama puan farkı</h2>
          <span className={SECTION_NOTE}>{playedRounds}/{rounds.length} el tamam</span>
        </div>
        <table className="w-full text-center border-collapse">
          <thead className={DARK_HEAD}>
            <tr className={TH_LABEL}>
              <th className="py-1.5 pl-3 text-left font-semibold">Oyuncu</th>
              <th className="py-1.5 font-semibold">Puan</th>
              <th className="py-1.5 font-semibold">Lidere</th>
              <th className="py-1.5 pr-3 font-semibold">Üsttekine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const above = rows.slice(0, i).reverse().find(x => x.place < r.place);
              return (
                <tr key={r.player.id} className="text-sm md:text-base font-bold text-slate-800 tabular-nums">
                  <td className="py-2 pl-3 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 text-center text-base md:text-lg leading-none shrink-0">{badge(r.place)}</span>
                      <PlayerTag color={r.player.color} name={r.player.name} />
                    </div>
                  </td>
                  <td className="py-2 font-black">{r.total}</td>
                  <td className={`py-2 ${r.place === 1 ? 'text-slate-300' : 'text-red-500'}`}>{r.place === 1 ? '—' : `+${r.total - rows[0].total}`}</td>
                  <td className={`py-2 pr-3 ${above ? 'text-amber-600' : 'text-slate-300'}`}>{above ? `+${r.total - above.total}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {waiting.length > 0 && (
          <div className={`px-3 py-1.5 border-t border-slate-100 ${SECTION_NOTE}`}>
            Henüz puanı yok: {waiting.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {/* Herkesin herkese farkı (Excel'deki matris) */}
      <div className={CARD}>
        <div className={SECTION_HEAD}>
          <h2 className={SECTION_TITLE}>Oyuncular arası puan tablosu</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className={DARK_HEAD}>
              <tr>
                <th className="py-1.5 px-2" />
                {rows.map(c => (
                  <th key={c.player.id} className="py-1.5 px-1 text-[10px] xs:text-[11px] md:text-xs font-bold">
                    <PlayerTag color={c.player.color} name={c.player.name} onDark center />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.player.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 px-2 text-left text-[10px] xs:text-[11px] md:text-xs font-bold text-slate-800 max-w-[84px]">
                    <PlayerTag color={r.player.color} name={r.player.name} />
                  </td>
                  {rows.map(c => (
                    <td key={c.player.id} className={`py-1.5 px-1 text-xs md:text-sm font-bold tabular-nums ${c.player.id === r.player.id ? 'text-slate-300 bg-slate-50' : 'text-slate-700'}`}>
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
