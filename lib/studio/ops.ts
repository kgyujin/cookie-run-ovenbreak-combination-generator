/** 관리자 페이지에서 서버로 보내는 변경 요청 (브라우저·서버 공용) */
import type { Rarity, StudioCategory } from './config';

export type StudioOp =
  | { type: 'add'; category: StudioCategory; rarity?: Rarity; name: string; image: string } // image: base64 (data: 접두어 없이)
  | { type: 'move'; category: StudioCategory; from: string; name: string; rarity?: Rarity } // 이름 바꾸기·등급 옮기기 (from: /images/... 경로)
  | { type: 'delete'; category: StudioCategory; image: string }
  | { type: 'meta'; name: string; pinned?: boolean; hidden?: boolean; aliases?: string[]; description?: string }
  | { type: 'note'; date: string; title: string; items: string[] };

export const MAX_OPS = 30;
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 3 * 1024 * 1024; // base64로 보내면 1.33배 → 서버 요청 한도(4.5MB) 안쪽

/** 아이템 이름 = 파일 이름. 파일·주소에 문제 되는 글자는 쓸 수 없다 */
export function cleanName(raw: string): string | null {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 40) return null;
  if (/[\\/:*?"<>|#%{}^~[\]`\u0000-\u001f]/.test(name) || name.startsWith('.')) return null;
  return name;
}

export const CATEGORY_LABELS: Record<StudioCategory, string> = {
  cookies: '쿠키',
  pets: '펫',
  treasures: '보물',
  dishes: '요리',
  ingredients: '재료',
  magicCandies: '마법사탕',
  blessings: '축복',
};

export const RARITY_LABELS: Record<Rarity, string> = { legendary: '레전더리', epic: '에픽', rare: '레어', common: '커먼' };

/** '/images/cookies/epic/파김치.png' → '파김치' */
export const nameOf = (image: string) => (image.split('/').pop() ?? '').replace(/\.[^.]+$/, '').normalize('NFC');

/** 변경 요청 한 줄 설명 (확인 목록·커밋 메시지용) */
export function describeOp(op: StudioOp): string {
  switch (op.type) {
    case 'add':
      return `${CATEGORY_LABELS[op.category] ?? '아이템'} 추가: ${op.name}${op.rarity ? ` (${RARITY_LABELS[op.rarity]})` : ''}`;
    case 'move': {
      const oldName = nameOf(op.from);
      const parts = [oldName !== op.name && `이름 ${oldName} → ${op.name}`, op.rarity && `등급 ${RARITY_LABELS[op.rarity]}`].filter(Boolean);
      return `${CATEGORY_LABELS[op.category] ?? '아이템'} 수정: ${oldName} (${parts.join(', ')})`;
    }
    case 'delete':
      return `${CATEGORY_LABELS[op.category] ?? '아이템'} 삭제: ${nameOf(op.image)}`;
    case 'meta':
      return `아이템 정보 수정: ${op.name}`;
    case 'note':
      return `업데이트 소식 추가: ${op.title}`;
  }
}
