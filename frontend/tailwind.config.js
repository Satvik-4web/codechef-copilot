/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#0b0d11',
          900: '#12151b',
          850: '#171b23',
          800: '#1e232e',
          750: '#262d3a',
          700: '#323a4b',
          600: '#485369',
        },
        brand: {
          500: '#6366f1', // indigo / violet
          600: '#4f46e5',
          700: '#4338ca',
          accent: '#38bdf8', // electric sky
        }
      }
    },
  },
  plugins: [],
}
