// 디자인 토큰은 DESIGN.md가 원본이다. 바꿀 때는 DESIGN.md를 고친 뒤 `npm run design:tokens`.
const { colors, fontSize, borderRadius, spacing } = require('./design-tokens.json').theme.extend;

const sans = ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'sans-serif'];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors,
      fontSize,
      borderRadius,
      spacing,
      fontFamily: { sans },
      boxShadow: {
        // DESIGN.md "Elevation & Depth"
        e1: '0 1px 2px rgb(28 25 23 / .06), 0 4px 12px rgb(28 25 23 / .08)',
        e2: '0 1px 0 rgb(255 255 255 / .6) inset, 0 8px 24px rgb(28 25 23 / .12)',
        e3: '0 24px 64px rgb(28 25 23 / .24)',
      },
    },
  },
  plugins: [],
}
