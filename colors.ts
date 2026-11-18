// Oyuncu renkleri ada göre: dört sabit oyuncunun kendi rengi var, her ekranda (tablo, grafik, arşiv, lig) aynı.
// Diğerleri (misafir, henüz adı girilmemiş P1…) sabit renklerden uzak ayrı bir sıradan alır.
import { CORE_PLAYERS, personKey } from './shared/stats';

// CORE_PLAYERS sırasıyla: Fatih mavi, Ketenci yeşil, Hasan sarı, Zeki kırmızı
const CORE_COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626'];
export const CORE_COLOR: Record<string, string> = Object.fromEntries(CORE_PLAYERS.map((n, i) => [personKey(n), CORE_COLORS[i]]));

// Misafirler: mor, siyah, gri, kahverengi, pembe (mavi/yeşil/sarı/kırmızıya benzemez)
const GUEST_COLORS = ['#9333ea', '#111827', '#64748b', '#92400e', '#db2777'];

export const colorOfName = (name: string): string | undefined => CORE_COLOR[personKey(name)];

// Masadaki sıraya göre misafirlere sırayla renk verilir (aynı masada iki misafir aynı rengi almaz)
export const playerColors = <T extends { name: string; color: string }>(players: T[]): T[] => {
  let g = 0;
  return players.map(p => ({ ...p, color: colorOfName(p.name) ?? GUEST_COLORS[g++ % GUEST_COLORS.length] }));
};
