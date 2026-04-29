'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Inline script run before paint to avoid theme flash.
 * Reads localStorage('theme') -> 'light' | 'dark' | null (system).
 */
export function ThemeBoot() {
  return (
    <Script id="theme-boot" strategy="beforeInteractive">{`
      try {
        var t = localStorage.getItem('theme');
        var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = t === 'dark' || (!t && sys);
        if (dark) document.documentElement.classList.add('dark');
      } catch (_) {}
    `}</Script>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const t = (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'system';
    setTheme(t);
  }, []);

  function apply(next: 'light' | 'dark' | 'system') {
    setTheme(next);
    if (next === 'system') {
      localStorage.removeItem('theme');
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', sys);
    } else {
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  }

  const opts: Array<{ key: typeof theme; label: string }> = [
    { key: 'light',  label: 'Light' },
    { key: 'dark',   label: 'Dark' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="surface inline-flex rounded-full p-1">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => apply(o.key)}
          className={`px-3 py-1.5 text-sm rounded-full transition ${
            theme === o.key
              ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
              : 'text-ink-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
