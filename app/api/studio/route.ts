import { NextResponse } from 'next/server';
import { BRANCH, CATEGORY_FOLDERS, REPO, studioConfigured } from '@/lib/studio/config';
import { OpError, buildChanges } from '@/lib/studio/apply';
import { ConflictError, GitHubError, canWrite, commitChanges, githubSource, revokeToken } from '@/lib/studio/github';
import { GenerateError, applyLocal, fromLocalhost, localMode, localSource } from '@/lib/studio/local';
import { CATEGORY_LABELS, StudioOp, describeOp, nameOf } from '@/lib/studio/ops';
import { SESSION_COOKIE, getSession, sameOrigin } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 이미지 여러 장을 올리는 저장도 끝까지

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 로그인 확인 + 매 요청마다 저장소 쓰기 권한을 다시 확인 (관리자에서 빠지면 바로 막힘).
 * 로컬 모드에서는 로그인 없이 이 컴퓨터에서 연 요청만 받는다 (session: null)
 */
async function authorize() {
  if (localMode()) return fromLocalhost() ? { session: null } : { error: new NextResponse(null, { status: 404 }) };
  if (!studioConfigured()) return { error: new NextResponse(null, { status: 404 }) };
  const session = getSession();
  if (!session) return { error: json({ error: '로그인이 필요해요' }, 401) };
  let allowed: boolean;
  try {
    allowed = await canWrite(session.token, session.login);
  } catch {
    return { error: json({ error: GITHUB_DOWN }, 502) };
  }
  if (!allowed) {
    await revokeToken(session.token);
    const res = json({ error: '로그인이 끝났거나 권한이 없어요. 다시 로그인해 주세요' }, 401);
    res.cookies.delete(SESSION_COOKIE);
    return { error: res };
  }
  return { session };
}

const GITHUB_DOWN = 'GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요';

const FOLDER_TO_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_FOLDERS).map(([c, f]) => [f, c]));

/** 관리 화면에 필요한 데이터 (숨긴 아이템까지 포함한 저장소의 현재 상태) */
export async function GET() {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const { session } = auth;
  const source = session ? githubSource(session.token, BRANCH) : localSource;
  let files, meta, updates;
  try {
    const [list, metaFile, updatesFile] = await Promise.all([source.listImages(), source.readFile('data/item-meta.json'), source.readFile('data/updates.json')]);
    [files, meta, updates] = [list, JSON.parse(metaFile?.text || '{}'), JSON.parse(updatesFile?.text || '[]')];
  } catch (e) {
    if (session) return json({ error: GITHUB_DOWN }, 502);
    console.error('Failed to read local data files:', e);
    return json({ error: '프로젝트 폴더의 데이터 파일(data/item-meta.json, data/updates.json)을 읽지 못했어요. 터미널의 오류를 확인해 주세요' }, 500);
  }
  const items = Array.from(files.entries()).flatMap(([path, sha]) => {
    const [, , folder, ...rest] = path.split('/');
    const category = FOLDER_TO_CATEGORY[folder];
    if (!category) return [];
    return [{ category, rarity: rest.length > 1 ? rest[0] : undefined, name: rest[rest.length - 1].replace(/\.[^.]+$/, '').normalize('NFC'), image: path.slice('public'.length), sha }];
  });
  return json({
    user: session && { login: session.login, avatar: session.avatar },
    local: !session,
    repo: REPO,
    items,
    meta,
    updates,
  });
}

/** 모아 둔 변경을 커밋 1개로 main에 바로 올린다 (로컬 모드에서는 프로젝트 폴더에 바로 쓴다) */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const { session } = auth;
  let ops: StudioOp[];
  try {
    ops = (await req.json()).ops;
  } catch {
    return json({ error: '요청을 읽을 수 없어요' }, 400);
  }
  if (!session) {
    try {
      await applyLocal(await buildChanges(localSource, ops, Infinity));
      return json({ local: true });
    } catch (e) {
      if (e instanceof OpError) return json({ error: e.message }, 400);
      if (e instanceof GenerateError) return json({ error: `파일은 저장했지만 사이트 데이터를 만들지 못했어요. 터미널에서 npm run check:content 로 확인해 주세요\n${e.message}` }, 500);
      throw e;
    }
  }
  try {
    const commit = await commitChanges(
      session.token,
      (head) => buildChanges(githubSource(session.token, head), ops),
      () => {
        // 같은 이름을 지우고 바로 다시 올린 건 '이미지 바꿈' 한 줄로
        const lines: string[] = [];
        ops.forEach((op, i) => {
          const next = ops[i + 1];
          const replaced = (del?: StudioOp, add?: StudioOp) =>
            del?.type === 'delete' && add?.type === 'add' && del.category === add.category && nameOf(del.image) === add.name;
          if (replaced(ops[i - 1], op)) return;
          if (op.type === 'delete' && replaced(op, next)) lines.push(`${CATEGORY_LABELS[op.category] ?? '아이템'} 이미지 바꿈: ${nameOf(op.image)}`);
          else lines.push(describeOp(op));
        });
        const title = lines.length > 1 ? `${lines[0]} 외 ${lines.length - 1}건` : lines[0];
        return `${title}\n\n관리자 페이지에서 ${session.login} 님이 저장\n${lines.map((l) => `- ${l}`).join('\n')}`;
      }
    );
    return json({ sha: commit.sha, url: commit.html_url });
  } catch (e) {
    if (e instanceof OpError) return json({ error: e.message }, 400);
    if (e instanceof ConflictError) return json({ error: '다른 관리자가 같은 때에 저장하고 있어요. 잠시 후 다시 저장해 주세요' }, 409);
    if (e instanceof GitHubError && e.status === 401) return json({ error: '로그인이 끝났어요. 다시 로그인해 주세요' }, 401);
    console.error('studio commit failed', e instanceof Error ? e.message : e);
    return json({ error: '저장하지 못했어요. 바꾼 내용은 그대로 있으니 잠시 후 다시 저장해 주세요' }, 502);
  }
}
