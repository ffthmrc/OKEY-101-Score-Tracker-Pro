// Oda mantığı: sandalyeler, yetki, ortak geri al/ileri al geçmişi. Ağdan bağımsızdır (test edilebilir).
import type { ArchivedGame, GameState, RoomOp, RoomView } from '../shared/protocol.ts';
import { applyGameOp, cleanName, hasAnyScore, MAX_PLAYERS } from '../shared/game.ts';
import { getInitialPlayers, getInitialRounds, PLAYER_COLORS } from '../constants.ts';

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1500; // aynı hücreye art arda yazılan tuşlar tek geri-al adımı sayılır

export const ROOM_CODE_RE = /^[A-Z0-9]{3,16}$/;

export interface RoomData {
  code: string;
  adminClientId: string | null;
  createdAt: string;
  updatedAt: string;
  game: GameState;
  seats: Record<string, string | null>; // playerId -> clientId
}

export type OpResult =
  | { ok: true; archived?: ArchivedGame }
  | { ok: false; error: string };

const freshGame = (players = getInitialPlayers(), now = new Date()): GameState => ({
  players,
  rounds: getInitialRounds(players),
  startedAt: now.toISOString(),
});

export class Room {
  data: RoomData;
  version = 0;
  private history: GameState[];
  private index = 0;
  private lastEdit: { key: string; at: number } | null = null;

  constructor(data: RoomData) {
    this.data = data;
    this.history = [data.game];
  }

  static create(code: string, adminClientId: string, now = new Date()): Room {
    const game = freshGame(undefined, now);
    return new Room({
      code,
      adminClientId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      game,
      seats: Object.fromEntries(game.players.map(p => [p.id, null])),
    });
  }

  seatOf(clientId: string): string | null {
    for (const [playerId, owner] of Object.entries(this.data.seats)) {
      if (owner === clientId) return playerId;
    }
    return null;
  }

  isAdmin(clientId: string) {
    return this.data.adminClientId === clientId;
  }

  apply(clientId: string, op: RoomOp, now = Date.now()): OpResult {
    const { game, seats } = this.data;
    const admin = this.isAdmin(clientId);
    const seated = this.seatOf(clientId) !== null;

    switch (op.t) {
      case 'join': {
        const name = cleanName(op.name)?.trim();
        if (!name) return { ok: false, error: 'İsim gerekli' };
        let playerId = this.seatOf(clientId);
        if (!playerId) {
          playerId = game.players.find(p => !seats[p.id])?.id ?? null;
          if (!playerId) return { ok: false, error: 'Masa dolu' };
          seats[playerId] = clientId;
        }
        // İsim değişikliği geri-al geçmişine girmez; mevcut adımda da güncellenir
        const named = applyGameOp(game, { t: 'setName', playerId, name })!;
        this.history[this.index] = named;
        this.setGame(named);
        return { ok: true };
      }
      case 'leave': {
        const playerId = this.seatOf(clientId);
        if (playerId) seats[playerId] = null;
        this.touch();
        return { ok: true };
      }
      case 'vacate': {
        if (!admin) return { ok: false, error: 'Sandalyeyi sadece odayı kuran boşaltabilir' };
        if (!(op.playerId in seats)) return { ok: false, error: 'Oyuncu yok' };
        seats[op.playerId] = null;
        this.touch();
        return { ok: true };
      }
    }

    if (!seated && !admin) return { ok: false, error: 'Düzenlemek için önce masaya katıl' };

    switch (op.t) {
      case 'setScore':
      case 'setName':
      case 'addRound':
      case 'removeRound': {
        const next = applyGameOp(game, op);
        if (!next) return { ok: false, error: 'Geçersiz işlem' };
        const key = op.t === 'setScore' ? `${clientId}:s:${op.round}:${op.playerId}`
          : op.t === 'setName' ? `${clientId}:n:${op.playerId}` : null;
        this.commit(next, key, now);
        return { ok: true };
      }
      case 'addPlayer': {
        if (!admin) return { ok: false, error: 'Oyuncuyu sadece odayı kuran ekleyebilir' };
        if (game.players.length >= MAX_PLAYERS) return { ok: false, error: 'En fazla 8 oyuncu' };
        const id = `p-${now}`;
        const player = { id, name: `P${game.players.length + 1}`, color: PLAYER_COLORS[game.players.length % PLAYER_COLORS.length] };
        this.commit({
          ...game,
          players: [...game.players, player],
          rounds: game.rounds.map(r => ({ ...r, scores: { ...r.scores, [id]: null } })),
        }, null, now);
        return { ok: true };
      }
      case 'removePlayer': {
        if (!admin) return { ok: false, error: 'Oyuncuyu sadece odayı kuran silebilir' };
        if (game.players.length <= 1) return { ok: false, error: 'En az bir oyuncu gerekli' };
        if (!game.players.some(p => p.id === op.playerId)) return { ok: false, error: 'Oyuncu yok' };
        this.commit({
          ...game,
          players: game.players.filter(p => p.id !== op.playerId),
          rounds: game.rounds.map(r => {
            const scores = { ...r.scores };
            delete scores[op.playerId];
            return { ...r, scores };
          }),
        }, null, now);
        return { ok: true };
      }
      case 'undo': {
        if (this.index === 0) return { ok: false, error: 'Geri alınacak adım yok' };
        this.index--;
        this.lastEdit = null;
        this.setGame(this.history[this.index]);
        return { ok: true };
      }
      case 'redo': {
        if (this.index >= this.history.length - 1) return { ok: false, error: 'İleri alınacak adım yok' };
        this.index++;
        this.lastEdit = null;
        this.setGame(this.history[this.index]);
        return { ok: true };
      }
      case 'newGame': {
        this.commit(freshGame(game.players, new Date(now)), null, now);
        return { ok: true };
      }
      case 'closeGame': {
        if (!hasAnyScore(game.rounds)) return { ok: false, error: 'Kapatılacak skor yok' };
        const closedAt = new Date(now).toISOString();
        const archived: ArchivedGame = {
          id: `${this.data.code}-${now}`,
          roomCode: this.data.code,
          startedAt: game.startedAt,
          closedAt,
          updatedAt: closedAt,
          players: game.players,
          rounds: game.rounds,
        };
        const next = freshGame(game.players, new Date(now));
        this.history = [next];
        this.index = 0;
        this.lastEdit = null;
        this.setGame(next);
        return { ok: true, archived };
      }
    }
    return { ok: false, error: 'Bilinmeyen işlem' };
  }

  view(clientId: string, ack: number, viewers: number): RoomView {
    const { code, game, seats } = this.data;
    return {
      code,
      version: this.version,
      game,
      occupied: Object.fromEntries(game.players.map(p => [p.id, !!seats[p.id]])),
      mySeat: this.seatOf(clientId),
      isAdmin: this.isAdmin(clientId),
      canUndo: this.index > 0,
      canRedo: this.index < this.history.length - 1,
      viewers,
      ack,
    };
  }

  private commit(next: GameState, key: string | null, now: number) {
    const last = this.lastEdit;
    const atTip = this.index === this.history.length - 1;
    if (key && last && last.key === key && now - last.at < COALESCE_MS && atTip && this.index > 0) {
      this.history[this.index] = next;
    } else {
      this.history = this.history.slice(0, this.index + 1);
      this.history.push(next);
      if (this.history.length > HISTORY_LIMIT) this.history.shift();
      this.index = this.history.length - 1;
    }
    this.lastEdit = key ? { key, at: now } : null;
    this.setGame(next);
  }

  // Oyuncu listesi değişince (ekle/sil/geri al) sandalyeleri oyunculara göre hizalar
  private setGame(game: GameState) {
    const seats: Record<string, string | null> = {};
    for (const p of game.players) seats[p.id] = this.data.seats[p.id] ?? null;
    this.data.game = game;
    this.data.seats = seats;
    this.touch();
  }

  private touch() {
    this.version++;
    this.data.updatedAt = new Date().toISOString();
  }
}
