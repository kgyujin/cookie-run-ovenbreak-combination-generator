import { BoardState, Category, GameData, GameItem } from '@/types';

export const CATEGORIES: Category[] = ['cookies', 'pets', 'treasures', 'dishes', 'ingredients', 'magicCandies', 'blessings'];

export const CATEGORY_LABELS: Record<Category, string> = {
  cookies: '쿠키',
  pets: '펫',
  treasures: '보물',
  dishes: '요리',
  ingredients: '재료',
  magicCandies: '마법사탕',
  blessings: '축복',
};

const PATH_RE = /^\/images\/([^/]+)\/(?:[^/]+\/)?([^/]+)\.(?:png|jpe?g|webp)$/i;

/** '/images/cookies/epic/파김치.png' → { folder: 'cookies', name: '파김치' } */
function parsePath(path: string) {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {}
  const m = decoded.normalize('NFC').match(PATH_RE);
  return m ? { folder: m[1], name: m[2] } : null;
}

const NEW_DAYS = 30;

export function isNew(item: GameItem, now = Date.now()) {
  if (!item.addedAt) return false;
  const added = Date.parse(item.addedAt);
  return !Number.isNaN(added) && now - added < NEW_DAYS * 24 * 60 * 60 * 1000;
}

const itemMaps = new WeakMap<GameData, Map<string, GameItem>>();
const EMPTY_MAP = new Map<string, GameItem>();

/** 이미지 경로 → 아이템 */
export function getItemMap(gameData: GameData | null) {
  if (!gameData) return EMPTY_MAP;
  let map = itemMaps.get(gameData);
  if (!map) {
    map = new Map(CATEGORIES.flatMap((c) => (gameData[c] ?? []).map((item) => [item.image, item] as const)));
    itemMaps.set(gameData, map);
  }
  return map;
}

/**
 * 저장·공유된 이미지 경로를 현재 데이터에 맞춘다.
 * 등급 폴더가 바뀌었거나(예: epic → legendary) 이름이 바뀐 경우(renamed)에도 같은 아이템을 찾아준다.
 */
export function createPathResolver(gameData: GameData) {
  const current = new Set<string>();
  const byKey = new Map<string, string | null>(); // null: 같은 이름이 여러 등급에 있어 하나로 정할 수 없음
  for (const category of CATEGORIES) {
    for (const item of gameData[category] ?? []) {
      current.add(item.image);
      const parsed = parsePath(item.image);
      if (!parsed) continue;
      const key = `${parsed.folder}/${parsed.name}`;
      byKey.set(key, byKey.has(key) ? null : item.image);
    }
  }
  const renamed = gameData.renamed ?? {};

  return (path: string) => {
    if (!path || current.has(path)) return path;
    const parsed = parsePath(path);
    if (!parsed) return path;
    const { folder, name } = parsed;
    // 이름이 여러 번 바뀌었어도 따라간다 (순환 방지로 최대 10번)
    for (let n: string | undefined = name, i = 0; n && i < 10; n = renamed[n], i++) {
      const found = byKey.get(`${folder}/${n}`);
      if (found) return found;
    }
    return path;
  };
}

export function resolveBoardItems(board: BoardState, gameData: GameData): BoardState {
  const resolve = createPathResolver(gameData);
  let changed = false;
  const r = (path: string) => {
    const next = resolve(path);
    if (next !== path) changed = true;
    return next;
  };
  const combo = (c: BoardState['arenas'][number]['mainCombo']) => ({
    pet: r(c.pet),
    cookie1: r(c.cookie1),
    cookie2: r(c.cookie2),
    treasures: c.treasures.map(r) as [string, string, string],
  });
  const result = {
    ...board,
    seasonDish: r(board.seasonDish),
    seasonIngredients: board.seasonIngredients.map(r) as [string, string, string],
    arenas: board.arenas.map((a) => ({
      ...a,
      mainCombo: combo(a.mainCombo),
      subCombo: combo(a.subCombo),
      dish: r(a.dish),
      magicCandy: {
        cookie1Candy: r(a.magicCandy.cookie1Candy),
        cookie1Blessing: r(a.magicCandy.cookie1Blessing),
        cookie2Candy: r(a.magicCandy.cookie2Candy),
        cookie2Blessing: r(a.magicCandy.cookie2Blessing),
      },
    })),
  };
  // 바뀐 경로가 없으면 그대로 돌려줘서 화면 전체를 다시 그리지 않게
  return changed ? result : board;
}
