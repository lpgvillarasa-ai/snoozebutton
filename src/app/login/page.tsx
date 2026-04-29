import { LoginButton } from '@/components/LoginButton';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-8 safe-top safe-bottom">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 dark:bg-white flex items-center justify-center shadow-card mb-6">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white dark:text-ink-900">
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Boss Availability</h1>
          <p className="mt-3 text-ink-500 dark:text-ink-400 text-base leading-relaxed">
            Know if the boss is free, in one tap.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-6 card p-4 text-sm text-status-unavailable">
            We couldn't sign you in. Please try again.
          </div>
        )}

        <LoginButton next={searchParams.next} />

        <p className="mt-10 text-center text-xs text-ink-400 dark:text-ink-500">
          By signing in, you agree to share your name and email with this app.
        </p>
      </div>
    </main>
  );
}
