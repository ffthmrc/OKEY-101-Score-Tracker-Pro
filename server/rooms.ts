// Oda mantığı: sandalyeler, katılma onayı + masa şifresi, yetki (masaya oturan her şeyi yapar, oturmayan izler), ortak geri al/ileri al geçmişi. Ağdan bağımsızdır (test edilebilir).
import type { ArchivedGame, GameState, JoinRequestView, RoomOp, RoomView } from '../shared/protocol.ts';
import { applyGameOp, cleanName, hasAnyScore, MAX_PLAYERS, MAX_TITLE_LEN, tidyTable } from '../shared/game.ts';
import { getInitialPlayers, getInitialRounds, PLAYER_COLORS } from '../constants.ts';
import { personKey } from '../shared/stats.ts';

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1500; // aynı hücreye art arda yazılan tuşlar tek geri-al adımı sayılır

export const ROOM_CODE_RE = /^[A-Z0-9]{3,16}$/;

// Adı henüz yazılmamış sandalye: P1, P2, ... (yeni gelen sadece bunlara oturur, yazılmış isme geçemez)
const isUnnamed = (name: string) => /^P\d+$/i.test(name.trim());

const PIN_RE = /^\d{4,6}$/;
const PIN_MAX_FAILS = 5;       // bu kadar yanlış şifreden sonra
const PIN_LOCK_MS = 60_000;    // 1 dakika bekletilir

interface JoinRequest { id: string; clientId: string; name: string }

// Bu kadar süre bağlı olmayan cihaz masadan kendiliğinden kalkar (süre son bağlantıdan sayılır)
export const SEAT_IDLE_MS = 6 * 3600_000;

export interface RoomData {
  code: string;
  adminClientId: string | null;
  title?: string | null; // masa adı (boşsa ekranda bugünün tarihi)
  pin?: string | null;   // masa şifresi (katılırken sorulur; istemciye gönderilmez)
  lastSeen?: Record<string, number>; // clientId -> son bağlı olduğu an (ms); sunucu yeniden başlasa da korunur
  createdAt: string;
  updatedAt: string;
  game: GameState;
  seats: Record<string, string[]>; // playerId -> o sandalyedeki cihazlar (aynı kişi telefon + PC)
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
  // Masa açma PIN'i: masada bağlı kimse yokken ilk gelen bunu girer (sunucu ortamından, OPEN_PIN). Boşsa istenmez.
  static openPin = '';

  data: RoomData;
  version = 0;
  private history: GameState[];
  private index = 0;
  private lastEdit: { key: string; at: number } | null = null;
  private requests: JoinRequest[] = [];            // onay bekleyen katılma istekleri (bellekte)
  private pinFails = new Map<string, { n: number; until: number }>();

  constructor(data: RoomData) {
    // Eski kayıtlarda sandalye tek cihazdı (string | null); diziye çevir
    const seats: Record<string, string[]> = {};
    for (const [pid, v] of Object.entries(data.seats as Record<string, unknown>)) {
      seats[pid] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : [];
    }
    this.data = { ...data, seats, lastSeen: data.lastSeen ?? {} };
    this.history = [data.game];
    // Son görülme kaydı olmayan oturan cihazlara bugünden süre başlat
    const now = Date.now();
    for (const devices of Object.values(seats)) for (const id of devices) this.data.lastSeen![id] ??= now;
  }

  // Bağlı cihazların son görülme anını günceller
  markSeen(clientIds: string[], now = Date.now()) {
    for (const id of clientIds) this.data.lastSeen![id] = now;
  }

  // SEAT_IDLE_MS'den uzun süredir bağlı olmayan cihazları masadan kaldırır. Değişiklik olduysa true.
  expireSeats(connected: Set<string>, now = Date.now(), idleMs = SEAT_IDLE_MS): boolean {
    const lastSeen = this.data.lastSeen!;
    let changed = false;
    for (const [pid, devices] of Object.entries(this.data.seats)) {
      const keep = devices.filter(id => connected.has(id) || (lastSeen[id] ?? 0) > now - idleMs);
      if (keep.length !== devices.length) {
        this.data.seats[pid] = keep;
        changed = true;
      }
    }
    // 30 günden eski kayıtları unut
    for (const [id, t] of Object.entries(lastSeen)) if (t < now - 30 * 86400_000) delete lastSeen[id];
    if (changed) this.touch();
    return changed;
  }

  static create(code: string, adminClientId: string, now = new Date()): Room {
    const game = freshGame(undefined, now);
    return new Room({
      code,
      adminClientId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      game,
      seats: Object.fromEntries(game.players.map(p => [p.id, []])),
    });
  }

  seatOf(clientId: string): string | null {
    for (const [playerId, devices] of Object.entries(this.data.seats)) {
      if (devices.includes(clientId)) return playerId;
    }
    return null;
  }

  isAdmin(clientId: string) {
    return this.data.adminClientId === clientId;
  }

  // Bir isimle oturma kuralı:
  // 1) isim masada varsa o sandalye (aynı kişi başka cihazdan da), 2) yoksa adı yazılmamış boş sandalye, 3) yoksa yer yok
  private seatTarget(name: string): { playerId: string; rename: boolean } | null {
    const { game, seats } = this.data;
    const own = game.players.find(p => personKey(p.name) === personKey(name));
    if (own) return { playerId: own.id, rename: false };
    const free = game.players.find(p => isUnnamed(p.name) && seats[p.id].length === 0);
    return free ? { playerId: free.id, rename: true } : null;
  }

  private seat(clientId: string, name: string): OpResult {
    const target = this.seatTarget(name);
    if (!target) return { ok: false, error: 'Masada boş yer yok. Masadaki biri + Player ile yer açabilir.' };
    const { seats } = this.data;
    seats[target.playerId] = [...seats[target.playerId], clientId];
    if (target.rename) {
      // İsim değişikliği geri-al geçmişine girmez; mevcut adımda da güncellenir
      const named = applyGameOp(this.data.game, { t: 'setName', playerId: target.playerId, name })!;
      this.history[this.index] = named;
      this.setGame(named);
    } else {
      this.touch();
    }
    return { ok: true };
  }

  // Bağlantısı kopan cihazın bekleyen isteği silinir
  dropRequests(clientId: string) {
    const before = this.requests.length;
    this.requests = this.requests.filter(r => r.clientId !== clientId);
    if (this.requests.length !== before) this.touch();
  }

  // onlineIds: odaya şu an bağlı cihazlar. Masada bağlı kimse yoksa katılma onaysız olur (onaylayacak kimse yok).
  apply(clientId: string, op: RoomOp, now = Date.now(), onlineIds: string[] = []): OpResult {
    const { game, seats } = this.data;
    const seated = this.seatOf(clientId) !== null;

    switch (op.t) {
      case 'join': {
        const name = cleanName(op.name)?.trim();
        if (!name) return { ok: false, error: 'İsim gerekli' };
        if (seated) return { ok: true };
        const fail = this.pinFails.get(clientId);
        if (fail && fail.until > now) return { ok: false, error: 'Çok fazla yanlış şifre. 1 dakika sonra tekrar dene.' };
        const wrong = (error: string): OpResult => {
          const n = (fail?.n ?? 0) + 1;
          this.pinFails.set(clientId, n >= PIN_MAX_FAILS ? { n: 0, until: now + PIN_LOCK_MS } : { n, until: 0 });
          return { ok: false, error };
        };
        if (this.data.pin && op.pin !== this.data.pin) return wrong('Masa şifresi yanlış');
        const approverOnline = onlineIds.some(id => id !== clientId && this.seatOf(id) !== null);
        if (!approverOnline) {
          // Onaylayacak kimse yok: masayı ancak masa açma PIN'ini bilen açar, sonra gelenleri o onaylar
          if (Room.openPin && op.openPin !== Room.openPin) {
            return wrong(op.openPin ? 'Masa açma PIN\'i yanlış' : 'Masada kimse yok. Masayı açmak için masa açma PIN\'i gerekli.');
          }
          this.pinFails.delete(clientId);
          return this.seat(clientId, name);
        }
        this.pinFails.delete(clientId);
        const existing = this.requests.find(r => r.clientId === clientId);
        if (existing) existing.name = name;
        else this.requests.push({ id: globalThis.crypto.randomUUID(), clientId, name });
        this.touch();
        return { ok: true };
      }
      case 'cancelJoin': {
        this.dropRequests(clientId);
        return { ok: true };
      }
      case 'leave': {
        const playerId = this.seatOf(clientId);
        if (playerId) seats[playerId] = seats[playerId].filter(id => id !== clientId);
        this.touch();
        return { ok: true };
      }
      case 'vacate': {
        if (!seated) return { ok: false, error: 'Sandalye boşaltmak için önce masaya katıl' };
        if (!(op.playerId in seats)) return { ok: false, error: 'Oyuncu yok' };
        seats[op.playerId] = [];
        this.touch();
        return { ok: true };
      }
    }

    if (!seated) return { ok: false, error: 'Düzenlemek için önce masaya katıl' };

    switch (op.t) {
      case 'approve': {
        const req = this.requests.find(r => r.id === op.id);
        if (!req) return { ok: false, error: 'İstek artık yok' };
        if (this.seatOf(req.clientId)) {
          this.requests = this.requests.filter(r => r !== req);
          this.touch();
          return { ok: true };
        }
        const result = this.seat(req.clientId, req.name);
        if (!result.ok) return { ok: false, error: `${req.name} için masada yer yok. Önce + Player ile yer aç.` };
        this.requests = this.requests.filter(r => r !== req);
        return { ok: true };
      }
      case 'reject': {
        const before = this.requests.length;
        this.requests = this.requests.filter(r => r.id !== op.id);
        if (this.requests.length !== before) this.touch();
        return { ok: true };
      }
      case 'setPin': {
        if (op.pin !== null && (typeof op.pin !== 'string' || !PIN_RE.test(op.pin))) {
          return { ok: false, error: 'Şifre 4-6 rakam olmalı' };
        }
        this.data.pin = op.pin;
        this.touch();
        return { ok: true };
      }
      case 'setTitle': {
        // Geri-al geçmişine girmez; boş bırakılırsa tarihe döner
        const raw = typeof op.title === 'string' ? op.title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_TITLE_LEN) : '';
        this.data.title = raw || null;
        this.touch();
        return { ok: true };
      }
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
        if (game.players.length >= MAX_PLAYERS) return { ok: false, error: `En fazla ${MAX_PLAYERS} oyuncu` };
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
          ...tidyTable(game.players, game.rounds),
        };
        const next = freshGame(game.players, new Date(now));
        this.history = [next];
        this.index = 0;
        this.lastEdit = null;
        // Oyun gecesi bitti: herkes masadan kalkar, kapatanın sandalyesi (tüm cihazlarıyla) kalır ki gelenleri onaylayabilsin
        const closerSeat = this.seatOf(clientId);
        for (const pid of Object.keys(seats)) if (pid !== closerSeat) seats[pid] = [];
        this.setGame(next);
        return { ok: true, archived };
      }
    }
    return { ok: false, error: 'Bilinmeyen işlem' };
  }

  // onlineClientIds: odaya bağlı cihazlar (aynı cihazın birden çok sekmesi tek sayılır)
  view(clientId: string, ack: number, onlineClientIds: string[]): RoomView {
    const { code, game, seats } = this.data;
    const unique = [...new Set(onlineClientIds)];
    const online = unique
      .map(id => {
        const seat = this.seatOf(id);
        return { name: seat ? game.players.find(p => p.id === seat)?.name ?? null : null, me: id === clientId };
      })
      .sort((a, b) => Number(b.me) - Number(a.me) || Number(b.name !== null) - Number(a.name !== null));
    return {
      code,
      version: this.version,
      title: this.data.title ?? null,
      pinSet: !!this.data.pin,
      needsOpenPin: !!Room.openPin && !unique.some(id => id !== clientId && this.seatOf(id) !== null),
      myRequest: this.requests.find(r => r.clientId === clientId)?.name ?? null,
      requests: this.seatOf(clientId) ? this.requests.map(r => this.requestView(r)) : [],
      game,
      occupied: Object.fromEntries(game.players.map(p => [p.id, (seats[p.id] ?? []).length > 0])),
      mySeat: this.seatOf(clientId),
      isAdmin: this.isAdmin(clientId),
      canUndo: this.index > 0,
      canRedo: this.index < this.history.length - 1,
      viewers: unique.length,
      online,
      ack,
    };
  }

  private requestView(r: JoinRequest): JoinRequestView {
    const target = this.seatTarget(r.name);
    const player = target && this.data.game.players.find(p => p.id === target.playerId);
    return {
      id: r.id,
      name: r.name,
      target: !target ? 'yer yok' : target.rename ? 'boş sandalye' : `${player?.name ?? ''} sandalyesi`,
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
    const seats: Record<string, string[]> = {};
    for (const p of game.players) seats[p.id] = this.data.seats[p.id] ?? [];
    this.data.game = game;
    this.data.seats = seats;
    this.touch();
  }

  private touch() {
    this.version++;
    this.data.updatedAt = new Date().toISOString();
  }
}
