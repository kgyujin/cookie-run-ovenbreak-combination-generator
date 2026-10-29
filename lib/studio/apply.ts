import { createHash } from 'crypto';
import { CATEGORY_FOLDERS, RARITIES, RARITY_CATEGORIES } from './config';
import { CATEGORY_LABELS, MAX_OPS, MAX_TOTAL_IMAGE_BYTES, NOTE_SYMBOLS, NOTE_SYMBOLS_MESSAGE, StudioOp, cleanName, nameOf } from './ops';
import type { TreeChange } from './github';

export class OpError extends Error {}

/** 현재 파일을 읽는 곳 (GitHub 저장소 또는 내 컴퓨터의 프로젝트 폴더) */
export interface Source {
  listImages(): Promise<Map<string, string>>; // 'public/images/...' → git 파일 sha
  readFile(path: string): Promise<{ text: string } | null>;
}

const META_PATH = 'data/item-meta.json';
const UPDATES_PATH = 'data/updates.json';

/** 이미지 내용으로 형식 확인 (확장자·MIME은 믿지 않음) */
function imageExt(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

const strList = (v: unknown, max: number, len: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, len)).filter(Boolean).slice(0, max) : [];

/** git이 파일 내용에 붙이는 이름 (같은 그림인지 비교) */
export const gitBlobSha = (bytes: Buffer) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const dirName = (path: string) => path.slice(0, path.lastIndexOf('/'));
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase(); // 대소문자만 다른 이름은 윈도우·맥에서 같은 파일
const isRealDate = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
};

/**
 * 요청을 하나하나 검사해서, 저장소에 쓸 파일 변경 목록으로 바꾼다.
 * maxImageBytes: 한 번에 올리는 이미지 합계 한도 (로컬 모드는 Infinity)
 */
export async function buildChanges(source: Source, ops: unknown, maxImageBytes = MAX_TOTAL_IMAGE_BYTES): Promise<TreeChange[]> {
  if (!Array.isArray(ops) || ops.length === 0) throw new OpError('변경할 내용이 없어요');
  if (ops.length > MAX_OPS) throw new OpError('한 번에 저장하기에는 변경이 너무 많아요. 나눠서 저장해 주세요');

  const files = await source.listImages(); // 작업하면서 함께 갱신한다
  const headPaths = new Set(files.keys());
  const headFiles = new Map(files);
  let changes: TreeChange[] = [];
  /** 같은 경로의 앞선 변경은 덮어쓴다 (예: 지운 뒤 같은 이름으로 다시 올리기) */
  const setChange = (change: TreeChange) => {
    changes = changes.filter((c) => c.path !== change.path);
    if (!('delete' in change) || headPaths.has(change.path)) changes.push(change);
  };
  const meta = JSON.parse((await source.readFile(META_PATH))?.text || '{}');
  for (const k of ['pinned', 'hidden']) meta[k] ??= [];
  for (const k of ['added', 'aliases', 'descriptions', 'renamed']) meta[k] ??= {};
  const metaBefore = JSON.stringify(meta);
  let notes: any[] | null = null;
  let notesChanged = false;
  const loadNotes = async () => (notes ??= JSON.parse((await source.readFile(UPDATES_PATH))?.text || '[]') as any[]);
  const sameNote = (a: any, b: any) =>
    a?.date === b?.date && a?.title === b?.title && JSON.stringify(a?.items) === JSON.stringify(b?.items);
  let totalBytes = 0;

  const dirOf = (category: string, rarity?: string) => {
    if (!hasOwn(CATEGORY_FOLDERS, category)) throw new OpError('알 수 없는 종류예요');
    const needsRarity = RARITY_CATEGORIES.includes(category as never);
    if (needsRarity && !RARITIES.includes(rarity as never)) throw new OpError('등급을 골라 주세요');
    return `public/images/${CATEGORY_FOLDERS[category as keyof typeof CATEGORY_FOLDERS]}${needsRarity ? `/${rarity}` : ''}`;
  };
  const nameTaken = (dir: string, name: string, except?: string) =>
    Array.from(files.keys()).some((p) => p !== except && dirName(p) === dir && sameName(nameOf(p), name));
  /** 담을 때와 지금 파일이 다르면(다른 관리자가 바꿨거나, 응답을 못 받은 저장이 이미 반영됨) 거절 */
  const unchanged = (path: string, sha: unknown) => {
    if (sha !== undefined && headFiles.get(path) !== sha)
      throw new OpError(`${nameOf(path)}: 그사이 바뀌었어요. 새로고침해서 목록을 다시 불러온 뒤 해 주세요`);
  };
  const existing = (image: unknown) => {
    const path = `public${String(image ?? '')}`;
    return files.has(path) && !path.includes('..') ? path : null;
  };
  /** 'public/images/cookies/epic/x.png' → 'cookies' */
  const categoryOf = (path: string) => Object.keys(CATEGORY_FOLDERS).find((c) => CATEGORY_FOLDERS[c as keyof typeof CATEGORY_FOLDERS] === path.split('/')[2]);

  for (const raw of ops as StudioOp[]) {
    switch (raw?.type) {
      case 'add': {
        const name = cleanName(String(raw.name ?? ''));
        if (!name) throw new OpError('이름을 확인해 주세요 (40자 이내, / : * ? " < > | 같은 기호 제외)');
        const dir = dirOf(raw.category, raw.rarity);
        const bytes = Buffer.from(String(raw.image ?? ''), 'base64');
        const ext = imageExt(bytes);
        if (!ext) throw new OpError(`${name}: PNG, JPG, WEBP 이미지만 올릴 수 있어요`);
        totalBytes += bytes.length;
        if (totalBytes > maxImageBytes) throw new OpError('한 번에 올리는 이미지가 너무 커요. 나눠서 저장해 주세요');
        if (nameTaken(dir, name)) throw new OpError(`${name}: 같은 이름이 이미 있어요`);
        const path = `${dir}/${name}.${ext}`;
        const sha = gitBlobSha(bytes);
        if (headFiles.get(path) === sha) {
          // 지금과 똑같은 그림을 다시 올린 경우(응답을 못 받고 다시 저장 등): 바꿀 것이 없다
          changes = changes.filter((c) => c.path !== path);
          files.set(path, sha);
          break;
        }
        setChange({ path, content: bytes.toString('base64'), encoding: 'base64' });
        files.set(path, '');
        break;
      }
      case 'move': {
        const name = cleanName(String(raw.name ?? ''));
        if (!name) throw new OpError('새 이름을 확인해 주세요');
        const from = existing(raw.from);
        const sha = from && files.get(from);
        if (!from || !sha) throw new OpError(`${nameOf(String(raw.from ?? ''))}: 옮길 파일을 찾을 수 없어요 (이미 바뀌었을 수 있어요)`);
        unchanged(from, raw.sha);
        const oldName = nameOf(from);
        // 종류는 바꿀 수 없다 (등급과 이름만)
        const toDir = dirOf(categoryOf(from) ?? '', raw.rarity ?? dirName(from).split('/').pop());
        const to = `${toDir}/${name}.${from.split('.').pop()}`;
        if (to === from) break;
        if (nameTaken(toDir, name, from)) throw new OpError(`${name}: 같은 이름이 이미 있어요`);
        // 새 이름을 쓰는 파일이 하나도 없으면(같은 저장에서 지운 아이템의 이름 등) 그 이름에 남은 정보는 이 아이템 것이 아니다
        if (name !== oldName && !Array.from(files.keys()).some((p) => p !== from && nameOf(p) === name)) {
          for (const k of ['pinned', 'hidden']) meta[k] = meta[k].filter((n: string) => n !== name);
          for (const k of ['aliases', 'descriptions']) meta[k][name] = undefined;
          for (const d of Object.keys(meta.added)) meta.added[d] = meta.added[d].filter((n: string) => n !== name);
          for (const [k, v] of Object.entries(meta.renamed)) if (v === name) meta.renamed[k] = undefined;
        }
        setChange({ path: to, sha });
        setChange({ path: from, delete: true });
        files.delete(from);
        files.set(to, sha);
        if (name !== oldName) {
          // 이름에 붙은 정보는 같은 이름의 다른 아이템(펫, 마법사탕 등)과 함께 쓰므로,
          // 아직 그 이름을 쓰는 파일이 남아 있으면 옮기지 않고 복사한다
          const shared = Array.from(files.keys()).some((p) => nameOf(p) === oldName);
          // 예전 이름으로 저장하거나 공유한 조합표도 새 이름으로 이어지게 (여러 번 바뀐 이름도 끊기지 않게)
          if (!shared) for (const [k, v] of Object.entries(meta.renamed)) if (v === oldName) meta.renamed[k] = name;
          meta.renamed[oldName] = name;
          for (const k of ['pinned', 'hidden']) {
            if (meta[k].includes(oldName) && !meta[k].includes(name)) meta[k].push(name);
            if (!shared) meta[k] = meta[k].filter((n: string) => n !== oldName);
          }
          for (const d of Object.keys(meta.added)) if (meta.added[d].includes(oldName)) meta.added[d] = [...meta.added[d].filter((n: string) => n !== name), name];
          for (const k of ['aliases', 'descriptions']) {
            if (meta[k][oldName] !== undefined) meta[k][name] ??= meta[k][oldName];
            if (!shared) meta[k][oldName] = undefined;
          }
        }
        break;
      }
      case 'delete': {
        const target = existing(raw.image);
        if (!target) throw new OpError(`${nameOf(String(raw.image ?? ''))}: 지울 파일을 찾을 수 없어요 (이미 지워졌을 수 있어요)`);
        unchanged(target, raw.sha);
        setChange({ path: target, delete: true });
        files.delete(target);
        break;
      }
      case 'meta': {
        const name = cleanName(String(raw.name ?? ''));
        if (!name) throw new OpError('아이템 이름을 확인해 주세요');
        const toggle = (key: 'pinned' | 'hidden', on?: boolean) => {
          if (on === undefined) return;
          meta[key] = meta[key].filter((n: string) => n !== name);
          if (on) meta[key].push(name);
        };
        toggle('pinned', raw.pinned);
        toggle('hidden', raw.hidden);
        if (raw.aliases !== undefined) {
          const list = strList(raw.aliases, 10, 30);
          meta.aliases[name] = list.length ? list : undefined;
        }
        if (raw.description !== undefined) meta.descriptions[name] = String(raw.description).trim().slice(0, 80) || undefined;
        break;
      }
      case 'note': {
        const date = String(raw.date ?? '');
        const title = String(raw.title ?? '').trim().slice(0, 40);
        const items = strList(raw.items, 20, 100);
        if (!isRealDate(date) || !title || items.length === 0) throw new OpError('업데이트 소식의 날짜, 제목, 내용을 확인해 주세요');
        if ([title, ...items].some((t) => NOTE_SYMBOLS.test(t))) throw new OpError(`${title}: ${NOTE_SYMBOLS_MESSAGE}`);
        const list = await loadNotes();
        const note = { date, title, items };
        const exists = list.some((n) => sameNote(n, note));
        if (raw.from) {
          // 고치기: 담을 때의 소식이 그대로 있어야 한다 (다른 관리자가 그사이 고치거나 지웠으면 거절)
          const index = list.findIndex((n) => sameNote(n, raw.from));
          if (index < 0) {
            if (exists) break; // 이미 고쳐짐 (응답만 늦어 다시 저장한 경우)
            throw new OpError(`${title}: 소식이 그사이 바뀌었어요. 새로고침해서 목록을 다시 불러온 뒤 해 주세요`);
          }
          if (sameNote(list[index], note)) break;
          // 고친 결과가 다른 소식과 똑같아지면 둘을 하나로 (같은 소식이 두 번 보이지 않게)
          if (exists) list.splice(index, 1);
          else list[index] = note;
        } else {
          // 저장이 끝났는데 응답만 늦어 다시 저장한 경우 같은 소식이 두 번 들어가지 않게
          if (exists) break;
          list.push(note);
        }
        notesChanged = true;
        list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        break;
      }
      case 'note-delete': {
        const list = await loadNotes();
        const index = list.findIndex((n) => sameNote(n, raw));
        if (index < 0) break; // 이미 지워짐 (응답만 늦어 다시 저장한 경우 등)
        list.splice(index, 1);
        notesChanged = true;
        break;
      }
      default:
        throw new OpError('알 수 없는 요청이에요');
    }
  }

  // 종류 폴더가 통째로 비면 빌드가 멈추므로 마지막 하나는 남긴다
  for (const [category, folder] of Object.entries(CATEGORY_FOLDERS)) {
    if (!Array.from(files.keys()).some((p) => p.startsWith(`public/images/${folder}/`)))
      throw new OpError(`${CATEGORY_LABELS[category as keyof typeof CATEGORY_FOLDERS]}: 마지막 남은 아이템은 지울 수 없어요`);
  }

  // 지우거나 이름이 바뀌어 없어진 아이템의 정보는 정리한다 (빌드 때 이름 검사에 걸리지 않게)
  const names = new Set(Array.from(files.keys()).map(nameOf));
  for (const k of ['pinned', 'hidden']) meta[k] = meta[k].filter((n: string) => names.has(n));
  for (const k of ['aliases', 'descriptions']) for (const n of Object.keys(meta[k])) if (!names.has(n)) meta[k][n] = undefined;
  for (const [date, list] of Object.entries(meta.added)) {
    const kept = (list as string[]).filter((n) => names.has(n));
    meta.added[date] = kept.length ? kept : undefined;
  }
  for (const [from, to] of Object.entries(meta.renamed)) if (from === to || !names.has(to as string)) meta.renamed[from] = undefined;

  const metaText = JSON.stringify(meta, null, 2) + '\n';
  if (JSON.stringify(JSON.parse(metaText)) !== metaBefore) setChange({ path: META_PATH, content: metaText, encoding: 'utf-8' });
  if (notes && notesChanged) setChange({ path: UPDATES_PATH, content: JSON.stringify(notes, null, 2) + '\n', encoding: 'utf-8' });
  if (changes.length === 0) throw new OpError('바뀐 내용이 없어요');
  return changes;
}
