// Ortak görünüm kuralları (canlı tablo ve arşiv aynı renkleri kullanır)

// -100 soluk kırmızı, -200 (ve altı) koyu kırmızı
export const scoreTextClass = (v: unknown) =>
  v === -100 ? 'text-red-400' : typeof v === 'number' && v <= -200 ? 'text-red-700' : 'text-slate-800';

// "25 EKİM 2026" (büyük harf CSS ile; sayfa dili tr olduğu için İ doğru çıkar)
export const formatDay = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

// Ses birimi. Telefon ses çalmak için bir dokunuş ister ve izni parmak kalkınca verir (dokunuşun başında değil);
// ekran kilitlenince / uygulamadan çıkınca ses birimi yeniden uyur. Bu yüzden her dokunuşta, parmak kalkınca da
// uyandırılır ve sessiz bir ses çalınarak açık tutulur. Süre bitince uyuyorsa önce uyandırılır, sonra çalınır.
let audio: AudioContext | null = null;
const ensureAudio = () => {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state !== 'running') void audio.resume().catch(() => {});
  } catch { /* ses desteklenmiyor */ }
};
const unlockAudio = () => {
  ensureAudio();
  if (!audio) return;
  try {
    // sessiz kısa ses: iPhone ses birimini ancak dokunuş içinde bir şey çalınınca açar
    const src = audio.createBufferSource();
    src.buffer = audio.createBuffer(1, 1, 22050);
    src.connect(audio.destination);
    src.start(0);
  } catch { /* yok say */ }
};
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(ev, unlockAudio, { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ensureAudio(); });
  // iPhone (iOS 17+): sessiz tuşu açıkken de zil çalsın
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch { /* desteklenmiyor */ }
}

// Ses birimi uyuyorsa önce uyandır, sonra çal (uyurken kurulan sesler hiç duyulmayabiliyordu)
const whenAudioReady = (play: (ctx: AudioContext) => void) => {
  ensureAudio();
  if (!audio) return;
  const ctx = audio;
  if (ctx.state === 'running') play(ctx);
  else ctx.resume().then(() => play(ctx)).catch(() => {});
};

export const playChime = () => whenAudioReady(audio => {
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
});

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

// Süre bitti zili: inen "vah vah" tonları (başarısızlık sesi) + titreşim
export const playFail = () => {
  navigator.vibrate?.([300, 120, 300, 120, 600]);
  whenAudioReady(playFailTones);
};
const playFailTones = (audio: AudioContext) => {
  const t = audio.currentTime;
  const notes: [number, number, number][] = [[392, 0, 0.32], [370, 0.36, 0.32], [349, 0.72, 0.32], [311, 1.08, 0.9]];
  for (const [freq, at, len] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t + at);
    if (len > 0.5) {
      // son notada titreme
      const lfo = audio.createOscillator();
      const lfoGain = audio.createGain();
      lfo.frequency.value = 6;
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(t + at);
      lfo.stop(t + at + len);
    }
    gain.gain.setValueAtTime(0.0001, t + at);
    gain.gain.exponentialRampToValueAtTime(0.22, t + at + 0.03);
    gain.gain.setValueAtTime(0.22, t + at + len - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + at);
    osc.stop(t + at + len + 0.02);
  }
};
