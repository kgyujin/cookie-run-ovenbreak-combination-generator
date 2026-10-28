import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { headers } from 'next/headers';
import { Source, gitBlobSha } from './apply';
import type { TreeChange } from './github';

/**
 * 로컬 모드: 내 컴퓨터에서 `npm run dev`로 띄웠을 때만 (.env.local에 STUDIO_LOCAL=1).
 * GitHub 로그인 없이 /studio-local 에서 관리하고, 저장하면 프로젝트 폴더의 파일을 바로 바꾼다.
 * 배포된 사이트(NODE_ENV=production)에서는 절대 켜지지 않는다.
 */
export const localMode = () => process.env.NODE_ENV === 'development' && process.env.STUDIO_LOCAL === '1';
export const LOCAL_PATH = 'studio-local';

/** 이 컴퓨터에서 연 요청인지 (같은 와이파이의 다른 기기나, 주소를 바꿔 치는 웹페이지는 막는다) */
export const fromLocalhost = () => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(headers().get('host') ?? '');

const ROOT = process.cwd();
const IMAGES = path.join(ROOT, 'public', 'images');
const IMAGE_FILE = /\.(png|jpe?g|webp)$/i;

/** 저장소 경로('public/images/...') → 실제 파일 위치. 프로젝트의 이미지·데이터 폴더 밖은 막는다 */
function abs(repoPath: string) {
  const full = path.resolve(ROOT, repoPath);
  if (!full.startsWith(IMAGES + path.sep) && !full.startsWith(path.join(ROOT, 'data') + path.sep)) throw new Error(`잘못된 경로: ${repoPath}`);
  return full;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])));
  return nested.flat();
}

export const localSource: Source = {
  async listImages() {
    const files = (await walk(IMAGES)).filter((f) => IMAGE_FILE.test(f));
    const shas = await Promise.all(files.map(async (f) => gitBlobSha(await fs.readFile(f))));
    return new Map(files.map((f, i) => [path.relative(ROOT, f).split(path.sep).join('/'), shas[i]]));
  },
  async readFile(repoPath) {
    try {
      return { text: await fs.readFile(abs(repoPath), 'utf8') };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  },
};

export class GenerateError extends Error {}

/** 변경을 프로젝트 폴더에 쓰고, 사이트 데이터(gameData.json, 작은 이미지)를 다시 만든다 */
export async function applyLocal(changes: TreeChange[]) {
  // 옮기기는 내용(sha)만 알려주므로, 지우기 전에 원래 파일을 읽어 둔다
  const bySha = new Map(Array.from(await localSource.listImages()).map(([p, sha]) => [sha, p]));
  const moved = await Promise.all(
    changes.map((c) => {
      if (!('sha' in c)) return null;
      const from = bySha.get(c.sha);
      if (!from) throw new Error(`옮길 파일을 찾지 못했어요: ${c.path}`);
      return fs.readFile(abs(from));
    })
  );
  // 지우기를 먼저 해야 대소문자만 바꾼 이름(윈도우·맥에서는 같은 파일)도 제대로 바뀐다
  for (const c of changes) if ('delete' in c) await fs.rm(abs(c.path), { force: true });
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if ('delete' in c) continue;
    const file = abs(c.path);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, 'sha' in c ? moved[i]! : Buffer.from(c.content, c.encoding === 'base64' ? 'base64' : 'utf8'));
  }
  // 비워진 등급 폴더는 지운다 (Git에는 빈 폴더가 남지 않으므로 같은 모습으로)
  for (const c of changes) if ('delete' in c) await fs.rmdir(path.dirname(abs(c.path))).catch(() => {});

  await new Promise<void>((resolve, reject) =>
    execFile(process.execPath, ['scripts/generateImageData.js'], { cwd: ROOT }, (error, _stdout, stderr) => {
      if (!error) return resolve();
      const problems = stderr.split('\n').filter((l) => l.startsWith('  - ')).map((l) => l.slice(4));
      reject(new GenerateError(problems.join('\n') || stderr.trim() || error.message));
    })
  );
}
