import { BRANCH, REPO } from './config';

/** GitHub REST API (로그인한 관리자 본인의 토큰으로 호출 → 커밋 작성자도 본인) */
async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body && { 'Content-Type': 'application/json' }),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    // 요청 한도 초과(403 + 남은 횟수 0)는 권한 없음과 구분해 429로 다룬다
    // 1차·2차 요청 한도 (2차 한도는 머리글 없이 본문에만 적혀 올 때도 있다)
    const limited =
      res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after') || (res.status === 403 && /rate limit/i.test(await res.text().catch(() => '')));
    const status = res.status === 403 && limited ? 429 : res.status;
    throw new GitHubError(status, `${init?.method ?? 'GET'} ${path}: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 저장하는 사이에 다른 사람이 먼저 저장해서 다시 시도해도 맞출 수 없을 때 */
export class ConflictError extends Error {}

/** 로그아웃·권한 없음일 때 받은 토큰을 GitHub에서 바로 폐기한다 */
export async function revokeToken(token: string) {
  const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64');
  await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
    method: 'DELETE',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token }),
    cache: 'no-store',
  }).catch(() => {});
}

export async function getUser(token: string) {
  return gh<{ login: string; avatar_url: string }>(token, '/user');
}

/** 저장소에 쓰기 권한(write/maintain/admin)이 있는지. GitHub 장애 같은 다른 오류는 그대로 던진다 (로그아웃시키지 않게) */
export async function canWrite(token: string, login: string) {
  try {
    const { permission } = await gh<{ permission: string }>(token, `/repos/${REPO}/collaborators/${encodeURIComponent(login)}/permission`);
    return ['admin', 'maintain', 'write'].includes(permission);
  } catch (e) {
    if (e instanceof GitHubError && [401, 403, 404].includes(e.status)) return false;
    throw e;
  }
}

/** 현재 main의 파일 (없으면 null). content는 utf-8 문자열 또는 base64 원본 */
export async function readFile(token: string, filePath: string, ref: string) {
  try {
    const file = await gh<{ sha: string; content?: string; encoding?: string }>(
      token,
      `/repos/${REPO}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`
    );
    return { sha: file.sha, text: file.content ? Buffer.from(file.content, 'base64').toString('utf8') : '' };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** 저장소의 아이템 이미지 파일 전체 (경로 → 파일 sha) */
export async function listImages(token: string, ref: string) {
  const { tree, truncated } = await gh<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
    token,
    `/repos/${REPO}/git/trees/${ref}?recursive=1`
  );
  if (truncated) throw new Error('저장소 파일 목록이 너무 커서 읽지 못했어요');
  return new Map(
    tree.filter((f) => f.type === 'blob' && /^public\/images\/.+\.(png|jpe?g|webp)$/i.test(f.path)).map((f) => [f.path, f.sha])
  );
}

/** 정해진 커밋 기준으로 저장소 파일을 읽는다 */
export const githubSource = (token: string, ref: string) => ({
  listImages: () => listImages(token, ref),
  readFile: (path: string) => readFile(token, path, ref),
});

export type TreeChange =
  | { path: string; content: string; encoding: 'utf-8' | 'base64' } // 새 파일 또는 내용 변경
  | { path: string; sha: string } // 기존 파일 옮기기 (같은 내용)
  | { path: string; delete: true };

/**
 * 여러 파일 변경을 커밋 1개로 main에 올린다.
 * 그 사이 다른 커밋이 들어와 앞서 나갈 수 없으면(fast-forward 불가) 한 번 다시 시도한다.
 */
export async function commitChanges(token: string, build: (headSha: string) => Promise<TreeChange[]>, message: () => string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh<{ object: { sha: string } }>(token, `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const headSha = ref.object.sha;
    const head = await gh<{ tree: { sha: string } }>(token, `/repos/${REPO}/git/commits/${headSha}`);
    const changes = await build(headSha);

    const tree = await Promise.all(
      changes.map(async (c) => {
        if ('delete' in c) return { path: c.path, mode: '100644', type: 'blob', sha: null };
        if ('sha' in c) return { path: c.path, mode: '100644', type: 'blob', sha: c.sha };
        const blob = await gh<{ sha: string }>(token, `/repos/${REPO}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: c.content, encoding: c.encoding }),
        });
        return { path: c.path, mode: '100644', type: 'blob', sha: blob.sha };
      })
    );
    const newTree = await gh<{ sha: string }>(token, `/repos/${REPO}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: head.tree.sha, tree }),
    });
    const commit = await gh<{ sha: string; html_url: string }>(token, `/repos/${REPO}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: message(), tree: newTree.sha, parents: [headSha] }),
    });
    try {
      await gh(token, `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return commit;
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 422)) throw e;
    }
  }
  throw new ConflictError();
}
