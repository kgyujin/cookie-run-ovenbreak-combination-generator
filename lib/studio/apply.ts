import { CATEGORY_FOLDERS, RARITIES, RARITY_CATEGORIES } from './config';
import { MAX_IMAGE_BYTES, MAX_OPS, MAX_TOTAL_IMAGE_BYTES, StudioOp, cleanName, nameOf } from './ops';
import { TreeChange, listImages, readFile } from './github';

export class OpError extends Error {}

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

const dirName = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** 요청을 하나하나 검사해서, 저장소에 쓸 파일 변경 목록으로 바꾼다 */
export async function buildChanges(token: string, ops: unknown, headSha: string): Promise<TreeChange[]> {
  if (!Array.isArray(ops) || ops.length === 0) throw new OpError('변경할 내용이 없어요');
  if (ops.length > MAX_OPS) throw new OpError(`한 번에 ${MAX_OPS}개까지 저장할 수 있어요`);

  const files = await listImages(token, headSha); // 작업하면서 함께 갱신한다
  const changes: TreeChange[] = [];
  const meta = JSON.parse((await readFile(token, META_PATH, headSha))?.text || '{}');
  for (const k of ['pinned', 'hidden']) meta[k] ??= [];
  for (const k of ['added', 'aliases', 'descriptions', 'renamed']) meta[k] ??= {};
  const metaBefore = JSON.stringify(meta);
  let notes: any[] | null = null;
  let totalBytes = 0;

  const dirOf = (category: string, rarity?: string) => {
    if (!(category in CATEGORY_FOLDERS)) throw new OpError('알 수 없는 종류예요');
    const needsRarity = RARITY_CATEGORIES.includes(category as never);
    if (needsRarity && !RARITIES.includes(rarity as never)) throw new OpError('등급을 골라 주세요');
    return `public/images/${CATEGORY_FOLDERS[category as keyof typeof CATEGORY_FOLDERS]}${needsRarity ? `/${rarity}` : ''}`;
  };
  const nameTaken = (dir: string, name: string, except?: string) =>
    Array.from(files.keys()).some((p) => p !== except && dirName(p) === dir && nameOf(p) === name);
  const existing = (image: unknown) => {
    const path = `public${String(image ?? '')}`;
    return files.has(path) && !path.includes('..') ? path : null;
  };

  for (const raw of ops as StudioOp[]) {
    switch (raw?.type) {
      case 'add': {
        const name = cleanName(String(raw.name ?? ''));
        if (!name) throw new OpError('이름을 확인해 주세요 (40자 이내, / : * ? " < > | 같은 기호 제외)');
        const dir = dirOf(raw.category, raw.rarity);
        const bytes = Buffer.from(String(raw.image ?? ''), 'base64');
        const ext = imageExt(bytes);
        if (!ext) throw new OpError(`${name}: PNG, JPG, WEBP 이미지만 올릴 수 있어요`);
        if (bytes.length > MAX_IMAGE_BYTES) throw new OpError(`${name}: 이미지는 1.5MB 이하로 올려 주세요`);
        totalBytes += bytes.length;
        if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new OpError('한 번에 올리는 이미지가 너무 커요. 나눠서 저장해 주세요');
        if (nameTaken(dir, name)) throw new OpError(`${name}: 같은 이름이 이미 있어요`);
        const path = `${dir}/${name}.${ext}`;
        changes.push({ path, content: bytes.toString('base64'), encoding: 'base64' });
        files.set(path, '');
        break;
      }
      case 'move': {
        const name = cleanName(String(raw.name ?? ''));
        if (!name) throw new OpError('새 이름을 확인해 주세요');
        const from = existing(raw.from);
        const sha = from && files.get(from);
        if (!from || !sha) throw new OpError('옮길 파일을 찾을 수 없어요 (이미 바뀌었을 수 있어요)');
        const oldName = nameOf(from);
        const toDir = dirOf(raw.category, raw.rarity ?? dirName(from).split('/').pop());
        const to = `${toDir}/${name}.${from.split('.').pop()}`;
        if (to === from) break;
        if (nameTaken(toDir, name, from)) throw new OpError(`${name}: 같은 이름이 이미 있어요`);
        changes.push({ path: to, sha }, { path: from, delete: true });
        files.delete(from);
        files.set(to, sha);
        if (name !== oldName) {
          // 예전 이름으로 저장·공유된 조합표도 새 이름으로 이어지게, 이름에 붙은 정보도 함께 옮긴다
          for (const [k, v] of Object.entries(meta.renamed)) if (v === oldName) meta.renamed[k] = name;
          meta.renamed[oldName] = name;
          for (const k of ['pinned', 'hidden']) meta[k] = meta[k].map((n: string) => (n === oldName ? name : n));
          for (const d of Object.keys(meta.added)) meta.added[d] = meta.added[d].map((n: string) => (n === oldName ? name : n));
          for (const k of ['aliases', 'descriptions']) if (meta[k][oldName] !== undefined) [meta[k][name], meta[k][oldName]] = [meta[k][oldName], undefined];
        }
        break;
      }
      case 'delete': {
        const target = existing(raw.image);
        if (!target) throw new OpError('지울 파일을 찾을 수 없어요 (이미 지워졌을 수 있어요)');
        changes.push({ path: target, delete: true });
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || items.length === 0) throw new OpError('업데이트 소식의 날짜, 제목, 내용을 확인해 주세요');
        notes ??= JSON.parse((await readFile(token, UPDATES_PATH, headSha))?.text || '[]');
        notes!.push({ date, title, items });
        notes!.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        break;
      }
      default:
        throw new OpError('알 수 없는 요청이에요');
    }
  }

  // 지우거나 이름이 바뀌어 없어진 아이템의 정보는 정리한다 (빌드 때 이름 검사에 걸리지 않게)
  const names = new Set(Array.from(files.keys()).map(nameOf));
  for (const k of ['pinned', 'hidden']) meta[k] = meta[k].filter((n: string) => names.has(n));
  for (const k of ['aliases', 'descriptions']) for (const n of Object.keys(meta[k])) if (!names.has(n)) meta[k][n] = undefined;
  for (const [date, list] of Object.entries(meta.added)) {
    const kept = (list as string[]).filter((n) => names.has(n));
    meta.added[date] = kept.length ? kept : undefined;
  }
  for (const [from, to] of Object.entries(meta.renamed)) if (!names.has(to as string)) meta.renamed[from] = undefined;

  const metaText = JSON.stringify(meta, null, 2) + '\n';
  if (JSON.stringify(JSON.parse(metaText)) !== metaBefore) changes.push({ path: META_PATH, content: metaText, encoding: 'utf-8' });
  if (notes) changes.push({ path: UPDATES_PATH, content: JSON.stringify(notes, null, 2) + '\n', encoding: 'utf-8' });
  if (changes.length === 0) throw new OpError('바뀐 내용이 없어요');
  return changes;
}
