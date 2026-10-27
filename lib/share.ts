import { compressToEncodedURIComponent } from 'lz-string';
import { BoardState } from '@/types';
import { DEFAULT_BACKGROUND } from './backgrounds';

/**
 * 짧은 공유 링크 (Supabase).
 * 조합표 데이터는 shares 테이블에, 직접 올린 배경 이미지·폰트 파일은 share-assets 버킷에 저장한다.
 * DB 구조는 supabase/migrations 참고.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BUCKET = 'share-assets';

const headers = () => ({ apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}` });

async function rpc<T>(fn: string, args: object): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} 실패 (${res.status})`);
  return res.json();
}

const uploaded = new Map<string, string>(); // 같은 파일을 여러 번 올리지 않도록

/** data: URL(직접 올린 파일)을 스토리지에 올리고 공개 주소를 돌려준다 */
async function uploadDataUrl(dataUrl: string) {
  const cached = uploaded.get(dataUrl);
  if (cached) return cached;
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const path = `${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': blob.type },
    body: blob,
  });
  if (!res.ok) throw new Error(`파일 업로드 실패 (${res.status})`);
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  uploaded.set(dataUrl, url);
  return url;
}

export async function createShortLink(board: BoardState) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase 설정이 없습니다');
  const payload = structuredClone(board);
  if (payload.background.imageUrl?.startsWith('data:')) {
    payload.background.imageUrl = await uploadDataUrl(payload.background.imageUrl);
  }
  if (payload.fontSettings.customFontUrl?.startsWith('data:')) {
    payload.fontSettings.customFontUrl = await uploadDataUrl(payload.fontSettings.customFontUrl);
  }
  const id = await rpc<string>('create_share', { payload });
  return `${window.location.origin}/s/${id}`;
}

export async function loadShortLink(id: string): Promise<unknown | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return rpc('get_share', { share_id: id });
}

/** 예비용 긴 링크 (짧은 링크를 만들 수 없을 때). 직접 올린 파일은 너무 커서 제외한다. */
export function createLongLink(board: BoardState) {
  const payload = structuredClone(board);
  // 직접 올린 배경 이미지는 담을 수 없으므로 기본 배경으로 바꿔서 보낸다 (빈 이미지 배경 방지)
  if (payload.background.imageUrl?.startsWith('data:')) payload.background = DEFAULT_BACKGROUND;
  if (payload.fontSettings.customFontUrl?.startsWith('data:')) payload.fontSettings.customFontUrl = '';
  return `${window.location.origin}/?data=${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}
