// Oda durumunu sunucuyla senkron tutan hook.
// Skor/isim/tur işlemleri önce ekranda uygulanır (iyimser), sunucu onaylayınca bekleyen listeden düşer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArchivedGame, ArchiveSummary, GameOp, RoomOp, RoomView } from './shared/protocol';
import type { Player, RoundScore } from './types';
import { applyGameOp } from './shared/game';
import { getClientId, randomId, resolveRoomCode } from './clientId';
import { SyncClient, wsUrl, type ConnStatus } from './syncClient';

interface PendingOp { seq: number; op: RoomOp }

const OPTIMISTIC = new Set<RoomOp['t']>(['setScore', 'setName', 'addRound', 'removeRound']);

export function useRoom() {
  const [code] = useState(resolveRoomCode);
  const [clientId] = useState(getClientId);
  const [sid] = useState(() => randomId(8)); // sayfa oturumu: yeniden bağlanınca tekrar gönderilen op'ları ayırt eder
  const [room, setRoom] = useState<RoomView | null>(null);
  const [pending, setPending] = useState<PendingOp[]>([]);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [archiveItems, setArchiveItems] = useState<ArchiveSummary[]>([]);
  const [archiveGame, setArchiveGame] = useState<ArchivedGame | null>(null);
  const [archiveSavedId, setArchiveSavedId] = useState<string | null>(null);
  const [archiveDeletedId, setArchiveDeletedId] = useState<string | null>(null);
  const [archiveUnlockSeq, setArchiveUnlockSeq] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SyncClient | null>(null);
  const pendingRef = useRef<PendingOp[]>([]);
  const seqRef = useRef(0);

  const updatePending = useCallback((fn: (p: PendingOp[]) => PendingOp[]) => {
    pendingRef.current = fn(pendingRef.current);
    setPending(pendingRef.current);
  }, []);

  useEffect(() => {
    const client = new SyncClient(wsUrl(), {
      onOpen: () => {
        client.send({ type: 'hello', clientId, sid, room: code });
        for (const p of pendingRef.current) client.send({ type: 'op', seq: p.seq, op: p.op });
      },
      onStatus: setStatus,
      onMessage: msg => {
        switch (msg.type) {
          case 'state':
            setRoom(msg.room);
            updatePending(p => p.filter(x => x.seq > msg.room.ack));
            break;
          case 'error':
            setError(msg.message);
            break;
          case 'archive:list':
            setArchiveItems(msg.items);
            break;
          case 'archive:game':
            setArchiveGame(msg.game);
            break;
          case 'archive:saved':
            setArchiveSavedId(msg.id);
            break;
          case 'archive:deleted':
            setArchiveDeletedId(msg.id);
            break;
          case 'archive:unlocked':
            setArchiveUnlockSeq(n => n + 1);
            break;
        }
      },
    });
    clientRef.current = client;
    client.start();
    return () => client.stop();
  }, [code, clientId, sid, updatePending]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(timer);
  }, [error]);

  const sendOp = useCallback((op: RoomOp) => {
    const seq = ++seqRef.current;
    updatePending(p => [...p, { seq, op }]);
    clientRef.current?.send({ type: 'op', seq, op }); // bağlantı yoksa yeniden bağlanınca gönderilir
  }, [updatePending]);

  // Ekrandaki oyun = sunucu durumu + henüz onaylanmamış kendi işlemlerimiz
  const game = useMemo(() => {
    if (!room) return null;
    return pending.reduce(
      (g, p) => (OPTIMISTIC.has(p.op.t) ? applyGameOp(g, p.op as GameOp) ?? g : g),
      room.game
    );
  }, [room, pending]);

  const openArchiveGame = useCallback((id: string) => {
    setArchiveGame(null);
    clientRef.current?.send({ type: 'archive:get', id });
  }, []);

  const unlockArchive = useCallback((pin: string): boolean => {
    const sent = clientRef.current?.send({ type: 'archive:unlock', pin }) ?? false;
    if (!sent) setError('Bağlantı yok');
    return sent;
  }, []);

  const saveArchiveGame = useCallback((id: string, players: Player[], rounds: RoundScore[], pin: string): boolean => {
    setArchiveSavedId(null);
    const sent = clientRef.current?.send({ type: 'archive:update', id, players, rounds, pin }) ?? false;
    if (!sent) setError('Bağlantı yok, kaydedilemedi');
    return sent;
  }, []);

  const deleteArchiveGame = useCallback((id: string, pin: string): boolean => {
    setArchiveDeletedId(null);
    const sent = clientRef.current?.send({ type: 'archive:delete', id, pin }) ?? false;
    if (!sent) setError('Bağlantı yok, silinemedi');
    return sent;
  }, []);

  return {
    code, room, game, status, error, sendOp,
    archiveItems, archiveGame, archiveSavedId, archiveDeletedId, archiveUnlockSeq,
    openArchiveGame, unlockArchive, saveArchiveGame, deleteArchiveGame,
  };
}
