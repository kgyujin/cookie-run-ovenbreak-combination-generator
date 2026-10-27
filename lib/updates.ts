import updates from '@/data/updates.json';

export interface UpdateNote {
  date: string;
  title: string;
  items: string[];
}

/** 최신순 업데이트 기록 (data/updates.json) */
export const UPDATES: UpdateNote[] = updates;

const SEEN_KEY = 'seen-update';
const keyOf = (note: UpdateNote) => `${note.date}|${note.title}`;

/** 마지막으로 확인한 업데이트보다 새로운 항목 수 */
export function unseenCount() {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    const index = UPDATES.findIndex((n) => keyOf(n) === seen);
    return index === -1 ? (seen ? UPDATES.length : -1) : index; // -1: 확인 기록 없음
  } catch {
    return 0;
  }
}

export function markUpdatesSeen() {
  try {
    if (UPDATES[0]) localStorage.setItem(SEEN_KEY, keyOf(UPDATES[0]));
  } catch {}
}
