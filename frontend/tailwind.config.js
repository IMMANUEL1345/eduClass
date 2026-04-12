/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      borderRadius: { xl: '12px', '2xl': '16px' },
      fontSize: { xs: ['11px', '16px'], sm: ['13px', '20px'] },
    },
  },
  plugins: [],
};
