import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from './rooms.ts';

const setup = () => Room.create('TEST1', 'admin');

test('katılan ilk boş sandalyeye oturur, masa 4 kişide dolar', () => {
  const room = setup();
  for (const [i, c] of ['a', 'b', 'c', 'd'].entries()) {
    assert.deepEqual(room.apply(c, { t: 'join', name: c.toUpperCase() }), { ok: true });
    assert.equal(room.seatOf(c), `p${i + 1}`);
  }
  assert.equal(room.data.game.players[2].name, 'C');
  assert.deepEqual(room.apply('e', { t: 'join', name: 'E' }), { ok: false, error: 'Masa dolu' });
});

test('yeniden katılan aynı sandalyesine döner, ayrılınca sandalye boşalır', () => {
  const room = setup();
  room.apply('a', { t: 'join', name: 'ALI' });
  room.apply('b', { t: 'join', name: 'VELI' });
  room.apply('a', { t: 'join', name: 'ALI' });
  assert.equal(room.seatOf('a'), 'p1');
  room.apply('a', { t: 'leave' });
  assert.equal(room.seatOf('a'), null);
  room.apply('c', { t: 'join', name: 'CAN' });
  assert.equal(room.seatOf('c'), 'p1');
});

test('izleyici düzenleyemez, oturan herkes her şeyi yapabilir', () => {
  const room = setup();
  assert.equal(room.apply('x', { t: 'setScore', round: 0, playerId: 'p1', value: 5 }).ok, false);
  room.apply('b', { t: 'join', name: 'B' });
  assert.equal(room.apply('b', { t: 'setScore', round: 0, playerId: 'p3', value: 50 }).ok, true);
  assert.equal(room.data.game.rounds[0].scores.p3, 50);
  assert.equal(room.apply('b', { t: 'newGame' }).ok, true);
  assert.equal(room.data.game.rounds[0].scores.p3, null);
});

test('oyuncu ekle/sil ve sandalye boşaltma: oturan herkes yapar, izleyici (kurucu dahil) yapamaz', () => {
  const room = setup();
  assert.equal(room.apply('admin', { t: 'addPlayer' }).ok, false);
  room.apply('b', { t: 'join', name: 'B' });
  room.apply('c', { t: 'join', name: 'C' });
  assert.equal(room.apply('x', { t: 'vacate', playerId: 'p1' }).ok, false);
  assert.equal(room.apply('c', { t: 'vacate', playerId: 'p1' }).ok, true);
  assert.equal(room.seatOf('b'), null);
  assert.equal(room.apply('c', { t: 'addPlayer' }, 1000).ok, true);
  assert.equal(room.data.game.players.length, 5);
  assert.equal(room.data.seats['p-1000'], null);
  assert.equal(room.apply('c', { t: 'addPlayer' }, 2000).ok, true);
  assert.equal(room.apply('c', { t: 'addPlayer' }, 3000).ok, false); // en fazla 6
  assert.equal(room.apply('c', { t: 'removePlayer', playerId: 'p-1000' }).ok, true);
});

test('aynı hücreye art arda yazma tek geri-al adımı, geri al/ileri al çalışır', () => {
  const room = setup();
  room.apply('a', { t: 'join', name: 'A' });
  room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: 1 }, 1000);
  room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: 12 }, 1200);
  room.apply('a', { t: 'setScore', round: 1, playerId: 'p1', value: 7 }, 1400);
  room.apply('a', { t: 'undo' });
  assert.equal(room.data.game.rounds[1].scores.p1, null);
  assert.equal(room.data.game.rounds[0].scores.p1, 12);
  room.apply('a', { t: 'undo' });
  assert.equal(room.data.game.rounds[0].scores.p1, null);
  assert.equal(room.apply('a', { t: 'undo' }).ok, false);
  room.apply('a', { t: 'redo' });
  assert.equal(room.data.game.rounds[0].scores.p1, 12);
});

test('oyunu kapat skoru arşive verir ve yeni boş oyun açar, isimler kalır', () => {
  const room = setup();
  room.apply('a', { t: 'join', name: 'ALI' });
  assert.equal(room.apply('a', { t: 'closeGame' }).ok, false);
  room.apply('a', { t: 'setScore', round: 0, playerId: 'p2', value: -101 });
  const res = room.apply('a', { t: 'closeGame' }, 5000);
  assert.ok(res.ok && res.archived);
  assert.equal(res.archived.rounds[0].scores.p2, -101);
  assert.equal(room.data.game.rounds[0].scores.p2, null);
  assert.equal(room.data.game.players[0].name, 'ALI');
  assert.equal(room.view('a', 0, ['a']).canUndo, false);
});

test('geçersiz skor ve uzun isim reddedilir/kırpılır', () => {
  const room = setup();
  room.apply('a', { t: 'join', name: 'ABCDEFGHIJK' });
  assert.equal(room.data.game.players[0].name, 'ABCDEFGH');
  assert.equal(room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: 1.5 as any }).ok, false);
  assert.equal(room.apply('a', { t: 'setScore', round: 99, playerId: 'p1', value: 1 }).ok, false);
  assert.equal(room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: '-' }).ok, true);
});

test('bağlı cihaz listesi: masadakiler isimle, izleyiciler isimsiz, aynı cihaz tek sayılır', () => {
  const room = setup();
  room.apply('a', { t: 'join', name: 'Fatih' });
  const v = room.view('x', 0, ['x', 'a', 'y', 'a']);
  assert.equal(v.viewers, 3);
  assert.deepEqual(v.online, [{ name: null, me: true }, { name: 'Fatih', me: false }, { name: null, me: false }]);
});
