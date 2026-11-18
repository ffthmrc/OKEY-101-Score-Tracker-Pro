// Oyuncu renkleri ada göre: dört sabit oyuncunun kendi rengi var, her ekranda (tablo, grafik, arşiv, lig) aynı.
// Diğerleri (misafir, henüz adı girilmemiş P1…) sabit renklerden uzak ayrı bir sıradan alır.
import { CORE_PLAYERS, personKey } from './shared/stats';

// CORE_PLAYERS sırasıyla: Fatih kırmızı, Ketenci yeşil, Hasan sarı, Zeki lacivert
const CORE_COLORS = ['#dc2626', '#16a34a', '#eab308', '#1e3a8a'];
export const CORE_COLOR: Record<string, string> = Object.fromEntries(CORE_PLAYERS.map((n, i) => [personKey(n), CORE_COLORS[i]]));

// Misafirler: mor, pembe, gri, kahverengi, camgöbeği (kırmızı/yeşil/sarı/laciverte benzemez)
const GUEST_COLORS = ['#9333ea', '#db2777', '#64748b', '#92400e', '#06b6d4'];

export const colorOfName = (name: string): string | undefined => CORE_COLOR[personKey(name)];

// Masadaki sıraya göre misafirlere sırayla renk verilir (aynı masada iki misafir aynı rengi almaz)
export const playerColors = <T extends { name: string; color: string }>(players: T[]): T[] => {
  let g = 0;
  return players.map(p => ({ ...p, color: colorOfName(p.name) ?? GUEST_COLORS[g++ % GUEST_COLORS.length] }));
};
