import React, { useEffect, useRef, useState } from 'react';
import type { TimerState } from './shared/protocol';
import { playFail } from './ui';

// Ortak hamle sayacı: sıra gelen oyuncunun taş çekip karar vermesi için 1. sayaç (varsayılan 1 dk);
// "Oyun açtı" denirse 1. sayaç durur, taşı atması için 2. sayaç (varsayılan 2 dk) başlar.
// Durum sunucuda; herkes aynı sayacı görür, sadece masadakiler kullanır.
// Süre bitince zil sadece sayaca son dokunan telefonda çalar (masada 4 telefon birden çalmasın).

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

const Clock: React.FC<{ label: string; ms: number; total: number; active: boolean; done: boolean; dim?: boolean }> = ({ label, ms, total, active, done, dim }) => {
  const warn = active && ms <= 10_000;
  const color = done ? 'text-red-600' : warn ? 'text-amber-500' : active ? 'text-slate-900' : 'text-slate-300';
  const bar = done ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className={`bg-white border rounded-2xl p-3 md:p-5 shadow-sm transition-opacity ${done ? 'border-red-300 bg-red-50' : 'border-slate-100'} ${dim ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between text-[10px] md:text-xs font-black uppercase tracking-tight text-slate-400">
        <span>{label}</span>
        {done && <span className="text-red-600">Süre bitti</span>}
      </div>
      <div className={`text-center font-black tabular-nums leading-none text-[64px] md:text-[96px] my-2 ${color}`}>{fmt(ms)}</div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bar} transition-[width] duration-200`} style={{ width: `${Math.max(0, Math.min(100, (ms / (total * 1000)) * 100))}%` }} />
      </div>
    </div>
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
    : timer.decideLeftMs ?? 0;
  const openLeft = phase === 'open' ? (timer.openEndsAt ?? now) - now : openSec * 1000;
  const decideDone = phase === 'decide' && decideLeft <= 0;
  const openDone = phase === 'open' && openLeft <= 0;

  // Zil: sadece sayaca son dokunan telefonda, her bitiş için bir kez
  const runningEnd = phase === 'decide' ? timer.decideEndsAt : phase === 'open' ? timer.openEndsAt : null;
  useEffect(() => {
    if (!timer.mine || runningEnd === null || !(decideDone || openDone)) return;
    if (rangFor.current === runningEnd) return;
    rangFor.current = runningEnd;
    // geç açılan sayfada eski bitiş için çalma
    if (now - runningEnd < 5000) playFail();
  }, [timer.mine, runningEnd, decideDone, openDone, now]);

  const adjust = (which: 0 | 1, delta: number) => {
    const clamp = (n: number) => Math.max(MIN_SEC, Math.min(MAX_SEC, n));
    if (which === 0) onDurations(clamp(decideSec + delta), openSec);
    else onDurations(decideSec, clamp(openSec + delta));
  };

  const Stepper = ({ which, label, sec }: { which: 0 | 1; label: string; sec: number }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{label}</span>
      <button onClick={() => adjust(which, -STEP)} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600" aria-label={`${label} azalt`}>−</button>
      <span className="w-10 text-center tabular-nums text-slate-700">{fmt(sec * 1000)}</span>
      <button onClick={() => adjust(which, STEP)} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600" aria-label={`${label} artır`}>+</button>
    </div>
  );

  return (
    <div className="p-2 md:p-4 flex-1 overflow-auto custom-scrollbar flex flex-col gap-3">
      <Clock label="1 · Taş çek, karar ver" ms={decideLeft} total={decideSec} active={phase === 'decide'} done={decideDone} dim={phase === 'open'} />
      <Clock label="2 · Oyun açtı, taş at" ms={openLeft} total={openSec} active={phase === 'open'} done={openDone} dim={phase !== 'open'} />

      {canControl ? (
        <>
          <div className="flex gap-2">
            {phase === 'idle' && (
              <button onClick={() => onAction('start')} className="flex-1 h-14 md:h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base md:text-lg font-black uppercase tracking-tight shadow active:scale-[0.98]">Başlat</button>
            )}
            {phase === 'decide' && !decideDone && (
              <button onClick={() => onAction('open')} className="flex-1 h-14 md:h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base md:text-lg font-black uppercase tracking-tight shadow active:scale-[0.98]">Oyun açtı</button>
            )}
            {phase !== 'idle' && (
              <button onClick={() => onAction('reset')} className={`h-14 md:h-16 rounded-2xl border-2 border-slate-900 text-base md:text-lg font-black uppercase tracking-tight active:scale-[0.98] ${decideDone || phase === 'open' ? 'flex-1 bg-slate-900 text-white' : 'px-5 bg-white text-slate-900'}`}>Sıfırla</button>
            )}
          </div>
          {phase === 'idle' && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] md:text-xs font-black uppercase tracking-tight">
              <Stepper which={0} label="1. süre" sec={decideSec} />
              <Stepper which={1} label="2. süre" sec={openSec} />
            </div>
          )}
          <p className="text-[10px] md:text-xs font-bold text-slate-400 text-center">
            Sıra gelince <b>Başlat</b>. Oyun açarsa <b>Oyun açtı</b>. Taş atılınca <b>Sıfırla</b>, sıradaki için tekrar <b>Başlat</b>.
            Sayaç herkeste görünür; süre bitince zil sayaca son dokunan telefonda çalar.
          </p>
        </>
      ) : (
        <p className="text-[11px] md:text-xs font-bold text-slate-400 text-center bg-slate-50 rounded-xl py-3 px-2">
          Sayacı masadakiler kullanır. Sen canlı izliyorsun.
        </p>
      )}
    </div>
  );
};
