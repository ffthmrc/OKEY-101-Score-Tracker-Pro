// Kişi karnesi: arşivdeki oyunlardan kim kaç kez oynadı, kaç kez 1./2./3./4. oldu.
// Düşük toplam kazanır; eşit toplamlar aynı sırayı paylaşır (1, 2, 2, 4).
import type { ArchiveSummary } from './protocol.ts';

export interface ReportCard {
  name: string;     // kişinin en son oyundaki yazımı
  color: string;
  played: number;
  places: number[]; // places[0] = 1.lik sayısı, places[1] = 2.lik ...
  last: number;     // en az 4 kişilik oyunlarda sonunculuk (💩)
  avgPlace: number;
}

// "ali " ve "ALİ" aynı kişi sayılır
export const personKey = (name: string) => name.trim().toLocaleUpperCase('tr-TR');

export function buildReportCards(items: ArchiveSummary[]): ReportCard[] {
  const cards = new Map<string, ReportCard & { placeSum: number; lastSeen: string }>();
  for (const game of items) {
    const sorted = [...game.players].sort((a, b) => a.total - b.total);
    for (const p of game.players) {
      const key = personKey(p.name);
      if (!key) continue;
      const place = sorted.findIndex(s => s.total === p.total) + 1;
      let card = cards.get(key);
      if (!card) {
        card = { name: p.name.trim(), color: p.color, played: 0, places: [], last: 0, avgPlace: 0, placeSum: 0, lastSeen: '' };
        cards.set(key, card);
      }
      card.played++;
      card.placeSum += place;
      card.places[place - 1] = (card.places[place - 1] ?? 0) + 1;
      if (game.players.length >= 4 && p.total === sorted[sorted.length - 1].total) card.last++;
      if (game.closedAt > card.lastSeen) { card.lastSeen = game.closedAt; card.color = p.color; card.name = p.name.trim(); }
    }
  }
  return [...cards.values()]
    .map(({ placeSum, lastSeen, ...c }) => ({ ...c, places: Array.from(c.places, v => v ?? 0), avgPlace: placeSum / c.played }))
    .sort((a, b) => (b.places[0] ?? 0) - (a.places[0] ?? 0) || b.played - a.played || a.avgPlace - b.avgPlace);
}
