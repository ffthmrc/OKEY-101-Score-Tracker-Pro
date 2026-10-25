import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportCards } from './stats.ts';
import type { ArchiveSummary } from './protocol.ts';

const game = (closedAt: string, totals: Record<string, number>): ArchiveSummary => ({
  id: closedAt, roomCode: 'T', closedAt, updatedAt: closedAt,
  players: Object.entries(totals).map(([name, total], i) => ({ id: `p${i}`, name, color: '#000', total })),
});

test('sıralar sayılır, isimler büyük/küçük harften bağımsız birleşir', () => {
  const cards = buildReportCards([
    game('2026-01-01', { Ali: 100, Veli: 200, Can: 300, Cem: 400 }),
    game('2026-01-02', { ali: 500, Veli: 50, Can: 300, Cem: 400 }),
  ]);
  const ali = cards.find(c => c.name === 'ali')!; // son oyundaki yazımı gösterir
  assert.equal(ali.played, 2);
  assert.deepEqual(ali.places, [1, 0, 0, 1]);
  assert.equal(ali.last, 1);
  assert.deepEqual(cards.find(c => c.name === 'Cem')!.places, [0, 0, 1, 1]);
});

test('eşit toplam aynı sırayı paylaşır', () => {
  const cards = buildReportCards([game('2026-01-01', { A: 10, B: 20, C: 20, D: 30 })]);
  assert.deepEqual(cards.find(c => c.name === 'B')!.places, [0, 1]);
  assert.deepEqual(cards.find(c => c.name === 'C')!.places, [0, 1]);
  assert.deepEqual(cards.find(c => c.name === 'D')!.places, [0, 0, 0, 1]);
});

test('ana ekran sıralama yardımcıları: eşitlik, puansız oyuncu, 💩', async () => {
  const { placesOf, isLastPlace, tidyTable } = await import('./game.ts');
  const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, color: '#000' }));
  const rounds = [{ round: 1, scores: { a: 10, b: 50, c: 50, d: null } }, { round: 2, scores: { a: null, b: null, c: null, d: null } }];
  const places = placesOf(players, rounds);
  assert.deepEqual(places, { a: 1, b: 2, c: 2, d: null });
  assert.equal(isLastPlace(places.b, places), false); // sadece 3 sıralı oyuncu
  const p4 = placesOf(players, [{ round: 1, scores: { a: 10, b: 20, c: 30, d: 30 } }]);
  assert.equal(isLastPlace(p4.c, p4) && isLastPlace(p4.d, p4), true); // 3.lükte eşit sonuncular
  assert.equal(isLastPlace(1, placesOf(players, [{ round: 1, scores: { a: 0, b: 0, c: 0, d: 0 } }])), false);
  const tidy = tidyTable(players, [{ round: 1, scores: { a: 5, b: '-' as any, c: 7, d: null } }, rounds[1]]);
  assert.deepEqual(tidy.players.map(p => p.id), ['a', 'c']);
  assert.equal(tidy.rounds.length, 1);
});
