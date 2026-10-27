import { NextResponse } from 'next/server';
import { BRANCH, CATEGORY_FOLDERS, REPO, studioConfigured } from '@/lib/studio/config';
import { OpError, buildChanges } from '@/lib/studio/apply';
import { GitHubError, canWrite, commitChanges, listImages, readFile } from '@/lib/studio/github';
import { StudioOp, describeOp } from '@/lib/studio/ops';
import { SESSION_COOKIE, getSession, sameOrigin } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 로그인 확인 + 매 요청마다 저장소 쓰기 권한을 다시 확인 (관리자에서 빠지면 바로 막힘) */
async function authorize() {
  if (!studioConfigured()) return { error: new NextResponse(null, { status: 404 }) };
  const session = getSession();
  if (!session) return { error: json({ error: '로그인이 필요해요' }, 401) };
  if (!(await canWrite(session.token, session.login))) {
    const res = json({ error: '로그인이 끝났거나 권한이 없어요. 다시 로그인해 주세요' }, 401);
    res.cookies.delete(SESSION_COOKIE);
    return { error: res };
  }
  return { session };
}

const FOLDER_TO_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_FOLDERS).map(([c, f]) => [f, c]));

/** 관리 화면에 필요한 데이터 (숨긴 아이템까지 포함한 저장소의 현재 상태) */
export async function GET() {
  const { session, error } = await authorize();
  if (error) return error;
  const [files, meta, updates] = await Promise.all([
    listImages(session.token, BRANCH),
    readFile(session.token, 'data/item-meta.json', BRANCH),
    readFile(session.token, 'data/updates.json', BRANCH),
  ]);
  const items = Array.from(files.keys()).flatMap((path) => {
    const [, , folder, ...rest] = path.split('/');
    const category = FOLDER_TO_CATEGORY[folder];
    if (!category) return [];
    return [{ category, rarity: rest.length > 1 ? rest[0] : undefined, name: rest[rest.length - 1].replace(/\.[^.]+$/, '').normalize('NFC'), image: path.slice('public'.length) }];
  });
  return json({
    user: { login: session.login, avatar: session.avatar },
    repo: REPO,
    items,
    meta: JSON.parse(meta?.text || '{}'),
    updates: JSON.parse(updates?.text || '[]'),
  });
}

/** 모아 둔 변경을 커밋 1개로 main에 바로 올린다 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const { session, error } = await authorize();
  if (error) return error;
  let ops: StudioOp[];
  try {
    ops = (await req.json()).ops;
  } catch {
    return json({ error: '요청을 읽을 수 없어요' }, 400);
  }
  try {
    const commit = await commitChanges(
      session.token,
      (head) => buildChanges(session.token, ops, head),
      () => {
        const lines = ops.map(describeOp);
        const title = lines.length > 1 ? `${lines[0]} 외 ${lines.length - 1}건` : lines[0];
        return `${title}\n\n관리자 페이지에서 ${session.login} 님이 저장\n${lines.map((l) => `- ${l}`).join('\n')}`;
      }
    );
    return json({ sha: commit.sha, url: commit.html_url });
  } catch (e) {
    if (e instanceof OpError) return json({ error: e.message }, 400);
    if (e instanceof GitHubError && e.status === 422) return json({ error: '다른 사람이 방금 저장했어요. 새로고침한 뒤 다시 시도해 주세요' }, 409);
    console.error('studio commit failed', e instanceof Error ? e.message : e);
    return json({ error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요' }, 502);
  }
}
