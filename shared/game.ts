// Oyun durumu üzerinde saf işlemler. İstemci (iyimser güncelleme) ve sunucu (asıl kayıt)
// aynı fonksiyonu kullanır; böylece iki taraf aynı sonucu üretir.
import type { Player, RoundScore } from '../types.ts';
import type { CellValue, GameOp, GameState } from './protocol.ts';

export const MAX_NAME_LEN = 8;
export const MAX_PLAYERS = 8;
export const MAX_ROUNDS = 60;
const MAX_ABS_SCORE = 99999;

export const cleanName = (name: unknown): string | null =>
  typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MAX_NAME_LEN) : null;

export const isCellValue = (v: unknown): v is CellValue =>
  v === null || v === '-' ||
  (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= MAX_ABS_SCORE);

// Skor kutusuna yazılan metni hücre değerine çevirir (yazarken tek başına '-' kalabilir)
export const parseScoreInput = (value: string): CellValue => {
  let sanitized = value.replace(/[^0-9-]/g, '');
  if (sanitized.indexOf('-', 1) !== -1) {
    sanitized = sanitized.charAt(0) + sanitized.slice(1).replace(/-/g, '');
  }
  if (sanitized === '') return null;
  if (sanitized === '-') return '-';
  return Math.max(-MAX_ABS_SCORE, Math.min(MAX_ABS_SCORE, parseInt(sanitized, 10)));
};

export const hasAnyScore =(rounds: RoundScore[]) =>
  rounds.some(r => Object.values(r.scores).some(v => typeof v === 'number'));

export const totalOf = (rounds: RoundScore[], playerId: string) =>
  rounds.reduce((sum, r) => {
    const v = r.scores[playerId];
    return sum + (typeof v === 'number' ? v : 0);
  }, 0);

// Toplama göre sıralama (düşük kazanır). Eşit toplam aynı sırayı paylaşır: 1, 2, 2, 4.
export const standings = (players: Player[], rounds: RoundScore[]) => {
  const rows = players
    .map(player => ({ player, total: totalOf(rounds, player.id) }))
    .sort((a, b) => a.total - b.total);
  return rows.map(r => ({ ...r, place: rows.findIndex(x => x.total === r.total) + 1 }));
};

// Geçersiz işlemde null döner (durum değişmez).
export function applyGameOp(game: GameState, op: GameOp): GameState | null {
  const { players, rounds } = game;
  switch (op.t) {
    case 'setScore': {
      if (!Number.isInteger(op.round) || op.round < 0 || op.round >= rounds.length) return null;
      if (!players.some(p => p.id === op.playerId) || !isCellValue(op.value)) return null;
      const newRounds = rounds.map((r, idx) =>
        idx === op.round ? { ...r, scores: { ...r.scores, [op.playerId]: op.value as number | null } } : r
      );
      return { ...game, rounds: newRounds };
    }
    case 'setName': {
      const name = cleanName(op.name);
      if (name === null || !players.some(p => p.id === op.playerId)) return null;
      return { ...game, players: players.map(p => (p.id === op.playerId ? { ...p, name } : p)) };
    }
    case 'addRound': {
      if (rounds.length >= MAX_ROUNDS) return null;
      const scores = Object.fromEntries(players.map(p => [p.id, null]));
      return { ...game, rounds: [...rounds, { round: rounds.length + 1, scores }] };
    }
    case 'removeRound': {
      if (rounds.length === 0) return null;
      return { ...game, rounds: rounds.slice(0, -1) };
    }
    default:
      return null;
  }
}

// Arşivden gelen tam tabloyu doğrular ve temizler.
export function sanitizeTable(players: unknown, rounds: unknown): { players: Player[]; rounds: RoundScore[] } | null {
  if (!Array.isArray(players) || !Array.isArray(rounds)) return null;
  if (players.length < 1 || players.length > MAX_PLAYERS || rounds.length > MAX_ROUNDS) return null;
  const cleanPlayers: Player[] = [];
  for (const p of players) {
    const name = cleanName(p?.name);
    if (typeof p?.id !== 'string' || typeof p?.color !== 'string' || name === null) return null;
    cleanPlayers.push({ id: p.id.slice(0, 40), name, color: p.color.slice(0, 20) });
  }
  const cleanRounds: RoundScore[] = [];
  for (const [i, r] of rounds.entries()) {
    const scores: Record<string, number | null> = {};
    for (const p of cleanPlayers) {
      const v = r?.scores?.[p.id];
      scores[p.id] = typeof v === 'number' && isCellValue(v) ? v : null;
    }
    cleanRounds.push({ round: i + 1, scores });
  }
  return { players: cleanPlayers, rounds: cleanRounds };
}
