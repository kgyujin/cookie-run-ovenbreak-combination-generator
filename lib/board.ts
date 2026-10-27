import { BackgroundData, FontSettings } from '@/types';

/**
 * 조합표 크기 단위. 보드는 기준 폭(2열 1552px, 1열 764px)으로 디자인돼 있고
 * 화면 폭에 맞춰 --u 배율로 통째로 확대/축소된다 (globals.css의 .board 참고).
 * 그래서 어떤 화면에서도, 저장한 이미지에서도 배치 비율이 같다.
 */
export const u = (px: number) => `calc(${px} * var(--u))`;

/** 이미지 저장 시 고정 폭 (보드 1552px + 좌우 여백 64px) */
export const EXPORT_WIDTH = 1680;

export const fontFamilyOf = (family: FontSettings['fontFamily']) =>
  `${{ Pretendard: "'Pretendard Variable', Pretendard", CookieRun: 'CookieRun', Custom: 'CustomFont' }[family]}, 'Pretendard Variable', Pretendard, sans-serif`;

export function backgroundCss(background: BackgroundData) {
  if (background.type === 'color' && background.color) return background.color;
  if (background.type === 'gradient' && background.gradient)
    return `linear-gradient(135deg, ${background.gradient[0]}, ${background.gradient[1]})`;
  if (background.type === 'image' && background.imageUrl) return `url("${background.imageUrl}") center/cover`;
  return '';
}

/** 글자색이 밝으면 어두운 테두리 빛, 어두우면 흰 테두리 빛 (어떤 배경에서도 번호가 읽히게) */
export function textGlow(color = '#111827') {
  const hex = color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.length === 3 ? hex[i / 2].repeat(2) : hex.slice(i, i + 2), 16));
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  const c = light ? 'rgb(0 0 0 / .65)' : 'white';
  return `0 0 3px ${c}, 0 0 5px ${c}, 0 0 8px ${c}, 1px 1px 2px ${c}, -1px -1px 2px ${c}, 1px -1px 2px ${c}, -1px 1px 2px ${c}`;
}
