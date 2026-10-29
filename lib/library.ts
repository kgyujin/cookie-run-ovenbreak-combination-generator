import { create } from 'zustand';

/**
 * 이 브라우저에 이름을 붙여 저장해 두는 조합표와 꾸미기 테마 (localStorage 'library').
 * 둘 다 같은 동작(저장, 덮어쓰기, 이름 바꾸기, 복사, 지우기)을 쓴다.
 * 저장된 내용(data)은 예전 버전이나 손으로 고친 값일 수 있어 unknown으로 두고, 쓸 때 sanitizeBoard / sanitizeTheme로 맞춘다.
 */
export interface SavedEntry {
  id: string;
  name: string;
  savedAt: number;
  data: unknown;
}

export type LibraryKind = 'boards' | 'themes';
type LibraryData = Record<LibraryKind, SavedEntry[]>;

export const MAX_NAME = 40;
export const STORAGE_FULL_MESSAGE = '저장 공간이 모자라 저장하지 못했어요. 직접 올린 큰 배경이나 글꼴을 빼거나 보관함에서 안 쓰는 항목을 지운 뒤 다시 해 보세요';
const STORAGE_KEY = 'library';
const MAX_DATE = 8.64e15; // Date가 나타낼 수 있는 가장 큰 값

/** 앞에서부터 n글자 (이모지 같은 글자를 반으로 자르지 않게 글자 단위로) */
const take = (text: string, n: number) => Array.from(text).slice(0, n).join('');
const cleanName = (name: string) => take(name.replace(/\s+/g, ' ').trim(), MAX_NAME).trim();
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/** 저장된 목록에서 모양이 맞는 항목만 (id가 겹치면 앞의 것만, 이름이나 날짜가 이상하면 기본값) */
function readEntries(raw: unknown): SavedEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((e) => {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || seen.has(e.id) || typeof e.name !== 'string' || !e.data || typeof e.data !== 'object') return [];
    seen.add(e.id);
    const savedAt = Number(e.savedAt);
    return [{ id: e.id, name: cleanName(e.name) || '이름 없음', savedAt: savedAt > 0 && savedAt < MAX_DATE ? savedAt : 0, data: e.data }];
  });
}

function read(): LibraryData {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return { boards: readEntries(raw?.boards), themes: readEntries(raw?.themes) };
  } catch {
    return { boards: [], themes: [] };
  }
}

interface LibraryStore extends LibraryData {
  /** 맨 위에 새로 저장한다. 저장 공간이 모자라면 false */
  add: (kind: LibraryKind, name: string, data: object) => boolean;
  /** 이름은 두고 내용만 바꾼다 */
  overwrite: (kind: LibraryKind, id: string, data: object) => boolean;
  /** 비운 이름은 '이름 없음'으로 (false는 언제나 저장 실패) */
  rename: (kind: LibraryKind, id: string, name: string) => boolean;
  /** 바로 아래에 '사본'을 만든다 */
  duplicate: (kind: LibraryKind, id: string) => boolean;
  remove: (kind: LibraryKind, id: string) => boolean;
}

export const useLibrary = create<LibraryStore>((set, get) => {
  /** 바뀐 목록을 먼저 저장해 보고, 성공했을 때만 화면 상태에도 반영한다 (실패하면 false) */
  const put = (kind: LibraryKind, items: SavedEntry[]) => {
    const next = { boards: get().boards, themes: get().themes, [kind]: items };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save library:', e);
      return false;
    }
    set(next);
    return true;
  };
  const update = (kind: LibraryKind, id: string, patch: Partial<SavedEntry>) => put(kind, get()[kind].map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return {
    ...(typeof window !== 'undefined' ? read() : { boards: [], themes: [] }),

    add: (kind, name, data) => put(kind, [{ id: newId(), name: cleanName(name) || '이름 없음', savedAt: Date.now(), data }, ...get()[kind]]),

    overwrite: (kind, id, data) => update(kind, id, { data, savedAt: Date.now() }),

    rename: (kind, id, name) => update(kind, id, { name: cleanName(name) || '이름 없음' }),

    duplicate: (kind, id) => {
      const items = get()[kind];
      const index = items.findIndex((e) => e.id === id);
      if (index === -1) return false;
      // 이름이 길어도 ' 사본'이 잘리지 않게 앞을 줄인다
      const copy = { ...items[index], id: newId(), name: `${take(items[index].name, MAX_NAME - 3).trim()} 사본`, savedAt: Date.now() };
      return put(kind, [...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    },

    remove: (kind, id) => put(kind, get()[kind].filter((e) => e.id !== id)),
  };
});

// 다른 탭에서 저장하거나 지우면 이 탭 목록도 맞춘다
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) useLibrary.setState(read());
  });
}
