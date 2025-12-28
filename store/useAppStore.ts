import { create } from 'zustand';
import { AppState, ArenaData, BackgroundData } from '@/types';

const createEmptyArena = (): ArenaData => ({
  youtubeUrl: null,
  mainCombo: {
    pet: '',
    cookie1: '',
    cookie2: '',
    treasures: ['', '', ''],
  },
  magicCandy: {
    cookie1Candy: '',
    cookie1Blessing: '',
    cookie2Candy: '',
    cookie2Blessing: '',
  },
  score: {
    value: '',
    unit: '-',
  },
  dish: '',
  subCombo: {
    pet: '',
    cookie1: '',
    cookie2: '',
    treasures: ['', '', ''],
  },
  subScore: {
    value: '',
    unit: '-',
  },
  isSubComboExpanded: false,
  mainCookieRatio: 54, // 메인 조합 선달 쿠키 비율 (기본 54%, 이달 46%)
  subCookieRatio: 56, // 대체 조합 선달 쿠키 비율 (기본 56%, 이달 44%)
});

interface AppStore extends AppState {
  isExporting: boolean;
  modalOpen: boolean;
  modalArenaIndex: number | null;
  modalType: string | null;
  setIsExporting: (isExporting: boolean) => void;
  setModalOpen: (open: boolean, arenaIndex?: number, type?: string) => void;
  updateArenaItem: (arenaIndex: number, field: string, value: any) => void;
  setBackground: (background: BackgroundData) => void;
  setSeasonName: (name: string) => void;
  setSeasonDish: (dishId: string) => void;
  setSeasonIngredient: (index: 0 | 1 | 2, ingredientId: string) => void;
  setArenaYoutubeUrl: (arenaIndex: number, url: string | null) => void;
  setArenaMainCombo: (arenaIndex: number, field: string, value: any) => void;
  setArenaMagicCandy: (arenaIndex: number, field: string, value: string) => void;
  setArenaScore: (arenaIndex: number, field: 'value' | 'unit', value: string) => void;
  setArenaDish: (arenaIndex: number, dishId: string) => void;
  setArenaSubCombo: (arenaIndex: number, field: string, value: any) => void;
  setArenaSubScore: (arenaIndex: number, field: 'value' | 'unit', value: string) => void;
  toggleSubCombo: (arenaIndex: number) => void;
  setMainCookieRatio: (arenaIndex: number, ratio: number) => void;
  setSubCookieRatio: (arenaIndex: number, ratio: number) => void;
  setGameData: (data: any) => void;
  loadStateFromUrl: (state: Partial<AppState>) => void;
  reset: () => void;
  setFontSettings: (settings: Partial<{ fontSize: number; fontFamily: 'Pretendard' | 'CookieRun' | 'Custom'; textAlign: 'left' | 'center' | 'right'; customFontUrl?: string; customFontName?: string }>) => void;
  setDisplaySettings: (settings: Partial<{ scoreDisplayType: 'abbreviated' | 'comma' | 'korean' }>) => void;
}

const initialState: AppState = {
  background: {
    type: 'gradient',
    gradient: ['#667eea', '#764ba2'],
  },
  seasonName: '',
  seasonDish: '',
  seasonIngredients: ['', '', ''],
  arenas: Array.from({ length: 12 }, () => createEmptyArena()),
  gameData: null,
  fontSettings: {
    fontSize: 24,
    fontFamily: 'Pretendard',
    textAlign: 'center',
  },
  displaySettings: {
    scoreDisplayType: 'comma',
  },
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,
  isExporting: false,
  modalOpen: false,
  modalArenaIndex: null,
  modalType: null,

  setIsExporting: (isExporting) => set({ isExporting }),

  setModalOpen: (open, arenaIndex, type) => 
    set({ modalOpen: open, modalArenaIndex: arenaIndex ?? null, modalType: type ?? null }),

  updateArenaItem: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = { ...newArenas[arenaIndex], [field]: value };
      return { arenas: newArenas };
    }),

  setBackground: (background) => set({ background }),

  setSeasonName: (name) => set({ seasonName: name }),

  setSeasonDish: (dishId) => set({ seasonDish: dishId }),

  setSeasonIngredient: (index, ingredientId) =>
    set((state) => {
      const newIngredients = [...state.seasonIngredients] as [string, string, string];
      newIngredients[index] = ingredientId;
      return { seasonIngredients: newIngredients };
    }),

  setArenaYoutubeUrl: (arenaIndex, url) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = { ...newArenas[arenaIndex], youtubeUrl: url };
      return { arenas: newArenas };
    }),

  setArenaMainCombo: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      const arena = newArenas[arenaIndex];
      if (field === 'pet' || field === 'cookie1' || field === 'cookie2') {
        arena.mainCombo = { ...arena.mainCombo, [field]: value };
      } else if (field.startsWith('treasure')) {
        const treasureIndex = parseInt(field.replace('treasure', '')) as 0 | 1 | 2;
        const newTreasures = [...arena.mainCombo.treasures] as [string, string, string];
        newTreasures[treasureIndex] = value;
        arena.mainCombo = { ...arena.mainCombo, treasures: newTreasures };
      }
      return { arenas: newArenas };
    }),

  setArenaMagicCandy: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        magicCandy: {
          ...newArenas[arenaIndex].magicCandy,
          [field]: value,
        },
      };
      return { arenas: newArenas };
    }),

  setArenaScore: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        score: {
          ...newArenas[arenaIndex].score,
          [field]: value,
        },
      };
      return { arenas: newArenas };
    }),

  setArenaDish: (arenaIndex, dishId) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = { ...newArenas[arenaIndex], dish: dishId };
      return { arenas: newArenas };
    }),

  setArenaSubCombo: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      const arena = newArenas[arenaIndex];
      if (field === 'pet' || field === 'cookie1' || field === 'cookie2') {
        arena.subCombo = { ...arena.subCombo, [field]: value };
      } else if (field.startsWith('treasure')) {
        const treasureIndex = parseInt(field.replace('treasure', '')) as 0 | 1 | 2;
        const newTreasures = [...arena.subCombo.treasures] as [string, string, string];
        newTreasures[treasureIndex] = value;
        arena.subCombo = { ...arena.subCombo, treasures: newTreasures };
      }
      return { arenas: newArenas };
    }),

  setArenaSubScore: (arenaIndex, field, value) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        subScore: {
          ...newArenas[arenaIndex].subScore,
          [field]: value,
        },
      };
      return { arenas: newArenas };
    }),

  toggleSubCombo: (arenaIndex) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        isSubComboExpanded: !newArenas[arenaIndex].isSubComboExpanded,
      };
      return { arenas: newArenas };
    }),

  setMainCookieRatio: (arenaIndex, ratio) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        mainCookieRatio: ratio,
      };
      return { arenas: newArenas };
    }),

  setSubCookieRatio: (arenaIndex, ratio) =>
    set((state) => {
      const newArenas = [...state.arenas];
      newArenas[arenaIndex] = {
        ...newArenas[arenaIndex],
        subCookieRatio: ratio,
      };
      return { arenas: newArenas };
    }),

  setGameData: (data) => set({ gameData: data }),

  loadStateFromUrl: (newState) =>
    set((state) => ({
      ...state,
      ...newState,
    })),

  reset: () => set(initialState),

  setFontSettings: (settings) =>
    set((state) => ({
      fontSettings: {
        ...state.fontSettings,
        ...settings,
      },
    })),

  setDisplaySettings: (settings) =>
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        ...settings,
      },
    })),
}));
