// Ortak görünüm kuralları (canlı tablo ve arşiv aynı renkleri kullanır)

// -100 soluk kırmızı, -200 (ve altı) koyu kırmızı
export const scoreTextClass = (v: unknown) =>
  v === -100 ? 'text-red-400' : typeof v === 'number' && v <= -200 ? 'text-red-700' : 'text-slate-800';

// "25 EKİM 2026" (büyük harf CSS ile; sayfa dili tr olduğu için İ doğru çıkar)
export const formatDay = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
