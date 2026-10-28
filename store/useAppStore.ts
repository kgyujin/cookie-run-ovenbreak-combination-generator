import { create } from 'zustand';
import { ArenaData, BackgroundData, BoardState, BoardStyle, Category, ComboData, DisplaySettings, FontSettings, GameData, LayoutKey, MagicCandyData } from '@/types';
import { resolveBoardItems } from '@/lib/items';
import { DEFAULT_BACKGROUND } from '@/lib/backgrounds';
import { ARENA_HEIGHT, LAYOUT_KEYS } from '@/lib/board';

const emptyCombo = (): ComboData => ({ pet: '', cookie1: '', cookie2: '', treasures: ['', '', ''] });

const createEmptyArena = (): ArenaData => ({
  youtubeUrl: null,
  mainCombo: emptyCombo(),
  magicCandy: { cookie1Candy: '', cookie1Blessing: '', cookie2Candy: '', cookie2Blessing: '' },
  score: { value: '' },
  dish: '',
  subCombo: emptyCombo(),
  subScore: { value: '' },
  mainCookieRatio: 54, // 메인 조합 선달 쿠키 비율 (기본 54%, 이달 46%)
  subCookieRatio: 56, // 대체 조합 선달 쿠키 비율 (기본 56%, 이달 44%)
});

export const initialBoard = (): BoardState => ({
  background: DEFAULT_BACKGROUND,
  seasonName: '',
  seasonDish: '',
  seasonIngredients: ['', '', ''],
  arenas: Array.from({ length: 12 }, createEmptyArena),
  fontSettings: {
    fontSize: 24,
    fontFamily: 'Pretendard',
    textAlign: 'center',
    verticalAlign: 'middle',
    offsetX: 0,
    offsetY: 0,
    lineHeight: 1.2,
    letterSpacing: 0,
    fontColor: '#1c1917',
    fontWeight: 700,
    seasonStrokeColor: '#ffffff',
    seasonStrokeWidth: 0,
    scoreColor: '#1c1917',
    scoreFontSize: 14,
    scoreFontWeight: 400,
    scoreAlign: 'center',
    scoreStrokeColor: '#ffffff',
    scoreStrokeWidth: 0,
    numberSize: 18,
  },
  displaySettings: { scoreDisplayType: 'comma' },
  boardStyle: {
    card: false,
    cardColor: '#ffffff',
    cardOpacity: 60,
    cardRadius: 24,
    cardBorderWidth: 0,
    cardBorderColor: '#ffffff',
    cardShadow: false,
    headerCard: false,
    scoreBg: false,
    scoreBgColor: '#ffffff',
    scoreBgOpacity: 80,
    scoreBgRadius: 12,
    numberBg: false,
    numberBgColor: '#ffffff',
    gap: 24,
    exportPadding: 64,
    cookieFit: true,
    mainCookieGap: 16,
    subCookieGap: 8,
    layout: {},
  },
});

// ----- 저장·공유된 데이터 검증 (공유 링크는 누구나 만들 수 있으므로 알려진 필드·형식만 받는다) -----
/** 문자열만, 최대 길이까지 (아주 긴 문자열로 화면이 멈추는 것 방지) */
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : fallback;
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
/** #rrggbb만 (#rgb는 늘려서 받음) */
const color = (v: unknown, fallback?: string) => {
  const s = str(v, 9);
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return fallback;
};
const weight = (v: unknown, fallback: number) => ([400, 700, 900].includes(Number(v)) ? Number(v) : fallback);
/** 아이템 이미지는 항상 사이트 안의 /images/ 아래 그림 파일 (%2e%2e 같은 우회 경로 차단) */
const itemImage = (v: unknown) => {
  const s = str(v);
  let decoded = '';
  try {
    decoded = decodeURIComponent(s);
  } catch {
    return '';
  }
  return /^\/images\/[^?#\\]+\.(png|jpe?g|webp)$/i.test(s) && !decoded.includes('..') && !decoded.includes('\\') ? s : '';
};

const DATA_URL = {
  image: /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/,
  font: /^data:(?:font\/(?:ttf|otf|woff2?|sfnt)|application\/(?:octet-stream|x-font-[a-z]+|font-[a-z]+|vnd\.ms-opentype));base64,[A-Za-z0-9+/=]+$/,
};

/**
 * https 주소 또는 형식이 확실한 data: URL만 허용.
 * URL 객체로 다시 쓰고 따옴표·괄호는 %로 바꾸므로 CSS url("...") 밖으로 빠져나갈 수 없다.
 */
export const safeUrl = (v: unknown, dataKind?: keyof typeof DATA_URL) => {
  if (typeof v !== 'string') return '';
  const raw = v.trim();
  if (dataKind && raw.length <= 7_000_000 && DATA_URL[dataKind].test(raw)) return raw;
  try {
    const url = new URL(raw.slice(0, 2048));
    // 따옴표·괄호는 %로 바꿔 CSS url("...") 밖으로 빠져나갈 수 없게 한다 (호스트 이름에 남은 것까지). 공백·역슬래시가 남으면 받지 않는다
    const href = url.href.replace(/["'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return url.protocol === 'https:' && !/[\\\s]/.test(href) ? href : '';
  } catch {
    return '';
  }
};

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
/** 유튜브 주소만 허용 (공유 링크로 다른 사이트 링크를 심는 것 방지) */
export const safeYoutubeUrl = (v: unknown) => {
  const url = safeUrl(v);
  if (!url) return '';
  return YOUTUBE_HOSTS.includes(new URL(url).hostname) ? url : '';
};

/** 저장/공유된 데이터에서 알려진 필드만 골라 현재 구조로 맞춘다 (옛 버전 데이터 호환). */
export function sanitizeBoard(raw: any): Partial<BoardState> {
  if (!raw || typeof raw !== 'object') return {};
  const base = initialBoard();
  const out: Partial<BoardState> = {};
  if (raw.background && typeof raw.background === 'object') {
    const bg = raw.background;
    out.background = {
      type: oneOf(bg.type, ['color', 'gradient', 'image'] as const, 'gradient'),
      color: color(bg.color),
      gradient: Array.isArray(bg.gradient) ? [color(bg.gradient[0], '#667eea')!, color(bg.gradient[1], '#764ba2')!] : undefined,
      angle: clamp(bg.angle, 0, 360, 135),
      imageUrl: safeUrl(bg.imageUrl, 'image'),
      imageFit: oneOf(bg.imageFit, ['cover', 'contain', 'repeat'] as const, 'cover'),
      dim: clamp(bg.dim, 0, 0.6, 0),
    };
  }
  if (typeof raw.seasonName === 'string') out.seasonName = str(raw.seasonName, 300).split('\n').slice(0, 3).join('\n');
  if ('seasonDish' in raw) out.seasonDish = itemImage(raw.seasonDish);
  if (Array.isArray(raw.seasonIngredients)) {
    out.seasonIngredients = [0, 1, 2].map((i) => itemImage(raw.seasonIngredients[i])) as [string, string, string];
  }
  if (Array.isArray(raw.arenas)) {
    out.arenas = base.arenas.map((empty, i) => {
      const a = raw.arenas[i] ?? {};
      const combo = (c: any): ComboData => ({
        pet: itemImage(c?.pet),
        cookie1: itemImage(c?.cookie1),
        cookie2: itemImage(c?.cookie2),
        treasures: [0, 1, 2].map((t) => itemImage(c?.treasures?.[t])) as [string, string, string],
      });
      return {
        youtubeUrl: safeYoutubeUrl(a.youtubeUrl) || null,
        mainCombo: combo(a.mainCombo),
        magicCandy: {
          cookie1Candy: itemImage(a.magicCandy?.cookie1Candy),
          cookie1Blessing: itemImage(a.magicCandy?.cookie1Blessing),
          cookie2Candy: itemImage(a.magicCandy?.cookie2Candy),
          cookie2Blessing: itemImage(a.magicCandy?.cookie2Blessing),
        },
        score: { value: str(a.score?.value, 30) },
        dish: itemImage(a.dish),
        subCombo: combo(a.subCombo),
        subScore: { value: str(a.subScore?.value, 30) },
        mainCookieRatio: clamp(a.mainCookieRatio, 30, 70, empty.mainCookieRatio),
        subCookieRatio: clamp(a.subCookieRatio, 30, 70, empty.subCookieRatio),
      };
    });
  }
  if (raw.fontSettings && typeof raw.fontSettings === 'object') {
    const f = raw.fontSettings;
    const d = base.fontSettings;
    out.fontSettings = {
      fontSize: clamp(f.fontSize, 12, 52, d.fontSize),
      fontFamily: oneOf(f.fontFamily, ['Pretendard', 'CookieRun', 'Custom'] as const, d.fontFamily),
      textAlign: oneOf(f.textAlign, ['left', 'center', 'right'] as const, d.textAlign),
      verticalAlign: oneOf(f.verticalAlign, ['top', 'middle', 'bottom'] as const, 'middle'),
      offsetX: clamp(f.offsetX, -200, 200, 0),
      offsetY: clamp(f.offsetY, -150, 150, 0),
      lineHeight: clamp(f.lineHeight, 0.8, 2, 1.2),
      letterSpacing: clamp(f.letterSpacing, -5, 20, 0),
      customFontUrl: safeUrl(f.customFontUrl, 'font'),
      customFontName: str(f.customFontName, 100),
      fontColor: color(f.fontColor, d.fontColor),
      fontWeight: weight(f.fontWeight, 700),
      seasonStrokeColor: color(f.seasonStrokeColor, d.seasonStrokeColor),
      seasonStrokeWidth: clamp(f.seasonStrokeWidth, 0, 8, 0),
      scoreColor: color(f.scoreColor, d.scoreColor),
      scoreFontSize: clamp(f.scoreFontSize, 10, 48, d.scoreFontSize!),
      scoreFontWeight: weight(f.scoreFontWeight, 400),
      scoreAlign: oneOf(f.scoreAlign, ['left', 'center', 'right'] as const, 'center'),
      scoreStrokeColor: color(f.scoreStrokeColor, d.scoreStrokeColor),
      scoreStrokeWidth: clamp(f.scoreStrokeWidth, 0, 5, d.scoreStrokeWidth!),
      numberColor: color(f.numberColor),
      numberSize: clamp(f.numberSize, 12, 32, 18),
    };
  }
  if (raw.boardStyle && typeof raw.boardStyle === 'object') {
    const b = raw.boardStyle;
    const d = base.boardStyle;
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    out.boardStyle = {
      card: bool(b.card, d.card),
      cardColor: color(b.cardColor, d.cardColor)!,
      cardOpacity: clamp(b.cardOpacity, 0, 100, d.cardOpacity),
      cardRadius: clamp(b.cardRadius, 0, 60, d.cardRadius),
      cardBorderWidth: clamp(b.cardBorderWidth, 0, 8, d.cardBorderWidth),
      cardBorderColor: color(b.cardBorderColor, d.cardBorderColor)!,
      cardShadow: bool(b.cardShadow, d.cardShadow),
      headerCard: bool(b.headerCard, d.headerCard),
      scoreBg: bool(b.scoreBg, d.scoreBg),
      scoreBgColor: color(b.scoreBgColor, d.scoreBgColor)!,
      scoreBgOpacity: clamp(b.scoreBgOpacity, 0, 100, d.scoreBgOpacity),
      scoreBgRadius: clamp(b.scoreBgRadius, 0, 30, d.scoreBgRadius),
      numberBg: bool(b.numberBg, d.numberBg),
      numberBgColor: color(b.numberBgColor, d.numberBgColor)!,
      gap: clamp(b.gap, 0, 80, d.gap),
      exportPadding: clamp(b.exportPadding, 0, 160, d.exportPadding),
      cookieFit: bool(b.cookieFit, d.cookieFit),
      mainCookieGap: clamp(b.mainCookieGap, 0, 120, d.mainCookieGap),
      subCookieGap: clamp(b.subCookieGap, 0, 80, d.subCookieGap),
      layout: Object.fromEntries(
        LAYOUT_KEYS.flatMap((key) => {
          const v = b.layout?.[key];
          return Array.isArray(v) ? [[key, [clamp(v[0], -764, 764, 0), clamp(v[1], -ARENA_HEIGHT, ARENA_HEIGHT, 0)]]] : [];
        })
      ),
    };
  }
  if (raw.displaySettings && typeof raw.displaySettings === 'object') {
    out.displaySettings = {
      scoreDisplayType: oneOf(raw.displaySettings.scoreDisplayType, ['abbreviated', 'comma', 'korean'] as const, 'comma'),
    };
  }
  return out;
}

/** 아무것도 입력하지 않은 조합표인지 (공유 링크를 열 때 덮어쓰기 확인용) */
export function isBoardEmpty(board: BoardState) {
  const filled = (v: string) => !!v;
  return (
    !board.seasonName &&
    !board.seasonDish &&
    !board.seasonIngredients.some(filled) &&
    board.arenas.every(
      (a) =>
        !a.youtubeUrl &&
        !a.dish &&
        !a.score.value &&
        !a.subScore.value &&
        ![a.mainCombo, a.subCombo].some((c) => [c.pet, c.cookie1, c.cookie2, ...c.treasures].some(filled)) &&
        !Object.values(a.magicCandy).some(filled)
    )
  );
}

export function pickBoard(state: BoardState): BoardState {
  const { background, seasonName, seasonDish, seasonIngredients, arenas, fontSettings, displaySettings, boardStyle } = state;
  return { background, seasonName, seasonDish, seasonIngredients, arenas, fontSettings, displaySettings, boardStyle };
}

export type ComboField = 'pet' | 'cookie1' | 'cookie2' | 'treasure0' | 'treasure1' | 'treasure2';

/** 아이템 선택 창: 어떤 칸을 고르는 중인지 */
export interface PickerRequest {
  category: Category;
  label: string;
  current: string;
  apply: (image: string) => void;
}

export interface AppStore extends BoardState {
  gameData: GameData | null;
  gameDataError: boolean;
  picker: PickerRequest | null;
  settingsOpen: boolean;
  toast: { id: number; message: string; tone: 'success' | 'error' | 'loading' } | null;
  openPicker: (request: PickerRequest) => void;
  closePicker: () => void;
  setSettingsOpen: (open: boolean) => void;
  /** loading: 다음 알림이 올 때까지 사라지지 않음 */
  showToast: (message: string, tone?: 'success' | 'error' | 'loading') => void;
  setBackground: (background: BackgroundData) => void;
  setSeasonName: (name: string) => void;
  setSeasonDish: (image: string) => void;
  setSeasonIngredient: (index: 0 | 1 | 2, image: string) => void;
  setArenaYoutubeUrl: (arenaIndex: number, url: string | null) => void;
  setArenaCombo: (arenaIndex: number, combo: 'mainCombo' | 'subCombo', field: ComboField, image: string) => void;
  setArenaMagicCandy: (arenaIndex: number, field: keyof MagicCandyData, image: string) => void;
  setArenaScore: (arenaIndex: number, score: 'score' | 'subScore', value: string) => void;
  setArenaDish: (arenaIndex: number, image: string) => void;
  setCookieRatio: (combo: 'mainCookieRatio' | 'subCookieRatio', ratio: number) => void;
  setGameData: (data: GameData) => void;
  loadGameData: () => Promise<void>;
  loadBoard: (raw: unknown) => void;
  /** style: 설정 패널에서 바꾸는 꾸미기 / content: 시즌과 아레나에 넣은 내용 / all: 둘 다 */
  reset: (part: 'style' | 'content' | 'all') => void;
  setFontSettings: (settings: Partial<FontSettings>) => void;
  setDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  setBoardStyle: (style: Partial<BoardStyle>) => void;
  setLayout: (key: LayoutKey, offset: [number, number]) => void;
  /** 실행 취소할 편집이 있는지 */
  canUndo: boolean;
  undo: () => void;
}

/**
 * 실행 취소: 조합표가 바뀔 때마다 바뀌기 전 모습을 쌓아 두고, 가장 최근 것부터 하나씩 되돌린다.
 * 연달아 바뀐 것(입력하는 글자, 끄는 동안의 슬라이더나 칸 위치)은 한 번으로 묶는다 (아래 구독).
 */
const HISTORY_LIMIT = 100;
const past: BoardState[] = [];
/** 지금 바뀌는 것이 직전 변경과 같은 편집인지 */
let editing = false;
/** 기록하지 않는 변경 (아이템 목록을 받아 이름을 맞추는 것, 실행 취소 자체) */
let recording = true;
const quietly = (fn: () => void) => {
  recording = false;
  try {
    fn();
  } finally {
    recording = true;
  }
};

export const useAppStore = create<AppStore>((set) => {
  const updateArena = (arenaIndex: number, update: (arena: ArenaData) => Partial<ArenaData>) =>
    set((state) => ({
      arenas: state.arenas.map((arena, i) => (i === arenaIndex ? { ...arena, ...update(arena) } : arena)),
    }));

  return {
    ...initialBoard(),
    gameData: null,
    gameDataError: false,
    picker: null,
    toast: null,
    openPicker: (picker) => set({ picker }),
    closePicker: () => set({ picker: null }),
    settingsOpen: false,
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    showToast: (message, tone = 'success') => set({ toast: { id: Date.now(), message, tone } }),

    setBackground: (background) => set({ background }),
    setSeasonName: (name) => set({ seasonName: name }),
    setSeasonDish: (image) => set({ seasonDish: image }),
    setSeasonIngredient: (index, image) =>
      set((state) => {
        const seasonIngredients = [...state.seasonIngredients] as [string, string, string];
        seasonIngredients[index] = image;
        return { seasonIngredients };
      }),

    setArenaYoutubeUrl: (arenaIndex, url) => updateArena(arenaIndex, () => ({ youtubeUrl: url })),

    setArenaCombo: (arenaIndex, combo, field, image) =>
      updateArena(arenaIndex, (arena) => {
        if (field.startsWith('treasure')) {
          const treasures = [...arena[combo].treasures] as [string, string, string];
          treasures[Number(field.slice(-1))] = image;
          return { [combo]: { ...arena[combo], treasures } };
        }
        return { [combo]: { ...arena[combo], [field]: image } };
      }),

    setArenaMagicCandy: (arenaIndex, field, image) =>
      updateArena(arenaIndex, (arena) => ({ magicCandy: { ...arena.magicCandy, [field]: image } })),

    setArenaScore: (arenaIndex, score, value) => updateArena(arenaIndex, () => ({ [score]: { value } })),

    setArenaDish: (arenaIndex, image) => updateArena(arenaIndex, () => ({ dish: image })),

    // 비율은 12개 아레나 전체에 함께 적용
    setCookieRatio: (combo, ratio) =>
      set((state) => ({ arenas: state.arenas.map((arena) => ({ ...arena, [combo]: ratio })) })),

    setGameData: (gameData) => quietly(() => set((state) => ({ gameData, gameDataError: false, ...resolveBoardItems(pickBoard(state), gameData) }))),

    // 아이템 목록 (빌드 때 생성된 JSON). 잠깐 끊겨도 몇 번 다시 시도한다
    loadGameData: async () => {
      set({ gameDataError: false });
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch('/data/gameData.json', attempt ? { cache: 'reload' } : undefined);
          if (!res.ok) throw new Error(`gameData ${res.status}`);
          useAppStore.getState().setGameData(await res.json());
          return;
        } catch (err) {
          console.error('Failed to load game data:', err);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      set({ gameDataError: true });
    },

    loadBoard: (raw) =>
      set((state) => {
        const board = { ...pickBoard(state), ...sanitizeBoard(raw) };
        return state.gameData ? resolveBoardItems(board, state.gameData) : board;
      }),

    reset: (part) =>
      set((state) => {
        const init = initialBoard();
        if (part === 'all') return init;
        // 쿠키 크기 비율은 아레나마다 들어 있지만 설정 패널에서 바꾸는 꾸미기 값이다
        const { mainCookieRatio, subCookieRatio } = (part === 'style' ? init : state).arenas[0];
        const arenas = (part === 'style' ? state : init).arenas.map((arena) => ({ ...arena, mainCookieRatio, subCookieRatio }));
        if (part === 'style') return { background: init.background, fontSettings: init.fontSettings, displaySettings: init.displaySettings, boardStyle: init.boardStyle, arenas };
        return { seasonName: init.seasonName, seasonDish: init.seasonDish, seasonIngredients: init.seasonIngredients, arenas };
      }),

    setFontSettings: (settings) => set((state) => ({ fontSettings: { ...state.fontSettings, ...settings } })),
    setDisplaySettings: (settings) => set((state) => ({ displaySettings: { ...state.displaySettings, ...settings } })),
    setBoardStyle: (style) => set((state) => ({ boardStyle: { ...state.boardStyle, ...style } })),
    setLayout: (key, offset) => set((state) => ({ boardStyle: { ...state.boardStyle, layout: { ...state.boardStyle.layout, [key]: offset } } })),

    canUndo: false,
    undo: () => {
      const board = past.pop();
      if (!board) return;
      editing = false;
      quietly(() => set({ ...board, canUndo: past.length > 0 }));
    },
  };
});

/** 이 브라우저에서 전에 사이트를 쓴 적이 있는지 (처음 온 사람에게는 업데이트 창을 띄우지 않음) */
export let isReturningVisitor = false;

// 브라우저에 조합표 자동 저장 (게임 데이터는 매번 새로 받으므로 저장하지 않음)
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('appState');
    isReturningVisitor = !!saved;
    if (saved) useAppStore.setState(sanitizeBoard(JSON.parse(saved)));
  } catch (e) {
    console.error('Failed to load persisted state:', e);
  }

  // 설정을 끌어서 바꾸는 동안 매번 쓰지 않도록 잠깐 모았다가 저장
  let lastSaved: BoardState | null = null;
  let warnedQuota = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    const board = pickBoard(useAppStore.getState());
    if (lastSaved && Object.keys(board).every((k) => board[k as keyof BoardState] === lastSaved![k as keyof BoardState])) return;
    lastSaved = board;
    try {
      localStorage.setItem('appState', JSON.stringify(board));
    } catch (e) {
      console.error('Failed to persist state:', e);
      // 직접 올린 큰 배경·글꼴 파일 때문에 저장 공간이 모자라면, 그 파일만 빼고 나머지는 계속 저장한다
      try {
        const slim = {
          ...board,
          background: board.background.imageUrl?.startsWith('data:') ? DEFAULT_BACKGROUND : board.background,
          fontSettings: board.fontSettings.customFontUrl?.startsWith('data:') ? { ...board.fontSettings, customFontUrl: '' } : board.fontSettings,
        };
        localStorage.setItem('appState', JSON.stringify(slim));
      } catch {}
      if (!warnedQuota) {
        warnedQuota = true;
        useAppStore.getState().showToast('올린 파일이 커서 이 브라우저에는 저장되지 않아요. 나머지 내용은 계속 저장돼요', 'error');
      }
    }
  };
  useAppStore.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  });

  // 실행 취소 기록. 새로 누르기 시작하면 새 편집이고, 누르고 있는 동안(끌기)이나 0.5초 안에 이어진 변경은 같은 편집이다
  let before = pickBoard(useAppStore.getState());
  let pressed = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const endEdit = () => {
    clearTimeout(idle);
    idle = setTimeout(() => (editing = pressed), 500);
  };
  useAppStore.subscribe((state) => {
    const board = pickBoard(state);
    if (Object.keys(board).every((k) => board[k as keyof BoardState] === before[k as keyof BoardState])) return;
    const previous = before;
    before = board;
    if (!recording) return;
    if (!editing) {
      past.push(previous);
      if (past.length > HISTORY_LIMIT) past.shift();
      editing = true;
      if (!state.canUndo) useAppStore.setState({ canUndo: true });
    }
    endEdit();
  });
  window.addEventListener('pointerdown', () => ((pressed = true), (editing = false)), true);
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, () => ((pressed = false), editing && endEdit()), true);
  window.addEventListener('pagehide', save);
}
