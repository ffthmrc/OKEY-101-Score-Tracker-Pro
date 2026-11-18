
import React, { useState, useMemo, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Player, RoundScore, PlayerStats } from './types';
import type { CellValue, TimerState } from './shared/protocol';
import { parseScoreInput, placesOf, placeEmoji, hasAnyScore, MAX_TITLE_LEN } from './shared/game';
import { scoreTextClass, formatDay, playChime, playDiceRoll, playNextBeep, playOpenBeep, emojiAnimClass, countdownTickOn, setCountdownTick, subscribeCountdownTick, scoreInputProps, scoreValue, SCORE_INPUT_CLASS } from './ui';
import { useRoom } from './useRoom';
import { seatColors } from './constants';
import { personKey } from './shared/stats';
import { ConfirmDialog, JoinDialog, NameDialog, TablePinDialog } from './Dialogs';
import { ArchivePanel } from './ArchivePanel';
import { GapPanel } from './GapPanel';
import { GameCharts } from './GameCharts';
import { TimerPanel, HeaderTimer } from './TimerPanel';

// --- Sub-components ---

// emoji: 🏆 🥈 🥉 4️⃣ 5️⃣ 💩 (shared/game.ts placeEmoji); boşsa henüz puanı yok, rozet gösterilmez
const Badge = ({ emoji, visible, size = 'small' }: { emoji: string, visible: boolean, size?: 'small' | 'large' }) => {
  if (!visible || !emoji) return <div className={`${size === 'large' ? 'h-[24px] md:h-[40px]' : 'h-4 md:h-6'}`} />;

  const emojiSize = size === 'large' ? 'text-[24px] md:text-4xl' : 'text-sm md:text-xl';

  return <span className={`${emojiSize} select-none leading-none ${emojiAnimClass(emoji) || 'drop-shadow-sm'}`}>{emoji}</span>;
};

interface StatCardProps {
  player: Player;
  stat: PlayerStats;
  gameStarted: boolean;
  occupied: boolean;
  isMine: boolean;
  nameLen: number;
  totalLen: number;
  stacked: boolean; // 5-6 kişi: alt alta düzen
  onVacate?: (id: string) => void;
  onRename?: (id: string) => void;
}

// Oyuncu kartı. 4 kişiye kadar: solda rozet, sağda isim ve altında toplam (ortalı).
// 5-6 kişide kutu dar: rozet üstte, isim, toplam alt alta (isim kutunun bütün genişliğini kullanır).
// nameLen / totalLen: masadaki en uzun isim ve toplam; bütün kartlar aynı yazı boyunu kullanır (kesilmez).
const StatCard: React.FC<StatCardProps> = ({ player, stat, gameStarted, occupied, isMine, onVacate, onRename, nameLen, totalLen, stacked }) => (
  <div className={`relative flex ${stacked ? 'flex-col justify-center gap-0.5 px-0.5' : 'items-center gap-0.5 md:gap-3 pl-0.5 pr-1 md:px-3'} rounded-lg border border-slate-100 bg-white shadow-sm h-full min-h-[56px] md:min-h-[96px] pt-2 pb-2.5 md:py-3 ${isMine ? 'ring-2 ring-indigo-400' : ''}`}>
    {/* Sandalye durumu: dolu = yeşil nokta; masadakiler boşaltabilir */}
    <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 flex items-center gap-0.5">
      <span className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${occupied ? 'bg-emerald-500' : 'bg-slate-200'}`} title={occupied ? 'Oturuyor' : 'Boş sandalye'} />
      {onVacate && occupied && !isMine && (
        <button onClick={() => onVacate(player.id)} className="text-[9px] md:text-xs leading-none text-slate-300 hover:text-red-500" title="Sandalyeyi boşalt" aria-label="Sandalyeyi boşalt">⏏</button>
      )}
    </div>

    <div className={`${stacked ? '' : 'w-6 md:w-12'} shrink-0 flex items-center justify-center`}>
      <Badge emoji={stat.emoji ?? ''} visible={gameStarted} size={stacked ? 'small' : 'large'} />
    </div>

    <div className="min-w-0 flex-1 text-center" style={{ containerType: 'inline-size' }}>
      <div className="font-black uppercase tracking-tighter leading-tight text-slate-900 whitespace-nowrap"
        style={{ fontSize: `min(15px, calc(100cqw / ${Math.max(4, nameLen) * 0.6}))` }}>
        {onRename ? <button onClick={() => onRename(player.id)} className="uppercase underline decoration-dotted decoration-slate-300 underline-offset-2">{player.name}</button> : player.name}
      </div>
      <div className="font-black tracking-tighter leading-none tabular-nums text-slate-900 mt-1 whitespace-nowrap md:!text-2xl"
        style={{ fontSize: `min(18px, calc(100cqw / ${Math.max(3, totalLen) * 0.58}))` }}>
        {stat.totalScore}
      </div>
    </div>

    <div className="absolute bottom-0 left-0 right-0 h-1 md:h-2 rounded-b-lg" style={{ backgroundColor: player.color }} />
  </div>
);

// --- Dice Component ---

const DiceRoller = () => {
  const [roll, setRoll] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [history, setRollHistory] = useState<{ value: number, time: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    playDiceRoll();

    const nextRoll = Math.floor(Math.random() * 6) + 1;
    const newX = rotation.x + 720 + Math.floor(Math.random() * 360);
    const newY = rotation.y + 720 + Math.floor(Math.random() * 360);

    setRotation({ x: newX, y: newY });

    setTimeout(() => {
      setRoll(nextRoll);
      setRollHistory(prev => [{ value: nextRoll, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev].slice(0, 50));

      const faceRotations: Record<number, {x: number, y: number}> = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: 180 },
        3: { x: 0, y: -90 },
        4: { x: 0, y: 90 },
        5: { x: -90, y: 0 },
        6: { x: 90, y: 0 }
      };

      const final = faceRotations[nextRoll];
      setRotation({
        x: Math.round(newX / 360) * 360 + final.x,
        y: Math.round(newY / 360) * 360 + final.y
      });
      setIsRolling(false);
    }, 600);
  };

  const Face = ({ num, rotate }: { num: number, rotate: string }) => {
    const dotsMap: Record<number, number[]> = {
      1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
    };
    return (
      <div
        className="absolute w-full h-full bg-[#fcd34d] border-2 border-[#b45309]/30 rounded-2xl flex items-center justify-center p-2 md:p-4 shadow-inner"
        style={{ transform: rotate + ' translateZ(50px)', backfaceVisibility: 'hidden' }}
      >
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5 md:gap-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              {dotsMap[num].includes(i) && (
                <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1e1b4b] rounded-full shadow-inner" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Dik: zar ortada, altta skor + Roll. Yan çevrilmiş telefon: tam ekran, solda zar, sağda skor + Roll.
  // Geçmiş tuşu iki yönde de sağ üstte.
  return (
    <div className="flex-1 w-full bg-[#310000] flex flex-col relative overflow-hidden
      phoneland:fixed phoneland:inset-0 phoneland:z-[100] phoneland:flex-row
      phoneland:pl-[max(12px,env(safe-area-inset-left))] phoneland:pr-[max(12px,env(safe-area-inset-right))]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#5a0000_0%,_#1a0000_100%)] pointer-events-none" />
      <button onClick={() => setShowHistory(true)} aria-label="Zar geçmişi" className="absolute top-3 right-3 phoneland:right-[max(12px,env(safe-area-inset-right))] z-30 w-12 h-12 md:w-16 md:h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all active:scale-90">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </button>
      <div className="flex-1 min-h-0 flex items-center justify-center z-10 p-4">
        <div className="relative w-40 h-40 md:w-56 md:h-56 perspective-1000">
          <div
            className="relative w-full h-full transition-transform duration-700 ease-out preserve-3d"
            style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
          >
            <Face num={1} rotate="rotateY(0deg)" />
            <Face num={2} rotate="rotateY(180deg)" />
            <Face num={3} rotate="rotateY(90deg)" />
            <Face num={4} rotate="rotateY(-90deg)" />
            <Face num={5} rotate="rotateX(90deg)" />
            <Face num={6} rotate="rotateX(-90deg)" />
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/50 blur-xl rounded-full" />
        </div>
      </div>
      <div className="shrink-0 z-20 flex flex-col items-center justify-center gap-3 md:gap-4 p-6 md:p-10 phoneland:w-[42%] phoneland:p-4">
        <h2 className="text-[#fde68a] text-xl md:text-3xl font-serif tracking-tight drop-shadow-lg uppercase font-medium whitespace-nowrap">King's Score: <span className="font-bold">{roll}</span></h2>
        <button onClick={rollDice} disabled={isRolling} className="w-full max-w-[220px] md:max-w-[320px] h-14 md:h-16 bg-gradient-to-b from-[#92400e] to-[#451a03] hover:from-[#b45309] hover:to-[#78350f] text-white rounded-full flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all border border-[#f59e0b]/20">
          <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
          <span className="text-xl md:text-2xl font-black tracking-[0.15em] uppercase">Roll</span>
        </button>
      </div>
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-[#1a0000]/98 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <h3 className="text-[#fde68a] text-xl font-black uppercase tracking-widest">Roll History</h3>
            <button onClick={() => setShowHistory(false)} className="text-white/40 hover:text-white p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="flex-1 overflow-auto space-y-3 pr-2 custom-scrollbar">
            {history.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-white/20 italic">No rolls yet...</div> : history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4"><span className="text-white/20 font-mono text-xs">{history.length - i}.</span><span className="text-white/40 text-[10px] font-bold uppercase tracking-tighter">{h.time}</span></div>
                <div className="flex items-center gap-3"><span className="text-white/30 text-[10px] font-black uppercase">Result:</span><span className="text-[#fcd34d] text-2xl font-black drop-shadow-sm">{h.value}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`.perspective-1000 { perspective: 1000px; } .preserve-3d { transform-style: preserve-3d; }`}</style>
    </div>
  );
};

// --- Main UI Component ---

interface GameActions {
  setScore: (roundIndex: number, playerId: string, value: CellValue) => void;
  setName: (playerId: string, name: string) => void;
  addRound: () => void;
  removeRound: () => void;
}

interface GameDashboardProps {
  players: Player[];
  rounds: RoundScore[];
  actions: GameActions;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  canEdit: boolean;
  occupied: Record<string, boolean>;
  mySeat: string | null;
  onVacate: (id: string) => void;
  roomBar: React.ReactNode;       // katılma istekleri şeridi
  headerTitle: React.ReactNode;   // masa adı (tablonun sol üstünde)
  headerStatus: React.ReactNode;  // bağlantı yoksa üst satırda uyarı
  headerJoin: React.ReactNode;    // + Player yanında Katıl / Ayrıl
  statusDot: string;              // ☰ tuşundaki bağlantı noktası rengi
  onMenu: () => void;
  onTimerNext: () => void;
  onTimerOpenGame: () => void;
  archive: React.ReactNode;
  timer: React.ReactNode;
  timerState: TimerState;
  serverOffset: React.MutableRefObject<number>;
}

// Sekmeler (sırası kaydırma sırasıdır)
const TABS = [['table', 'Tablo'], ['charts', 'Sıra'], ['timer', 'Süre'], ['archive', 'Arşiv'], ['dice', 'Zar']] as const;
type TabId = typeof TABS[number][0];
// Sekme simgeleri (çizgi simgeler, yazı rengini alır)
const TAB_ICONS: Record<TabId, React.ReactNode> = {
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14.5h18M9 4v16M15 4v16" /></>,
  charts: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M10 2h4" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.1" fill="currentColor" /><circle cx="15" cy="15" r="1.1" fill="currentColor" /><circle cx="15" cy="9" r="1.1" fill="currentColor" /><circle cx="9" cy="15" r="1.1" fill="currentColor" /><circle cx="12" cy="12" r="1.1" fill="currentColor" /></>,
};

const GameDashboard: React.FC<GameDashboardProps> = ({
  players, rounds, actions, onAddPlayer, onRemovePlayer,
  canEdit, occupied, mySeat, onVacate, roomBar, archive, timer, timerState, serverOffset,
  headerTitle, headerStatus, headerJoin, statusDot, onMenu, onTimerNext, onTimerOpenGame
}) => {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('table');

  // Sağa / sola kaydırınca yan sekmeye geç (sekmelere dokunmak da çalışır).
  // Yana kayabilen bir kutunun (geniş tablo) içinde, grafik üzerinde ya da yan çevrilmiş tam ekran sayaç / zarda kaydırma sekme değiştirmez.
  const mainRef = useRef<HTMLElement>(null);
  const swipe = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) { swipe.current = null; return; }
    const tch = e.touches[0];
    let skip = window.matchMedia('(orientation: landscape) and (max-height: 540px)').matches;
    for (let el = e.target as HTMLElement | null; el && el !== e.currentTarget && !skip; el = el.parentElement) {
      if (el.classList.contains('recharts-wrapper')) skip = true;
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2) skip = true;
    }
    swipe.current = { x: tch.clientX, y: tch.clientY, t: Date.now(), skip };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.skip) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - s.x, dy = tch.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.t > 700) return;
    const i = TABS.findIndex(([id]) => id === activeTab);
    const next = TABS[i + (dx < 0 ? 1 : -1)];
    if (!next) return;
    setActiveTab(next[0]);
    // kısa kayma: yeni sekme kaydırılan yönden gelir
    mainRef.current?.animate?.([{ transform: `translateX(${dx < 0 ? 40 : -40}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'ease-out' });
  };

  // Check if any non-null input has been made across all rounds
  const hasGameStarted = useMemo(() => hasAnyScore(rounds), [rounds]);

  const stats: PlayerStats[] = useMemo(() => {
    const scoresMap = players.map(player => {
      const totalScore = rounds.reduce((sum, r) => {
        const val = r.scores[player.id];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      return { id: player.id, name: player.name, totalScore };
    });
    // Eşit toplam aynı sırayı alır; puanı olmayan oyuncunun sırası 0 (rozet yok)
    const places = placesOf(players, rounds);
    return players.map(player => {
      const rank = places[player.id] ?? 0;
      const pData = scoresMap.find(s => s.id === player.id)!;
      const emoji = placeEmoji(places[player.id], places);
      return { id: player.id, name: player.name, totalScore: pData.totalScore, rank, wins: 0, lastRoundRank: 0, emoji } as PlayerStats;
    });
  }, [players, rounds]);

  // Kartlarda ortak yazı boyu için en uzun isim ve toplam
  const cardNameLen = Math.max(...players.map(p => p.name.length));
  const cardTotalLen = Math.max(...stats.map(s => String(s.totalScore).length));

  const handleScoreChange = (roundIndex: number, playerId: string, value: string) => {
    actions.setScore(roundIndex, playerId, parseScoreInput(value));
  };

  const handleNameChange = (playerId: string, newName: string) => {
    actions.setName(playerId, newName);
  };

  const addNewRound = () => {
    actions.addRound();
  };

  const removeLastRound = () => {
    if (rounds.length > 0) actions.removeRound();
  };

  return (
    // Üst boşluk: sadece iPhone saat çubuğu kadar (Android'de 0)
    <div className="h-dvh font-sans bg-slate-50 flex flex-col overflow-hidden"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <div className="ios-top-space shrink-0" />
      {/* iOS 26: sayfanın üst kenarına buzlu cam / solma efekti uyguluyor (saat çubuğu düz olsa da).
          WebKit bunu, en üst kenarda tam genişlikte, tek ve dolu renkli sabit bir kutu varsa yapmıyor.
          Şerit sadece iPhone'da (index.css .ios-top-strip), en az 12 pt; zeminle aynı renk, dokunuşu engellemez.
          Altındaki .ios-top-space içeriği şerit kadar aşağı alır. */}
      <div aria-hidden="true" className="ios-top-strip fixed top-0 inset-x-0 z-[250] bg-slate-50 pointer-events-none" />
      <main ref={mainRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { swipe.current = null; }}
        className="max-w-7xl mx-auto w-full px-1.5 md:px-6 pt-0.5 md:pt-3 pb-0 md:pb-3 flex flex-col flex-1 gap-1.5 md:gap-3 overflow-hidden">
        {activeTab === 'table' && (
          <div className="w-full shrink-0 bg-slate-100/30 rounded-xl">
            {/* Kartlar tek satırda, eşit genişlikte; sıraları tablonun sütunlarıyla aynı */}
            <section className="grid gap-1 px-1 pb-1 pt-0.5 md:gap-4 md:p-4" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
              {stats.map(stat => {
                const p = players.find(player => player.id === stat.id);
                if (!p) return null;
                return (
                  <div key={stat.id}>
                    <StatCard
                      player={p} stat={stat} gameStarted={hasGameStarted} nameLen={cardNameLen} totalLen={cardTotalLen} stacked={players.length > 4}
                      occupied={!!occupied[p.id]} isMine={mySeat === p.id} onVacate={canEdit ? onVacate : undefined}
                      onRename={canEdit ? setRenameId : undefined}
                    />
                  </div>
                );
              })}
            </section>
          </div>
        )}

        <div className="bg-white rounded-xl rounded-b-none md:rounded-b-xl shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
          {activeTab === 'table' && (
            <div className="p-1.5 md:p-3 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1 px-1 shrink-0">
                {/* bu tablonun ait olduğu masa (Leaderboard yazısının yerinde) */}
                <div className="min-w-0 flex-1 pr-2">{headerTitle}</div>
                <div className="flex items-center gap-1 shrink-0">
                  {headerJoin}
                  {canEdit && <button
                    onClick={onAddPlayer}
                    className="flex bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-md p-0.5 items-center px-2 text-white shadow-sm transition-all h-7 md:h-10"
                  >
                    <span className="text-sm font-bold mr-1 leading-none">+</span>
                    <span className="text-[11px] md:text-sm font-semibold">Player</span>
                  </button>}
                  <div className={`flex bg-slate-900 rounded-md p-0.5 gap-0.5 items-center px-2 h-7 md:h-10 ${canEdit ? '' : 'opacity-30'}`}>
                    <button onClick={addNewRound} disabled={!canEdit} className="text-white text-sm font-bold p-0.5 leading-none">+</button>
                    <span className="text-[11px] md:text-sm font-semibold text-white px-0.5">Round</span>
                    <button onClick={removeLastRound} disabled={!canEdit || rounds.length === 0} className="text-white text-sm font-bold p-0.5 leading-none disabled:opacity-30">−</button>
                  </div>
                </div>
              </div>
              <div className="overflow-auto rounded-lg border border-slate-100 flex-1 bg-white">
                <table className="w-full text-left border-collapse min-w-[280px] min-h-full">
                  {/* Lacivert başlık (Toplam satırıyla aynı): ad beyaz, oyuncunun rengi yanındaki noktada (sarı ad da okunur) */}
                  <thead className="sticky top-0 z-20 bg-slate-900 text-white">
                    <tr>
                      <th className="py-1 md:py-2.5 px-1.5 md:px-2 text-[10px] md:text-xs font-semibold text-slate-400 w-9 md:w-20">Rnd</th>
                      {players.map(p => (
                        <th key={p.id} className="py-1 md:py-2.5 px-0.5 text-center">
                          <button type="button" disabled={!canEdit} onClick={() => setRenameId(p.id)} className="flex items-center justify-center gap-1 w-full min-w-0 bg-transparent border-0 py-1 text-[11px] xs:text-xs md:text-base font-bold uppercase tracking-tight">
                            <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full shrink-0 ring-1 ring-white/70" style={{ backgroundColor: p.color }} />
                            <span className="truncate">{p.name}</span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rounds.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-0 md:py-2 px-1.5 md:px-2 text-[11px] md:text-sm font-semibold text-slate-400 tabular-nums">R{r.round}</td>
                        {players.map(p => (
                          <td key={p.id} className="px-0.5 py-px md:p-1">
                            <input {...scoreInputProps} value={scoreValue(r.scores[p.id])} readOnly={!canEdit} onChange={(e) => handleScoreChange(rIdx, p.id, e.target.value)} className={`${SCORE_INPUT_CLASS} w-full bg-slate-50/50 border-0 rounded-md py-0.5 md:py-2 text-center font-black ${scoreTextClass(r.scores[p.id])} text-[16px] md:text-xl focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-900 text-white z-20 shadow-lg">
                    <tr>
                      <td className="py-1.5 md:py-2.5 px-1.5 md:px-2 text-[10px] md:text-xs font-semibold text-slate-400">Total</td>
                      {players.map(p => (
                        <td key={p.id} className="py-1.5 md:py-2.5 text-center text-[18px] md:text-2xl font-black tabular-nums">{stats.find(s => s.id === p.id)?.totalScore}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="p-2 md:p-4 flex-1 flex flex-col gap-4 overflow-auto custom-scrollbar">
              {/* Sıra ve Fark tek sekmede, arşiv detayıyla aynı düzen */}
              <GameCharts players={players} rounds={rounds} show="ranking" />
              <GapPanel players={players} rounds={rounds} embedded />
              <GameCharts players={players} rounds={rounds} show="trend" />
            </div>
          )}

          {activeTab === 'dice' && <DiceRoller />}

          {/* Sayaç sekme değişince durmasın diye hep açık, sadece gizlenir */}
          <div className={activeTab === 'timer' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>{timer}</div>

          {activeTab === 'archive' && archive}
        </div>
      </main>


      {roomBar}

      {/* Sekmeler alt satırın hemen üstünde: büyük harf, aralarında çizgi, seçili olanın üstü çizili */}
      <nav className="flex bg-white border-t-2 border-slate-200 shrink-0 divide-x divide-slate-200">
        {TABS.map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 md:py-2 text-[10px] md:text-xs font-semibold truncate transition-all border-t-[3px] -mt-[2px] ${activeTab === tab ? 'text-indigo-700 bg-indigo-50 border-indigo-600' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" fill="none" stroke="currentColor" strokeWidth={activeTab === tab ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">{TAB_ICONS[tab]}</svg>
            <span className="leading-none">{label}</span>
          </button>
        ))}
      </nav>

      {/* Alt satır (başparmak bölgesi): Oyun açtı · sayaç · Sonraki · geri/ileri (ya da Katıl) · ☰ menü.
          iPhone ev çizgisi ve yuvarlak köşeler için alttan güvenli boşluk */}
      {/* Yanlarda geniş boşluk: iPhone'un yuvarlak alt köşeleri logoyu ve ☰'yi kesmesin.
          Altta en az 14 px (iOS 26'da ekran kenarı ölçüsü bazen 0 geliyor) */}
      <footer className="bg-white border-t border-slate-200 z-50 px-5 md:px-6 pt-2 flex items-center gap-1.5 md:gap-2 shrink-0"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        {headerStatus && <div className="min-w-0 flex-1">{headerStatus}</div>}
        <HeaderTimer timer={timerState} serverOffset={serverOffset} onOpen={() => setActiveTab('timer')} canControl={canEdit && activeTab !== 'timer'} onNext={onTimerNext} onOpenGame={onTimerOpenGame} />
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button onClick={onMenu} className="relative h-14 w-12 rounded-xl bg-slate-900 text-white text-xl leading-none flex items-center justify-center" aria-haspopup="dialog" aria-label="Masa menüsü">☰
            {/* bağlantı noktası (yeşil bağlı, sarı bağlanıyor, kırmızı yok) */}
            <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${statusDot}`} />
          </button>
        </div>
      </footer>
      <NameDialog
        open={renameId !== null}
        initial={players.find(p => p.id === renameId)?.name ?? ''}
        onCancel={() => setRenameId(null)}
        onSave={name => { if (renameId) handleNameChange(renameId, name); setRenameId(null); }}
        removeLabel={canEdit && players.length > 1 ? 'Oyuncuyu çıkar' : undefined}
        onRemove={() => { if (renameId) onRemovePlayer(renameId); setRenameId(null); }}
      />
    </div>
  );
};

// --- App Root ---

const STATUS_LABEL = { online: 'Bağlı', connecting: 'Bağlanıyor', offline: 'Bağlantı koptu' } as const;
const STATUS_DOT = { online: 'bg-emerald-400', connecting: 'bg-amber-400 animate-pulse', offline: 'bg-red-500 animate-pulse' } as const;

export default function App() {
  const {
    code, room, game, status, error, sendOp,
    archiveItems, archiveGame, archiveSavedId, archiveDeletedId, archiveUnlockSeq,
    openArchiveGame, unlockArchive, saveArchiveGame, deleteArchiveGame,
    lastDeleted, undoDelete, notice: roomNotice, serverOffset,
  } = useRoom();
  const [joinOpen, setJoinOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);       // ☰ Masa menüsü
  const [leaveArmed, setLeaveArmed] = useState(false); // Ayrıl: yanlışlıkla basılmasın, ikinci dokunuşta ayrılır
  useEffect(() => {
    if (!leaveArmed) return;
    const id = setTimeout(() => setLeaveArmed(false), 3000);
    return () => clearTimeout(id);
  }, [leaveArmed]);
  const tickOn = useSyncExternalStore(subscribeCountdownTick, countdownTickOn); // son 10 sn bipi (telefon başına)
  const [clearConfirm, setClearConfirm] = useState(false); // tabloyu arşivlemeden temizle
  const [notice, setNotice] = useState<string | null>(null);

  // Yeni katılma isteği gelince masadakilere ses + titreşim
  const requestIds = room?.requests.map(r => r.id).join(',') ?? '';
  const seenRequests = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = requestIds ? requestIds.split(',') : [];
    if (ids.some(id => !seenRequests.current.has(id))) playChime();
    seenRequests.current = new Set(ids);
  }, [requestIds]);

  // Bekleyen isteğim kabul edilmeden düştüyse haber ver
  const prevRequest = useRef<string | null>(null);
  const cancelledByMe = useRef(false);
  useEffect(() => {
    if (!room) return;
    if (prevRequest.current && !room.myRequest && !room.mySeat && !cancelledByMe.current) {
      setNotice('Katılma isteğin onaylanmadı');
    }
    if (!room.myRequest) cancelledByMe.current = false;
    prevRequest.current = room.myRequest;
  }, [room?.myRequest, room?.mySeat]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const actions = useMemo<GameActions>(() => ({
    setScore: (round, playerId, value) => sendOp({ t: 'setScore', round, playerId, value }),
    setName: (playerId, name) => sendOp({ t: 'setName', playerId, name }),
    addRound: () => sendOp({ t: 'addRound' }),
    removeRound: () => sendOp({ t: 'removeRound' }),
  }), [sendOp]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (game && game.players.length <= 1) {
      alert("At least one player is required!");
      return;
    }
    sendOp({ t: 'removePlayer', playerId });
  }, [game, sendOp]);

  const copyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Linki kopyala', url);
    }
  }, []);

  if (!room || !game) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3 bg-slate-50">
        <span className={`h-3 w-3 rounded-full ${STATUS_DOT[status]}`} />
        <span className="text-sm font-semibold text-slate-400">Oda {code} · {STATUS_LABEL[status]}…</span>
      </div>
    );
  }

  const canEdit = room.mySeat !== null; // masaya oturan her şeyi yapar, oturmayan sadece izler
  const tableTitle = room.title ?? formatDay(new Date()); // masa adı yoksa bugünün tarihi
  const coloredPlayers = seatColors(game.players); // renkler sıraya göre (ekran için)
  // Lig listesinde masadaki oyuncu Tablo'daki rengiyle görünür
  const liveColors = Object.fromEntries(coloredPlayers.map(p => [personKey(p.name), p.color]));
  const hasScore = game.rounds.some(r => Object.values(r.scores).some(v => typeof v === 'number'));

  // Masa adı tablonun sol üstünde: oturan dokununca değiştirir
  const headerTitle = canEdit ? (
    <button onClick={() => setTitleOpen(true)} className="max-w-full text-left line-clamp-2 break-words leading-tight text-[15px] md:text-lg font-bold tracking-tight text-slate-900 underline decoration-dotted decoration-slate-300 underline-offset-4" title="Masa adını değiştir">{tableTitle}</button>
  ) : (
    <span className="line-clamp-2 break-words leading-tight text-[15px] md:text-lg font-bold tracking-tight text-slate-900">{tableTitle}</span>
  );
  // Bağlantı yoksa üst satırda uyarı (bağlıyken logo köşesindeki yeşil nokta yeter)
  const headerStatus = status !== 'online'
    ? <span className="block truncate text-[12px] md:text-sm font-bold text-amber-600">{STATUS_LABEL[status]}…</span>
    : null;
  // Tablonun üstünde + Player yanında: oturan için Ayrıl (iki dokunuş), oturmayan için Katıl
  const JOIN_BTN = 'flex items-center px-2.5 h-7 md:h-10 rounded-md text-[11px] md:text-sm font-semibold shadow-sm active:scale-95 transition-all';
  const headerJoin = room.mySeat ? (
    <button onClick={() => { if (leaveArmed) { setLeaveArmed(false); sendOp({ t: 'leave' }); } else setLeaveArmed(true); }}
      className={`${JOIN_BTN} ${leaveArmed ? 'bg-red-600 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>
      {leaveArmed ? 'Emin? Dokun' : '🚪 Ayrıl'}
    </button>
  ) : room.myRequest ? (
    <button onClick={() => { cancelledByMe.current = true; sendOp({ t: 'cancelJoin' }); }} className={`${JOIN_BTN} bg-amber-100 text-amber-700 animate-pulse`} title="İptal etmek için dokun">Onay bekleniyor…</button>
  ) : (
    <button onClick={() => setJoinOpen(true)} className={`${JOIN_BTN} bg-emerald-600 text-white`}>Katıl</button>
  );

  const roomBar = (
    <>
    {room.requests.length > 0 && (
      <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex flex-col gap-1.5 shrink-0">
        {room.requests.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-[11px] md:text-xs font-black text-amber-900">
            <span className="flex-1 min-w-0 leading-tight"><span>🔔 <span className="uppercase">{r.name}</span> katılmak istiyor</span><br /><span className="font-bold text-amber-700">{r.target}</span></span>
            <button onClick={() => sendOp({ t: 'reject', id: r.id })} className="h-7 px-2 rounded-md border border-amber-300 bg-white text-amber-800">Reddet</button>
            <button onClick={() => sendOp({ t: 'approve', id: r.id })} className="h-7 px-2 rounded-md bg-emerald-600 text-white shadow">Onayla</button>
          </div>
        ))}
      </div>
    )}
    </>
  );

  return (
    <>
      <GameDashboard
        players={coloredPlayers}
        rounds={game.rounds}
        actions={actions}
        onAddPlayer={() => sendOp({ t: 'addPlayer' })}
        onRemovePlayer={handleRemovePlayer}
        canEdit={canEdit}
        occupied={room.occupied}
        mySeat={room.mySeat}
        onVacate={playerId => sendOp({ t: 'vacate', playerId })}
        roomBar={roomBar}
        headerTitle={headerTitle}
        headerStatus={headerStatus}
        headerJoin={headerJoin}
        statusDot={STATUS_DOT[status]}
        onMenu={() => setMenuOpen(true)}
        onTimerNext={() => { playNextBeep(); sendOp({ t: 'timer', action: 'start' }); }}
        onTimerOpenGame={() => { playOpenBeep(); sendOp({ t: 'timer', action: 'open' }); }}
        timerState={room.timer}
        serverOffset={serverOffset}
        timer={
          <TimerPanel
            timer={room.timer}
            serverOffset={serverOffset}
            canControl={canEdit}
            onAction={action => {
              if (action === 'start') playNextBeep(); else if (action === 'open') playOpenBeep();
              sendOp({ t: 'timer', action });
            }}
            onDurations={(decideSec, openSec) => sendOp({ t: 'timerDurations', decideSec, openSec })}
          />
        }
        archive={
          <ArchivePanel
            items={archiveItems} liveColors={liveColors} game={archiveGame} savedId={archiveSavedId} deletedId={archiveDeletedId} unlockSeq={archiveUnlockSeq} canEdit={canEdit}
            onOpen={openArchiveGame} onUnlock={unlockArchive} onSave={saveArchiveGame} onDelete={deleteArchiveGame}
          />
        }
      />
      <NameDialog
        open={titleOpen}
        heading="Masa adı"
        placeholder={formatDay(new Date())}
        maxLength={MAX_TITLE_LEN}
        initial={tableTitle}
        resetLabel="Tarih yap"
        onReset={() => { sendOp({ t: 'setTitle', title: null }); setTitleOpen(false); }}
        onCancel={() => setTitleOpen(false)}
        onSave={title => { sendOp({ t: 'setTitle', title }); setTitleOpen(false); }}
      />
      <JoinDialog
        open={joinOpen}
        needPin={room.pinSet}
        needOpenPin={room.needsOpenPin}
        approversOnline={room.approversOnline}
        onCancel={() => setJoinOpen(false)}
        onJoin={(name, pin, openPin) => { sendOp({ t: 'join', name, pin, openPin }); setJoinOpen(false); }}
      />
      <TablePinDialog
        open={pinOpen}
        pinSet={room.pinSet}
        onCancel={() => setPinOpen(false)}
        onSave={pin => { sendOp({ t: 'setPin', pin }); setPinOpen(false); }}
      />
      {menuOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 flex items-end justify-center" onClick={() => setMenuOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 space-y-4 shadow-2xl" style={{ paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 12px))' }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Masa">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold tracking-tight text-slate-900 truncate">Masa · {tableTitle}</h3>
              <button onClick={() => setMenuOpen(false)} className="h-9 px-3 rounded-lg text-slate-500 text-sm font-semibold">Kapat</button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
              <span className="text-slate-400 py-1">👁 Bağlı {room.viewers}:</span>
              {room.online.map((o, i) => (
                <span key={i} className={`px-2 py-1 rounded ${o.name ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {o.name ?? 'İzleyici'}{o.name ? ' · masada' : ''}{o.me ? ' (sen)' : ''}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                <button onClick={() => sendOp({ t: 'undo' })} disabled={!room.canUndo} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-30">⏪ Geri al</button>
                <button onClick={() => sendOp({ t: 'redo' })} disabled={!room.canRedo} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-30">İleri al ⏩</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
              <button onClick={copyLink} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">{copied ? '✓ Kopyalandı' : '🔗 Linki kopyala'}</button>
              {canEdit && <button onClick={() => { setMenuOpen(false); setTitleOpen(true); }} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">✏️ Masa adı</button>}
              {canEdit && <button onClick={() => { setMenuOpen(false); setPinOpen(true); }} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">{room.pinSet ? '🔒 Masa şifresi' : '🔓 Masa şifresi'}</button>}
              {canEdit && <button onClick={() => { setMenuOpen(false); sendOp({ t: 'leave' }); }} className="h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">🚪 Masadan ayrıl</button>}
              <button onClick={() => setCountdownTick(!tickOn)} aria-pressed={tickOn}
                className={`col-span-2 h-12 rounded-xl border ${tickOn ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                {tickOn ? '🔊 Son 10 sn bip: açık' : '🔇 Son 10 sn bip: kapalı'}
              </button>
            </div>
            {canEdit ? (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400">Oyun bitince</p>
                <button onClick={() => { setMenuOpen(false); setCloseConfirm(true); }} disabled={!hasScore} className="w-full h-14 rounded-xl bg-amber-500 text-slate-900 text-[15px] font-bold shadow disabled:opacity-30">📦 Oyunu kapat · arşive kaydet</button>
                <button onClick={() => { setMenuOpen(false); setClearConfirm(true); }} disabled={!hasScore} className="w-full h-11 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 text-sm font-semibold disabled:opacity-30">🗑 Tabloyu temizle · arşive kaydetmez</button>
              </div>
            ) : (
              <p className="text-[11px] font-bold text-slate-400">Oyunu kapatmak ve masa ayarları için önce masaya katıl.</p>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={clearConfirm}
        title="Tabloyu temizle"
        message="Tablodaki tüm puanlar silinecek ve oyun arşive KAYDEDİLMEYECEK. Oyunu saklamak için 'Oyunu kapat' kullan. Emin misin?"
        confirmLabel="Evet, temizle"
        danger
        onCancel={() => setClearConfirm(false)}
        onConfirm={() => { sendOp({ t: 'newGame' }); setClearConfirm(false); }}
      />
      <ConfirmDialog
        open={closeConfirm}
        title="Oyunu kapat"
        message="Oyun kapatılıp arşive eklenecek ve masada yeni boş bir oyun açılacak. Masadakiler kalkar, sen kalırsın; diğerleri Katıl ile döner. Emin misin?"
        confirmLabel="Evet, kapat"
        danger
        onCancel={() => setCloseConfirm(false)}
        onConfirm={() => { sendOp({ t: 'closeGame' }); setCloseConfirm(false); }}
      />
      {lastDeleted && !error && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white text-xs font-black pl-4 pr-1.5 py-1.5 rounded-full shadow-xl flex items-center gap-3 whitespace-nowrap">
          Oyun silindi
          <button onClick={undoDelete} className="h-8 px-3 rounded-full bg-amber-400 text-slate-900">Geri al</button>
        </div>
      )}
      {roomNotice && !lastDeleted && !error && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl">{roomNotice}</div>
      )}
      {notice && !error && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[300] bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl">{notice}</div>
      )}
      {error && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl">{error}</div>
      )}
    </>
  );
}
