import React, { useEffect, useState } from 'react';
import type { ArchivedGame, ArchiveSummary } from './shared/protocol';
import type { Player, RoundScore } from './types';
import { parseScoreInput, totalOf, MAX_NAME_LEN, MAX_ROUNDS } from './shared/game';
import { ConfirmDialog } from './Dialogs';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface ArchivePanelProps {
  items: ArchiveSummary[];
  game: ArchivedGame | null;
  savedId: string | null;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onSave: (id: string, players: Player[], rounds: RoundScore[]) => boolean;
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({ items, game, savedId, canEdit, onOpen, onSave }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ players: Player[]; rounds: RoundScore[] } | null>(null);
  const [confirm, setConfirm] = useState<'edit' | 'save' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saving && savedId === selectedId) {
      setSaving(false);
      setDraft(null);
    }
  }, [saving, savedId, selectedId]);

  const open = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    onOpen(id);
  };

  // --- Liste ---
  if (!selectedId) {
    return (
      <div className="p-2 md:p-4 flex-1 overflow-auto custom-scrollbar space-y-2">
        {items.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold uppercase italic">Arşivde oyun yok</div>
        )}
        {items.map(item => {
          const sorted = [...item.players].sort((a, b) => a.total - b.total);
          return (
            <button key={item.id} onClick={() => open(item.id)} className="w-full text-left bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md active:scale-[0.99] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-tight">{formatDate(item.closedAt)}</span>
                <span className="text-[9px] font-black text-slate-300 uppercase">{item.roomCode}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {sorted.map((p, i) => (
                  <div key={p.id} className="rounded-md bg-slate-50 px-1 py-1 text-center border-b-2" style={{ borderColor: p.color }}>
                    <div className="text-[9px] md:text-[11px] font-black uppercase truncate text-slate-700">{i === 0 ? '🏆 ' : ''}{p.name}</div>
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
    <div className="p-1.5 md:p-3 flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between mb-1 px-1 shrink-0 gap-2">
        <button onClick={() => { setSelectedId(null); setDraft(null); }} className="text-[10px] md:text-xs font-black text-indigo-600 uppercase">‹ Arşiv</button>
        <span className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tight truncate">{loaded ? formatDate(loaded.closedAt) : ''}</span>
        <div className="flex items-center gap-1">
          {!editing && (
            <button onClick={() => setConfirm('edit')} disabled={!loaded || !canEdit} title={canEdit ? '' : 'Düzenlemek için masaya katıl'} className="h-7 md:h-9 px-2 rounded-md bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase disabled:opacity-30">Düzenle</button>
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
        <div className="overflow-auto rounded-lg border border-slate-100 flex-1 bg-white">
          <table className="w-full text-left border-collapse min-w-[280px]">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
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
                      <input type="text" value={r.scores[p.id] ?? ''} readOnly={!editing} onChange={e => setScore(rIdx, p.id, e.target.value)} className={`w-full border-0 rounded-md py-1 md:py-2 text-center font-black text-slate-800 text-[11px] md:text-base transition-all ${editing ? 'bg-amber-50 focus:bg-white focus:ring-1 focus:ring-amber-300' : 'bg-slate-50/50'}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-900 text-white z-20 shadow-lg">
              <tr>
                <td className="py-1 md:py-2.5 px-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Total</td>
                {table.players.map(p => (
                  <td key={p.id} className="py-1 md:py-2.5 text-center text-[11px] md:text-xl font-black">{totalOf(table.rounds, p.id)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'edit'}
        title="Arşivden çıkar"
        message="Bu oyun arşivden çıkarılıp düzenlemeye açılacak. Emin misin?"
        confirmLabel="Evet, düzenle"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (loaded) setDraft({ players: loaded.players, rounds: loaded.rounds });
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
          if (draft && selectedId && onSave(selectedId, draft.players, draft.rounds)) setSaving(true);
        }}
      />
    </div>
  );
};
