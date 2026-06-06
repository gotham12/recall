/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        atkinson: ['"Atkinson Hyperlegible"', 'sans-serif'],
      },
      colors: {
        blue: { DEFAULT: '#0E7AE6', dark: '#0057CC', dim: 'rgba(14,122,230,0.12)' },
        navy: { DEFAULT: '#1A2B4A', deep: '#0A1628' },
        cream: '#F8F5F0',
      },
    },
  },
  plugins: [],
};
