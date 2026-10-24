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
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, confirmLabel, danger, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <Overlay onClose={onCancel}>
      <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
        <button onClick={onConfirm} className={`h-10 px-4 rounded-lg text-[11px] font-black uppercase text-white shadow ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{confirmLabel}</button>
      </div>
    </Overlay>
  );
};

interface JoinDialogProps {
  open: boolean;
  onJoin: (name: string) => void;
  onCancel: () => void;
}

export const JoinDialog: React.FC<JoinDialogProps> = ({ open, onJoin, onCancel }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;
  const trimmed = name.trim();
  return (
    <Overlay onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); if (trimmed) onJoin(trimmed); }}>
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-1">Masaya katıl</h3>
        <p className="text-xs text-slate-500 mb-3">İlk boş sandalyeye oturursun. Katılan herkes skor girebilir.</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={MAX_NAME_LEN}
          placeholder="Adın"
          className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base font-black uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 hover:bg-slate-50">Vazgeç</button>
          <button type="submit" disabled={!trimmed} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-[11px] font-black uppercase text-white shadow">Katıl</button>
        </div>
      </form>
    </Overlay>
  );
};
