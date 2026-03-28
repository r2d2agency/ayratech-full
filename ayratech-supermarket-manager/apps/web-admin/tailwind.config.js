/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'surface-bright': 'var(--surface-bright)',
        'outline-variant': 'var(--outline-variant)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        'on-background': 'var(--on-background)',
        'on-surface-variant': 'var(--on-surface-variant)',
        ayra: {
          primary: 'var(--color-primary)',
          background: 'var(--color-background)',
          panel: 'var(--color-panel)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
        }
      },
      fontFamily: {
        headline: ['Space Grotesk', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
