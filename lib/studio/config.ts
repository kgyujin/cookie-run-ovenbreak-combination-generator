/**
 * 관리자 페이지 설정 (모두 Vercel 환경변수, 서버에서만 읽음)
 * - STUDIO_PATH: 관리자 페이지 주소 (영문·숫자·-·_ 8자 이상, 예: 'k3x-room-81' → https://사이트/k3x-room-81). 없으면 관리자 페이지가 꺼진다.
 * - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET: GitHub OAuth 앱
 * - STUDIO_SESSION_SECRET: 로그인 쿠키 암호화 키 (32자 이상 무작위 문자열)
 * - STUDIO_LOCAL=1: 로컬 모드 (npm run dev 에서만, lib/studio/local.ts)
 */
export const REPO = 'kgyujin/cookie-run-ovenbreak-combination-generator';
export const BRANCH = 'main';
// 영문, 숫자, -, _ 로 8자 이상만
export const STUDIO_PATH = /^[A-Za-z0-9_-]{8,64}$/.test(process.env.STUDIO_PATH ?? '') ? process.env.STUDIO_PATH! : '';

export function studioConfigured() {
  return Boolean(
    STUDIO_PATH && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && (process.env.STUDIO_SESSION_SECRET?.length ?? 0) >= 32
  );
}

export const CATEGORY_FOLDERS = {
  cookies: 'cookies',
  pets: 'pets',
  treasures: 'treasures',
  dishes: 'dishes',
  ingredients: 'ingredients',
  magicCandies: 'magic_candies',
  blessings: 'blessings',
} as const;
export type StudioCategory = keyof typeof CATEGORY_FOLDERS;

/** 등급 폴더를 쓰는 카테고리 */
export const RARITY_CATEGORIES: StudioCategory[] = ['cookies', 'pets', 'treasures', 'magicCandies'];
export const RARITIES = ['legendary', 'epic', 'rare', 'common'] as const;
export type Rarity = (typeof RARITIES)[number];
