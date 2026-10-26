import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playFail } from './ui';

// Hamle süresi: sıra gelen oyuncunun taş çekip karar vermesi için 1. sayaç (varsayılan 1 dk);
// "Oyun açtı" denirse 1. sayaç durur, taşı atması için 2. sayaç (varsayılan 2 dk) başlar.
// Süre biten sayaçta başarısızlık zili çalar. Sayaç sadece bu cihazda çalışır.

type Phase = 'idle' | 'decide' | 'open';

const STEP = 15;           // süre ayarı adımı (sn)
const MIN_SEC = 15;
const MAX_SEC = 300;
const DURATIONS_KEY = 'okey_timer_durations';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const loadDurations = (): [number, number] => {
  try {
    const v = JSON.parse(localStorage.getItem(DURATIONS_KEY) ?? '');
    if (Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= MIN_SEC && n <= MAX_SEC)) return [v[0], v[1]];
  } catch { /* varsayılan */ }
  return [60, 120];
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

export const TimerPanel: React.FC = () => {
  const [[decideSec, openSec], setDurations] = useState(loadDurations);
  const [phase, setPhase] = useState<Phase>('idle');
  const [decideLeft, setDecideLeft] = useState(decideSec * 1000);
  const [openLeft, setOpenLeft] = useState(openSec * 1000);
  const endsAt = useRef(0);
  const rang = useRef(false);

  useWakeLock(phase !== 'idle');

  useEffect(() => {
    try { localStorage.setItem(DURATIONS_KEY, JSON.stringify([decideSec, openSec])); } catch { /* yok say */ }
    if (phase === 'idle') {
      setDecideLeft(decideSec * 1000);
      setOpenLeft(openSec * 1000);
    }
  }, [decideSec, openSec, phase]);

  // Zamanı bitiş anına göre hesaplar: telefon yavaşlasa da sayaç kaymaz
  useEffect(() => {
    if (phase === 'idle') return;
    const tick = () => {
      const left = endsAt.current - Date.now();
      if (phase === 'decide') setDecideLeft(left); else setOpenLeft(left);
      if (left <= 0 && !rang.current) {
        rang.current = true;
        playFail();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    rang.current = false;
    endsAt.current = Date.now() + decideSec * 1000;
    setOpenLeft(openSec * 1000);
    setPhase('decide');
  }, [decideSec, openSec]);

  const opened = useCallback(() => {
    rang.current = false;
    setDecideLeft(Math.max(0, endsAt.current - Date.now()));   // 1. sayaç kaldığı yerde durur
    endsAt.current = Date.now() + openSec * 1000;
    setPhase('open');
  }, [openSec]);

  const reset = useCallback(() => {
    rang.current = false;
    setPhase('idle');
    setDecideLeft(decideSec * 1000);
    setOpenLeft(openSec * 1000);
  }, [decideSec, openSec]);

  const decideDone = decideLeft <= 0 && phase === 'decide';
  const openDone = openLeft <= 0 && phase === 'open';

  const adjust = (which: 0 | 1, delta: number) =>
    setDurations(([a, b]) => {
      const clamp = (n: number) => Math.max(MIN_SEC, Math.min(MAX_SEC, n));
      return which === 0 ? [clamp(a + delta), b] : [a, clamp(b + delta)];
    });

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

      <div className="flex gap-2">
        {phase === 'idle' && (
          <button onClick={start} className="flex-1 h-14 md:h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base md:text-lg font-black uppercase tracking-tight shadow active:scale-[0.98]">Başlat</button>
        )}
        {phase === 'decide' && !decideDone && (
          <button onClick={opened} className="flex-1 h-14 md:h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base md:text-lg font-black uppercase tracking-tight shadow active:scale-[0.98]">Oyun açtı</button>
        )}
        {phase !== 'idle' && (
          <button onClick={reset} className={`h-14 md:h-16 rounded-2xl border-2 border-slate-900 text-slate-900 text-base md:text-lg font-black uppercase tracking-tight active:scale-[0.98] ${decideDone || phase === 'open' ? 'flex-1 bg-slate-900 text-white' : 'px-5 bg-white'}`}>Sıfırla</button>
        )}
      </div>

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] md:text-xs font-black uppercase tracking-tight">
          <Stepper which={0} label="1. süre" sec={decideSec} />
          <Stepper which={1} label="2. süre" sec={openSec} />
        </div>
      )}
      <p className="text-[10px] md:text-xs font-bold text-slate-400 text-center">
        Sıra gelince <b>Başlat</b>. Oyun açarsa <b>Oyun açtı</b>. Taş atılınca <b>Sıfırla</b>, sıradaki için tekrar <b>Başlat</b>. Süre bitince zil çalar. Sayaç sadece bu telefonda çalışır.
      </p>
    </div>
  );
};
