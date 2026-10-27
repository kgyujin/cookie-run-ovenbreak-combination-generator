import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { studioConfigured } from '@/lib/studio/config';
import { STATE_COOKIE, cookieOptions } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

/** GitHub 로그인 화면으로 보낸다 */
export function GET(req: Request) {
  if (!studioConfigured()) return new NextResponse(null, { status: 404 });
  const state = randomBytes(24).toString('base64url');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${new URL(req.url).origin}/api/studio/callback`);
  url.searchParams.set('scope', 'public_repo'); // 공개 저장소에 커밋하는 데 필요한 최소 권한
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, cookieOptions(600));
  return res;
}
