// İstemci ile sunucu arasındaki ortak tipler.
// Sunucu bu dosyayı Node'un yerleşik TypeScript desteğiyle doğrudan çalıştırır:
// sadece silinebilir TS sözdizimi kullan (enum / namespace yok) ve tipleri `import type` ile al.
import type { Player, RoundScore } from '../types.ts';

// Hücre değeri: sayı, boş veya yazılırken geçici '-' (negatif sayı girişi)
export type CellValue = number | null | '-';

export interface GameState {
  players: Player[];
  rounds: RoundScore[];
  startedAt: string;
}

// Bir istemciye gönderilen oda görünümü (clientId'ler başkalarına sızdırılmaz)
export interface RoomView {
  code: string;
  version: number;
  game: GameState;
  occupied: Record<string, boolean>; // playerId -> sandalye dolu mu
  mySeat: string | null;             // bu istemcinin oturduğu playerId
  isAdmin: boolean;                  // odayı kuran mı
  canUndo: boolean;
  canRedo: boolean;
  viewers: number;                   // bağlı cihaz sayısı
  ack: number;                       // bu oturumdan işlenen son op seq'i
}

export type GameOp =
  | { t: 'setScore'; round: number; playerId: string; value: CellValue }
  | { t: 'setName'; playerId: string; name: string }
  | { t: 'addRound' }
  | { t: 'removeRound' };

export type RoomOp =
  | GameOp
  | { t: 'addPlayer' }
  | { t: 'removePlayer'; playerId: string }
  | { t: 'undo' }
  | { t: 'redo' }
  | { t: 'newGame' }
  | { t: 'closeGame' }
  | { t: 'join'; name: string }
  | { t: 'leave' }
  | { t: 'vacate'; playerId: string };

export interface ArchivedGame {
  id: string;
  roomCode: string;
  startedAt: string;
  closedAt: string;
  updatedAt: string;
  players: Player[];
  rounds: RoundScore[];
}

export interface ArchiveSummary {
  id: string;
  roomCode: string;
  closedAt: string;
  updatedAt: string;
  players: { id: string; name: string; color: string; total: number }[];
}

export type ClientMsg =
  | { type: 'hello'; clientId: string; sid: string; room: string }
  | { type: 'op'; seq: number; op: RoomOp }
  | { type: 'ping' }
  | { type: 'archive:list' }
  | { type: 'archive:get'; id: string }
  | { type: 'archive:update'; id: string; players: Player[]; rounds: RoundScore[] };

export type ServerMsg =
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; seq?: number }
  | { type: 'pong' }
  | { type: 'archive:list'; items: ArchiveSummary[] }
  | { type: 'archive:game'; game: ArchivedGame }
  | { type: 'archive:saved'; id: string };
