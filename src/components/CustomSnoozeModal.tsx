'use client';

import { useState, useEffect } from 'react';

export function CustomSnoozeModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void | Promise<void>;
}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(45);

  useEffect(() => {
    if (open) { setHours(0); setMinutes(45); }
  }, [open]);

  if (!open) return null;
  const total = hours * 60 + minutes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold tracking-tight">Custom snooze</h3>
        <p className="mt-1 text-sm text-ink-500">Pick how long to be unavailable.</p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-ink-400 mb-2">Hours</span>
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-ink-400 mb-2">Minutes</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              className="input w-full"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={total <= 0}
            onClick={() => onConfirm(total)}
            className="btn-primary flex-1"
          >
            Snooze
          </button>
        </div>
      </div>
    </div>
  );
}
