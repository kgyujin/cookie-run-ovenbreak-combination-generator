import { create } from 'zustand';
import { BoardState, Theme } from '@/types';

/**
 * 이 브라우저에 이름을 붙여 저장해 두는 조합표와 꾸미기 테마 (localStorage 'library').
 * 둘 다 같은 방식(저장, 이름 바꾸기, 복사, 삭제)으로 다룬다.
 * 저장된 내용은 쓸 때 sanitizeBoard / sanitizeTheme로 다시 맞춘다 (예전 버전이나 손으로 고친 값 대비).
 */
export interface SavedEntry<T> {
  id: string;
  name: string;
  savedAt: number;
  data: T;
}

interface LibraryData {
  boards: SavedEntry<BoardState>[];
  themes: SavedEntry<Theme>[];
  /** 마지막으로 저장하거나 불러온 조합표 (덮어쓰기 대상) */
  activeBoardId: string | null;
}

export type LibraryKind = 'boards' | 'themes';
type DataOf<K extends LibraryKind> = LibraryData[K][number]['data'];

export const MAX_NAME = 40;
export const STORAGE_FULL_MESSAGE = '저장 공간이 모자라 저장하지 못했어요. 직접 올린 큰 배경이나 글꼴을 빼거나 안 쓰는 항목을 지운 뒤 다시 해 보세요';
const STORAGE_KEY = 'library';
const EMPTY: LibraryData = { boards: [], themes: [], activeBoardId: null };

const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/** 저장된 목록에서 모양이 맞는 항목만 (내용은 쓸 때 다시 맞춘다) */
function readEntries<T>(raw: unknown): SavedEntry<T>[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && e.data && typeof e.data === 'object')
    .map((e) => ({ id: e.id, name: cleanName(e.name), savedAt: Number(e.savedAt) || 0, data: e.data as T }));
}

function read(): LibraryData {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const boards = readEntries<BoardState>(raw?.boards);
    const activeBoardId = boards.some((b) => b.id === raw?.activeBoardId) ? raw.activeBoardId : null;
    return { boards, themes: readEntries<Theme>(raw?.themes), activeBoardId };
  } catch {
    return EMPTY;
  }
}

/** 저장 공간이 모자라면 false (그때는 화면 목록도 바꾸지 않는다) */
function write(data: LibraryData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save library:', e);
    return false;
  }
}

interface LibraryStore extends LibraryData {
  /** 새로 저장하거나(id 없음) 그 항목을 덮어쓴다. 저장한 항목의 id, 실패하면 null */
  save: <K extends LibraryKind>(kind: K, name: string, data: DataOf<K>, id?: string) => string | null;
  rename: (kind: LibraryKind, id: string, name: string) => boolean;
  /** 바로 아래에 '사본'을 만든다. 새 항목의 id, 실패하면 null */
  duplicate: (kind: LibraryKind, id: string) => string | null;
  remove: (kind: LibraryKind, id: string) => boolean;
  setActiveBoard: (id: string | null) => void;
}

export const useLibrary = create<LibraryStore>((set, get) => {
  /** 바뀐 내용을 먼저 저장해 보고, 성공했을 때만 화면 상태에도 반영한다 */
  const commit = (patch: Partial<LibraryData>) => {
    const { boards, themes, activeBoardId } = get();
    const next = { boards, themes, activeBoardId, ...patch };
    if (!write(next)) return false;
    set(next);
    return true;
  };
  const list = <K extends LibraryKind>(kind: K) => get()[kind] as SavedEntry<DataOf<K>>[];

  return {
    ...(typeof window !== 'undefined' ? read() : EMPTY),

    save: (kind, name, data, id) => {
      const items = list(kind);
      const entry = { id: id ?? newId(), name: cleanName(name) || '이름 없음', savedAt: Date.now(), data };
      const existing = items.some((e) => e.id === entry.id);
      const next = existing ? items.map((e) => (e.id === entry.id ? { ...entry, name: id ? e.name : entry.name } : e)) : [entry, ...items];
      const ok = commit({ [kind]: next, ...(kind === 'boards' && { activeBoardId: entry.id }) });
      return ok ? entry.id : null;
    },

    rename: (kind, id, name) => {
      const clean = cleanName(name);
      if (!clean) return false;
      return commit({ [kind]: list(kind).map((e) => (e.id === id ? { ...e, name: clean } : e)) });
    },

    duplicate: (kind, id) => {
      const items = list(kind);
      const index = items.findIndex((e) => e.id === id);
      if (index === -1) return null;
      const copy = { ...items[index], id: newId(), name: cleanName(`${items[index].name} 사본`), savedAt: Date.now() };
      return commit({ [kind]: [...items.slice(0, index + 1), copy, ...items.slice(index + 1)] }) ? copy.id : null;
    },

    remove: (kind, id) =>
      commit({ [kind]: list(kind).filter((e) => e.id !== id), ...(kind === 'boards' && get().activeBoardId === id && { activeBoardId: null }) }),

    setActiveBoard: (activeBoardId) => {
      commit({ activeBoardId });
    },
  };
});

// 다른 탭에서 저장하거나 지우면 이 탭 목록도 맞춘다
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) useLibrary.setState(read());
  });
}
