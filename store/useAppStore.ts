import { create } from 'zustand';
import { ArenaData, BackgroundData, BoardState, Category, ComboData, DisplaySettings, FontSettings, GameData, MagicCandyData } from '@/types';
import { resolveBoardItems } from '@/lib/items';
import { DEFAULT_BACKGROUND } from '@/lib/backgrounds';

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

const initialBoard = (): BoardState => ({
  background: DEFAULT_BACKGROUND,
  seasonName: '',
  seasonDish: '',
  seasonIngredients: ['', '', ''],
  arenas: Array.from({ length: 12 }, createEmptyArena),
  fontSettings: {
    fontSize: 24,
    fontFamily: 'Pretendard',
    textAlign: 'center',
    fontColor: '#111827',
    scoreColor: '#111827',
    scoreFontSize: 14,
    scoreStrokeColor: '#ffffff',
    scoreStrokeWidth: 0,
  },
  displaySettings: { scoreDisplayType: 'comma' },
});

// ----- 저장·공유된 데이터 검증 (공유 링크는 누구나 만들 수 있으므로 알려진 필드·형식만 받는다) -----
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : fallback;
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const color = (v: unknown, fallback?: string) => (/^#[0-9a-f]{3,8}$/i.test(str(v)) ? str(v) : fallback);
/** 아이템 이미지는 항상 사이트 내부 경로 */
const itemImage = (v: unknown) => (str(v).startsWith('/images/') ? str(v) : '');
/** http(s) 주소 또는 지정한 종류의 data: URL만 허용 (javascript: 등 차단) */
export const safeUrl = (v: unknown, dataPrefix?: string) => {
  const url = str(v).trim();
  if (dataPrefix && url.startsWith(dataPrefix)) return url;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : '';
  } catch {
    return '';
  }
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
      imageUrl: safeUrl(bg.imageUrl, 'data:image/'),
    };
  }
  if (typeof raw.seasonName === 'string') out.seasonName = raw.seasonName;
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
        youtubeUrl: safeUrl(a.youtubeUrl) || null,
        mainCombo: combo(a.mainCombo),
        magicCandy: {
          cookie1Candy: itemImage(a.magicCandy?.cookie1Candy),
          cookie1Blessing: itemImage(a.magicCandy?.cookie1Blessing),
          cookie2Candy: itemImage(a.magicCandy?.cookie2Candy),
          cookie2Blessing: itemImage(a.magicCandy?.cookie2Blessing),
        },
        score: { value: str(a.score?.value) },
        dish: itemImage(a.dish),
        subCombo: combo(a.subCombo),
        subScore: { value: str(a.subScore?.value) },
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
      customFontUrl: safeUrl(f.customFontUrl, 'data:font/'),
      customFontName: str(f.customFontName),
      fontColor: color(f.fontColor, d.fontColor),
      scoreColor: color(f.scoreColor, d.scoreColor),
      scoreFontSize: clamp(f.scoreFontSize, 10, 48, d.scoreFontSize!),
      scoreStrokeColor: color(f.scoreStrokeColor, d.scoreStrokeColor),
      scoreStrokeWidth: clamp(f.scoreStrokeWidth, 0, 5, d.scoreStrokeWidth!),
    };
  }
  if (raw.displaySettings && typeof raw.displaySettings === 'object') {
    out.displaySettings = {
      scoreDisplayType: oneOf(raw.displaySettings.scoreDisplayType, ['abbreviated', 'comma', 'korean'] as const, 'comma'),
    };
  }
  return out;
}

export function pickBoard(state: BoardState): BoardState {
  const { background, seasonName, seasonDish, seasonIngredients, arenas, fontSettings, displaySettings } = state;
  return { background, seasonName, seasonDish, seasonIngredients, arenas, fontSettings, displaySettings };
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
  picker: PickerRequest | null;
  toast: { id: number; message: string; tone: 'success' | 'error' } | null;
  openPicker: (request: PickerRequest) => void;
  closePicker: () => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
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
  loadBoard: (raw: unknown) => void;
  reset: () => void;
  setFontSettings: (settings: Partial<FontSettings>) => void;
  setDisplaySettings: (settings: Partial<DisplaySettings>) => void;
}

export const useAppStore = create<AppStore>((set) => {
  const updateArena = (arenaIndex: number, update: (arena: ArenaData) => Partial<ArenaData>) =>
    set((state) => ({
      arenas: state.arenas.map((arena, i) => (i === arenaIndex ? { ...arena, ...update(arena) } : arena)),
    }));

  return {
    ...initialBoard(),
    gameData: null,
    picker: null,
    toast: null,
    openPicker: (picker) => set({ picker }),
    closePicker: () => set({ picker: null }),
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

    setGameData: (gameData) => set((state) => ({ gameData, ...resolveBoardItems(pickBoard(state), gameData) })),

    loadBoard: (raw) =>
      set((state) => {
        const board = { ...pickBoard(state), ...sanitizeBoard(raw) };
        return state.gameData ? resolveBoardItems(board, state.gameData) : board;
      }),

    reset: () => set(initialBoard()),

    setFontSettings: (settings) => set((state) => ({ fontSettings: { ...state.fontSettings, ...settings } })),
    setDisplaySettings: (settings) => set((state) => ({ displaySettings: { ...state.displaySettings, ...settings } })),
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
      if (!warnedQuota) {
        warnedQuota = true;
        // 직접 올린 큰 배경·글꼴 파일 때문에 브라우저 저장 공간이 부족한 경우
        useAppStore.getState().showToast('브라우저 저장 공간이 부족해 자동 저장이 안 돼요. 올린 파일 크기를 줄여 주세요', 'error');
      }
    }
  };
  useAppStore.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  });
  window.addEventListener('pagehide', save);
}
