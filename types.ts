
export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface RoundScore {
  round: number;
  scores: Record<string, number | null>; // playerId: score
}

export interface PlayerStats {
  id: string;
  name: string;
  totalScore: number;
  rank: number;
  wins: number;
  lastRoundRank: number;
}

export interface MatchRecord {
  id: string;
  timestamp: string;
  players: Player[];
  finalScores: Record<string, number>;
}
