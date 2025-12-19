
import { Player, RoundScore } from './types';

export const DEFAULT_PLAYER_COUNT = 4;
export const DEFAULT_ROUND_COUNT = 11;

export const getInitialPlayers = (): Player[] => [
  { id: 'p1', name: 'P1', color: '#6366f1' },
  { id: 'p2', name: 'P2', color: '#10b981' },
  { id: 'p3', name: 'P3', color: '#f59e0b' },
  { id: 'p4', name: 'P4', color: '#ef4444' }
];

export const getInitialRounds = (players: Player[]): RoundScore[] => {
  return Array.from({ length: DEFAULT_ROUND_COUNT }, (_, i) => ({
    round: i + 1,
    scores: players.reduce((acc, p) => ({ ...acc, [p.id]: null }), {})
  }));
};
