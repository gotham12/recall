/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forgetmenot: {
          blue: '#4A90D9',
          light: '#8ECDF5',
          deep: '#1A4A7A',
          soft: '#D6EBFA',
          sky: '#EBF5FF',
          yellow: '#FFD44D',
          gold: '#F5A623',
          green: '#3D8B6E',
        },
        cream: {
          50:  '#F5FAFF',
          100: '#EBF5FF',
          200: '#D6EBFA',
          300: '#B8D9F0',
        },
        coral: {
          400: '#6BB3E8',
          500: '#4A90D9',
          600: '#2E6DB0',
        },
        sage: {
          400: '#5CB88A',
          500: '#3D8B6E',
          600: '#2D6A4F',
        },
        lavender: {
          400: '#8BA8E8',
          500: '#6B8FD4',
        },
        electric: {
          50:  '#EBF5FF',
          100: '#D6EBFA',
          200: '#8ECDF5',
          300: '#6BB3E8',
          400: '#4A90D9',
          500: '#2E6DB0',
          600: '#1A4A7A',
          700: '#0F2847',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'base': ['20px', { lineHeight: '1.5' }],
        'lg':   ['22px', { lineHeight: '1.5' }],
        'xl':   ['26px', { lineHeight: '1.4' }],
        '2xl':  ['30px', { lineHeight: '1.3' }],
        '3xl':  ['36px', { lineHeight: '1.2' }],
        '4xl':  ['44px', { lineHeight: '1.1' }],
      },
      animation: {
        'aurora': 'auroraShift 12s ease-in-out infinite',
        'pulse-warmth': 'warmthPulse 2.4s ease-in-out infinite',
        'breathe-in':   'breatheScale 4s ease-in-out forwards',
        'breathe-hold': 'breatheHold 4s ease-in-out forwards',
        'breathe-out':  'breatheScale 4s ease-in-out reverse forwards',
        'fade-in':      'fadeIn 0.6s ease-out forwards',
        'mic-pulse':    'micPulse 1.5s ease-in-out infinite',
        'slide-up':     'slideUp 0.4s ease-out forwards',
        'fm-breathe':   'forgetMeNotBreathe 4s ease-in-out infinite',
      },
      keyframes: {
        auroraShift: {
          '0%, 100%': { filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(15deg)' },
        },
        warmthPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
        breatheScale: {
          '0%':   { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.3)' },
        },
        breatheHold: {
          '0%, 100%': { transform: 'scale(1.3)' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        micPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(74,144,217,0.45)' },
          '50%':      { boxShadow: '0 0 0 20px rgba(74,144,217,0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        forgetMeNotBreathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
      },
    },
  },
  plugins: [],
};
