import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from './rooms.ts';

const setup = () => Room.create('TEST1', 'admin');

test('katılan ilk adsız sandalyeye oturur, masa 4 kişide dolar', () => {
  const room = setup();
  for (const [i, c] of ['a', 'b', 'c', 'd'].entries()) {
    assert.deepEqual(room.apply(c, { t: 'join', name: c.toUpperCase() }), { ok: true });
    assert.equal(room.seatOf(c), `p${i + 1}`);
  }
  assert.equal(room.data.game.players[2].name, 'C');
  assert.equal(room.apply('e', { t: 'join', name: 'E' }).ok, false);
});

test('yazılmış isme geçemez; kendi ismini yazan o sandalyeye oturur; + Player ile P5 açılır', () => {
  const room = setup();
  room.apply('fatih-tel', { t: 'join', name: 'Fatih' });
  room.apply('fatih-tel', { t: 'setName', playerId: 'p2', name: 'Ketenci' });
  room.apply('fatih-tel', { t: 'setName', playerId: 'p3', name: 'Zeki' });
  room.apply('fatih-tel', { t: 'setName', playerId: 'p4', name: 'Hasan' });
  // aynı kişi PC'den: kendi sandalyesine, Ketenci'nin adı bozulmaz
  assert.equal(room.apply('fatih-pc', { t: 'join', name: 'FATİH' }).ok, true);
  assert.equal(room.seatOf('fatih-pc'), 'p1');
  assert.equal(room.seatOf('fatih-tel'), 'p1');
  assert.equal(room.data.game.players[1].name, 'Ketenci');
  // Ketenci kendi adıyla katılır
  assert.equal(room.apply('ketenci', { t: 'join', name: 'ketenci' }).ok, true);
  assert.equal(room.seatOf('ketenci'), 'p2');
  // yabancı: yer yok
  const r = room.apply('ali', { t: 'join', name: 'Ali' });
  assert.equal(r.ok, false);
  // masadaki biri yer açar, Ali P5'e oturur
  room.apply('fatih-pc', { t: 'addPlayer' }, 1000);
  assert.equal(room.apply('ali', { t: 'join', name: 'Ali' }).ok, true);
  assert.equal(room.seatOf('ali'), 'p-1000');
  assert.equal(room.data.game.players[4].name, 'Ali');
  // bir cihaz ayrılınca diğeri sandalyede kalır
  room.apply('fatih-tel', { t: 'leave' });
  assert.equal(room.seatOf('fatih-tel'), null);
  assert.equal(room.view('x', 0, []).occupied.p1, true);
});

test('eski kayıt biçimi (sandalye = tek cihaz) yüklenir', () => {
  const old = Room.create('ESKI', 'a');
  const data = { ...old.data, seats: { p1: 'a', p2: null, p3: null, p4: null } as any };
  const room = new Room(data);
  assert.equal(room.seatOf('a'), 'p1');
  assert.deepEqual(room.data.seats.p2, []);
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
  assert.equal(room.seatOf('c'), 'p3'); // ALI'nin sandalyesi adlı, yeni gelen sıradaki adsız sandalyeye
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
  assert.deepEqual(room.data.seats['p-1000'], []);
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

test('masa adı: oturan değiştirir, boş bırakılırsa tarihe döner, izleyici değiştiremez', () => {
  const room = setup();
  assert.equal(room.apply('x', { t: 'setTitle', title: 'Cuma Masası' }).ok, false);
  room.apply('a', { t: 'join', name: 'A' });
  assert.equal(room.apply('a', { t: 'setTitle', title: '  Cuma Masası  ' }).ok, true);
  assert.equal(room.view('a', 0, []).title, 'Cuma Masası');
  room.apply('a', { t: 'setTitle', title: '   ' });
  assert.equal(room.view('a', 0, []).title, null);
});

test('katılma onayı: masada bağlı biri varsa istek bekler; onaylanınca oturur, reddedilince düşer', () => {
  const room = setup();
  room.apply('fatih', { t: 'join', name: 'Fatih' }, 0, ['fatih']);   // masa boş: onaysız
  assert.equal(room.seatOf('fatih'), 'p1');
  room.apply('fatih', { t: 'setName', playerId: 'p3', name: 'Zeki' });
  // sahte Zeki: onay bekler
  assert.equal(room.apply('sahte', { t: 'join', name: 'Zeki' }, 0, ['fatih', 'sahte']).ok, true);
  assert.equal(room.seatOf('sahte'), null);
  assert.equal(room.view('sahte', 0, []).myRequest, 'Zeki');
  assert.deepEqual(room.view('sahte', 0, []).requests, []);           // izleyici istek listesini görmez
  const req = room.view('fatih', 0, []).requests[0];
  assert.equal(req.target, 'Zeki sandalyesi');
  room.apply('fatih', { t: 'reject', id: req.id });
  assert.equal(room.view('sahte', 0, []).myRequest, null);
  assert.equal(room.seatOf('sahte'), null);
  // gerçek Zeki: onaylanır
  room.apply('zeki', { t: 'join', name: 'zeki' }, 0, ['fatih', 'zeki']);
  room.apply('fatih', { t: 'approve', id: room.view('fatih', 0, []).requests[0].id });
  assert.equal(room.seatOf('zeki'), 'p3');
  // izleyici onaylayamaz
  room.apply('ali', { t: 'join', name: 'Ali' }, 0, ['fatih', 'ali']);
  assert.equal(room.apply('veli', { t: 'approve', id: room.view('fatih', 0, []).requests[0].id }).ok, false);
  // bağlantısı kopan isteği düşer
  room.dropRequests('ali');
  assert.deepEqual(room.view('fatih', 0, []).requests, []);
});

test('masa şifresi: yanlışta istek açılmaz, 5 yanlıştan sonra kilit, doğruysa onaya düşer', () => {
  const room = setup();
  room.apply('fatih', { t: 'join', name: 'Fatih' }, 0, ['fatih']);
  assert.equal(room.apply('fatih', { t: 'setPin', pin: '12' }).ok, false);
  assert.equal(room.apply('fatih', { t: 'setPin', pin: '1923' }).ok, true);
  assert.equal(room.view('x', 0, []).pinSet, true);
  assert.equal(room.apply('ali', { t: 'join', name: 'Ali', pin: '0000' }, 0, ['fatih', 'ali']).ok, false);
  for (let i = 0; i < 4; i++) room.apply('ali', { t: 'join', name: 'Ali', pin: '0000' }, 0, ['fatih', 'ali']);
  const locked = room.apply('ali', { t: 'join', name: 'Ali', pin: '1923' }, 1000, ['fatih', 'ali']);
  assert.equal(locked.ok, false);
  assert.equal(room.apply('ali', { t: 'join', name: 'Ali', pin: '1923' }, 61_000, ['fatih', 'ali']).ok, true);
  assert.equal(room.view('ali', 0, []).myRequest, 'Ali');
  room.apply('fatih', { t: 'setPin', pin: null });
  assert.equal(room.view('x', 0, []).pinSet, false);
});

test('silinen oyuncunun sandalyesindeki cihaz yetkisini kaybeder', () => {
  const room = setup();
  room.apply('fatih', { t: 'join', name: 'Fatih' }, 0, ['fatih']);
  for (const [i, n] of ['Ketenci', 'Zeki', 'Hasan'].entries()) room.apply('fatih', { t: 'setName', playerId: `p${i + 2}`, name: n });
  room.apply('fatih', { t: 'addPlayer' }, 5000);
  room.apply('pc', { t: 'join', name: 'Zekeriya' }, 0, ['fatih', 'pc']);
  room.apply('fatih', { t: 'approve', id: room.view('fatih', 0, []).requests[0].id });
  assert.equal(room.seatOf('pc'), 'p-5000');
  room.apply('fatih', { t: 'removePlayer', playerId: 'p-5000' });
  assert.equal(room.seatOf('pc'), null);
  assert.equal(room.view('pc', 0, []).mySeat, null);
  assert.equal(room.apply('pc', { t: 'addPlayer' }).ok, false);
});
