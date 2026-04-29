'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstaller() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!evt || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 px-4 fade-up">
      <div className="mx-auto max-w-md card flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <div className="text-sm font-medium">Install on your phone</div>
          <div className="text-xs text-ink-500">Get one-tap access from your home screen.</div>
        </div>
        <button onClick={() => setDismissed(true)} className="btn-ghost text-sm px-3 py-2">
          Not now
        </button>
        <button
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            setEvt(null);
          }}
          className="btn-primary text-sm px-3 py-2"
        >
          Install
        </button>
      </div>
    </div>
  );
}
