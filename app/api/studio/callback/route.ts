import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { STUDIO_PATH, studioConfigured } from '@/lib/studio/config';
import { canWrite, getUser, revokeToken } from '@/lib/studio/github';
import { SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE, cookieOptions, sealSession } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GitHub 로그인 후 돌아오는 곳: 저장소 쓰기 권한이 있는 사람만 로그인시킨다 */
export async function GET(req: Request) {
  if (!studioConfigured()) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const back = (error?: string) => {
    const res = NextResponse.redirect(new URL(`/${STUDIO_PATH}${error ? `?e=${error}` : ''}`, url.origin));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const expected = cookies().get(STATE_COOKIE)?.value ?? '';
  if (!code || !expected || !same(state, expected)) return back('failed');

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/studio/callback`,
      }),
      cache: 'no-store',
    });
    const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
    if (!token) return back('failed');

    const user = await getUser(token);
    if (!(await canWrite(token, user.login))) {
      await revokeToken(token);
      return back('denied');
    }
    const res = back();
    res.cookies.set(SESSION_COOKIE, sealSession({ token, login: user.login, avatar: user.avatar_url }), cookieOptions(SESSION_MAX_AGE));
    return res;
  } catch {
    return back('failed');
  }
}
