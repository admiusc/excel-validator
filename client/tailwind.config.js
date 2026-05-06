/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080f1e',
          900: '#0d1526',
          800: '#111d35',
          700: '#162344',
          600: '#1e2f57',
          500: '#2a3f6f',
          400: '#3a5490',
        },
        brand: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
          light: '#818cf8',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
        'gradient-dark': 'radial-gradient(ellipse at top, #111d35 0%, #080f1e 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
