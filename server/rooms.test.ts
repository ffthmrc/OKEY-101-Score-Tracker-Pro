import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from './rooms.ts';

const setup = () => Room.create('TEST1', 'admin');

// Katıl; masada oturan biri varsa istek onaya düşer, masadakilerden biri onaylar
const sit = (room: Room, clientId: string, name: string) => {
  const r = room.apply(clientId, { t: 'join', name });
  if (!r.ok || room.seatOf(clientId)) return r;
  const approver = Object.values(room.data.seats).flat()[0];
  const req = room.view(approver, 0, []).requests.at(-1)!;
  return room.apply(approver, { t: 'approve', id: req.id });
};

test('katılan ilk adsız sandalyeye oturur, masa 4 kişide dolar', () => {
  const room = setup();
  for (const [i, c] of ['a', 'b', 'c', 'd'].entries()) {
    assert.deepEqual(sit(room, c, c.toUpperCase()), { ok: true });
    assert.equal(room.seatOf(c), `p${i + 1}`);
  }
  assert.equal(room.data.game.players[2].name, 'C');
  assert.equal(sit(room, 'e', 'E').ok, false);
});

test('yazılmış isme geçemez; kendi ismini yazan o sandalyeye oturur; + Player ile P5 açılır', () => {
  const room = setup();
  sit(room, 'fatih-tel', 'Fatih');
  room.apply('fatih-tel', { t: 'setName', playerId: 'p2', name: 'Ketenci' });
  room.apply('fatih-tel', { t: 'setName', playerId: 'p3', name: 'Zeki' });
  room.apply('fatih-tel', { t: 'setName', playerId: 'p4', name: 'Hasan' });
  // aynı kişi PC'den: kendi sandalyesine, Ketenci'nin adı bozulmaz
  assert.equal(sit(room, 'fatih-pc', 'FATİH').ok, true);
  assert.equal(room.seatOf('fatih-pc'), 'p1');
  assert.equal(room.seatOf('fatih-tel'), 'p1');
  assert.equal(room.data.game.players[1].name, 'Ketenci');
  // Ketenci kendi adıyla katılır
  assert.equal(sit(room, 'ketenci', 'ketenci').ok, true);
  assert.equal(room.seatOf('ketenci'), 'p2');
  // yabancı: yer yok
  const r = sit(room, 'ali', 'Ali');
  assert.equal(r.ok, false);
  // masadaki biri yer açar, Ali P5'e oturur
  room.apply('fatih-pc', { t: 'addPlayer' }, 1000);
  assert.equal(sit(room, 'ali', 'Ali').ok, true);
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
  sit(room, 'a', 'ALI');
  sit(room, 'b', 'VELI');
  sit(room, 'a', 'ALI');
  assert.equal(room.seatOf('a'), 'p1');
  room.apply('a', { t: 'leave' });
  assert.equal(room.seatOf('a'), null);
  sit(room, 'c', 'CAN');
  assert.equal(room.seatOf('c'), 'p3'); // ALI'nin sandalyesi adlı, yeni gelen sıradaki adsız sandalyeye
});

test('izleyici düzenleyemez, oturan herkes her şeyi yapabilir', () => {
  const room = setup();
  assert.equal(room.apply('x', { t: 'setScore', round: 0, playerId: 'p1', value: 5 }).ok, false);
  sit(room, 'b', 'B');
  assert.equal(room.apply('b', { t: 'setScore', round: 0, playerId: 'p3', value: 50 }).ok, true);
  assert.equal(room.data.game.rounds[0].scores.p3, 50);
  assert.equal(room.apply('b', { t: 'newGame' }).ok, true);
  assert.equal(room.data.game.rounds[0].scores.p3, null);
});

test('oyuncu ekle/sil ve sandalye boşaltma: oturan herkes yapar, izleyici (kurucu dahil) yapamaz', () => {
  const room = setup();
  assert.equal(room.apply('admin', { t: 'addPlayer' }).ok, false);
  sit(room, 'b', 'B');
  sit(room, 'c', 'C');
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
  sit(room, 'a', 'A');
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
  sit(room, 'a', 'ALI');
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
  sit(room, 'a', 'ABCDEFGHIJK');
  assert.equal(room.data.game.players[0].name, 'ABCDEFGH');
  assert.equal(room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: 1.5 as any }).ok, false);
  assert.equal(room.apply('a', { t: 'setScore', round: 99, playerId: 'p1', value: 1 }).ok, false);
  assert.equal(room.apply('a', { t: 'setScore', round: 0, playerId: 'p1', value: '-' }).ok, true);
});

test('bağlı cihaz listesi: masadakiler isimle, izleyiciler isimsiz, aynı cihaz tek sayılır', () => {
  const room = setup();
  sit(room, 'a', 'Fatih');
  const v = room.view('x', 0, ['x', 'a', 'y', 'a']);
  assert.equal(v.viewers, 3);
  assert.deepEqual(v.online, [{ name: null, me: true }, { name: 'Fatih', me: false }, { name: null, me: false }]);
});

test('masa adı: oturan değiştirir, boş bırakılırsa tarihe döner, izleyici değiştiremez', () => {
  const room = setup();
  assert.equal(room.apply('x', { t: 'setTitle', title: 'Cuma Masası' }).ok, false);
  sit(room, 'a', 'A');
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

test('Oyunu kapat: masadakiler kalkar, kapatanın sandalyesi (tüm cihazları) kalır', () => {
  const room = setup();
  sit(room, 'fatih-tel', 'Fatih');
  sit(room, 'fatih-pc', 'Fatih');
  sit(room, 'zeki', 'Zeki');
  room.apply('zeki', { t: 'setScore', round: 0, playerId: 'p2', value: 50 });
  assert.equal(room.apply('fatih-tel', { t: 'closeGame' }).ok, true);
  assert.equal(room.seatOf('fatih-tel'), 'p1');
  assert.equal(room.seatOf('fatih-pc'), 'p1');
  assert.equal(room.seatOf('zeki'), null);
  assert.equal(room.data.game.players[1].name, 'Zeki'); // isim kalır, tekrar katılınca aynı sandalye
});

test('New game masadakilere dokunmaz', () => {
  const room = setup();
  sit(room, 'a', 'A');
  sit(room, 'b', 'B');
  room.apply('a', { t: 'newGame' });
  assert.equal(room.seatOf('b'), 'p2');
});

test('6 saat bağlı olmayan cihaz kalkar; bağlı olan ya da yakında görülen kalır', () => {
  const room = setup();
  sit(room, 'a', 'A');
  sit(room, 'b', 'B');
  sit(room, 'c', 'C');
  const t0 = 1_000_000_000_000;
  room.markSeen(['a', 'b', 'c'], t0);
  room.markSeen(['c'], t0 + 5 * 3600_000);              // c 5 saat sonra da görüldü
  const after = t0 + 7 * 3600_000;
  assert.equal(room.expireSeats(new Set(['a']), after), true); // a şu an bağlı
  assert.equal(room.seatOf('a'), 'p1');
  assert.equal(room.seatOf('b'), null);
  assert.equal(room.seatOf('c'), 'p3');
  assert.equal(room.expireSeats(new Set(['a']), after), false);
});

test('masa açma PIN\'i: masada bağlı kimse yokken ilk gelen PIN ister; masada biri varsa onaya düşer', () => {
  Room.openPin = '9999';
  try {
    const room = setup();
    assert.equal(room.view('x', 0, ['x']).needsOpenPin, true);
    assert.equal(room.apply('yabanci', { t: 'join', name: 'Ali' }, 0, ['yabanci']).ok, false);
    assert.equal(room.apply('yabanci', { t: 'join', name: 'Ali', openPin: '1111' }, 0, ['yabanci']).ok, false);
    assert.equal(room.seatOf('yabanci'), null);
    assert.equal(room.apply('fatih', { t: 'join', name: 'Fatih', openPin: '9999' }, 0, ['fatih']).ok, true);
    assert.equal(room.seatOf('fatih'), 'p1');
    assert.equal(room.view('zeki', 0, ['fatih', 'zeki']).needsOpenPin, false);
    room.apply('zeki', { t: 'join', name: 'Zeki' }, 0, ['fatih', 'zeki']);   // PIN istenmez, onay bekler
    assert.equal(room.view('zeki', 0, []).myRequest, 'Zeki');
    // PC'den FATIH yazan kendi sandalyesine (onaydan sonra)
    room.apply('fatih-pc', { t: 'join', name: 'FATIH' }, 0, ['fatih', 'fatih-pc']);
    room.apply('fatih', { t: 'approve', id: room.view('fatih', 0, []).requests.find(r => r.name === 'FATIH')!.id });
    assert.equal(room.seatOf('fatih-pc'), 'p1');
  } finally {
    Room.openPin = '';
  }
});

test('masa açan telefonu kilitlese de sonra gelenlere masa açma PIN\'i sorulmaz, istek onaya düşer', () => {
  Room.openPin = '9999';
  try {
    const room = setup();
    room.apply('fatih', { t: 'join', name: 'Fatih', openPin: '9999' }, 0, ['fatih']);
    // Fatih'in telefonu kilitli: bağlı değil (onlineIds'de yok)
    const v = room.view('zeki', 0, ['zeki']);
    assert.equal(v.needsOpenPin, false);
    assert.equal(v.approversOnline, false);
    assert.equal(room.apply('zeki', { t: 'join', name: 'Zeki' }, 0, ['zeki']).ok, true);
    assert.equal(room.view('zeki', 0, []).myRequest, 'Zeki');
    // Fatih telefonu açınca isteği görür ve onaylar
    room.apply('fatih', { t: 'approve', id: room.view('fatih', 0, ['fatih', 'zeki']).requests[0].id });
    assert.equal(room.seatOf('zeki') !== null, true);
    // herkes kalkarsa masa yine PIN ister
    room.apply('fatih', { t: 'leave' });
    room.apply('zeki', { t: 'leave' });
    assert.equal(room.view('ali', 0, ['ali']).needsOpenPin, true);
  } finally {
    Room.openPin = '';
  }
});

test('ortak sayaç: masadakiler başlatır / oyun açtı / sıfırlar; izleyici dokunamaz; süreler sadece dururken değişir', () => {
  const room = setup();
  sit(room, 'fatih', 'Fatih');
  assert.equal(room.apply('izleyici', { t: 'timer', action: 'start' }).ok, false);
  assert.equal(room.apply('fatih', { t: 'timer', action: 'start' }, 1000).ok, true);
  let v = room.view('izleyici', 0, []).timer;
  assert.equal(v.phase, 'decide');
  assert.equal(v.decideEndsAt, 61_000);
  assert.equal(v.mine, false);
  assert.equal(room.view('fatih', 0, []).timer.mine, true);
  assert.equal(room.apply('fatih', { t: 'timerDurations', decideSec: 30, openSec: 60 }).ok, false); // çalışırken değişmez
  assert.equal(room.apply('fatih', { t: 'timer', action: 'open' }, 21_000).ok, true);
  v = room.view('x', 0, []).timer;
  assert.equal(v.phase, 'open');
  assert.equal(v.decideLeftMs, 40_000);
  assert.equal(v.openEndsAt, 141_000);
  assert.equal(room.apply('izleyici', { t: 'timer', action: 'reset' }).ok, false);
  room.apply('fatih', { t: 'timer', action: 'reset' });
  assert.equal(room.view('x', 0, []).timer.phase, 'idle');
  assert.equal(room.apply('fatih', { t: 'timerDurations', decideSec: 45, openSec: 90 }).ok, true);
  assert.equal(room.view('x', 0, []).timer.decideSec, 45);
  // süresi biten 1. sayaçta "oyun açtı" denemez
  room.apply('fatih', { t: 'timer', action: 'start' }, 0);
  assert.equal(room.apply('fatih', { t: 'timer', action: 'open' }, 50_000).ok, false);
});
