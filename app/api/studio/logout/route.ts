import { NextResponse } from 'next/server';
import { revokeToken } from '@/lib/studio/github';
import { SESSION_COOKIE, getSession, sameOrigin } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const session = getSession();
  if (session) await revokeToken(session.token);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
