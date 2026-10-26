// Kişi karnesi: arşivdeki oyunlardan kim kaç kez oynadı, kaç kez 1./2./3./4. oldu, kaç puan topladı.
// Düşük toplam kazanır; eşit toplamlar aynı sırayı paylaşır (1, 2, 2, 4).
import type { ArchiveSummary } from './protocol.ts';

// Karne puanı: 1. = 3, 2. = 2, 3. = 1, sonrası 0 (eşit bitirenler aynı puanı alır)
export const PLACE_POINTS = [3, 2, 1];
// Sıralamaya girmek için gereken en az oyun sayısı (altındakiler karnede görünür ama sıra almaz)
export const MIN_RANKED_GAMES = 20;

export interface ReportCard {
  name: string;     // kişinin en son oyundaki yazımı
  color: string;
  played: number;
  places: number[]; // places[0] = 1.lik sayısı, places[1] = 2.lik ...
  last: number;     // en az 4 kişilik oyunlarda sonunculuk (💩)
  avgPlace: number;
  points: number;   // toplam karne puanı
  avgPoints: number; // oyun başına karne puanı (sıralama buna göre)
  rank: number | null; // sıralamadaki yeri; MIN_RANKED_GAMES altında null
}

// Aynı kişi sayılanlar: "ali " / "ALİ", "Fatih" / "FATIH" / "Fatıh", "Yücer" / "Yucer", "Şaban" / "Saban"
// (büyük/küçük harf ve Türkçe harf farkı yok sayılır; aynı isimli iki kişi soyadıyla ayrılır)
const TR_FOLD: Record<string, string> = { 'İ': 'I', 'Ş': 'S', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C' };
export const personKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR').replace(/[İŞĞÜÖÇ]/g, ch => TR_FOLD[ch]);

export function buildReportCards(items: ArchiveSummary[]): ReportCard[] {
  const cards = new Map<string, ReportCard & { placeSum: number; lastSeen: string }>();
  for (const game of items) {
    const placeOf = (total: number) => 1 + game.players.filter(x => x.total < total).length;
    const worst = Math.max(...game.players.map(x => placeOf(x.total)));
    for (const p of game.players) {
      const key = personKey(p.name);
      if (!key) continue;
      const place = placeOf(p.total);
      let card = cards.get(key);
      if (!card) {
        card = { name: p.name.trim(), color: p.color, played: 0, places: [], last: 0, avgPlace: 0, points: 0, avgPoints: 0, rank: null, placeSum: 0, lastSeen: '' };
        cards.set(key, card);
      }
      card.played++;
      card.placeSum += place;
      card.places[place - 1] = (card.places[place - 1] ?? 0) + 1;
      card.points += PLACE_POINTS[place - 1] ?? 0;
      // ana ekrandaki 💩 kuralıyla aynı (shared/game.ts isLastPlace)
      if (game.players.length >= 4 && worst >= 3 && place === worst) card.last++;
      if (game.closedAt > card.lastSeen) { card.lastSeen = game.closedAt; card.color = p.color; card.name = p.name.trim(); }
    }
  }
  // Önce barajı geçenler (oyun başına puan, eşitse toplam puan, sonra birincilik), sonra diğerleri aynı ölçüyle
  const sorted = [...cards.values()]
    .map(({ placeSum, lastSeen, ...c }) => ({
      ...c,
      places: Array.from(c.places, v => v ?? 0),
      avgPlace: placeSum / c.played,
      avgPoints: c.points / c.played,
    }))
    .sort((a, b) =>
      Number(b.played >= MIN_RANKED_GAMES) - Number(a.played >= MIN_RANKED_GAMES)
      || b.avgPoints - a.avgPoints
      || b.points - a.points
      || (b.places[0] ?? 0) - (a.places[0] ?? 0));
  let rank = 0;
  return sorted.map((c, i) => {
    if (c.played < MIN_RANKED_GAMES) return { ...c, rank: null };
    // eşit ortalama aynı sırayı alır
    const prev = sorted[i - 1];
    rank = prev && prev.played >= MIN_RANKED_GAMES && prev.avgPoints === c.avgPoints ? rank : i + 1;
    return { ...c, rank };
  });
}
