import React, { useEffect, useRef, useState } from 'react';
import type { TimerState } from './shared/protocol';
import { playFail, playTick, countdownTickOn } from './ui';

// Ortak hamle sayacı: sıra gelen oyuncu taş çeker; taş atar, açmışsa işler ya da elini açar: 1. sayaç (varsayılan 1 dk);
// oyuncu İLK KEZ açınca "Oyun açtı": 1. sayaç durur, işleyip taş atması için 2. sayaç (varsayılan 2 dk) başlar;
// 1. sayaçta kalan süre 2. sayaca eklenir (20. sn'de açtıysa 40 sn kalır: 2:00 + 0:40 = 2:40).
// "Sonraki": sıra yan oyuncuya geçince 1. sayaç baştan başlar (Sıfırla + Başlat yerine tek tuş).
// Durum sunucuda; herkes aynı sayacı görür, sadece masadakiler kullanır.
// Süre bitince zil sadece sayaca son dokunan telefonda çalar (masada 4 telefon birden çalmasın).
// Son 5 saniyede aynı telefonda her saniye kısa bip (☰ menüden kapatılabilir).

const STEP = 15;           // süre ayarı adımı (sn)
const MIN_SEC = 15;
const MAX_SEC = 300;

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Ekran sayaç çalışırken kapanmasın (destekleyen tarayıcılarda)
const useWakeLock = (on: boolean) => {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
      .wakeLock.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, [on]);
};

// Çalışan sayaç büyük, diğeri tek satır (ekrana sığsın, sayfa kaymasın).
// Yan çevrilmiş telefonda (phoneland) büyük sayaç sol sütunu doldurur.
const Clock: React.FC<{ label: string; ms: number; total: number; active: boolean; done: boolean; big: boolean; note?: string }> = ({ label, ms, total, active, done, big, note }) => {
  const warn = active && ms <= 10_000;
  const color = done ? 'text-red-600' : warn ? 'text-amber-500' : active ? 'text-slate-900' : 'text-slate-300';
  const bar = done ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500';
  const status = done ? <span className="text-red-600 shrink-0">Süre bitti</span> : note ? <span className="text-emerald-600 shrink-0">{note}</span> : null;
  if (!big) {
    return (
      <div className={`flex items-center justify-between gap-2 bg-white border rounded-xl px-3 py-1.5 ${done ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
        <span className="text-[10px] md:text-xs font-black uppercase tracking-tight text-slate-400 truncate">{label}</span>
        {status && <span className="text-[10px] font-black uppercase">{status}</span>}
        <span className={`text-2xl md:text-3xl font-black tabular-nums leading-none shrink-0 ${active ? color : 'text-slate-300'}`}>{fmt(ms)}</span>
      </div>
    );
  }
  return (
    <div className={`bg-white border rounded-2xl p-3 md:p-5 shadow-sm phoneland:flex-1 phoneland:flex phoneland:flex-col phoneland:justify-center ${done ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between gap-2 text-[10px] md:text-xs font-black uppercase tracking-tight text-slate-400">
        <span className="truncate">{label}</span>
        {status}
      </div>
      <div className={`text-center font-black tabular-nums leading-none text-[96px] md:text-[140px] phoneland:text-[110px] my-2 ${color}`}>{fmt(ms)}</div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bar} transition-[width] duration-200`} style={{ width: `${Math.max(0, Math.min(100, (ms / (total * 1000)) * 100))}%` }} />
      </div>
    </div>
  );
};

// Parmak ekrana değdiği an çalışan tuş. onClick parmak kalkınca ve hiç kaymadıysa çalışır;
// oyun sırasında hızlı dokunuşta parmak az kayınca tarayıcı bunu kaydırma sayıp tıklamayı yutuyordu.
// Kısa titreşim + parlama: basıldığı hemen anlaşılır (sunucu cevabını beklemeden). Çift tetiklemeye karşı 400 ms kilit.
export const TapButton: React.FC<{ onTap: () => void; disabled?: boolean; className: string; children: React.ReactNode }> = ({ onTap, disabled, className, children }) => {
  const last = useRef(0);
  const [flash, setFlash] = useState(false);
  const fire = () => {
    const t = Date.now();
    if (disabled || t - last.current < 400) return;
    last.current = t;
    navigator.vibrate?.(30);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    onTap();
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); fire(); }}
      onClick={e => { if (e.detail === 0) fire(); }} // klavye (Enter / boşluk)
      className={`${className} touch-none select-none font-black uppercase tracking-tight rounded-2xl transition-[filter,transform] duration-100 ${flash ? 'brightness-125 scale-[0.98]' : ''}`}
    >{children}</button>
  );
};

interface TimerPanelProps {
  timer: TimerState & { mine: boolean };
  serverOffset: React.MutableRefObject<number>;
  canControl: boolean;
  onAction: (action: 'start' | 'open' | 'reset') => void;
  onDurations: (decideSec: number, openSec: number) => void;
}

export const TimerPanel: React.FC<TimerPanelProps> = ({ timer, serverOffset, canControl, onAction, onDurations }) => {
  const { phase, decideSec, openSec } = timer;
  const [now, setNow] = useState(() => Date.now() + serverOffset.current);
  const rangFor = useRef<number | null>(null); // hangi bitiş anı için zil çaldı
  const tickedFor = useRef<string>(''); // hangi bitiş anının hangi saniyesi için bip çaldı

  useWakeLock(phase !== 'idle');

  // Sayaç çalışırken ekranı yenile (sunucu saatine göre)
  useEffect(() => {
    if (phase === 'idle') return;
    const tick = () => setNow(Date.now() + serverOffset.current);
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, serverOffset]);

  const decideLeft = phase === 'idle' ? decideSec * 1000
    : phase === 'decide' ? (timer.decideEndsAt ?? now) - now
    : 0; // kalan süre 2. sayaca aktarıldı
  const bonusMs = phase === 'open' ? timer.decideLeftMs ?? 0 : 0;
  const openLeft = phase === 'open' ? (timer.openEndsAt ?? now) - now : openSec * 1000;
  const decideDone = phase === 'decide' && decideLeft <= 0;
  const openDone = phase === 'open' && openLeft <= 0;

  // Zil: sadece sayaca son dokunan telefonda, her bitiş için bir kez
  const runningEnd = phase === 'decide' ? timer.decideEndsAt : phase === 'open' ? timer.openEndsAt : null;
  useEffect(() => {
    if (!timer.mine || runningEnd === null || !(decideDone || openDone)) return;
    if (rangFor.current === runningEnd) return;
    rangFor.current = runningEnd;
    // geç açılan sayfada eski bitiş için çalma (arka planda sayfa yavaşladıysa 30 sn'ye kadar yine çalar)
    if (now - runningEnd < 30_000) playFail();
  }, [timer.mine, runningEnd, decideDone, openDone, now]);

  // Son 5 saniye: her saniye bir kez "dit" (5-4-3-2-1), 0'da zil
  useEffect(() => {
    if (!timer.mine || runningEnd === null || !countdownTickOn()) return;
    const left = runningEnd - now;
    if (left <= 0 || left > 5000) return;
    const sec = Math.ceil(left / 1000);
    const key = `${runningEnd}:${sec}`;
    if (tickedFor.current === key) return;
    tickedFor.current = key;
    // saniyenin başında değilsek (sayfa arka plandan döndü) geç bip çalma
    if (sec * 1000 - left < 600) playTick(sec === 1);
  }, [timer.mine, runningEnd, now]);

  const adjust = (which: 0 | 1, delta: number) => {
    const clamp = (n: number) => Math.max(MIN_SEC, Math.min(MAX_SEC, n));
    if (which === 0) onDurations(clamp(decideSec + delta), openSec);
    else onDurations(decideSec, clamp(openSec + delta));
  };

  const stepper = (which: 0 | 1, label: string, sec: number) => (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{label}</span>
      <button onClick={() => adjust(which, -STEP)} className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-600" aria-label={`${label} azalt`}>−</button>
      <span className="w-10 text-center tabular-nums text-slate-700">{fmt(sec * 1000)}</span>
      <button onClick={() => adjust(which, STEP)} className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-600" aria-label={`${label} artır`}>+</button>
    </div>
  );

  const canOpen = phase === 'decide' && !decideDone;
  const B = 'text-slate-600';

  return (
    // Dikey: alt alta. Yan çevrilmiş telefon: tam ekran, solda sayaç, sağda tuşlar.
    <div className="p-2 md:p-4 flex-1 overflow-auto custom-scrollbar flex flex-col gap-2.5
      phoneland:fixed phoneland:inset-0 phoneland:z-[100] phoneland:bg-slate-50 phoneland:overflow-hidden phoneland:grid phoneland:grid-cols-[1.15fr_1fr] phoneland:gap-3 phoneland:p-3
      phoneland:pl-[max(12px,env(safe-area-inset-left))] phoneland:pr-[max(12px,env(safe-area-inset-right))] phoneland:pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-2 phoneland:min-h-0">
        <Clock label="1 · Taş çek, taş at, el aç" ms={decideLeft} total={decideSec} big={phase !== 'open'}
          active={phase === 'decide'} done={decideDone} />
        <Clock label="2 · Oyun açtı, işledi, taş at, bitti" ms={openLeft} total={openSec + bonusMs / 1000} big={phase === 'open'}
          active={phase === 'open'} done={openDone} note={bonusMs >= 1000 ? `+${fmt(bonusMs)} eklendi` : undefined} />
      </div>

      <div className="flex flex-col gap-2.5 phoneland:min-h-0">
        {canControl && phase === 'idle' && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] md:text-xs font-black uppercase tracking-tight">
              {stepper(0, '1. süre', decideSec)}
              {stepper(1, '2. süre', openSec)}
            </div>
            <TapButton onTap={() => onAction('start')} className="h-32 md:h-36 phoneland:h-auto phoneland:flex-1 text-2xl md:text-3xl bg-emerald-600 text-white shadow">Başlat</TapButton>
          </>
        )}
        {canControl && phase !== 'idle' && (
          <>
            {/* Yerler hiç değişmez: Oyun açtı kullanılamazken soluk durur, Sonraki hep aynı yerde */}
            <div className="flex justify-end">
              <TapButton onTap={() => onAction('reset')} className="h-9 px-4 rounded-xl border-2 border-slate-300 bg-white text-slate-500 text-[11px] md:text-xs">Sıfırla (mola)</TapButton>
            </div>
            <TapButton onTap={() => onAction('open')} disabled={!canOpen}
              className={`h-16 md:h-20 phoneland:h-auto phoneland:flex-1 text-lg md:text-xl ${canOpen ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-300'}`}>Oyun açtı</TapButton>
            <TapButton onTap={() => onAction('start')} className="h-32 md:h-40 phoneland:h-auto phoneland:flex-[2] text-3xl md:text-4xl bg-emerald-600 text-white shadow-lg">Sonraki ›</TapButton>
          </>
        )}
        {!canControl && (
          <p className="text-[11px] md:text-xs font-bold text-slate-400 text-center bg-slate-50 rounded-xl py-3 px-2">
            Sayacı masadakiler kullanır. Sen canlı izliyorsun.
          </p>
        )}
        {canControl && (
          <details className="group text-[11px] md:text-xs font-bold text-slate-400 phoneland:hidden">
            <summary className="cursor-pointer select-none list-none py-1 text-slate-500 font-black uppercase tracking-tight">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span> Nasıl kullanılır?
            </summary>
            <ol className="space-y-1 px-1 pt-1">
              <li>1. İlk oyuncu için <b className={B}>Başlat</b>. 1. sayaç geri sayar.</li>
              <li>2. Oyuncu taş çekti, yana taş attı → <b className={B}>Sonraki</b>. Yan oyuncu için 1. sayaç baştan başlar.</li>
              <li>3. Oyuncu elini İLK KEZ açtı → <b className={B}>Oyun açtı</b>. Ek süre: 2. sayaç + 1. sayaçta kalan süre.</li>
              <li>4. Taşlarını işledi, yana taş attı → <b className={B}>Sonraki</b>.</li>
              <li>5. Daha önce açmış oyuncuya sıra geldi → ek süre yok. Sadece 1. sayaç: taş çeker, işler, yana atar → <b className={B}>Sonraki</b>.</li>
              <li>6. Oyunu durdurmak için (mola) → <b className={B}>Sıfırla</b>. Devam etmek için tekrar <b className={B}>Başlat</b>.</li>
              <li>7. Telefonu yan çevirince sayaç tam ekran olur. Dik çevirince sekmeler geri gelir.</li>
              <li className="pt-1 text-slate-300">Sayaç herkeste görünür. Son 5 saniyede bip, süre bitince zil, sayaca son dokunan telefonda çalar. Bipi ☰ menüden kapatabilirsin.</li>
            </ol>
          </details>
        )}
      </div>
    </div>
  );
};

// Üst çubukta canlı kalan süre: sayaç çalışırken her sekmede görünür, dokununca Süre sekmesine gider
// Masadakiler için yanında Sonraki: Süre sekmesine gitmeden sıradaki oyuncuya geçilir
export const HeaderTimer: React.FC<{ timer: TimerState; serverOffset: React.MutableRefObject<number>; onOpen: () => void; canControl: boolean; onNext: () => void }> = ({ timer, serverOffset, onOpen, canControl, onNext }) => {
  const { phase } = timer;
  const [now, setNow] = useState(() => Date.now() + serverOffset.current);
  useEffect(() => {
    if (phase === 'idle') return;
    const tick = () => setNow(Date.now() + serverOffset.current);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, serverOffset]);
  if (phase === 'idle') return null;
  const end = phase === 'decide' ? timer.decideEndsAt : timer.openEndsAt;
  const left = (end ?? now) - now;
  const look = left <= 0 ? 'bg-red-600 border-red-700 text-white animate-pulse'
    : left <= 10_000 ? 'bg-amber-100 border-amber-300 text-amber-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={onOpen} title="Süre sekmesine git" className={`h-11 px-1 md:px-3 rounded-lg border flex items-center gap-0.5 font-black tabular-nums tracking-tighter ${look}`}>
        <span className="text-[8px] md:text-[11px] opacity-70">{phase === 'decide' ? '1' : '2'}</span>
        <span className="text-[24px] md:text-3xl leading-none">{fmt(left)}</span>
      </button>
      {canControl && (
        <TapButton onTap={onNext} className="h-11 px-3 md:px-4 !rounded-lg bg-emerald-600 text-white text-xs md:text-sm shadow">Sonraki ›</TapButton>
      )}
    </div>
  );
};
