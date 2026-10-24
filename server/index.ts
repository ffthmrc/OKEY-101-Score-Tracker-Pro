// OKEY 101 oda sunucusu: dist/ klasörünü sunar ve /ws üzerinden canlı senkronu yönetir.
// Çalıştırma: node server/index.ts (Node >= 22.18, yerleşik TypeScript desteği)
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ArchiveSummary, ClientMsg, ServerMsg } from '../shared/protocol.ts';
import { sanitizeTable, totalOf } from '../shared/game.ts';
import { Room, ROOM_CODE_RE } from './rooms.ts';
import { JsonStore } from './store.ts';
import { getGameAnalysis } from './gemini.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '127.0.0.1';

const store = new JsonStore(DATA_DIR);
const rooms = new Map(store.loadRooms().map(d => [d.code, new Room(d)]));
const archive = store.loadArchive();
console.log(`${rooms.size} oda, ${archive.length} arşiv kaydı yüklendi (${DATA_DIR})`);

// --- HTTP ---

const app = express();
app.set('trust proxy', 'loopback');

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, connections: wss.clients.size });
});

const analysisHits = new Map<string, number[]>();
app.post('/api/analysis', express.json({ limit: '64kb' }), async (req, res) => {
  const ip = req.ip ?? '?';
  const now = Date.now();
  const hits = (analysisHits.get(ip) ?? []).filter(t => now - t < 60_000);
  if (hits.length >= 5) {
    res.status(429).json({ error: 'Çok fazla istek' });
    return;
  }
  analysisHits.set(ip, [...hits, now]);
  const table = sanitizeTable(req.body?.players, req.body?.rounds);
  if (!table) {
    res.status(400).json({ error: 'Geçersiz tablo' });
    return;
  }
  res.json({ text: await getGameAnalysis(table.players, table.rounds) });
});

app.use(express.static(DIST, {
  setHeaders(res, file) {
    if (file.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(DIST, 'index.html'), err => err && next());
});

const server = http.createServer(app);

// --- WebSocket ---

interface Conn {
  ws: WebSocket;
  clientId: string;
  sid: string;
  room: Room;
  alive: boolean;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const roomConns = new Map<string, Set<Conn>>();
const lastSeq = new Map<string, { seq: number; at: number }>(); // sid -> son işlenen op

const send = (ws: WebSocket, msg: ServerMsg) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

const sendState = (c: Conn, viewers: number) =>
  send(c.ws, { type: 'state', room: c.room.view(c.clientId, lastSeq.get(c.sid)?.seq ?? 0, viewers) });

const broadcastRoom = (room: Room) => {
  const set = roomConns.get(room.data.code);
  if (set) for (const c of set) sendState(c, set.size);
};

const summaries = (): ArchiveSummary[] =>
  archive
    .map(g => ({
      id: g.id,
      roomCode: g.roomCode,
      closedAt: g.closedAt,
      updatedAt: g.updatedAt,
      players: g.players.map(p => ({ id: p.id, name: p.name, color: p.color, total: totalOf(g.rounds, p.id) })),
    }))
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));

const broadcastArchive = () => {
  const msg: ServerMsg = { type: 'archive:list', items: summaries() };
  for (const ws of wss.clients) send(ws, msg);
};

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

wss.on('connection', ws => {
  let conn: Conn | null = null;
  const msgTimes: number[] = [];

  ws.on('pong', () => { if (conn) conn.alive = true; });

  ws.on('message', raw => {
    // Basit taşma koruması: saniyede 40'tan fazla mesaj atan bağlantıyı kapat
    const now = Date.now();
    msgTimes.push(now);
    while (msgTimes.length && now - msgTimes[0] > 1000) msgTimes.shift();
    if (msgTimes.length > 40) return ws.close(1008, 'rate limit');

    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      const code = typeof msg.room === 'string' ? msg.room.toUpperCase() : '';
      if (!isId(msg.clientId) || !isId(msg.sid) || !ROOM_CODE_RE.test(code)) {
        return send(ws, { type: 'error', message: 'Geçersiz oda kodu' });
      }
      if (conn) leaveRoom(conn);
      let room = rooms.get(code);
      if (!room) {
        room = Room.create(code, msg.clientId);
        rooms.set(code, room);
        store.saveRoom(room.data);
      }
      conn = { ws, clientId: msg.clientId, sid: msg.sid, room, alive: true };
      if (!roomConns.has(code)) roomConns.set(code, new Set());
      roomConns.get(code)!.add(conn);
      broadcastRoom(room);
      send(ws, { type: 'archive:list', items: summaries() });
      return;
    }

    if (msg.type === 'ping') return send(ws, { type: 'pong' });
    if (!conn) return send(ws, { type: 'error', message: 'Önce odaya bağlan' });
    const { room } = conn;

    switch (msg.type) {
      case 'op': {
        const prev = lastSeq.get(conn.sid)?.seq ?? 0;
        if (!Number.isInteger(msg.seq) || msg.seq <= prev) {
          // Yeniden bağlanınca tekrar gönderilmiş, zaten işlenmiş op
          return sendState(conn, roomConns.get(room.data.code)?.size ?? 1);
        }
        lastSeq.set(conn.sid, { seq: msg.seq, at: now });
        const result = msg.op && typeof msg.op === 'object'
          ? room.apply(conn.clientId, msg.op, now)
          : { ok: false as const, error: 'Geçersiz işlem' };
        if (result.ok === false) {
          send(ws, { type: 'error', message: result.error, seq: msg.seq });
          return sendState(conn, roomConns.get(room.data.code)?.size ?? 1);
        }
        store.saveRoom(room.data);
        if (result.archived) {
          archive.push(result.archived);
          store.saveArchive(archive);
          broadcastArchive();
        }
        return broadcastRoom(room);
      }
      case 'archive:list':
        return send(ws, { type: 'archive:list', items: summaries() });
      case 'archive:get': {
        const game = archive.find(g => g.id === msg.id);
        if (!game) return send(ws, { type: 'error', message: 'Arşiv kaydı bulunamadı' });
        return send(ws, { type: 'archive:game', game });
      }
      case 'archive:update': {
        if (!room.seatOf(conn.clientId) && !room.isAdmin(conn.clientId)) {
          return send(ws, { type: 'error', message: 'Arşivi düzenlemek için önce masaya katıl' });
        }
        const game = archive.find(g => g.id === msg.id);
        const table = sanitizeTable(msg.players, msg.rounds);
        if (!game || !table) return send(ws, { type: 'error', message: 'Arşiv kaydı kaydedilemedi' });
        Object.assign(game, table, { updatedAt: new Date(now).toISOString() });
        store.saveArchive(archive);
        send(ws, { type: 'archive:saved', id: game.id });
        send(ws, { type: 'archive:game', game });
        return broadcastArchive();
      }
    }
  });

  ws.on('close', () => { if (conn) leaveRoom(conn); });
});

function leaveRoom(c: Conn) {
  const set = roomConns.get(c.room.data.code);
  if (!set) return;
  set.delete(c);
  if (set.size === 0) roomConns.delete(c.room.data.code);
  else broadcastRoom(c.room);
}

// Ölü bağlantıları temizle, eski seq kayıtlarını unut
const heartbeat = setInterval(() => {
  for (const set of roomConns.values()) {
    for (const c of set) {
      if (!c.alive) { c.ws.terminate(); continue; }
      c.alive = false;
      c.ws.ping();
    }
  }
  const cutoff = Date.now() - 86400_000;
  for (const [sid, v] of lastSeq) if (v.at < cutoff) lastSeq.delete(sid);
}, 25_000);

server.listen(PORT, HOST, () => console.log(`OKEY sunucusu http://${HOST}:${PORT}`));

const shutdown = () => {
  clearInterval(heartbeat);
  store.flush();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
