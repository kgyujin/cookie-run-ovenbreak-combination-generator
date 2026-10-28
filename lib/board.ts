import { CSSProperties } from 'react';
import { BackgroundData, BoardStyle, FontSettings } from '@/types';

/**
 * 조합표 크기 단위. 보드는 기준 폭(2열 1552px, 1열 764px)으로 디자인돼 있고
 * 화면 폭에 맞춰 --u 배율로 통째로 확대/축소된다 (globals.css의 .board 참고).
 * 그래서 어떤 화면에서도, 저장한 이미지에서도 배치 비율이 같다.
 */
export const u = (px: number) => `calc(${px} * var(--u))`;

/** 아레나 높이 (보드 px) */
export const ARENA_HEIGHT = 425;

/** 아레나 안에서 꾹 눌러 옮길 수 있는 칸. 메인 쿠키 두 칸과 사탕+축복은 한 덩어리로 움직인다 */
export const LAYOUT_KEYS = [
  'number', 'dish', 'mainCookies', 'pet', 'treasure0', 'treasure1', 'treasure2', 'score', 'candy1', 'candy2',
  'subPet', 'subScore', 'subCookies', 'subTreasure0', 'subTreasure1', 'subTreasure2',
] as const;

/** 칸을 옮긴 만큼 (CSS translate 속성: 칸의 hover 효과용 transform과 겹치지 않게) */
export const moved = (offset?: [number, number]): CSSProperties | undefined => offset && { translate: `${u(offset[0])} ${u(offset[1])}` };

/** 조합표 기준 폭 (2열) */
export const BOARD_WIDTH = 1552;

export const fontFamilyOf = (family: FontSettings['fontFamily']) =>
  `${{ Pretendard: "'Pretendard Variable', Pretendard", CookieRun: 'CookieRun', Custom: 'CustomFont' }[family]}, 'Pretendard Variable', Pretendard, sans-serif`;

export function backgroundCss(background: BackgroundData) {
  if (background.type === 'color' && background.color) return background.color;
  if (background.type === 'gradient' && background.gradient)
    return `linear-gradient(${background.angle ?? 135}deg, ${background.gradient[0]}, ${background.gradient[1]})`;
  if (background.type === 'image' && background.imageUrl) {
    const fit = { cover: 'center/cover no-repeat', contain: 'center/contain no-repeat', repeat: 'top left repeat' }[background.imageFit ?? 'cover'];
    const dim = background.dim ? `linear-gradient(rgb(0 0 0 / ${background.dim}), rgb(0 0 0 / ${background.dim})), ` : '';
    return `${dim}url("${background.imageUrl}") ${fit}, #1c1917`;
  }
  // 이미지 주소를 아직 넣지 않은 경우 등: 저장 이미지가 투명해지지 않게 기본 바탕
  return '#fffbf5';
}

/** 화면 위·아래 끝(당겼을 때 드러나는 곳)에 칠할 단색 */
export function backgroundEdgeColor(background: BackgroundData) {
  if (background.type === 'color') return background.color ?? '#fffbf5';
  if (background.type === 'gradient') return background.gradient?.[0] ?? '#fffbf5';
  return background.imageUrl ? '#1c1917' : '#fffbf5'; // 이미지 주소가 없으면 기본 바탕과 같게
}

/** 글자색이 밝으면 어두운 테두리 빛, 어두우면 흰 테두리 빛 (어떤 배경에서도 번호가 읽히게) */
export function textGlow(color = '#1c1917') {
  const hex = color.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.length === 3 ? hex[i / 2].repeat(2) : hex.slice(i, i + 2), 16));
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  const c = light ? 'rgb(0 0 0 / .65)' : 'white';
  return `0 0 3px ${c}, 0 0 5px ${c}, 0 0 8px ${c}, 1px 1px 2px ${c}, -1px -1px 2px ${c}, 1px -1px 2px ${c}, -1px 1px 2px ${c}`;
}

/**
 * 글자 외곽선: 글자 뒤에 깔리는 그림자 고리로 그린다.
 * -webkit-text-stroke는 입력칸에서 글자 위에 덮여 그려져(글자가 가늘어짐) 저장 이미지와 달라 보이므로 화면과 저장 모두 이 방식으로.
 * unit: 보드 배율 단위 (u, tu)
 */
export function outlineShadow(width: number, color: string, unit: (px: number) => string) {
  const steps = Math.max(12, Math.ceil(width * 8));
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return `${unit(+(Math.cos(a) * width).toFixed(3))} ${unit(+(Math.sin(a) * width).toFixed(3))} 0 ${color}`;
  }).join(', ');
}

/** #rrggbb + 0~100 투명도 → rgb() */
export function withOpacity(hex: string, opacity: number) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r} ${g} ${b} / ${opacity / 100})`;
}

/** 아레나·시즌 영역 카드 모양 */
export function cardStyle(style: Pick<BoardStyle, 'cardColor' | 'cardOpacity' | 'cardRadius' | 'cardBorderWidth' | 'cardBorderColor' | 'cardShadow'>): CSSProperties {
  return {
    backgroundColor: withOpacity(style.cardColor, style.cardOpacity),
    borderRadius: u(style.cardRadius),
    border: style.cardBorderWidth ? `${u(style.cardBorderWidth)} solid ${style.cardBorderColor}` : undefined,
    boxShadow: style.cardShadow ? '0 8px 24px rgb(0 0 0 / 0.15)' : undefined,
  };
}
