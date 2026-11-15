import React, { useEffect, useState } from 'react';

// Geçici ölçü aracı (☰ → Ekran ölçüsü): üst 160 pt'ye her 10 pt'de bir çizgi ve numara çizer,
// ortada telefonun bildirdiği değerleri gösterir. iPhone'daki üst bulanıklığın nerede başlayıp bittiği
// ve sayfanın saat çubuğunun arkasından mı altından mı başladığı ekran görüntüsünden okunur.
// En üst kenara (ilk 10 pt) hiçbir şey koymaz: iOS bulanıklık kararını en üstteki sabit öğeye bakarak verir.
const readInset = (side: 'top' | 'bottom' | 'left' | 'right') => {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;visibility:hidden;height:env(safe-area-inset-${side});`;
  document.body.appendChild(el);
  const h = el.offsetHeight;
  el.remove();
  return h;
};

export const ScreenRuler: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [info, setInfo] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content') ?? '-';
      setInfo({
        'kenar üst / alt': `${readInset('top')} / ${readInset('bottom')} pt`,
        'kenar sol / sağ': `${readInset('left')} / ${readInset('right')} pt`,
        'pencere': `${innerWidth} × ${innerHeight}`,
        'ekran': `${screen.width} × ${screen.height}`,
        'uygulama olarak': (navigator as unknown as { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches ? 'evet' : 'hayır (tarayıcı)',
        'saat çubuğu ayarı': meta,
        'sayfa en üst noktası': `${Math.round(document.documentElement.getBoundingClientRect().top)} pt`,
      });
    };
    read();
    addEventListener('resize', read);
    return () => removeEventListener('resize', read);
  }, []);

  const lines = Array.from({ length: 16 }, (_, i) => (i + 1) * 10);
  return (
    <>
      {lines.map(y => (
        <div key={y} className="fixed inset-x-0 z-[500] pointer-events-none" style={{ top: y }}>
          <div className={`h-px ${y % 50 === 0 ? 'bg-red-600' : 'bg-red-500/60'}`} />
          {[8, 120, 260].map(x => (
            <span key={x} className="absolute -top-2 text-[10px] font-black leading-none text-red-600 bg-white/80 px-0.5" style={{ left: x }}>{y}</span>
          ))}
        </div>
      ))}
      <div className="fixed z-[500] left-1/2 -translate-x-1/2 top-[200px] w-[86%] max-w-sm bg-white border-2 border-red-500 rounded-xl p-3 text-[12px] font-bold text-slate-800 shadow-xl">
        <p className="font-black uppercase text-red-600 mb-1">Ekran ölçüsü</p>
        {Object.entries(info).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2"><span className="text-slate-500">{k}</span><span>{v}</span></div>
        ))}
        <p className="text-[11px] text-slate-500 mt-2">Bu ekranın görüntüsünü al ve gönder. Bulanıklığın hangi çizgiler arasında olduğu görünecek.</p>
        <button onClick={onClose} className="mt-2 w-full h-9 rounded-lg bg-red-600 text-white font-black uppercase">Kapat</button>
      </div>
    </>
  );
};
