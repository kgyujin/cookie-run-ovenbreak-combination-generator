import { BackgroundData } from '@/types';

/** 배경 프리셋. ink는 그 배경 위에서 잘 읽히는 시즌명·번호·점수 글자색 */
export interface BackgroundPreset {
  name: string;
  background: BackgroundData;
  ink: string;
}

const DARK_INK = '#1c1917';
const LIGHT_INK = '#ffffff';

const gradient = (name: string, from: string, to: string, ink = DARK_INK): BackgroundPreset => ({
  name,
  background: { type: 'gradient', gradient: [from, to] },
  ink,
});

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  gradient('버터 쿠키', '#fff3d6', '#ffd59e'),
  gradient('오븐 노을', '#ffc48c', '#f0845c'),
  gradient('딸기 우유', '#ffe0e8', '#ff9eb5'),
  gradient('민트 초코', '#c9f5ea', '#5bbfa9'),
  gradient('블루베리', '#c7d2fe', '#818cf8'),
  gradient('라벤더', '#667eea', '#764ba2'),
  gradient('밤하늘', '#312e81', '#0f172a', LIGHT_INK),
  gradient('다크 초코', '#5b3418', '#1c1917', LIGHT_INK),
  { name: '크림', background: { type: 'color', color: '#fffbf5' }, ink: DARK_INK },
  { name: '흰색', background: { type: 'color', color: '#ffffff' }, ink: DARK_INK },
];

export const DEFAULT_BACKGROUND = BACKGROUND_PRESETS[0].background;

export const isSameBackground = (a: BackgroundData, b: BackgroundData) =>
  a.type === b.type &&
  (a.type === 'color'
    ? a.color?.toLowerCase() === b.color?.toLowerCase()
    : a.type === 'gradient'
      ? a.gradient?.join().toLowerCase() === b.gradient?.join().toLowerCase() && (a.angle ?? 135) === (b.angle ?? 135)
      : a.imageUrl === b.imageUrl);
