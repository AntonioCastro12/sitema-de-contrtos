/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rcm: {
          primary: '#1E3A5F',
          deep: '#1A5276',
          cyan: '#5DADE2',
          wine: '#65174E',
          bg: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(30, 58, 95, 0.08)',
        'nav': '0 -4px 16px rgba(26, 82, 118, 0.08)',
      }
    },
  },
  plugins: [],
}
