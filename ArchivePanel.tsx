import React, { useEffect, useMemo, useState } from 'react';
import type { ArchivedGame, ArchiveSummary } from './shared/protocol';
import type { Player, RoundScore } from './types';
import { parseScoreInput, totalOf, placesFromTotals, placesOf, placeEmoji, hasAnyScore, MAX_NAME_LEN, MAX_ROUNDS } from './shared/game';
import { GapPanel } from './GapPanel';
import { scoreTextClass, scoreInputProps, scoreValue, SCORE_INPUT_CLASS } from './ui';
import { buildReportCards, personKey, MIN_RANKED_GAMES, PLACE_POINTS } from './shared/stats';
import { GameCharts } from './GameCharts';
import { ConfirmDialog } from './Dialogs';

// Excel'den aktarılan oyunların saati bilinmez (roomCode 'EXCEL'), sadece tarih gösterilir
const formatDate = (iso: string, roomCode: string) =>
  new Date(iso).toLocaleString('tr-TR', roomCode === 'EXCEL'
    ? { day: '2-digit', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface ArchivePanelProps {
  items: ArchiveSummary[];
  game: ArchivedGame | null;
  savedId: string | null;
  deletedId: string | null;
  unlockSeq: number;          // sunucu arşiv PIN'ini doğruladıkça artar
  canEdit: boolean;           // masaya katılmış mı: değilse Sil / Düzenle hiç görünmez
  onOpen: (id: string) => void;
  onUnlock: (pin: string) => boolean;
  onSave: (id: string, players: Player[], rounds: RoundScore[], pin: string) => boolean;
  onDelete: (id: string, pin: string) => boolean;
}

// Arşivde düzenleme ve silme arşiv PIN'i ister (sunucuda tanımlı; masaya katılmak gerekmez)
export const ArchivePanel: React.FC<ArchivePanelProps> = ({ items, game, savedId, deletedId, unlockSeq, canEdit, onOpen, onUnlock, onSave, onDelete }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ players: Player[]; rounds: RoundScore[] } | null>(null);
  const [confirm, setConfirm] = useState<'edit' | 'save' | 'delete' | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingPin, setPendingPin] = useState<string | null>(null); // doğrulanmayı bekleyen PIN
  const [editPin, setEditPin] = useState<string | null>(null);       // doğrulanmış PIN (kaydetmede gönderilir)
  const [view, setView] = useState<'games' | 'cards'>('games');
  const [showUnranked, setShowUnranked] = useState(false); // 20 oyun altı listesi (kapalı başlar)
  // Karnede bir oyuncuya dokununca Oyunlar listesi o oyuncunun oyunlarına süzülür
  const [filter, setFilter] = useState<{ key: string; name: string } | null>(null);
  const cards = useMemo(() => buildReportCards(items), [items]);
  const shownItems = useMemo(
    () => (filter ? items.filter(i => i.players.some(p => personKey(p.name) === filter.key)) : items),
    [items, filter]
  );
  // 5. ve sonrası sadece 5+ kişilik oyun varsa sütun olarak görünür
  const placeCols = Math.max(4, ...cards.map(c => c.places.length));

  useEffect(() => {
    if (saving && savedId === selectedId) {
      setSaving(false);
      setDraft(null);
    }
  }, [saving, savedId, selectedId]);

  // PIN doğrulandıysa düzenlemeyi aç
  useEffect(() => {
    if (unlockSeq === 0 || pendingPin === null) return;
    const loadedGame = game && game.id === selectedId ? game : null;
    if (loadedGame) {
      setEditPin(pendingPin);
      setDraft({ players: loadedGame.players, rounds: loadedGame.rounds });
    }
    setPendingPin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockSeq]);

  // Masadan kalkınca açık düzenleme kapanır (sunucu da kaydetmeyi reddeder)
  useEffect(() => {
    if (!canEdit) { setDraft(null); setConfirm(null); setPendingPin(null); }
  }, [canEdit]);

  // Silinen oyun (bu cihazdan ya da başkasından) açıksa listeye dön
  useEffect(() => {
    if (selectedId && !items.some(i => i.id === selectedId)) {
      setSelectedId(null);
      setDraft(null);
    }
  }, [items, selectedId]);

  const open = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    onOpen(id);
  };

  // --- Liste ---
  if (!selectedId) {
    return (
      <div className="p-2 md:p-4 flex-1 overflow-auto custom-scrollbar space-y-2">
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-[10px] md:text-xs font-black uppercase tracking-tight">
          {([['games', 'Oyunlar'], ['cards', 'Karne']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className={`flex-1 py-1.5 rounded-md transition-all ${view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{label}</button>
          ))}
        </div>
        {view === 'cards' && (
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-center border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[9px] md:text-[11px] font-black uppercase text-slate-400 tracking-tighter">
                  <th className="py-2 pl-2 w-5 md:w-8">#</th>
                  <th className="py-2 text-left">Oyuncu</th>
                  <th className="py-2">Oyun</th>
                  <th className="py-2">Puan</th>
                  {Array.from({ length: placeCols }, (_, i) => (
                    <th key={i} className="py-2">{['🏆', '🥈', '🥉'][i] ?? `${i + 1}.`}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cards.map((c, i) => (
                  <React.Fragment key={c.name}>
                  {c.rank === null && (i === 0 || cards[i - 1].rank !== null) && (
                    <tr className="bg-slate-50">
                      <td colSpan={4 + placeCols} className="p-0 border-t-2 border-slate-300">
                        <button onClick={() => setShowUnranked(v => !v)} aria-expanded={showUnranked} className="w-full py-2 text-[10px] md:text-xs font-black uppercase tracking-tight text-slate-500 hover:bg-slate-100">
                          {showUnranked ? '▾' : '▸'} {MIN_RANKED_GAMES} oyun altı · sıralamaya girmez ({cards.filter(x => x.rank === null).length} kişi)
                        </button>
                      </td>
                    </tr>
                  )}
                  {(c.rank !== null || showUnranked) && <tr
                    role="button"
                    tabIndex={0}
                    title={`${c.name} oyunlarını göster`}
                    onClick={() => { setFilter({ key: personKey(c.name), name: c.name }); setView('games'); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setFilter({ key: personKey(c.name), name: c.name }); setView('games'); } }}
                    className="text-[11px] md:text-sm font-black text-slate-700 cursor-pointer hover:bg-indigo-50/60 active:bg-indigo-50"
                  >
                    <td className="py-1.5 pl-2 text-slate-400">{c.rank ?? ''}</td>
                    <td className="py-1.5 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-1 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <div className="min-w-0">
                          <div className="uppercase truncate tracking-tight">{c.name} <span className="text-slate-300">›</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 text-slate-400">{c.played}</td>
                    <td className={`py-1 ${c.rank !== null ? 'text-indigo-700' : 'text-slate-400'}`}>
                      <div className="leading-tight">{c.avgPoints.toFixed(2)}</div>
                      <div className="text-[8px] md:text-[10px] font-bold text-slate-300 leading-tight">{c.points}</div>
                    </td>
                    {Array.from({ length: placeCols }, (_, i) => (
                      <td key={i} className={`py-1.5 ${i === 0 && c.places[0] ? 'text-[#006100] bg-[#c6efce]/50' : ''} ${c.places[i] ? '' : 'text-slate-200'}`}>{c.places[i] ?? 0}</td>
                    ))}
                  </tr>}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {cards.length === 0 && <div className="py-8 text-center text-slate-300 text-xs font-bold uppercase italic">Arşivde oyun yok</div>}
          </div>
        )}
        {view === 'cards' && cards.length > 0 && (
          <div className="text-[10px] md:text-xs font-bold text-slate-400 space-y-1 px-1">
            <p className="text-center">Oyuncuya dokun: hangi oyunlardan oluştuğunu gör.</p>
            <p>
              <b className="text-slate-500">Sıralama nasıl yapılır?</b> Her oyunda 1. {PLACE_POINTS[0]}, 2. {PLACE_POINTS[1]}, 3. {PLACE_POINTS[2]} puan alır; 4. ve sonrası 0.
              Eşit bitirenler aynı puanı alır. Sıra, <b className="text-slate-500">oyun başına ortalama puana</b> göredir (büyük sayı); altındaki küçük sayı toplam puandır.
              Sadece en az {MIN_RANKED_GAMES} oyun oynayanlar sıralanır, diğerleri çizginin altında görünür.
            </p>
          </div>
        )}
        {view === 'games' && filter && (
          <div className="flex items-center justify-between gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <span className="text-[11px] md:text-xs font-black uppercase tracking-tight text-indigo-700 truncate">
              {filter.name} oyunları · {shownItems.length}
            </span>
            <button onClick={() => setFilter(null)} className="shrink-0 h-7 px-2 rounded-md bg-white border border-indigo-200 text-indigo-600 text-[10px] font-black uppercase">✕ Tümü</button>
          </div>
        )}
        {view === 'games' && shownItems.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold uppercase italic">Arşivde oyun yok</div>
        )}
        {view === 'games' && shownItems.map(item => {
          const sorted = [...item.players].sort((a, b) => a.total - b.total);
          const places = placesFromTotals(item.players);
          return (
            <button key={item.id} onClick={() => open(item.id)} className="w-full text-left bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md active:scale-[0.99] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-tight">{formatDate(item.closedAt, item.roomCode)}</span>
                <span className="text-[9px] font-black text-slate-300 uppercase">{item.roomCode}</span>
              </div>
              <div className={`grid gap-1 ${item.players.length <= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {sorted.map(p => (
                  <div key={p.id} className={`rounded-md px-1 py-1 text-center border-b-2 ${filter && personKey(p.name) === filter.key ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'bg-slate-50'}`} style={{ borderColor: p.color }}>
                    <div className="text-[9px] md:text-[11px] font-black uppercase truncate text-slate-700">{placeEmoji(places[p.id], places)} {p.name}</div>
                    <div className="text-[11px] md:text-sm font-black text-slate-500">{p.total}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // --- Detay ---
  const loaded = game && game.id === selectedId ? game : null;
  const table = draft ?? loaded;
  const editing = draft !== null;

  const setScore = (rIdx: number, playerId: string, value: string) => {
    if (!draft) return;
    const parsed = parseScoreInput(value);
    setDraft({
      ...draft,
      rounds: draft.rounds.map((r, i) => (i === rIdx ? { ...r, scores: { ...r.scores, [playerId]: parsed as number | null } } : r)),
    });
  };
  const setName = (playerId: string, name: string) => {
    if (!draft) return;
    setDraft({ ...draft, players: draft.players.map(p => (p.id === playerId ? { ...p, name } : p)) });
  };
  const addRound = () => {
    if (!draft || draft.rounds.length >= MAX_ROUNDS) return;
    const scores = Object.fromEntries(draft.players.map(p => [p.id, null]));
    setDraft({ ...draft, rounds: [...draft.rounds, { round: draft.rounds.length + 1, scores }] });
  };
  const removeRound = () => {
    if (draft && draft.rounds.length > 0) setDraft({ ...draft, rounds: draft.rounds.slice(0, -1) });
  };

  return (
    <div className="p-1.5 md:p-3 flex flex-col flex-1 gap-3 overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between px-1 shrink-0 gap-2">
        <button onClick={() => { setSelectedId(null); setDraft(null); }} className="text-[10px] md:text-xs font-black text-indigo-600 uppercase">‹ Arşiv</button>
        <span className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight truncate">{loaded ? formatDate(loaded.closedAt, loaded.roomCode) : ''}</span>
        <div className="flex items-center gap-1">
          {!editing && canEdit && (
            <button onClick={() => setConfirm('delete')} disabled={!loaded} className="h-7 md:h-9 px-2 rounded-md border border-red-200 bg-red-50 text-red-600 text-[9px] md:text-[10px] font-black uppercase disabled:opacity-30">Sil</button>
          )}
          {!editing && canEdit && (
            <button onClick={() => setConfirm('edit')} disabled={!loaded || pendingPin !== null} className="h-7 md:h-9 px-2 rounded-md bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase disabled:opacity-30">Düzenle</button>
          )}
          {editing && (
            <>
              <div className="flex bg-slate-900 rounded-md gap-0.5 items-center px-2 h-7 md:h-9">
                <button onClick={addRound} className="text-white text-xs font-bold p-0.5">+</button>
                <span className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter">Round</span>
                <button onClick={removeRound} className="text-white text-xs font-bold p-0.5">-</button>
              </div>
              <button onClick={() => setDraft(null)} className="h-7 md:h-9 px-2 rounded-md border border-slate-200 text-slate-500 text-[9px] md:text-[10px] font-black uppercase">İptal</button>
              <button onClick={() => setConfirm('save')} disabled={saving} className="h-7 md:h-9 px-2 rounded-md bg-indigo-600 text-white text-[9px] md:text-[10px] font-black uppercase disabled:opacity-40">{saving ? '...' : 'Kaydet'}</button>
            </>
          )}
        </div>
      </div>

      {!table ? (
        <div className="flex-1 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">Yükleniyor…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shrink-0">
          <table className="w-full text-left border-collapse min-w-[280px]">
            <thead className="bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-100">
                <th className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black text-slate-400 uppercase w-10 md:w-20 tracking-tighter">Rnd</th>
                {table.players.map(p => (
                  <th key={p.id} className="py-1 md:py-2.5 text-center">
                    <input type="text" value={p.name} readOnly={!editing} onChange={e => setName(p.id, e.target.value)} maxLength={MAX_NAME_LEN} className="text-[9px] md:text-sm font-black text-center bg-transparent border-0 focus:ring-0 w-full truncate uppercase tracking-tighter" style={{ color: p.color }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {table.rounds.map((r, rIdx) => (
                <tr key={rIdx}>
                  <td className="py-0.5 md:py-2 px-2 text-[8px] md:text-[10px] font-black text-slate-300">R{r.round}</td>
                  {table.players.map(p => (
                    <td key={p.id} className="p-0.5 md:p-1">
                      <input {...scoreInputProps} value={scoreValue(r.scores[p.id])} readOnly={!editing} onChange={e => setScore(rIdx, p.id, e.target.value)} className={`${SCORE_INPUT_CLASS} w-full border-0 rounded-md py-1 md:py-2 text-center font-black ${scoreTextClass(r.scores[p.id])} text-[11px] md:text-base transition-all ${editing ? 'bg-amber-50 focus:bg-white focus:ring-1 focus:ring-amber-300' : 'bg-slate-50/50'}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white">
              <tr>
                <td className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Total</td>
                {table.players.map(p => (
                  <td key={p.id} className="py-1 md:py-2.5 text-center text-[11px] md:text-xl font-black">{totalOf(table.rounds, p.id)}</td>
                ))}
              </tr>
              {hasAnyScore(table.rounds) && (() => {
                const places = placesOf(table.players, table.rounds);
                return (
                  <tr className="bg-slate-800">
                    <td className="py-1 md:py-2 px-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest">SCR</td>
                    {table.players.map(p => (
                      <td key={p.id} className="py-1 md:py-2 text-center text-sm md:text-xl leading-none">{placeEmoji(places[p.id], places)}</td>
                    ))}
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}

      {table && (
        <>
          <GameCharts players={table.players} rounds={table.rounds} idPrefix="arsiv" show="ranking" />
          <GapPanel players={table.players} rounds={table.rounds} embedded />
          <GameCharts players={table.players} rounds={table.rounds} idPrefix="arsiv" show="trend" />
        </>
      )}

      <ConfirmDialog
        open={confirm === 'edit'}
        title="Arşivden çıkar"
        message="Bu oyun arşivden çıkarılıp düzenlemeye açılacak. Emin misin?"
        confirmLabel="Evet, düzenle"
        askPin="Arşiv PIN'i"
        onCancel={() => setConfirm(null)}
        onConfirm={pin => {
          setConfirm(null);
          if (loaded && onUnlock(pin)) setPendingPin(pin);
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Oyunu sil"
        message="Bu oyun arşivden kalıcı olarak silinecek ve karne yeniden hesaplanacak. Emin misin?"
        confirmLabel="Evet, sil"
        danger
        askPin="Arşiv PIN'i"
        onCancel={() => setConfirm(null)}
        onConfirm={pin => {
          setConfirm(null);
          if (selectedId) onDelete(selectedId, pin);
        }}
      />
      <ConfirmDialog
        open={confirm === 'save'}
        title="Kaydet"
        message="Değişiklikler arşivdeki bu oyuna kaydedilecek. Emin misin?"
        confirmLabel="Evet, kaydet"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (draft && selectedId && editPin && onSave(selectedId, draft.players, draft.rounds, editPin)) setSaving(true);
        }}
      />
    </div>
  );
};
