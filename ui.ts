// Ortak görünüm kuralları (canlı tablo ve arşiv aynı renkleri kullanır)

// -100 soluk kırmızı, -200 (ve altı) koyu kırmızı
export const scoreTextClass = (v: unknown) =>
  v === -100 ? 'text-red-400' : typeof v === 'number' && v <= -200 ? 'text-red-700' : 'text-slate-800';

// "25 EKİM 2026" (büyük harf CSS ile; sayfa dili tr olduğu için İ doğru çıkar)
export const formatDay = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

// Katılma isteği bildirim sesi. iPhone ses çalmak için önce bir dokunuş ister: ilk dokunuşta ses birimi hazırlanır.
let audio: AudioContext | null = null;
const ensureAudio = () => {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
  } catch { /* ses desteklenmiyor */ }
};
if (typeof window !== 'undefined') window.addEventListener('pointerdown', ensureAudio, { passive: true });

export const playChime = () => {
  ensureAudio();
  if (!audio) return;
  const t = audio.currentTime;
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.32);
  }
  navigator.vibrate?.(150);
};

// Puan kutusu: telefonda "sayılar ve işaretler" klavyesi açılır (eksi işareti var, ABC ile harfe geçilir).
// Kutu sayı tipinde; "e", "+", "." gibi sayı dışı işaretler engellenir, tekerlek değeri değiştirmez.
export const scoreInputProps = {
  type: 'number',
  step: 1,
  onKeyDown: (e: { key: string; preventDefault: () => void }) => {
    if (['e', 'E', '+', '.', ','].includes(e.key)) e.preventDefault();
  },
  onWheel: (e: { currentTarget: HTMLInputElement }) => e.currentTarget.blur(),
} as const;

// Sayı kutusunun yukarı/aşağı oklarını gizler
export const SCORE_INPUT_CLASS = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// Kutuda sadece sayı gösterilir ('-' yazılırken tarayıcı kendisi tutar)
export const scoreValue = (v: unknown) => (typeof v === 'number' ? v : '');
