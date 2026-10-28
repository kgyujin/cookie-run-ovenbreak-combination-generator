export type Category = 'cookies' | 'pets' | 'treasures' | 'dishes' | 'ingredients' | 'magicCandies' | 'blessings';

export type GameData = Record<Category, GameItem[]> & {
  /** 옛 이미지 경로/이름 → 현재 이름 (data/item-meta.json 의 renamed) */
  renamed?: Record<string, string>;
  /** 업데이트 소식 (최신순) */
  updates?: { date: string; title: string; items: string[] }[];
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
  crop?: [x: number, y: number, w: number, h: number, ratio: number, padLeft?: number, padRight?: number]; // 쿠키: 투명 여백을 뺀 몸통 영역과 양옆으로 넘치는 효과 폭 (크기 자동 맞춤, scripts/generateImageData.js)
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

/** 아레나 번호에 거는 유튜브 영상 (이름은 비워도 됨) */
export interface YoutubeLink {
  title: string;
  url: string;
}

export interface ArenaData {
  youtubeLinks: YoutubeLink[]; // 최대 MAX_YOUTUBE_LINKS개
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
  verticalAlign?: 'top' | 'middle' | 'bottom'; // 시즌명 세로 위치 (기본 middle)
  offsetX?: number; // 시즌명 위치 미세 조정 (보드 px)
  offsetY?: number;
  lineHeight?: number; // 시즌명 줄 간격 (기본 1.2)
  letterSpacing?: number; // 시즌명 자간 (보드 px)
  customFontUrl?: string;
  customFontName?: string;
  fontColor?: string;
  fontWeight?: number; // 시즌명 굵기 (기본 700)
  seasonStrokeColor?: string;
  seasonStrokeWidth?: number;
  scoreColor?: string;
  scoreFontSize?: number;
  scoreFontWeight?: number; // 점수 굵기 (기본 400)
  scoreAlign?: 'left' | 'center' | 'right'; // 점수 정렬 (기본 center)
  scoreStrokeColor?: string;
  scoreStrokeWidth?: number;
  numberColor?: string; // 아레나 번호 색 (없으면 시즌명 색)
  numberSize?: number; // 아레나 번호 크기 (기본 18)
}

export interface DisplaySettings {
  scoreDisplayType: ScoreDisplayType;
}

/** 아레나 안에서 꾹 눌러 옮길 수 있는 칸 (lib/board.ts LAYOUT_KEYS) */
export type LayoutKey = (typeof import('@/lib/board').LAYOUT_KEYS)[number];

/** 조합표 꾸미기 (칸 크기는 그대로, 겉모습과 칸 위치만) */
export interface BoardStyle {
  card: boolean; // 아레나마다 카드 바탕
  cardColor: string;
  cardOpacity: number; // 0~100
  cardRadius: number; // 보드 px
  cardBorderWidth: number;
  cardBorderColor: string;
  cardShadow: boolean;
  headerCard: boolean; // 시즌 영역에도 카드 적용
  scoreBg: boolean; // 점수 뒤 바탕
  scoreBgColor: string;
  scoreBgOpacity: number;
  scoreBgRadius: number;
  numberBg: boolean; // 아레나 번호 뒤 바탕
  numberBgColor: string;
  gap: number; // 아레나 사이 간격 (보드 px)
  exportPadding: number; // 저장 이미지 바깥 여백 (px)
  cookieFit: boolean; // 쿠키 크기 자동 맞춤 (이미지 여백 무시, 선달/이달 비율대로 크기, 두 쿠키를 간격만큼 띄워 나란히)
  mainPairGap: number; // 자동 맞춤에서 메인 조합 두 쿠키 몸통 사이 간격 (보드 px)
  subPairGap: number; // 대체 조합 두 쿠키 몸통 사이 간격
  layout: Partial<Record<LayoutKey, [number, number]>>; // 칸을 기본 자리에서 옮긴 거리 [가로, 세로] (보드 px, 12개 아레나 공통)
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
  boardStyle: BoardStyle;
}
