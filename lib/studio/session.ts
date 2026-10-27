import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
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
