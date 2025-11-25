/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          primary: '#9333ea',
          secondary: '#ec4899',
          accent: '#a855f7',
          neutral: '#1e293b',
          'base-100': '#ffffff',
          'base-content': '#0f172a',
        },
        dark: {
          primary: '#9333ea',
          secondary: '#ec4899',
          accent: '#a855f7',
          neutral: '#0B0E14',
          'base-100': '#0B0E14',
          'base-content': '#f1f5f9',
        },
      },
    ],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: false,
    themeRoot: ':root',
  },
};

