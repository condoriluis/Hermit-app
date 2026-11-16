import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0b0e11',
        panel: '#12161b',
        'panel-2': '#181d24',
        line: '#232a33',
        'line-strong': '#323c49',
        text: '#e8edf2',
        'text-2': '#c4ccd6',
        muted: '#8b97a5',
        placeholder: '#667281',
        'on-solid': '#04201c',
        accent: {
          DEFAULT: '#2dd4bf',
          hover: '#5eead4',
          soft: 'rgba(45, 212, 191, 0.12)',
          border: 'rgba(45, 212, 191, 0.4)',
        },
        ok: '#4ade80',
        warn: '#fbbf24',
        bad: '#f87171',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 35px -5px rgba(45, 212, 191, 0.35)',
        card: '0 8px 30px rgba(0, 0, 0, 0.5)',
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
      },
    },
  },
  plugins: [],
}

export default config
