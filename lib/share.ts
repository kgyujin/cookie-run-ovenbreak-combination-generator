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
    signal: AbortSignal.timeout(10_000), // 응답이 없으면 기다리지 않고 긴 링크로 대신한다
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
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`파일 업로드 실패 (${res.status})`);
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  uploaded.set(dataUrl, url);
  return url;
}

/** 공유 링크 종류: 보기 전용은 /v/<id>, 편집 가능은 /s/<id> (같은 공유 데이터. 예전에 보낸 /s/ 링크는 그대로 편집 가능) */
export type ShareMode = 'view' | 'edit';
const SHARE_PATH: Record<ShareMode, string> = { view: 'v', edit: 's' };

export const shareUrl = (id: string, mode: ShareMode) => `${window.location.origin}/${SHARE_PATH[mode]}/${id}`;

/** 주소에서 공유 아이디를 읽는다. 그 종류의 공유 주소가 아니면 null, 아이디 모양이 틀리면 '' */
export function shareIdIn(pathname: string, mode: ShareMode): string | null {
  const match = pathname.match(new RegExp(`^/${SHARE_PATH[mode]}/([^/]*)/?$`));
  if (!match) return null;
  return /^[A-Za-z0-9]{4,16}$/.test(match[1]) ? match[1] : '';
}

/** 공유 데이터를 저장하고 아이디를 돌려준다 (주소는 shareUrl) */
export async function createShortLink(board: BoardState) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase 설정이 없습니다');
  const payload = structuredClone(board);
  if (payload.background.imageUrl?.startsWith('data:')) {
    payload.background.imageUrl = await uploadDataUrl(payload.background.imageUrl);
  }
  if (payload.fontSettings.customFontUrl?.startsWith('data:')) {
    payload.fontSettings.customFontUrl = await uploadDataUrl(payload.fontSettings.customFontUrl);
  }
  return rpc<string>('create_share', { payload });
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
