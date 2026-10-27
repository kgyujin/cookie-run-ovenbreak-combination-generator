export type Category = 'cookies' | 'pets' | 'treasures' | 'dishes' | 'ingredients' | 'magicCandies' | 'blessings';

export type GameData = Record<Category, GameItem[]> & {
  /** 옛 이미지 경로/이름 → 현재 이름 (data/item-meta.json 의 renamed) */
  renamed?: Record<string, string>;
};

export interface GameItem {
  id: string; // `${category}:${rarity}/${name}` — 파일명이 바뀌지 않는 한 고정
  name: string;
  image: string;
  rarity?: string; // legendary, epic, rare, common
  description?: string;
  aliases?: string[];
  addedAt?: string; // YYYY-MM-DD, 신규 배지 표시용
  pinned?: boolean;
  thumb?: string; // 선택 창용 작은 이미지
}

export interface ComboData {
  pet: string;
  cookie1: string;
  cookie2: string;
  treasures: [string, string, string];
}

export interface MagicCandyData {
  cookie1Candy: string;
  cookie1Blessing: string;
  cookie2Candy: string;
  cookie2Blessing: string;
}

export interface ScoreData {
  value: string;
}

export interface ArenaData {
  youtubeUrl: string | null;
  mainCombo: ComboData;
  magicCandy: MagicCandyData;
  score: ScoreData;
  dish: string;
  subCombo: ComboData;
  subScore: ScoreData;
  mainCookieRatio: number; // 메인 조합 선달/이달 쿠키 비율 (0-100, 기본 54)
  subCookieRatio: number; // 대체 조합 선달/이달 쿠키 비율 (0-100, 기본 56)
}

export type BackgroundType = 'color' | 'gradient' | 'image';

export interface BackgroundData {
  type: BackgroundType;
  color?: string;
  gradient?: [string, string];
  angle?: number; // 그라데이션 방향 (기본 135)
  imageUrl?: string;
  imageFit?: 'cover' | 'contain' | 'repeat';
  dim?: number; // 이미지 어둡게 0~0.6
}

export type ScoreDisplayType = 'abbreviated' | 'comma' | 'korean';

export interface FontSettings {
  fontSize: number;
  fontFamily: 'Pretendard' | 'CookieRun' | 'Custom';
  textAlign: 'left' | 'center' | 'right';
  customFontUrl?: string;
  customFontName?: string;
  fontColor?: string;
  fontWeight?: number; // 시즌명 굵기 (기본 700)
  seasonStrokeColor?: string;
  seasonStrokeWidth?: number;
  scoreColor?: string;
  scoreFontSize?: number;
  scoreFontWeight?: number; // 점수 굵기 (기본 400)
  scoreStrokeColor?: string;
  scoreStrokeWidth?: number;
  numberColor?: string; // 아레나 번호 색 (없으면 시즌명 색)
  numberSize?: number; // 아레나 번호 크기 (기본 18)
}

export interface DisplaySettings {
  scoreDisplayType: ScoreDisplayType;
}

/** 저장·공유되는 조합표 상태 */
export interface BoardState {
  background: BackgroundData;
  seasonName: string;
  seasonDish: string;
  seasonIngredients: [string, string, string];
  arenas: ArenaData[];
  fontSettings: FontSettings;
  displaySettings: DisplaySettings;
}
