import Link from 'next/link';

type Tab = 'dashboard' | 'admin' | 'settings';

export function BottomNav({ active, isBoss }: { active: Tab; isBoss?: boolean }) {
  const items: Array<{ key: Tab; href: string; label: string; icon: React.ReactNode }> = [
    {
      key: 'dashboard',
      href: '/dashboard',
      label: 'Status',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    ...(isBoss
      ? [
          {
            key: 'admin' as const,
            href: '/admin',
            label: 'Control',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 12h6M14 12h6M4 6h10M10 18h10" strokeLinecap="round" />
              </svg>
            ),
          },
        ]
      : []),
    {
      key: 'settings',
      href: '/settings',
      label: 'Settings',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur safe-bottom"
      style={{ WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto max-w-md grid"
           style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}>
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              className={`flex flex-col items-center justify-center py-3 gap-1 text-xs ${
                isActive
                  ? 'text-ink-900 dark:text-white'
                  : 'text-ink-400 dark:text-ink-500'
              }`}
            >
              {it.icon}
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
