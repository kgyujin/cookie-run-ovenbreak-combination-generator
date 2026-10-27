import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/** 로그인 정보는 서버 DB 없이, 암호화한 쿠키(브라우저 스크립트로 읽을 수 없음)에 담는다 */
export const SESSION_COOKIE = 'studio_session';
export const STATE_COOKIE = 'studio_oauth_state';
const SESSION_HOURS = 8;

export interface StudioSession {
  token: string; // GitHub 토큰 (서버에서만 사용)
  login: string;
  avatar: string;
  exp: number;
}

const key = () => createHash('sha256').update(process.env.STUDIO_SESSION_SECRET ?? '').digest();

export function sealSession(data: Omit<StudioSession, 'exp'>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = JSON.stringify({ ...data, exp: Date.now() + SESSION_HOURS * 3600_000 });
  const encrypted = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function unseal(value: string): StudioSession | null {
  try {
    const raw = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as StudioSession;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function getSession() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  return value ? unseal(value) : null;
}

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSeconds,
});

export const SESSION_MAX_AGE = SESSION_HOURS * 3600;

/** 다른 사이트에서 보낸 요청(CSRF)을 막는다 */
export const sameOrigin = (req: Request) => req.headers.get('origin') === new URL(req.url).origin;

/** 로그인 시작 표시: 서버만 만들 수 있게 서명한다 (쿠키를 직접 넣어 관리 페이지 주소를 알아내지 못하게) */
const sign = (state: string) => createHmac('sha256', key()).update(`oauth-state:${state}`).digest('base64url');

export function newOAuthState() {
  const state = randomBytes(24).toString('base64url');
  return { state, cookie: `${state}.${sign(state)}` };
}

/** 서명이 맞으면 state 값, 아니면 null */
export function verifyOAuthState(cookie: string | undefined) {
  const [state, mac] = (cookie ?? '').split('.');
  if (!state || !mac) return null;
  const expected = Buffer.from(sign(state));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? state : null;
}
