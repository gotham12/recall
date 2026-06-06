/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FDFAF6',
          100: '#F8F4EF',
          200: '#F0E8DC',
          300: '#E5D5C0',
        },
        electric: {
          50:  '#EEF6FF',
          100: '#DBEEFF',
          200: '#A8D8FF',
          300: '#60B3FF',
          400: '#2196F3',
          500: '#0E7AE6',
          600: '#0057CC',
          700: '#0041A8',
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
        'lava1': 'lava1 14s ease-in-out infinite',
        'lava2': 'lava2 18s ease-in-out infinite',
        'lava3': 'lava3 22s ease-in-out infinite',
        'lava4': 'lava4 16s ease-in-out infinite',
        'lava5': 'lava5 20s ease-in-out infinite',
        'lava6': 'lava6 12s ease-in-out infinite',
        'breathe-in':   'breatheScale 4s ease-in-out forwards',
        'breathe-hold': 'breatheHold 4s ease-in-out forwards',
        'breathe-out':  'breatheScale 4s ease-in-out reverse forwards',
        'fade-in':      'fadeIn 0.6s ease-out forwards',
        'mic-pulse':    'micPulse 1.5s ease-in-out infinite',
        'slide-up':     'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        lava1: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':      { transform: 'translate(40px,-60px) scale(1.15)' },
          '66%':      { transform: 'translate(-30px,40px) scale(0.9)' },
        },
        lava2: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '25%':      { transform: 'translate(-50px,70px) scale(1.2)' },
          '75%':      { transform: 'translate(60px,-40px) scale(0.85)' },
        },
        lava3: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '40%':      { transform: 'translate(30px,80px) scale(1.1)' },
          '80%':      { transform: 'translate(-40px,-50px) scale(0.95)' },
        },
        lava4: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '50%':      { transform: 'translate(-60px,30px) scale(1.25)' },
        },
        lava5: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '30%':      { transform: 'translate(70px,50px) scale(0.9)' },
          '70%':      { transform: 'translate(-20px,-70px) scale(1.15)' },
        },
        lava6: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '45%':      { transform: 'translate(-80px,-30px) scale(1.1)' },
          '90%':      { transform: 'translate(50px,60px) scale(0.95)' },
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(33,150,243,0.4)' },
          '50%':      { boxShadow: '0 0 0 20px rgba(33,150,243,0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
