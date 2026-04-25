/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tng: {
          blue: '#005BAA',
          'blue-dark': '#003D75',
          'blue-deep': '#002A52',
          'blue-300': '#7FAFD8',
          'blue-200': '#B8D2EA',
          'blue-100': '#E5EFF8',
          yellow: '#FFF200',
          'yellow-deep': '#F5C400',
          green: '#008443',
          orange: '#EB8705',
          pink: '#EF4E74',
          'warm-grey': '#726658',
        },
        surface: {
          0: '#FAFAF7',
          1: '#FFFFFF',
          2: '#F2F1EC',
          3: '#E5E4DD',
        },
        ink: {
          900: '#1A1A1A',
          700: '#3D3D3D',
          500: '#6E6E6E',
          300: '#A5A5A0',
        },
        rise: '#FF6B35',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        body: ['Open Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        editorial: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        cta: '0 4px 0 #F5C400',
      },
    },
  },
  plugins: [],
};
