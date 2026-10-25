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
  title: string | null;               // masa adı; null ise ekranda bugünün tarihi görünür
  pinSet: boolean;                    // masa şifresi konmuş mu (şifrenin kendisi gönderilmez)
  myRequest: string | null;           // bu cihazın onay bekleyen katılma isteği (yazdığı isim)
  requests: JoinRequestView[];        // onay bekleyen istekler (sadece masadakilere dolu gelir)
  game: GameState;
  occupied: Record<string, boolean>; // playerId -> sandalye dolu mu
  mySeat: string | null;             // bu istemcinin oturduğu playerId
  isAdmin: boolean;                  // odayı kuran mı (artık ek yetki vermez, bilgi amaçlı)
  canUndo: boolean;
  canRedo: boolean;
  viewers: number;                   // bağlı cihaz sayısı
  online: { name: string | null; me: boolean }[]; // bağlı cihazlar: masadaysa oyuncu ismi, değilse null (izleyici)
  ack: number;                       // bu oturumdan işlenen son op seq'i
}

export interface JoinRequestView {
  id: string;
  name: string;
  target: string; // nereye oturacağı: "KETENCİ sandalyesi", "boş sandalye", "yer yok"
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
  | { t: 'join'; name: string; pin?: string }
  | { t: 'cancelJoin' }
  | { t: 'approve'; id: string }
  | { t: 'reject'; id: string }
  | { t: 'setPin'; pin: string | null }
  | { t: 'leave' }
  | { t: 'setTitle'; title: string | null }
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
  | { type: 'archive:unlock'; pin: string }
  | { type: 'archive:update'; id: string; players: Player[]; rounds: RoundScore[]; pin: string }
  | { type: 'archive:delete'; id: string; pin: string }
  | { type: 'archive:restore'; id: string; pin: string };

export type ServerMsg =
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; seq?: number }
  | { type: 'pong' }
  | { type: 'archive:list'; items: ArchiveSummary[] }
  | { type: 'archive:game'; game: ArchivedGame }
  | { type: 'archive:saved'; id: string }
  | { type: 'archive:deleted'; id: string }
  | { type: 'archive:unlocked' }
  | { type: 'archive:restored'; id: string };
