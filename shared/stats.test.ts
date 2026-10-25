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
