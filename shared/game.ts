// Oyun durumu üzerinde saf işlemler. İstemci (iyimser güncelleme) ve sunucu (asıl kayıt)
// aynı fonksiyonu kullanır; böylece iki taraf aynı sonucu üretir.
import type { Player, RoundScore } from '../types.ts';
import type { CellValue, GameOp, GameState } from './protocol.ts';

export const MAX_NAME_LEN = 8;
export const MAX_PLAYERS = 6; // okey en fazla 6 kişiyle oynanır
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

export const hasPlayerScore = (rounds: RoundScore[], playerId: string) =>
  rounds.some(r => typeof r.scores[playerId] === 'number');

// Sıra (düşük toplam kazanır). Eşit toplam aynı sırayı paylaşır: 1, 2, 2, 4.
// Henüz hiç puanı olmayan oyuncu sıraya girmez (null) — 0 puanla "lider" görünmesin.
export const placesOf = (players: Player[], rounds: RoundScore[]): Record<string, number | null> => {
  const places = placesFromTotals(players
    .filter(p => hasPlayerScore(rounds, p.id))
    .map(p => ({ id: p.id, total: totalOf(rounds, p.id) })));
  for (const p of players) places[p.id] ??= null;
  return places;
};

export const placesFromTotals = (ranked: { id: string; total: number }[]): Record<string, number | null> =>
  Object.fromEntries(ranked.map(r => [r.id, 1 + ranked.filter(x => x.total < r.total).length]));

// 💩: en az 4 sıralı oyuncu varken en kötü sıra; sonuncular 3.lükte eşitse onlar da 💩 olur
export const isLastPlace = (place: number | null, places: Record<string, number | null>) => {
  const ranked = Object.values(places).filter((v): v is number => v !== null);
  const worst = Math.max(...ranked);
  return place !== null && ranked.length >= 4 && worst >= 3 && place === worst;
};

// Sıra rozeti: 1. 🏆, 2. 🥈, 3. 🥉, sonuncu 💩 (en az 4 kişide), aradakiler (5-6 kişide 4., 5.) 🏅
export const placeEmoji = (place: number | null, places: Record<string, number | null>) => {
  if (place === null) return '';
  if (place === 1) return '🏆';
  if (isLastPlace(place, places)) return '💩';
  return ['🥈', '🥉'][place - 2] ?? '🏅';
};

// Sıralı oyuncular, toplama göre artan
export const standings = (players: Player[], rounds: RoundScore[]) => {
  const places = placesOf(players, rounds);
  return players
    .filter(p => places[p.id] !== null)
    .map(player => ({ player, total: totalOf(rounds, player.id), place: places[player.id] as number }))
    .sort((a, b) => a.total - b.total);
};

// Kapanan/kaydedilen oyunu temizler: puanı hiç olmayan oyuncu, sondaki boş eller ve yarım '-' girişleri atılır
export const tidyTable = (players: Player[], rounds: RoundScore[]) => {
  const scored = players.filter(p => hasPlayerScore(rounds, p.id));
  const keep = scored.length > 0 ? scored : players;
  const clean = rounds.map(r => ({
    round: r.round,
    scores: Object.fromEntries(keep.map(p => [p.id, typeof r.scores[p.id] === 'number' ? r.scores[p.id] : null])),
  }));
  while (clean.length > 1 && keep.every(p => clean[clean.length - 1].scores[p.id] === null)) clean.pop();
  return { players: keep, rounds: clean as RoundScore[] };
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
  return tidyTable(cleanPlayers, cleanRounds);
}
