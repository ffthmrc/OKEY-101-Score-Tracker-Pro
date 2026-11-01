// Kişi karnesi: arşivdeki oyunlardan kim kaç kez oynadı, kaç kez 1./2./3./4. oldu, kaç puan topladı.
// Düşük toplam kazanır; eşit toplamlar aynı sırayı paylaşır (1, 2, 2, 4).
import type { ArchiveSummary } from './protocol.ts';

// Karne sadece ana dört kişinin hepsinin oynadığı oyunlardan çıkar. Misafir varsa yok sayılır,
// sıra dördü arasında verilir. Biri kalıcı değişirse bu listeden değiştirilir.
export const CORE_PLAYERS = ['Fatih', 'Ketenci', 'Hasan', 'Zeki'];
// Karne puanı: 1. = 4, 2. = 3, 3. = 2, 4. ve sonrası = 1 (eşit bitirenler aynı puanı alır)
export const PLACE_POINTS = [4, 3, 2, 1];
const pointsFor = (place: number) => PLACE_POINTS[place - 1] ?? PLACE_POINTS[PLACE_POINTS.length - 1];

export interface ReportCard {
  name: string;     // kişinin en son oyundaki yazımı
  color: string;
  played: number;
  places: number[]; // places[0] = 1.lik sayısı, places[1] = 2.lik ...
  last: number;     // en az 4 kişilik oyunlarda sonunculuk (💩)
  avgPlace: number;
  points: number;   // toplam karne puanı
  avgPoints: number; // oyun başına karne puanı
  rank: number | null; // sıralamadaki yeri; misafirlerde null
}

// Aynı kişi sayılanlar: "ali " / "ALİ", "Fatih" / "FATIH" / "Fatıh", "Yücer" / "Yucer", "Şaban" / "Saban"
// (büyük/küçük harf ve Türkçe harf farkı yok sayılır; aynı isimli iki kişi soyadıyla ayrılır)
const TR_FOLD: Record<string, string> = { 'İ': 'I', 'Ş': 'S', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C' };
export const personKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR').replace(/[İŞĞÜÖÇ]/g, ch => TR_FOLD[ch]);

const CORE_KEYS = new Set(CORE_PLAYERS.map(personKey));
export const isCorePlayer = (name: string) => CORE_KEYS.has(personKey(name));
// Ana dört kişinin hepsi oynamış mı (karneye sayılan oyun)
export const isCoreGame = (game: ArchiveSummary) => {
  const keys = new Set(game.players.map(p => personKey(p.name)));
  return [...CORE_KEYS].every(k => keys.has(k));
};

type CardAcc = ReportCard & { placeSum: number; lastSeen: string };

// Bir oyunun oyuncularını karta işler. Sıra ve 💩, sadece verilen oyuncular arasında hesaplanır.
function addGame(cards: Map<string, CardAcc>, game: ArchiveSummary, players: ArchiveSummary['players']) {
  const placeOf = (total: number) => 1 + players.filter(x => x.total < total).length;
  const worst = Math.max(...players.map(x => placeOf(x.total)));
  for (const p of players) {
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
    card.points += pointsFor(place);
    // ana ekrandaki 💩 kuralıyla aynı (shared/game.ts isLastPlace)
    if (players.length >= 4 && worst >= 3 && place === worst) card.last++;
    if (game.closedAt > card.lastSeen) { card.lastSeen = game.closedAt; card.color = p.color; card.name = p.name.trim(); }
  }
}

const finish = (cards: Map<string, CardAcc>): ReportCard[] =>
  [...cards.values()].map(({ placeSum, lastSeen, ...c }) => ({
    ...c,
    places: Array.from(c.places, v => v ?? 0),
    avgPlace: placeSum / c.played,
    avgPoints: c.points / c.played,
  }));

const byPoints = (a: ReportCard, b: ReportCard) => b.points - a.points || (b.places[0] ?? 0) - (a.places[0] ?? 0);

// Üstte ana dört kişi: hepsinin oynadığı oyunlar, misafirsiz sıra; toplam puana göre (eşitse birincilik).
// Altta misafirler: oynadıkları tüm oyunlar, gerçek sıra; sıralamaya girmez.
export function buildReportCards(items: ArchiveSummary[]): ReportCard[] {
  const core = new Map<string, CardAcc>();
  const guests = new Map<string, CardAcc>();
  for (const game of items) {
    if (isCoreGame(game)) addGame(core, game, game.players.filter(p => isCorePlayer(p.name)));
    addGame(guests, game, game.players);
  }
  for (const key of CORE_KEYS) guests.delete(key);
  const ranked = finish(core).sort(byPoints);
  let rank = 0;
  return [
    ...ranked.map((c, i) => {
      // eşit puan ve eşit birincilik aynı sırayı alır
      const prev = ranked[i - 1];
      rank = prev && byPoints(prev, c) === 0 ? rank : i + 1;
      return { ...c, rank };
    }),
    ...finish(guests).sort((a, b) => b.played - a.played || byPoints(a, b)).map(c => ({ ...c, rank: null })),
  ];
}
