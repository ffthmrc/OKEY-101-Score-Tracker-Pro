
import type { Player, RoundScore } from './types';

export const DEFAULT_PLAYER_COUNT = 4;
export const DEFAULT_ROUND_COUNT = 11;

// Oyuncu renkleri sıraya göre, birbirine benzemeyen ana renkler:
// mavi, yeşil, sarı, kırmızı, mor, siyah (sonrakiler: turuncu, camgöbeği, kahverengi, pembe)
export const PLAYER_COLORS = [
  '#2563eb', '#16a34a', '#eab308', '#dc2626',
  '#9333ea', '#111827', '#f97316', '#06b6d4',
  '#92400e', '#ec4899'
];

// Ekranda renk ada göre verilir (colors.ts); buradaki renk yalnız kayıt içindir

export const getInitialPlayers = (): Player[] => [
  { id: 'p1', name: 'P1', color: PLAYER_COLORS[0] },
  { id: 'p2', name: 'P2', color: PLAYER_COLORS[1] },
  { id: 'p3', name: 'P3', color: PLAYER_COLORS[2] },
  { id: 'p4', name: 'P4', color: PLAYER_COLORS[3] }
];

export const getInitialRounds = (players: Player[]): RoundScore[] => {
  return Array.from({ length: DEFAULT_ROUND_COUNT }, (_, i) => ({
    round: i + 1,
    scores: players.reduce((acc, p) => ({ ...acc, [p.id]: null }), {})
  }));
};
