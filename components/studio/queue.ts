import { CATEGORY_FOLDERS, RARITY_CATEGORIES, Rarity, StudioCategory } from '@/lib/studio/config';
import { CATEGORY_LABELS, RARITY_LABELS, StudioOp } from '@/lib/studio/ops';

/** 저장 전 변경 목록. 아이템마다 한 줄로 모아서, 다시 고치면 덮어쓰고 하나씩 되돌릴 수 있게 한다 */

export interface StudioItem {
  category: StudioCategory;
  rarity?: Rarity;
  name: string;
  image: string; // '/images/...' (저장소 경로 그대로)
  sha?: string; // 파일 내용이 바뀌면 달라지는 값
}

export interface Meta {
  pinned?: string[];
  hidden?: string[];
  aliases?: Record<string, string[]>;
  descriptions?: Record<string, string>;
}

export interface MetaFields {
  hidden: boolean;
  pinned: boolean;
  aliases: string[];
  description: string;
}

export interface ItemEdit {
  name: string;
  rarity?: Rarity;
  meta: Partial<MetaFields>; // 원래 값과 다른 것만
  replace?: { image: string; size: number }; // 새 이미지 (base64)
}

export interface AddDraft {
  key: string;
  category: StudioCategory;
  rarity?: Rarity;
  name: string;
  image: string;
  size: number;
}

export interface NoteDraft {
  key: string;
  date: string;
  title: string;
  items: string[];
}

export interface Queue {
  edits: Record<string, ItemEdit>; // 원래 이미지 경로 → 바뀐 내용
  deletes: string[];
  shas: Record<string, string>; // 고치거나 지우려고 담을 때의 파일 (그사이 바뀌면 서버가 거절)
  adds: AddDraft[];
  notes: NoteDraft[];
}

export const emptyQueue = (): Queue => ({ edits: {}, deletes: [], adds: [], notes: [], shas: {} });
export const queueSize = (q: Queue) => Object.keys(q.edits).length + q.deletes.length + q.adds.length + q.notes.length;
export const queueBytes = (q: Queue) =>
  q.adds.reduce((s, a) => s + a.size, 0) + Object.values(q.edits).reduce((s, e) => s + (e.replace?.size ?? 0), 0);

const own = <T>(obj: Record<string, T> | undefined, key: string) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);

export const baseMeta = (meta: Meta, name: string): MetaFields => ({
  hidden: meta.hidden?.includes(name) ?? false,
  pinned: meta.pinned?.includes(name) ?? false,
  aliases: own(meta.aliases, name) ?? [],
  description: own(meta.descriptions, name) ?? '',
});

/** 이름에 붙은 정보는 같은 이름의 다른 아이템과 함께 쓰므로, 바뀐 정보는 이름 기준으로 모은다 */
export function metaPatchesByName(q: Queue) {
  const map = new Map<string, Partial<MetaFields>>();
  for (const e of Object.values(q.edits)) if (Object.keys(e.meta).length) map.set(e.name, { ...map.get(e.name), ...e.meta });
  return map;
}

/** 저장 전 변경까지 반영한 아이템 모습 */
export function effective(item: StudioItem, q: Queue, meta: Meta, patches: Map<string, Partial<MetaFields>>) {
  const edit = q.edits[item.image];
  const name = edit?.name ?? item.name;
  return {
    name,
    rarity: edit ? edit.rarity : item.rarity,
    meta: { ...baseMeta(meta, item.name), ...patches.get(name) },
    edit,
    deleted: q.deletes.includes(item.image),
  };
}

const dirKey = (category: StudioCategory, rarity?: string) => `${category}/${RARITY_CATEGORIES.includes(category) ? rarity : ''}`;

/** 같은 폴더에 같은 이름(대소문자 무시)이 있는지. 저장 전 변경까지 따진다 */
export function nameTaken(
  items: StudioItem[],
  q: Queue,
  target: { category: StudioCategory; rarity?: string; name: string },
  except?: { image?: string; addKey?: string }
) {
  const key = dirKey(target.category, target.rarity);
  const same = (n: string) => n.toLowerCase() === target.name.toLowerCase();
  return (
    items.some((i) => {
      if (i.image === except?.image || q.deletes.includes(i.image)) return false;
      const e = q.edits[i.image];
      return dirKey(i.category, e ? e.rarity : i.rarity) === key && same(e?.name ?? i.name);
    }) || q.adds.some((a) => a.key !== except?.addKey && dirKey(a.category, a.rarity) === key && same(a.name))
  );
}

const extOf = (image: string) => image.split('.').pop();

/** 서로 이름을 맞바꾸는 것처럼 순서를 정할 수 없는 변경 */
export class OrderError extends Error {}

/**
 * 서버로 보낼 요청 목록 (지우기 → 옮기기·이미지 바꾸기 → 추가 → 정보 → 소식 순서).
 * 옮기기는 비워지는 자리부터 먼저 (A→B, B→C면 B→C를 먼저 보내야 이름이 겹치지 않음)
 */
export function toOps(q: Queue, items: StudioItem[]): StudioOp[] {
  const byImage = new Map(items.map((i) => [i.image, i]));
  const ops: StudioOp[] = [];
  const metaOps: StudioOp[] = [];
  for (const image of q.deletes) {
    const item = byImage.get(image);
    if (item) ops.push({ type: 'delete', category: item.category, image, ...(q.shas[image] && { sha: q.shas[image] }) });
  }
  const slot = (category: StudioCategory, rarity: string | undefined, name: string) => `${dirKey(category, rarity)}/${name.toLowerCase()}`;
  let groups = Object.entries(q.edits).flatMap(([image, e]) => {
    const item = byImage.get(image);
    if (!item || q.deletes.includes(image)) return [];
    const moved = e.name !== item.name || e.rarity !== item.rarity;
    const group: StudioOp[] = [];
    if (moved)
      group.push({ type: 'move', category: item.category, from: image, name: e.name, ...(e.rarity !== item.rarity && { rarity: e.rarity }), ...(q.shas[image] && { sha: q.shas[image] }) });
    if (e.replace) {
      // 옮긴 자리(또는 원래 자리)의 파일을 새 이미지로 바꾼다
      const at = moved
        ? `/images/${CATEGORY_FOLDERS[item.category]}${RARITY_CATEGORIES.includes(item.category) ? `/${e.rarity}` : ''}/${e.name}.${extOf(image)}`
        : image;
      // 이름을 그대로 두고 그림만 바꾸면 원래 파일을 지우므로, 그사이 다른 관리자가 바꿨는지도 확인한다
      group.push({ type: 'delete', category: item.category, image: at, ...(!moved && q.shas[image] && { sha: q.shas[image] }) });
      group.push({ type: 'add', category: item.category, ...(e.rarity && { rarity: e.rarity }), name: e.name, image: e.replace.image });
    }
    if (Object.keys(e.meta).length) metaOps.push({ type: 'meta', name: e.name, ...e.meta });
    const from = slot(item.category, item.rarity, item.name);
    const to = slot(item.category, e.rarity, e.name);
    return [{ from, to: moved && from !== to ? to : null, group }];
  });
  while (groups.length) {
    // 아직 남은 다른 아이템이 쓰고 있는 자리로 옮기는 건 뒤로 미룬다
    const ready = groups.filter((g) => !g.to || !groups.some((o) => o !== g && o.from === g.to));
    if (!ready.length) throw new OrderError('이름을 서로 맞바꾸는 변경은 한 번에 저장할 수 없어요. 한쪽을 먼저 저장한 뒤 이어서 해 주세요');
    for (const g of ready) ops.push(...g.group);
    groups = groups.filter((g) => !ready.includes(g));
  }
  for (const a of q.adds) ops.push({ type: 'add', category: a.category, ...(a.rarity && { rarity: a.rarity }), name: a.name, image: a.image });
  for (const { date, title, items: lines } of q.notes) metaOps.push({ type: 'note', date, title, items: lines });
  return [...ops, ...metaOps];
}

/** 확인 목록에 보여줄 한 줄 설명 */
export function describeEdit(item: StudioItem, e: ItemEdit) {
  const parts = [
    e.name !== item.name && `새 이름 ${e.name}`,
    e.rarity !== item.rarity && e.rarity && `등급 ${RARITY_LABELS[e.rarity]}`,
    e.replace && '이미지 바꿈',
    e.meta.hidden !== undefined && (e.meta.hidden ? '숨김' : '숨김 해제'),
    e.meta.pinned !== undefined && (e.meta.pinned ? '맨 앞 고정' : '맨 앞 고정 해제'),
    e.meta.aliases !== undefined && '다른 이름 변경',
    e.meta.description !== undefined && '설명 변경',
  ].filter(Boolean);
  return `${CATEGORY_LABELS[item.category]} ${item.name}: ${parts.join(', ')}`;
}

/** base64 이미지의 실제 형식 → 확장자 (서버가 같은 방식으로 이름을 정함) */
export const extOfBase64 = (b64: string) => (b64.startsWith('iVBOR') ? 'png' : b64.startsWith('/9j/') ? 'jpg' : 'webp');
export const pathOf = (category: StudioCategory, rarity: string | undefined, name: string, ext: string) =>
  `/images/${CATEGORY_FOLDERS[category]}${RARITY_CATEGORIES.includes(category) ? `/${rarity}` : ''}/${name}.${ext}`;

/** 저장한 새 이미지의 경로 → 미리보기 (사이트에 반영되기 전까지 관리 화면에 보여줄 것) */
export function savedPreviews(q: Queue, items: StudioItem[]) {
  const byImage = new Map(items.map((i) => [i.image, i]));
  const result: Record<string, string> = {};
  for (const a of q.adds) result[pathOf(a.category, a.rarity, a.name, extOfBase64(a.image))] = `data:image;base64,${a.image}`;
  for (const [image, e] of Object.entries(q.edits)) {
    const item = byImage.get(image);
    if (item && e.replace) result[pathOf(item.category, e.rarity, e.name, extOfBase64(e.replace.image))] = `data:image;base64,${e.replace.image}`;
  }
  return result;
}
