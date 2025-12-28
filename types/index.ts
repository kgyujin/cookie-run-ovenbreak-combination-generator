export interface GameData {
  cookies: GameItem[];
  pets: GameItem[];
  treasures: GameItem[];
  dishes: GameItem[];
  ingredients: GameItem[];
  magicCandies: GameItem[];
  blessings: BlessingItem[];
}

export interface GameItem {
  id: string;
  name: string;
  image: string;
  rarity?: string; // legendary, epic, rare, common
}

export interface BlessingItem extends GameItem {
  description: string;
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
  unit: '-' | '점' | 'M' | 'K' | '억' | '만';
}

export interface ArenaData {
  youtubeUrl: string | null;
  mainCombo: ComboData;
  magicCandy: MagicCandyData;
  score: ScoreData;
  dish: string;
  subCombo: ComboData;
  subScore: ScoreData;
  isSubComboExpanded: boolean;
  mainCookieRatio: number; // 메인 조합 선달/이달 쿠키 비율 (0-100, 기본 54)
  subCookieRatio: number; // 대체 조합 선달/이달 쿠키 비율 (0-100, 기본 56)
}

export type BackgroundType = 'color' | 'gradient' | 'image';

export interface BackgroundData {
  type: BackgroundType;
  color?: string;
  gradient?: [string, string];
  imageUrl?: string;
}

export type ScoreDisplayType = 'abbreviated' | 'comma' | 'korean';

export interface FontSettings {
  fontSize: number;
  fontFamily: 'Pretendard' | 'CookieRun' | 'Custom';
  textAlign: 'left' | 'center' | 'right';
  customFontUrl?: string;
  customFontName?: string;
}

export interface DisplaySettings {
  scoreDisplayType: ScoreDisplayType;
}

export interface AppState {
  background: BackgroundData;
  seasonName: string;
  seasonDish: string;
  seasonIngredients: [string, string, string];
  arenas: ArenaData[];
  gameData: GameData | null;
  fontSettings: FontSettings;
  displaySettings: DisplaySettings;
}
