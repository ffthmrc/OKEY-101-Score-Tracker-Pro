import React, { useEffect, useState } from 'react';
import { MAX_NAME_LEN } from './shared/game';

const Overlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[200] bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in duration-150" onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  askPin?: string;              // verilirse PIN kutusu gösterilir (etiketi bu metin)
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

const PinInput: React.FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => (
  <input
    autoFocus
    type="password"
    inputMode="numeric"
    autoComplete="off"
    maxLength={6}
    value={value}
    onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
    placeholder={label}
    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
  />
);

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, confirmLabel, danger, askPin, onConfirm, onCancel }) => {
  const [pin, setPin] = useState('');
  useEffect(() => { if (!open) setPin(''); }, [open]);
  if (!open) return null;
  const ready = !askPin || pin.length >= 4;
  return (
    <Overlay onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (ready) onConfirm(pin); }}>
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        {askPin && <PinInput value={pin} onChange={setPin} label={askPin} />}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
          <button type="submit" disabled={!ready} className={`h-10 px-4 rounded-lg text-[11px] font-black uppercase text-white shadow disabled:opacity-40 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{confirmLabel}</button>
        </div>
      </form>
    </Overlay>
  );
};

interface TablePinDialogProps {
  open: boolean;
  pinSet: boolean;
  onSave: (pin: string | null) => void;
  onCancel: () => void;
}

// Masa şifresi: konursa katılmak isteyen önce şifreyi girer, sonra yine masadan onay bekler
export const TablePinDialog: React.FC<TablePinDialogProps> = ({ open, pinSet, onSave, onCancel }) => {
  const [pin, setPin] = useState('');
  useEffect(() => { if (!open) setPin(''); }, [open]);
  if (!open) return null;
  return (
    <Overlay onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (pin.length >= 4) onSave(pin); }}>
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-1">Masa şifresi</h3>
        <p className="text-xs text-slate-500 mb-3">
          {pinSet ? 'Şifre konmuş. Yeni şifre yaz ya da kaldır.' : 'Şifre yok. Koyarsan katılmak isteyen önce şifreyi girer, sonra masadan onay bekler.'}
        </p>
        <PinInput value={pin} onChange={setPin} label="4-6 rakam" />
        <div className="flex gap-2 justify-end">
          {pinSet && (
            <button type="button" onClick={() => onSave(null)} className="h-10 px-3 mr-auto rounded-lg border border-red-200 text-[11px] font-black uppercase text-red-600 hover:bg-red-50">Kaldır</button>
          )}
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
          <button type="submit" disabled={pin.length < 4} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-[11px] font-black uppercase text-white shadow">Kaydet</button>
        </div>
      </form>
    </Overlay>
  );
};

interface NameDialogProps {
  open: boolean;
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  heading?: string;
  placeholder?: string;
  maxLength?: number;
  resetLabel?: string;   // verilirse ek düğme (ör. "Tarih yap")
  onReset?: () => void;
}

// İsim değiştirme kutusu (oyuncu ismi, masa adı): telefonda rahat yazılır
export const NameDialog: React.FC<NameDialogProps> = ({
  open, initial, onSave, onCancel, heading = 'Oyuncu ismi', placeholder = 'İsim', maxLength = MAX_NAME_LEN, resetLabel, onReset,
}) => {
  const [name, setName] = useState(initial);
  useEffect(() => { if (open) setName(initial); }, [open, initial]);
  if (!open) return null;
  const trimmed = name.trim();
  return (
    <Overlay onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (trimmed) onSave(trimmed); }}>
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-3">{heading}</h3>
        <input
          autoFocus
          onFocus={e => e.currentTarget.select()}
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base font-black uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
        />
        <div className="flex gap-2 justify-end">
          {onReset && resetLabel && (
            <button type="button" onClick={onReset} className="h-10 px-3 mr-auto rounded-lg border border-slate-200 text-[11px] font-black uppercase text-indigo-600 hover:bg-slate-50">{resetLabel}</button>
          )}
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
          <button type="submit" disabled={!trimmed} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-[11px] font-black uppercase text-white shadow">Kaydet</button>
        </div>
      </form>
    </Overlay>
  );
};

interface JoinDialogProps {
  open: boolean;
  needPin: boolean;
  onJoin: (name: string, pin?: string) => void;
  onCancel: () => void;
}

export const JoinDialog: React.FC<JoinDialogProps> = ({ open, needPin, onJoin, onCancel }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  // Kapanırken temizle (açılırken temizlemek hızlı yazılan ilk harfleri silebiliyordu)
  useEffect(() => { if (!open) { setName(''); setPin(''); } }, [open]);
  if (!open) return null;
  const trimmed = name.trim();
  const ready = !!trimmed && (!needPin || pin.length >= 4);
  return (
    <Overlay onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (ready) onJoin(trimmed, needPin ? pin : undefined); }}>
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-1">Masaya katıl</h3>
        <p className="text-xs text-slate-500 mb-3">Masadaki biri onaylayınca oturursun. Adın masada yazılıysa o sandalyeye, değilse boş bir sandalyeye (P1, P5…) geçersin.</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={MAX_NAME_LEN}
          placeholder="Adın"
          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base font-black uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
        />
        {needPin && (
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Masa şifresi"
            className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
          />
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
          <button type="submit" disabled={!ready} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-[11px] font-black uppercase text-white shadow">Katıl</button>
        </div>
      </form>
    </Overlay>
  );
};
