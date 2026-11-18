import React from 'react';

// Ortak görünüm (Tablo sekmesiyle aynı dil): bölüm başlığı normal harfle ve kalın, açıklamalar soluk,
// tablo başlığı lacivert, oyuncu adı yanında renk noktası (renk tek başına okunmayı zorlaştırmasın, sarı ad da okunsun).

export const SECTION_HEAD = 'flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100';
export const SECTION_TITLE = 'text-[15px] md:text-lg font-bold text-slate-900 tracking-tight';
export const SECTION_NOTE = 'text-[11px] md:text-xs font-semibold text-slate-400';
export const DARK_HEAD = 'bg-slate-900 text-white';
export const TH_LABEL = 'text-[10px] md:text-xs font-semibold text-slate-400';
export const CARD = 'bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden';

export const PlayerDot: React.FC<{ color: string; onDark?: boolean }> = ({ color, onDark }) => (
  <span className={`h-2 w-2 md:h-2.5 md:w-2.5 rounded-full shrink-0 ${onDark ? 'ring-1 ring-white/70' : 'ring-1 ring-black/10'}`} style={{ backgroundColor: color }} />
);

// Nokta + ad. center: sütun başlığında ortalı
export const PlayerTag: React.FC<{ color: string; name: React.ReactNode; onDark?: boolean; center?: boolean; className?: string }> = ({ color, name, onDark, center, className = '' }) => (
  <span className={`flex items-center gap-1 min-w-0 ${center ? 'justify-center' : ''} ${className}`}>
    <PlayerDot color={color} onDark={onDark} />
    <span className="truncate uppercase tracking-tight">{name}</span>
  </span>
);
