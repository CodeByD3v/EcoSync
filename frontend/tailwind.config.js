/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // EcoSync premium fintech palette: slate grays, deep greens, neon accent.
        slatebg: '#0b0f14',
        panel: '#111820',
        panelborder: '#1e2a35',
        eco: {
          neon: '#34d399',
          green: '#22c55e',
          lime: '#a3e635',
          deep: '#064e3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(52, 211, 153, 0.25)',
      },
    },
  },
  plugins: [],
}
