export interface UpdateNote {
  date: string;
  title: string;
  items: string[];
}

const SEEN_KEY = 'seen-update';
const keyOf = (note: UpdateNote) => `${note.date}|${note.title}`;

/**
 * 마지막으로 확인한 업데이트보다 새로운 항목 수. -1: 확인 기록 없음
 * (업데이트 목록은 빌드 때 data/updates.json + 새 아이템 기록으로 만들어져 gameData.updates에 들어 있음)
 */
export function unseenCount(updates: UpdateNote[]) {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return -1;
    const index = updates.findIndex((n) => keyOf(n) === seen);
    return index === -1 ? updates.length : index;
  } catch {
    return 0;
  }
}

export function markUpdatesSeen(updates: UpdateNote[]) {
  try {
    if (updates[0]) localStorage.setItem(SEEN_KEY, keyOf(updates[0]));
  } catch {}
}
