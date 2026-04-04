/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#E1F5EE', 100: '#9FE1CB', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
        amber: { 50: '#FAEEDA', 400: '#EF9F27', 600: '#854F0B' },
        blue: { 50: '#E6F1FB', 400: '#378ADD', 600: '#185FA5', 800: '#0C447C' },
        purple: { 50: '#EEEDFE', 600: '#534AB7', 800: '#3C3489' },
        red: { 50: '#FCEBEB', 200: '#F7C1C1', 600: '#A32D2D' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}
