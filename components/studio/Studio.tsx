'use client';

import clsx from 'clsx';
import { cloneElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CATEGORY_FOLDERS, RARITIES, RARITY_CATEGORIES, Rarity, StudioCategory } from '@/lib/studio/config';
import { CATEGORY_LABELS, MAX_CHANGES, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, RARITY_LABELS, cleanName } from '@/lib/studio/ops';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CookieLogo, SearchIcon } from '../ui/icons';
import {
  AddDraft,
  ItemEdit,
  MetaFields,
  Meta,
  NoteDraft,
  Queue,
  StudioItem,
  baseMeta,
  describeEdit,
  effective,
  emptyQueue,
  metaPatchesByName,
  nameTaken,
  queueBytes,
  OrderError,
  queueSize,
  savedPreviews,
  toOps,
} from './queue';

interface StudioData {
  user: { login: string; avatar: string };
  repo: string;
  items: StudioItem[];
  meta: Meta;
  updates: { date: string; title: string; items: string[] }[];
}

type Notice = { tone: 'ok' | 'error'; text: string; url?: string };

const CATEGORIES = Object.keys(CATEGORY_FOLDERS) as StudioCategory[];
const LOGIN_ERRORS: Record<string, string> = {
  denied: '이 GitHub 계정에는 저장소 쓰기 권한이 없어요. 저장소 관리자에게 협업자 초대를 요청해 주세요.',
  failed: '로그인하지 못했어요. 다시 시도해 주세요.',
};
const NAME_RULE = '40자 이내, / : * ? " < > | # % 같은 기호 제외';
const SAVED_QUEUE = 'studio-queue';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const newKey = () => Math.random().toString(36).slice(2);
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const splitAliases = (text: string) => text.split(',').map((a) => a.trim()).filter(Boolean);

/** 파일 → base64 (data: 접두어 없이) */
const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** 고른 이미지 파일 검사 → 통과한 것과 오류 목록 */
async function readImages(files: FileList | null) {
  const ok: { name: string; image: string; size: number }[] = [];
  const errors: string[] = [];
  for (const file of Array.from(files ?? [])) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) errors.push(`${file.name}: PNG, JPG, WEBP 이미지만 올릴 수 있어요`);
    else if (file.size > MAX_IMAGE_BYTES) errors.push(`${file.name}: 1.5MB 이하로 올려 주세요`);
    else ok.push({ name: file.name.replace(/\.[^.]+$/, '').normalize('NFC'), image: await readBase64(file), size: file.size });
  }
  return { ok, errors };
}

/**
 * 아이템 그림: 작은 미리보기 → (아직 사이트에 반영 전이면) 저장소 원본 순서로 시도한다.
 * 막 저장한 이미지도 바로 보이게.
 */
function ItemImage({ image, repo, version, preview, className }: { image: string; repo: string; version?: string; preview?: string; className?: string }) {
  const sources = useMemo(() => {
    if (preview) return [preview]; // 방금 저장해서 사이트에는 아직 없는 이미지
    const v = version ? `?v=${version.slice(0, 8)}` : ''; // 이미지를 바꾸면 주소도 바뀌어 예전 그림이 남지 않게
    return [
      encodePath(`/thumbs${image.slice('/images'.length).replace(/\.[^.]+$/, '.webp')}`) + v,
      encodePath(image) + v,
      `https://raw.githubusercontent.com/${repo}/main${encodePath(`/public${image}`)}`,
    ];
  }, [image, repo, version, preview]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [sources]);
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      key={sources.join()} // 주소 목록이 바뀌면 처음부터 다시 시도
      src={sources[Math.min(index, sources.length - 1)]}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setIndex((i) => Math.min(i + 1, sources.length - 1))}
      className={className}
    />
  );
}

/** 데이터 관리 화면. 바꾼 내용은 모아 두었다가 한 번에 저장(main에 커밋 1개)한다 */
export default function Studio() {
  const [status, setStatus] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState<StudioData | null>(null);
  const [queue, setQueue] = useState<Queue>(emptyQueue);
  const [tab, setTab] = useState<'items' | 'notes'>('items');
  const [category, setCategory] = useState<StudioCategory>('cookies');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StudioItem | null>(null);
  const [editingAdd, setEditingAdd] = useState<AddDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ text: string; relogin?: boolean } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({}); // 방금 저장한 이미지 (사이트 반영 전까지 보여줌)

  const load = useCallback(async () => {
    const res = await fetch('/api/studio', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      const next: StudioData = await res.json();
      setData(next);
      setStatus('ready');
      // 다른 관리자가 그사이 지우거나 바꾼 아이템에 걸린 변경은 뺀다 (저장할 수 없는 변경이 남지 않게)
      const exists = new Set(next.items.map((i) => i.image));
      setQueue((q) => {
        const edits = Object.fromEntries(Object.entries(q.edits).filter(([image]) => exists.has(image)));
        const deletes = q.deletes.filter((image) => exists.has(image));
        const dropped = Object.keys(q.edits).length - Object.keys(edits).length + q.deletes.length - deletes.length;
        if (!dropped) return q;
        setNotice({ tone: 'error', text: `다른 관리자가 먼저 바꾼 아이템에 걸린 변경 ${dropped}건은 목록에서 뺐어요` });
        return { ...q, edits, deletes };
      });
    } else if (res?.status === 401) {
      setStatus('login');
    } else {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const e = new URLSearchParams(location.search).get('e');
    if (e) {
      setLoginError(LOGIN_ERRORS[e] ?? LOGIN_ERRORS.failed);
      history.replaceState(null, '', location.pathname);
    }
    // 새로고침이나 다시 로그인해도 저장 전 변경이 남아 있게
    try {
      const saved = sessionStorage.getItem(SAVED_QUEUE);
      if (saved) setQueue({ ...emptyQueue(), ...JSON.parse(saved) });
    } catch {}
    load();
  }, [load]);

  const size = queueSize(queue);
  useEffect(() => {
    try {
      if (size) sessionStorage.setItem(SAVED_QUEUE, JSON.stringify(queue));
      else sessionStorage.removeItem(SAVED_QUEUE);
    } catch {} // 이미지가 많아 저장 공간이 모자라면 이 창에서만 유지
  }, [queue, size]);

  // 저장하지 않은 변경이 있으면 나가기 전에 물어본다
  // (로그인 화면에서는 묻지 않음: 변경은 이 탭에 남아 있다)
  useEffect(() => {
    if (!size || status !== 'ready') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [size, status]);

  // 알림은 잠시 뒤 사라진다 (오류는 직접 닫을 때까지)
  useEffect(() => {
    if (notice?.tone !== 'ok') return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  /** 변경 담기. 한도를 넘으면 담지 않고 이유를 돌려준다 (창 안에 보여주도록) */
  const update = (next: (q: Queue) => Queue): string | null => {
    const result = next(queue);
    if (queueSize(result) > MAX_CHANGES && queueSize(result) > size) return `한 번에 ${MAX_CHANGES}건까지 저장할 수 있어요. 지금까지 담은 변경을 먼저 저장한 뒤 이어서 해 주세요`;
    if (queueBytes(result) > MAX_TOTAL_IMAGE_BYTES && queueBytes(result) > queueBytes(queue))
      return '한 번에 올리는 이미지는 모두 합쳐 3MB까지예요. 지금까지 담은 변경을 먼저 저장한 뒤 이어서 추가해 주세요';
    setQueue(result);
    return null;
  };

  const save = async () => {
    if (!data) return;
    let ops;
    try {
      ops = toOps(queue, data.items);
    } catch (e) {
      return setSaveError({ text: e instanceof OrderError ? e.message : '저장할 내용을 만들지 못했어요' });
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch('/api/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setSaving(false);
    if (res?.ok) {
      setPreviews((p) => ({ ...p, ...savedPreviews(queue, data.items) }));
      setQueue(emptyQueue());
      setReviewing(false);
      setNotice({ tone: 'ok', text: '저장했어요. 1~3분 뒤 사이트에 반영돼요.', url: body.url });
      load();
    } else {
      setSaveError({ text: body?.error ?? '인터넷 연결을 확인한 뒤 다시 저장해 주세요', relogin: res?.status === 401 });
    }
  };

  const logout = async () => {
    if (size && !confirm('저장하지 않은 변경이 사라져요. 로그아웃할까요?')) return;
    await fetch('/api/studio/logout', { method: 'POST' }).catch(() => null);
    setQueue(emptyQueue());
    setData(null);
    setStatus('login');
  };

  const loginHref = typeof location === 'undefined' ? '#' : `/api/studio/login?from=${encodeURIComponent(location.pathname)}`;

  if (status !== 'ready' || !data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-cream p-6">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-e1">
          <div className="mx-auto w-fit">
            <CookieLogo />
          </div>
          <h1 className="mt-3 text-title-md text-ink">데이터 관리</h1>
          {status === 'loading' && (
            <p role="status" className="mt-4 text-body-md text-ink-muted">
              확인하고 있어요
            </p>
          )}
          {status === 'error' && (
            <>
              <p role="alert" className="mt-4 text-body-md text-ink-muted">
                불러오지 못했어요. GitHub 연결이 잠시 불안정할 수 있어요.
              </p>
              <Button variant="primary" className="mt-5 w-full" onClick={() => (setStatus('loading'), load())}>
                다시 시도
              </Button>
            </>
          )}
          {status === 'login' && (
            <>
              <p className="mt-2 text-body-md text-ink-muted">저장소에 쓰기 권한이 있는 GitHub 계정만 들어올 수 있어요.</p>
              {size > 0 && <p className="mt-3 rounded-md bg-primary-soft p-3 text-left text-body-md text-ink">저장하지 않은 변경 {size}건은 로그인한 뒤에도 그대로 있어요.</p>}
              {loginError && (
                <p role="alert" className="mt-4 rounded-md bg-danger/10 p-3 text-left text-body-md text-danger">
                  {loginError}
                </p>
              )}
              <a
                href={loginHref}
                className="btn-shine relative mt-5 inline-flex h-touch w-full items-center justify-center overflow-hidden rounded-md bg-primary px-4 text-label-md text-on-primary shadow-e1 hover:bg-primary-hover"
              >
                GitHub로 로그인
              </a>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-cream pb-32">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <CookieLogo />
          <h1 className="text-title-md text-ink">데이터 관리</h1>
          <div className="ml-auto flex items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.user.avatar} alt="" className="h-7 w-7 rounded-full" />
            <span className="hidden px-1 text-label-md text-ink-muted sm:inline">{data.user.login}</span>
            <Button variant="ghost" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4" aria-label="관리 메뉴">
          {(
            [
              ['items', '아이템'],
              ['notes', '업데이트 소식'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => setTab(key)}
              className={clsx(
                'h-touch border-b-2 px-3 text-label-md transition-colors',
                tab === key ? 'border-primary-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {tab === 'items' ? (
          <ItemsTab
            data={data}
            queue={queue}
            category={category}
            onCategory={setCategory}
            query={query}
            onQuery={setQuery}
            onEdit={setEditing}
            onEditAdd={setEditingAdd}
            onAdd={() => setAdding(true)}
            onUndoDelete={(image) => update((q) => ({ ...q, deletes: q.deletes.filter((d) => d !== image) }))}
            previews={previews}
          />
        ) : (
          <NotesTab
            updates={data.updates}
            queued={queue.notes}
            onQueue={(note) => update((q) => ({ ...q, notes: [...q.notes, note] }))}
            onRemove={(key) => update((q) => ({ ...q, notes: q.notes.filter((n) => n.key !== key) }))}
          />
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20">
        {notice && (
          <div className="mx-auto mb-3 flex max-w-5xl px-4">
            <p
              role={notice.tone === 'error' ? 'alert' : 'status'}
              className={clsx(
                'blur-fade flex w-full items-center gap-3 rounded-lg p-3 text-body-md shadow-e2',
                notice.tone === 'error' ? 'bg-danger text-on-danger' : 'bg-ink text-surface'
              )}
            >
              <span className="flex-1">{notice.text}</span>
              {notice.url && (
                <a href={notice.url} target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2">
                  커밋 보기
                </a>
              )}
              <button type="button" onClick={() => setNotice(null)} className="shrink-0 rounded px-2 py-1 opacity-80 hover:opacity-100" aria-label="알림 닫기">
                닫기
              </button>
            </p>
          </div>
        )}
        {size > 0 && (
          <div className="border-t border-line bg-surface/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <p className="text-label-md text-ink">
                저장 전 변경 <span className="tabular-nums">{size}</span>건
              </p>
              <Button variant="primary" className="ml-auto" onClick={() => (setSaveError(null), setReviewing(true))}>
                확인하고 저장
              </Button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditDialog
          item={editing}
          data={data}
          queue={queue}
          onClose={() => setEditing(null)}
          previews={previews}
          onSubmit={(edit) => {
            const error = update((q) => {
              const edits = { ...q.edits };
              if (edit) edits[editing.image] = edit;
              else delete edits[editing.image];
              return { ...q, edits };
            });
            if (!error) setEditing(null);
            return error;
          }}
          onDelete={() => {
            const error = update((q) => {
              const edits = { ...q.edits };
              delete edits[editing.image];
              return { ...q, edits, deletes: [...q.deletes, editing.image] };
            });
            if (!error) setEditing(null);
            return error;
          }}
        />
      )}
      {editingAdd && (
        <PendingAddDialog
          draft={editingAdd}
          data={data}
          queue={queue}
          onClose={() => setEditingAdd(null)}
          onSubmit={(draft) => {
            setQueue((q) => ({ ...q, adds: draft ? q.adds.map((a) => (a.key === draft.key ? draft : a)) : q.adds.filter((a) => a.key !== editingAdd.key) }));
            setEditingAdd(null);
          }}
        />
      )}
      {adding && (
        <AddDialog
          initialCategory={category}
          data={data}
          queue={queue}
          onClose={() => setAdding(false)}
          onSubmit={(drafts) => {
            const error = update((q) => ({ ...q, adds: [...q.adds, ...drafts] }));
            if (!error) setAdding(false);
            return error;
          }}
        />
      )}
      {reviewing && (
        <ReviewDialog
          data={data}
          queue={queue}
          saving={saving}
          error={saveError}
          loginHref={loginHref}
          onClose={() => !saving && setReviewing(false)}
          onChange={setQueue}
          onSave={save}
        />
      )}
    </div>
  );
}

function ItemsTab({
  data,
  queue,
  category,
  onCategory,
  query,
  onQuery,
  onEdit,
  onEditAdd,
  onAdd,
  onUndoDelete,
  previews,
}: {
  data: StudioData;
  queue: Queue;
  category: StudioCategory;
  onCategory: (c: StudioCategory) => void;
  query: string;
  onQuery: (q: string) => void;
  onEdit: (item: StudioItem) => void;
  onEditAdd: (draft: AddDraft) => void;
  onAdd: () => void;
  onUndoDelete: (image: string) => void;
  previews: Record<string, string>;
}) {
  const patches = useMemo(() => metaPatchesByName(queue), [queue]);
  const q = query.trim().normalize('NFC').toLowerCase();
  const searching = q.length > 0;

  const counts = useMemo(() => {
    const map = new Map<StudioCategory, number>();
    for (const item of data.items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [data.items]);

  // 검색할 때는 모든 종류에서 찾는다
  const groups = useMemo(() => {
    const view = data.items
      .map((item) => ({ item, ...effective(item, queue, data.meta, patches) }))
      .filter(({ item, name, meta }) =>
        searching
          ? [item.name, name, ...meta.aliases].some((n) => n.toLowerCase().includes(q))
          : item.category === category
      );
    const adds = queue.adds.filter((a) => (searching ? a.name.toLowerCase().includes(q) : a.category === category));
    const keyOf = (c: StudioCategory, r?: string) => (searching ? c : RARITY_CATEGORIES.includes(c) ? r ?? '' : '');
    const labelOf = (key: string) =>
      searching ? CATEGORY_LABELS[key as StudioCategory] : key ? RARITY_LABELS[key as Rarity] : CATEGORY_LABELS[category];
    const order = searching ? CATEGORIES : [...RARITIES, ''];
    return order
      .map((key) => ({
        key,
        label: labelOf(key),
        adds: adds.filter((a) => keyOf(a.category, a.rarity) === key),
        items: view
          .filter((v) => keyOf(v.item.category, v.rarity) === key)
          .sort((a, b) => Number(b.meta.pinned) - Number(a.meta.pinned) || a.name.localeCompare(b.name, 'ko')),
      }))
      .filter((g) => g.items.length || g.adds.length);
  }, [data, queue, patches, category, searching, q]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="종류">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={!searching && category === c}
              onClick={() => (onCategory(c), onQuery(''))}
              className={clsx(
                'flex h-9 items-center gap-1 rounded-full px-3 text-label-md transition-colors',
                !searching && category === c ? 'bg-ink text-surface' : 'bg-surface text-ink-muted ring-1 ring-line hover:text-ink'
              )}
            >
              {CATEGORY_LABELS[c]}
              <span className={clsx('text-caption tabular-nums', !searching && category === c ? 'text-surface' : 'text-ink-subtle')}>{counts.get(c) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-56">
            <span className="sr-only">모든 종류에서 이름 검색</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
              <SearchIcon />
            </span>
            <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="모든 종류에서 검색" className="field pl-9" />
          </label>
          <Button variant="primary" onClick={onAdd}>
            추가
          </Button>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="mt-6" aria-label={g.label}>
          <h2 className="mb-2 flex items-baseline gap-2 text-label-md text-ink">
            {g.label}
            <span className="text-caption tabular-nums text-ink-subtle">{g.items.length + g.adds.length}</span>
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
            {g.adds.map((a) => (
              <li key={a.key} className="flex">
                <button
                  type="button"
                  onClick={() => onEditAdd(a)}
                  className="flex h-full w-full flex-col items-center gap-1 rounded-lg border border-dashed border-primary-ink/60 bg-primary-soft/50 p-2 text-center transition-colors hover:bg-primary-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image;base64,${a.image}`} alt="" className="aspect-square w-full object-contain" />
                  <TileName name={a.name} />
                  <TileBadges labels={[searching && CATEGORY_LABELS[a.category], '추가 예정']} accent />
                </button>
              </li>
            ))}
            {g.items.map(({ item, name, meta, edit, deleted }) => (
              <li key={item.image} className="flex">
                <button
                  type="button"
                  onClick={() => (deleted ? confirm(`${item.name} 삭제를 취소할까요?`) && onUndoDelete(item.image) : onEdit(item))}
                  className={clsx(
                    'flex h-full w-full flex-col items-center gap-1 rounded-lg border bg-surface p-2 text-center transition-[border-color,box-shadow] hover:shadow-e1',
                    deleted ? 'border-danger/50 bg-danger/5' : edit ? 'border-primary-ink' : 'border-line hover:border-ink-subtle/50'
                  )}
                >
                  <span className={clsx('relative w-full', (deleted || meta.hidden) && 'opacity-40')}>
                    {edit?.replace ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`data:image;base64,${edit.replace.image}`} alt="" className="aspect-square w-full object-contain" />
                    ) : (
                      <ItemImage image={item.image} repo={data.repo} version={item.sha} preview={previews[item.image]} className="aspect-square w-full object-contain" />
                    )}
                  </span>
                  <TileName name={name} strike={deleted} />
                  <TileBadges
                    labels={[
                      searching && CATEGORY_LABELS[item.category],
                      deleted ? '삭제 예정' : edit && '변경 예정',
                      !deleted && meta.hidden && '숨김',
                      !deleted && meta.pinned && '맨 앞',
                    ]}
                    accent={!!edit || deleted}
                    danger={deleted}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && (
        <p className="py-16 text-center text-body-md text-ink-subtle">{searching ? `‘${query}’ 검색 결과가 없어요` : '아직 아이템이 없어요'}</p>
      )}
    </>
  );
}

function TileName({ name, strike }: { name: string; strike?: boolean }) {
  return (
    <span className="flex min-h-[2.5em] w-full items-center justify-center text-caption font-semibold leading-tight text-ink">
      <span className={clsx('line-clamp-2 break-all', strike && 'line-through')}>{name}</span>
    </span>
  );
}

function TileBadges({ labels, accent, danger }: { labels: (string | false | undefined)[]; accent?: boolean; danger?: boolean }) {
  const list = labels.filter(Boolean) as string[];
  return (
    <span className={clsx('min-h-[1.3em] text-[11px] leading-tight', danger ? 'text-danger' : accent ? 'text-primary-ink' : 'text-ink-subtle')}>
      {list.join(', ')}
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactElement; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-label-md text-ink">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-caption text-ink-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

function RaritySelect({ value, onChange }: { value?: Rarity; onChange: (r: Rarity) => void }) {
  return (
    <Field label="등급">
      <select className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value as Rarity)}>
        <option value="" disabled>
          고르기
        </option>
        {RARITIES.map((r) => (
          <option key={r} value={r}>
            {RARITY_LABELS[r]}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-surface-sunken/50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary-ink" />
      <span>
        <span className="block text-label-md text-ink">{label}</span>
        <span className="block text-caption text-ink-subtle">{hint}</span>
      </span>
    </label>
  );
}

function ErrorText({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-md bg-danger/10 p-3 text-body-md text-danger">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

/** 바꾼 내용이 있으면 닫기 전에 물어본다 */
const closeIfConfirmed = (dirty: boolean, onClose: () => void) => () => {
  if (!dirty || confirm('입력한 내용을 버리고 닫을까요?')) onClose();
};

function EditDialog({
  item,
  data,
  queue,
  onClose,
  previews,
  onSubmit,
  onDelete,
}: {
  item: StudioItem;
  data: StudioData;
  queue: Queue;
  onClose: () => void;
  previews: Record<string, string>;
  onSubmit: (edit: ItemEdit | null) => string | null;
  onDelete: () => string | null;
}) {
  const original = baseMeta(data.meta, item.name);
  const current = effective(item, queue, data.meta, metaPatchesByName(queue));
  const initial = {
    name: current.name,
    rarity: current.rarity,
    hidden: current.meta.hidden,
    pinned: current.meta.pinned,
    aliases: current.meta.aliases.join(', '),
    description: current.meta.description,
    replace: current.edit?.replace,
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const hasRarity = RARITY_CATEGORIES.includes(item.category);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const sharedWith = data.items.filter((i) => i.name === item.name && i.image !== item.image).map((i) => CATEGORY_LABELS[i.category]);
  const sharedHint = sharedWith.length ? ` 같은 이름의 ${Array.from(new Set(sharedWith)).join(', ')}에도 함께 적용돼요.` : '';

  const submit = () => {
    const name = cleanName(form.name);
    if (!name) return setErrors([`이름을 확인해 주세요 (${NAME_RULE})`]);
    if (nameTaken(data.items, queue, { category: item.category, rarity: form.rarity, name }, { image: item.image }))
      return setErrors([`${name}: 같은 자리에 같은 이름이 이미 있어요`]);
    const aliases = splitAliases(form.aliases);
    const meta: ItemEdit['meta'] = {};
    if (form.hidden !== original.hidden) meta.hidden = form.hidden;
    if (form.pinned !== original.pinned) meta.pinned = form.pinned;
    if (!sameList(aliases, original.aliases)) meta.aliases = aliases;
    if (form.description.trim() !== original.description) meta.description = form.description.trim();
    const changed = name !== item.name || form.rarity !== item.rarity || form.replace || Object.keys(meta).length > 0;
    const error = onSubmit(changed ? { name, rarity: form.rarity, meta, ...(form.replace && { replace: form.replace }) } : null);
    if (error) setErrors([error]);
  };

  return (
    <Modal
      title={`${CATEGORY_LABELS[item.category]} 수정`}
      onClose={closeIfConfirmed(dirty, onClose)}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm(`${item.name}을(를) 지울까요? 저장하기 전에는 되돌릴 수 있어요.`)) return;
              const error = onDelete();
              if (error) setErrors([error]);
            }}
          >
            삭제
          </Button>
          <Button variant="primary" className="ml-auto" onClick={submit}>
            {current.edit ? '변경 고치기' : '변경 담기'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-4">
          {form.replace ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image;base64,${form.replace.image}`} alt="새 이미지" className="h-24 w-24 shrink-0 object-contain" />
          ) : (
            <ItemImage image={item.image} repo={data.repo} version={item.sha} preview={previews[item.image]} className="h-24 w-24 shrink-0 object-contain" />
          )}
          <div className="space-y-2">
            <label className="btn-link cursor-pointer focus-within:ring-4 focus-within:ring-primary-ink/15">
              이미지 바꾸기
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const { ok, errors } = await readImages(e.target.files);
                  e.target.value = '';
                  setErrors(errors);
                  if (ok[0]) set('replace', { image: ok[0].image, size: ok[0].size });
                }}
              />
            </label>
            {form.replace && (
              <button type="button" className="block text-caption text-ink-subtle underline underline-offset-2" onClick={() => set('replace', undefined)}>
                원래 이미지로
              </button>
            )}
          </div>
        </div>
        <Field
          label="이름"
          hint={`이름을 바꿔도 예전 이름으로 저장하거나 공유한 조합표는 그대로 열려요.${sharedWith.length ? ` 같은 이름의 ${Array.from(new Set(sharedWith)).join(', ')}은(는) 따로 바꿔 주세요.` : ''}`}
        >
          <input className="field" value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </Field>
        {hasRarity && <RaritySelect value={form.rarity} onChange={(r) => set('rarity', r)} />}
        <Field label="다른 이름" hint={`쉼표로 구분해요. 검색할 때 함께 찾아져요.${sharedHint}`}>
          <input className="field" value={form.aliases} onChange={(e) => set('aliases', e.target.value)} placeholder="예: 파김치, 파쿠" />
        </Field>
        <Field label="설명" hint={`선택 창에 함께 보여요 (80자 이내).${sharedHint}`}>
          <input className="field" value={form.description} maxLength={80} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Check label="맨 앞에 고정" hint={`선택 창에서 항상 먼저 보여요.${sharedHint}`} checked={form.pinned} onChange={(v) => set('pinned', v)} />
        <Check label="숨기기" hint={`이미지는 남겨 두고 선택 창에서만 빼요.${sharedHint}`} checked={form.hidden} onChange={(v) => set('hidden', v)} />
        <ErrorText errors={errors} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function AddDialog({
  initialCategory,
  data,
  queue,
  onClose,
  onSubmit,
}: {
  initialCategory: StudioCategory;
  data: StudioData;
  queue: Queue;
  onClose: () => void;
  onSubmit: (drafts: AddDraft[]) => string | null;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [rarity, setRarity] = useState<Rarity | undefined>();
  const [drafts, setDrafts] = useState<AddDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const hasRarity = RARITY_CATEGORIES.includes(category);

  const pick = async (files: FileList | null) => {
    const { ok, errors } = await readImages(files);
    setErrors(errors);
    setDrafts((d) => [...d, ...ok.map((f) => ({ ...f, key: newKey(), category, rarity }))]);
  };

  const submit = () => {
    if (drafts.length === 0) return setErrors(['이미지를 골라 주세요']);
    if (hasRarity && !rarity) return setErrors(['등급을 골라 주세요']);
    const result: AddDraft[] = [];
    const problems: string[] = [];
    for (const d of drafts) {
      const name = cleanName(d.name);
      const target = { category, rarity: hasRarity ? rarity : undefined, name: name ?? '' };
      if (!name) problems.push(`${d.name || '이름 없음'}: 이름을 확인해 주세요 (${NAME_RULE})`);
      else if (nameTaken(data.items, queue, target) || result.some((r) => r.name.toLowerCase() === name.toLowerCase()))
        problems.push(`${name}: 같은 자리에 같은 이름이 이미 있어요`);
      else result.push({ ...d, ...target, name });
    }
    if (problems.length) return setErrors(problems);
    const error = onSubmit(result);
    if (error) setErrors([error]);
  };

  return (
    <Modal
      title="아이템 추가"
      onClose={closeIfConfirmed(drafts.length > 0, onClose)}
      footer={
        <Button variant="primary" className="ml-auto" onClick={submit}>
          {drafts.length > 1 ? `${drafts.length}개 담기` : '담기'}
        </Button>
      }
    >
      <div className="space-y-4 p-5">
        <div className={clsx('grid gap-3', hasRarity && 'grid-cols-2')}>
          <Field label="종류">
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as StudioCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {hasRarity && <RaritySelect value={rarity} onChange={setRarity} />}
        </div>
        <Field label="이미지" hint="PNG, JPG, WEBP (1장 1.5MB 이하). 여러 장을 한 번에 골라도 돼요. 파일 이름이 아이템 이름이 되고, 아래에서 고칠 수 있어요">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="field h-auto py-2"
            onChange={async (e) => {
              const files = e.target.files;
              await pick(files);
              e.target.value = '';
            }}
          />
        </Field>
        {drafts.length > 0 && (
          <ul className="space-y-2" aria-label="올릴 이미지">
            {drafts.map((d) => (
              <li key={d.key} className="flex items-center gap-3 rounded-md border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image;base64,${d.image}`} alt="" className="h-14 w-14 shrink-0 object-contain" />
                <label className="min-w-0 flex-1">
                  <span className="sr-only">이름</span>
                  <input
                    className="field"
                    value={d.name}
                    maxLength={40}
                    onChange={(e) => setDrafts((list) => list.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)))}
                  />
                </label>
                <Button variant="ghost" onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))} aria-label={`${d.name} 빼기`}>
                  빼기
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ErrorText errors={errors} />
      </div>
    </Modal>
  );
}

/** 저장 전에 담아 둔 새 아이템 고치기 */
function PendingAddDialog({
  draft,
  data,
  queue,
  onClose,
  onSubmit,
}: {
  draft: AddDraft;
  data: StudioData;
  queue: Queue;
  onClose: () => void;
  onSubmit: (draft: AddDraft | null) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [rarity, setRarity] = useState(draft.rarity);
  const [errors, setErrors] = useState<string[]>([]);
  const hasRarity = RARITY_CATEGORIES.includes(draft.category);

  const submit = () => {
    const clean = cleanName(name);
    if (!clean) return setErrors([`이름을 확인해 주세요 (${NAME_RULE})`]);
    if (nameTaken(data.items, queue, { category: draft.category, rarity, name: clean }, { addKey: draft.key }))
      return setErrors([`${clean}: 같은 자리에 같은 이름이 이미 있어요`]);
    onSubmit({ ...draft, name: clean, rarity });
  };

  return (
    <Modal
      title={`추가할 ${CATEGORY_LABELS[draft.category]}`}
      onClose={closeIfConfirmed(name !== draft.name || rarity !== draft.rarity, onClose)}
      footer={
        <>
          <Button variant="ghost" onClick={() => onSubmit(null)}>
            추가 취소
          </Button>
          <Button variant="primary" className="ml-auto" onClick={submit}>
            고치기
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image;base64,${draft.image}`} alt="" className="mx-auto h-24 w-24 object-contain" />
        <Field label="이름">
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        {hasRarity && <RaritySelect value={rarity} onChange={setRarity} />}
        <ErrorText errors={errors} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ReviewDialog({
  data,
  queue,
  saving,
  error,
  loginHref,
  onClose,
  onChange,
  onSave,
}: {
  data: StudioData;
  queue: Queue;
  saving: boolean;
  error: { text: string; relogin?: boolean } | null;
  loginHref: string;
  onClose: () => void;
  onChange: (q: Queue) => void;
  onSave: () => void;
}) {
  const byImage = new Map(data.items.map((i) => [i.image, i]));
  const rows: { key: string; text: string; undo: () => Queue }[] = [
    ...queue.deletes.map((image) => ({
      key: `d:${image}`,
      text: `${CATEGORY_LABELS[byImage.get(image)?.category ?? 'cookies']} ${byImage.get(image)?.name ?? image}: 삭제`,
      undo: () => ({ ...queue, deletes: queue.deletes.filter((d) => d !== image) }),
    })),
    ...Object.entries(queue.edits).flatMap(([image, e]) => {
      const item = byImage.get(image);
      if (!item) return [];
      return [
        {
          key: `e:${image}`,
          text: describeEdit(item, e),
          undo: () => {
            const edits = { ...queue.edits };
            delete edits[image];
            return { ...queue, edits };
          },
        },
      ];
    }),
    ...queue.adds.map((a) => ({
      key: `a:${a.key}`,
      text: `${CATEGORY_LABELS[a.category]} ${a.name}: 추가${a.rarity ? ` (${RARITY_LABELS[a.rarity]})` : ''}`,
      undo: () => ({ ...queue, adds: queue.adds.filter((x) => x.key !== a.key) }),
    })),
    ...queue.notes.map((n) => ({
      key: `n:${n.key}`,
      text: `업데이트 소식: ${n.title}`,
      undo: () => ({ ...queue, notes: queue.notes.filter((x) => x.key !== n.key) }),
    })),
  ];

  return (
    <Modal
      title="저장할 변경"
      onClose={onClose}
      footer={
        <>
          <Button disabled={saving || queueSize(queue) === 0} variant="ghost" onClick={() => confirm('저장 전 변경을 모두 버릴까요?') && onChange(emptyQueue())}>
            모두 버리기
          </Button>
          <Button variant="primary" className="ml-auto" disabled={saving || rows.length === 0} onClick={onSave}>
            {saving ? '저장하는 중' : '저장하고 사이트에 반영'}
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line px-5 py-2" aria-busy={saving}>
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-body-md text-ink">{row.text}</span>
            <Button variant="ghost" disabled={saving} onClick={() => onChange(row.undo())} aria-label={`${row.text} 되돌리기`}>
              되돌리기
            </Button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="p-5 text-body-md text-ink-subtle">저장할 변경이 없어요</p>}
      <div className="space-y-3 px-5 pb-5">
        {error && (
          <div role="alert" className="rounded-md bg-danger/10 p-3 text-body-md text-danger">
            <p>{error.text}</p>
            {error.relogin && (
              <p className="mt-2 text-ink">
                변경은 그대로 있어요.{' '}
                <a href={loginHref} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                  새 탭에서 로그인
                </a>
                하고 그 탭은 닫은 뒤, 여기서 다시 저장해 주세요.
              </p>
            )}
          </div>
        )}
        <p className="text-caption text-ink-subtle">저장하면 {data.repo} 저장소에 바로 올라가고, 1~3분 뒤 사이트에 반영돼요.</p>
      </div>
    </Modal>
  );
}

function NotesTab({
  updates,
  queued,
  onQueue,
  onRemove,
}: {
  updates: StudioData['updates'];
  queued: NoteDraft[];
  onQueue: (note: NoteDraft) => string | null;
  onRemove: (key: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = body.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!date || !title.trim() || items.length === 0) return setErrors(['날짜, 제목, 내용을 모두 적어 주세요']);
    if (items.some((l) => /[·ㅡ]/.test(l) || /[·ㅡ]/.test(title))) return setErrors(['· 나 ㅡ 같은 기호 대신 쉼표나 문장으로 써 주세요']);
    const error = onQueue({ key: newKey(), date, title: title.trim(), items });
    if (error) return setErrors([error]);
    setTitle('');
    setBody('');
    setErrors([]);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={submit} className="space-y-4 self-start rounded-xl border border-line bg-surface p-5">
        <h2 className="text-title-md text-ink">소식 쓰기</h2>
        <p className="text-caption text-ink-subtle">새 아이템은 소식을 쓰지 않아도 자동으로 올라가요. 그 밖의 바뀐 점을 알릴 때 써 주세요.</p>
        <Field label="날짜">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="제목">
          <input className="field" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 새 시즌 준비" />
        </Field>
        <Field label="내용" hint="한 줄에 하나씩 써 주세요">
          <textarea className="field h-32 py-2" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <ErrorText errors={errors} />
        <Button type="submit" variant="primary" className="w-full">
          담기
        </Button>
      </form>
      <section aria-labelledby="notes-list" className="space-y-3">
        <h2 id="notes-list" className="text-title-md text-ink">
          사이트에 보이는 소식
        </h2>
        {queued.map((note) => (
          <NoteCard key={note.key} note={note} queued onRemove={() => onRemove(note.key)} />
        ))}
        {updates.map((note, i) => (
          <NoteCard key={i} note={note} />
        ))}
        {updates.length === 0 && queued.length === 0 && <p className="text-body-md text-ink-subtle">아직 직접 쓴 소식이 없어요</p>}
      </section>
    </div>
  );
}

function NoteCard({ note, queued, onRemove }: { note: { date: string; title: string; items: string[] }; queued?: boolean; onRemove?: () => void }) {
  return (
    <article className={clsx('rounded-lg border p-4', queued ? 'border-dashed border-primary-ink/60 bg-primary-soft/50' : 'border-line bg-surface')}>
      <div className="flex items-center gap-2">
        <h3 className="text-label-md text-ink">{note.title}</h3>
        {queued && <span className="text-[11px] text-primary-ink">저장 전</span>}
        <time dateTime={note.date} className="ml-auto text-caption tabular-nums text-ink-subtle">
          {note.date.replaceAll('-', '.')}
        </time>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md text-ink-muted">
        {note.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ul>
      {onRemove && (
        <button type="button" onClick={onRemove} className="mt-2 text-caption text-ink-subtle underline underline-offset-2 hover:text-ink">
          빼기
        </button>
      )}
    </article>
  );
}
