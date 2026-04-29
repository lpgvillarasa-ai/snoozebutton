import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50:  '#f7f7f8',
          100: '#eeeef1',
          200: '#d9d9df',
          300: '#b8b8c2',
          400: '#8e8e9b',
          500: '#6b6b78',
          600: '#4f4f5a',
          700: '#3a3a44',
          800: '#1f1f26',
          900: '#0e0e12',
        },
        status: {
          available:    '#10b981',
          unavailable:  '#ef4444',
          snoozed:      '#f59e0b',
          calendar:     '#64748b',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,15,20,.04), 0 8px 32px rgba(15,15,20,.06)',
        card: '0 1px 2px rgba(15,15,20,.05), 0 12px 40px rgba(15,15,20,.08)',
        ring: '0 0 0 1px rgba(15,15,20,.06)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
