'use client';

import clsx from 'clsx';
import { cloneElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORY_FOLDERS, RARITIES, RARITY_CATEGORIES, Rarity, StudioCategory } from '@/lib/studio/config';
import { CATEGORY_LABELS, MAX_CHANGES, MAX_TOTAL_IMAGE_BYTES, NOTE_SYMBOLS, NOTE_SYMBOLS_MESSAGE, Note, RARITY_LABELS, cleanName } from '@/lib/studio/ops';
import { objectParticle, topicParticle } from '@/lib/korean';
import { EditSettings, processImage } from '@/lib/studio/editImage';
import { findCharacter } from '@/lib/studio/segment';
import { upscaleAi } from '@/lib/studio/upscale';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckIcon, CookieLogo, EyeIcon, EyeOffIcon, ImageIcon, PinIcon, SearchIcon } from '../ui/icons';
import ImageEditor from './ImageEditor';
import { loadPixels, toPngBase64 } from './imageIO';
import {
  AddDraft,
  ItemEdit,
  MetaFields,
  Meta,
  NoteDraft,
  Queue,
  StudioItem,
  applyItemEdit,
  deleteItem,
  describeEdit,
  describeNote,
  effective,
  emptyQueue,
  metaPatchesByName,
  nameTaken,
  queueBytes,
  OrderError,
  PENDING_DELETE_MESSAGE,
  extOfBase64,
  pathOf,
  pendingDelete,
  queueSize,
  savedPreviews,
  toOps,
} from './queue';

interface StudioData {
  user: { login: string; avatar: string } | null; // 로컬 모드면 null
  local: boolean;
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
const LOCAL_SAVED = '프로젝트 폴더에 저장했어요. 확인한 뒤 커밋하고 푸시하면 사이트에 반영돼요.';

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

/** 고른 이미지 파일 검사 → 통과한 것과 오류 목록. local: 로컬 모드 (크기 제한 없음) */
async function readImages(files: ArrayLike<File> | null, local: boolean) {
  const ok: { name: string; image: string; size: number }[] = [];
  const errors: string[] = [];
  for (const file of Array.from(files ?? [])) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) errors.push(`${file.name}: PNG, JPG, WEBP 이미지만 올릴 수 있어요`);
    else if (!local && file.size > MAX_TOTAL_IMAGE_BYTES)
      errors.push(`${file.name}: 사이트의 관리 페이지에서는 한 번에 ${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024}MB까지 올릴 수 있어요. 이미지를 줄이거나 로컬 모드로 올려 주세요`);
    else ok.push({ name: file.name.replace(/\.[^.]+$/, '').normalize('NFC'), image: await readBase64(file), size: file.size });
  }
  return { ok, errors };
}

/** 아이템 원본 이미지 주소: 방금 저장한 것 → 사이트 → (아직 사이트에 반영 전이면) 저장소 원본 */
function originalSources(image: string, repo: string, version?: string, preview?: string) {
  if (preview) return [preview]; // 방금 저장해서 사이트에는 아직 없는 이미지
  const v = version ? `?v=${version.slice(0, 8)}` : ''; // 이미지를 바꾸면 주소도 바뀌어 예전 그림이 남지 않게
  return [encodePath(image) + v, `https://raw.githubusercontent.com/${repo}/main${encodePath(`/public${image}`)}`];
}

/**
 * 아이템 그림: 작은 미리보기 → 원본 순서로 시도한다.
 * 막 저장한 이미지도 바로 보이게.
 */
function ItemImage({ image, repo, version, preview, className }: { image: string; repo: string; version?: string; preview?: string; className?: string }) {
  const sources = useMemo(() => {
    if (preview) return [preview];
    const v = version ? `?v=${version.slice(0, 8)}` : '';
    return [encodePath(`/thumbs${image.slice('/images'.length).replace(/\.[^.]+$/, '.webp')}`) + v, ...originalSources(image, repo, version)];
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState<StudioData | null>(null);
  const [queue, setQueue] = useState<Queue>(emptyQueue);
  const [tab, setTab] = useState<'items' | 'notes'>('items');
  const [category, setCategory] = useState<StudioCategory>('cookies');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ item: StudioItem; list: StudioItem[] } | null>(null); // list: 이전/다음으로 넘길 목록
  const [editingAdd, setEditingAdd] = useState<AddDraft | null>(null);
  const [adding, setAdding] = useState<File[] | null>(null); // 추가 창 (처음 넣을 이미지)
  const [bottomSlot, setBottomSlot] = useState<HTMLDivElement | null>(null);
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
      // (응답을 못 받았지만 실제로는 저장된 추가, 담은 뒤 파일이 바뀐 것도 여기서 빠진다: 엉뚱한 새 그림을 지우거나 옮기지 않게)
      const exists = new Set(next.items.map((i) => i.image));
      const current = new Map(next.items.map((i) => [i.image, i.sha]));
      setQueue((q) => {
        const still = (image: string) => exists.has(image) && (!q.shas?.[image] || q.shas[image] === current.get(image));
        const edits = Object.fromEntries(Object.entries(q.edits).filter(([image]) => still(image)));
        const deletes = q.deletes.filter(still);
        // 같은 저장에서 지우거나 옮겨서 비워질 자리에 넣는 새 그림은 남긴다 (그 자리의 지금 그림은 아직 지울 예정인 것)
        const freed = new Set([...deletes, ...Object.keys(edits)]);
        const adds = q.adds.filter((a) => {
          const path = pathOf(a.category, a.rarity, a.name, extOfBase64(a.image));
          return !exists.has(path) || freed.has(path);
        });
        const dropped = queueSize(q) - queueSize({ ...q, edits, deletes, adds });
        if (!dropped) return q;
        setNotice({ tone: 'error', text: `이미 저장됐거나 다른 관리자가 먼저 바꾼 변경 ${dropped}건은 목록에서 뺐어요` });
        return { ...q, edits, deletes, adds };
      });
    } else if (res?.status === 401) {
      setStatus('login');
    } else {
      // 서버가 까닭을 알려 주면 그대로 (로컬 모드의 파일 오류 등)
      const body = await res?.json().catch(() => null);
      setLoadError(typeof body?.error === 'string' ? body.error : null);
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

  // Ctrl+S (맥은 ⌘S): 저장 확인 창 (브라우저의 '페이지 저장'은 막는다)
  useEffect(() => {
    if (status !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      // 한글 자판에서는 e.key가 'ㄴ'이라 키 위치(code)로도 본다
      if (!(e.ctrlKey || e.metaKey) || (e.code !== 'KeyS' && e.key.toLowerCase() !== 's')) return;
      e.preventDefault();
      if (size && !document.querySelector('dialog[open]')) {
        setSaveError(null);
        setReviewing(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, size]);

  // 이미지 파일을 화면 아무 데나 끌어다 놓으면 추가 창을 연다
  // (브라우저가 그 파일을 열어 이 페이지를 떠나며 담아 둔 변경이 사라지지 않게 기본 동작은 막는다)
  useEffect(() => {
    if (status !== 'ready') return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = document.querySelector('dialog[open]') ? 'none' : 'copy';
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (!document.querySelector('dialog[open]')) setAdding(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [status]);

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
    if (!data?.local && queueBytes(result) > MAX_TOTAL_IMAGE_BYTES && queueBytes(result) > queueBytes(queue))
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
      if (!data.local) setPreviews((p) => ({ ...p, ...savedPreviews(queue, data.items) }));
      setQueue(emptyQueue());
      setReviewing(false);
      setNotice({ tone: 'ok', text: data.local ? LOCAL_SAVED : '저장했어요. 1~3분 뒤 사이트에 반영돼요.', url: body.url });
      load();
    } else if (res?.status === 400 && body?.error === '바뀐 내용이 없어요') {
      // 앞서 응답만 못 받고 실제로는 저장된 경우
      setQueue(emptyQueue());
      setReviewing(false);
      setNotice({ tone: 'ok', text: data.local ? '이미 저장된 내용이에요.' : '이미 저장된 내용이에요. 1~3분 뒤 사이트에 반영돼요.' });
      load();
    } else if (body?.error) {
      setSaveError({ text: body.error, relogin: res?.status === 401 });
    } else {
      // 응답을 받지 못함: 저장이 됐을 수도 있으니 목록을 새로 불러와 이미 반영된 변경은 뺀다
      setSaveError({ text: '저장 결과를 확인하지 못했어요. 이미 저장됐을 수 있어서 목록을 다시 불러왔어요. 남은 변경을 확인한 뒤 다시 저장해 주세요' });
      load();
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
                {loadError ?? '불러오지 못했어요. GitHub 연결이 잠시 불안정할 수 있어요.'}
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
    <div className="min-h-dvh bg-surface-cream pb-48">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <CookieLogo />
          <h1 className="text-title-md text-ink">데이터 관리</h1>
          {data.user ? (
            <div className="ml-auto flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.user.avatar} alt="" className="h-7 w-7 rounded-full" />
              <span className="hidden px-1 text-label-md text-ink-muted sm:inline">{data.user.login}</span>
              <Button variant="ghost" onClick={logout}>
                로그아웃
              </Button>
            </div>
          ) : (
            <span className="ml-auto rounded-full bg-primary-soft px-3 py-1 text-label-md text-primary-ink">로컬 모드</span>
          )}
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
            onEdit={(item, list) => setEditing({ item, list })}
            onEditAdd={setEditingAdd}
            onAdd={() => setAdding([])}
            onUndoDelete={(image) => update((q) => ({ ...q, deletes: q.deletes.filter((d) => d !== image) }))}
            onApply={update}
            onError={(text) => setNotice({ tone: 'error', text })}
            bottomSlot={bottomSlot}
            previews={previews}
          />
        ) : (
          <NotesTab
            updates={data.updates}
            queued={queue.notes}
            onNotes={(next) => update((q) => ({ ...q, notes: next(q.notes) }))}
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
        <div ref={setBottomSlot} />
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
          key={editing.item.image}
          item={editing.item}
          data={data}
          queue={queue}
          onClose={() => setEditing(null)}
          previews={previews}
          position={{ index: editing.list.findIndex((i) => i.image === editing.item.image), total: editing.list.length }}
          onNavigate={(dir) => {
            const next = editing.list[editing.list.findIndex((i) => i.image === editing.item.image) + dir];
            if (next) setEditing({ ...editing, item: next });
          }}
          onSubmit={(next) => update((q) => applyItemEdit(q, data.items, data.meta, editing.item, next))}
          onDelete={() => {
            const error = update((q) => deleteItem(q, editing.item));
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
          initialFiles={adding}
          data={data}
          queue={queue}
          onClose={() => setAdding(null)}
          onSubmit={(drafts) => {
            const error = update((q) => ({ ...q, adds: [...q.adds, ...drafts] }));
            if (!error) setAdding(null);
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

type ItemFilter = 'all' | 'hidden' | 'pinned' | 'changed';
const FILTERS: [ItemFilter, string][] = [
  ['all', '모두'],
  ['hidden', '숨김'],
  ['pinned', '맨 앞'],
  ['changed', '저장 전 변경'],
];

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
  onApply,
  onError,
  bottomSlot,
  previews,
}: {
  data: StudioData;
  queue: Queue;
  category: StudioCategory;
  onCategory: (c: StudioCategory) => void;
  query: string;
  onQuery: (q: string) => void;
  onEdit: (item: StudioItem, list: StudioItem[]) => void;
  onEditAdd: (draft: AddDraft) => void;
  onAdd: () => void;
  onUndoDelete: (image: string) => void;
  /** 변경 담기 (한도를 넘으면 이유를 돌려준다) */
  onApply: (next: (q: Queue) => Queue) => string | null;
  onError: (text: string) => void;
  /** 화면 아래 고정 영역 (여러 개 선택 막대를 넣는다) */
  bottomSlot: HTMLElement | null;
  previews: Record<string, string>;
}) {
  const patches = useMemo(() => metaPatchesByName(queue), [queue]);
  const q = query.trim().normalize('NFC').toLowerCase();
  const searching = q.length > 0;
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [selected, setSelected] = useState<Set<string> | null>(null); // null: 선택 모드가 아님
  const lastPicked = useRef<string | null>(null); // Shift 범위 선택의 기준 칸 (목록이 바뀌어도 같은 아이템을 가리키게 경로로)

  const counts = useMemo(() => {
    const map = new Map<StudioCategory, number>();
    for (const item of data.items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [data.items]);

  // 검색할 때는 모든 종류에서 찾는다
  const { groups, filterCounts } = useMemo(() => {
    const inScope = data.items
      .map((item) => ({ item, ...effective(item, queue, data.meta, patches) }))
      .filter(({ item, name, meta }) =>
        searching ? [item.name, name, ...meta.aliases].some((n) => n.toLowerCase().includes(q)) : item.category === category
      );
    const addsInScope = queue.adds.filter((a) => (searching ? a.name.toLowerCase().includes(q) : a.category === category));
    const test: Record<ItemFilter, (v: (typeof inScope)[number]) => boolean> = {
      all: () => true,
      hidden: (v) => !v.deleted && v.meta.hidden,
      pinned: (v) => !v.deleted && v.meta.pinned,
      changed: (v) => v.deleted || !!v.edit,
    };
    const filterCounts = Object.fromEntries(
      FILTERS.map(([f]) => [f, inScope.filter(test[f]).length + (f === 'all' || f === 'changed' ? addsInScope.length : 0)])
    ) as Record<ItemFilter, number>;
    const view = inScope.filter(test[filter]);
    const adds = filter === 'all' || filter === 'changed' ? addsInScope : [];
    const keyOf = (c: StudioCategory, r?: string) => (searching ? c : RARITY_CATEGORIES.includes(c) ? r ?? '' : '');
    const labelOf = (key: string) =>
      searching ? CATEGORY_LABELS[key as StudioCategory] : key ? RARITY_LABELS[key as Rarity] : CATEGORY_LABELS[category];
    const order = searching ? CATEGORIES : [...RARITIES, ''];
    const groups = order
      .map((key) => ({
        key,
        label: labelOf(key),
        adds: adds.filter((a) => keyOf(a.category, a.rarity) === key),
        items: view
          .filter((v) => keyOf(v.item.category, v.rarity) === key)
          .sort((a, b) => Number(b.meta.pinned) - Number(a.meta.pinned) || a.name.localeCompare(b.name, 'ko')),
      }))
      .filter((g) => g.items.length || g.adds.length);
    return { groups, filterCounts };
  }, [data, queue, patches, category, searching, q, filter]);

  // 화면에 보이는 순서대로 (이전/다음, 범위 선택). 지우기로 담은 아이템은 뺀다
  const visible = useMemo(() => groups.flatMap((g) => g.items.filter((v) => !v.deleted).map((v) => v.item)), [groups]);

  // 종류나 검색, 필터를 바꾸면 선택은 화면에 남은 것만
  useEffect(() => {
    setSelected((sel) => {
      if (!sel) return sel;
      const shown = new Set(visible.map((i) => i.image));
      const kept = new Set(Array.from(sel).filter((i) => shown.has(i)));
      return kept.size === sel.size ? sel : kept;
    });
  }, [visible]);

  // Esc: 선택 모드 끝내기 (창이 열려 있으면 창이 먼저)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const toggle = (item: StudioItem, shift: boolean) => {
    const index = visible.findIndex((i) => i.image === item.image);
    // 상태 갱신은 나중에 실행되므로 미리 잡아 둔다. 기준 칸이 지금 목록에 없으면 그냥 하나만 고른다
    const anchor = lastPicked.current ? visible.findIndex((i) => i.image === lastPicked.current) : -1;
    setSelected((sel) => {
      const next = new Set(sel);
      if (shift && anchor >= 0) {
        // Shift: 마지막으로 누른 칸부터 여기까지 모두 선택
        const [from, to] = [Math.min(anchor, index), Math.max(anchor, index)];
        for (const i of visible.slice(from, to + 1)) next.add(i.image);
      } else if (next.has(item.image)) next.delete(item.image);
      else next.add(item.image);
      return next;
    });
    lastPicked.current = item.image;
  };

  /** 아이템 하나의 지금 모습에서 일부만 바꾼 값 */
  const nextOf = (q2: Queue, item: StudioItem, patch: { rarity?: Rarity; meta?: Partial<MetaFields> }) => {
    const cur = effective(item, q2, data.meta, metaPatchesByName(q2));
    return { name: cur.name, rarity: 'rarity' in patch ? patch.rarity : cur.rarity, meta: { ...cur.meta, ...patch.meta }, replace: cur.edit?.replace };
  };
  const apply = (next: (q: Queue) => Queue, count = 1) => {
    const error = onApply(next);
    // 한도를 넘은 까닭이 고른 개수 자체라면 나눠서 하라고 알린다
    if (error) onError(count > MAX_CHANGES ? `한 번에 ${MAX_CHANGES}건까지 저장할 수 있어요. 지금 ${count}개를 골랐으니 ${MAX_CHANGES}개 이하로 나눠서 해 주세요` : error);
    return !error;
  };
  const quickMeta = (item: StudioItem, meta: Partial<MetaFields>) =>
    apply((q2) => applyItemEdit(q2, data.items, data.meta, item, nextOf(q2, item, { meta })));

  const picked = data.items.filter((i) => selected?.has(i.image));
  const bulkMeta = (meta: Partial<MetaFields>) =>
    apply((q2) => picked.reduce((acc, item) => applyItemEdit(acc, data.items, data.meta, item, nextOf(acc, item, { meta })), q2), picked.length);
  const bulkRarity = (rarity: Rarity) => {
    const problems: string[] = [];
    const ok = apply((q2) =>
      picked.reduce((acc, item) => {
        if (!RARITY_CATEGORIES.includes(item.category)) return acc;
        const next = nextOf(acc, item, { rarity });
        if (nameTaken(data.items, acc, { category: item.category, rarity, name: next.name }, { image: item.image })) {
          problems.push(next.name);
          return acc;
        }
        return applyItemEdit(acc, data.items, data.meta, item, next);
      }, q2),
      picked.length
    );
    if (ok && problems.length) onError(`같은 등급에 같은 이름이 있어 옮기지 않았어요: ${problems.join(', ')}`);
  };
  const bulkDelete = () => {
    if (!confirm(`${picked.length}개를 지울까요? 저장하기 전에는 되돌릴 수 있어요.`)) return;
    if (apply((q2) => picked.reduce(deleteItem, q2), picked.length)) setSelected(new Set());
  };
  const pickedRarity = picked.some((i) => RARITY_CATEGORIES.includes(i.category));
  const [rarityTarget, setRarityTarget] = useState<Rarity | ''>('');

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

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <div className="flex flex-wrap gap-1" role="group" aria-label="보기">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={clsx(
                'flex h-8 items-center gap-1 rounded-full px-3 text-caption font-semibold transition-colors',
                filter === f ? 'bg-primary text-on-primary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              )}
            >
              {label}
              <span className="tabular-nums opacity-70">{filterCounts[f]}</span>
            </button>
          ))}
        </div>
        <Button
          variant={selected ? 'secondary' : 'ghost'}
          className="ml-auto"
          aria-pressed={!!selected}
          onClick={() => {
            setSelected(selected ? null : new Set());
            lastPicked.current = null;
          }}
        >
          {selected ? '선택 끝내기' : '여러 개 선택'}
        </Button>
      </div>
      {selected && (
        <p className="mt-2 text-caption text-ink-subtle">
          칸을 눌러 고르세요.
          <span className="[@media(hover:none)]:hidden"> Shift를 누른 채 누르면 사이의 칸까지 한 번에 골라져요. Esc로 끝내요.</span>
        </p>
      )}

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
                  disabled={!!selected}
                  onClick={() => onEditAdd(a)}
                  className="flex h-full w-full flex-col items-center gap-1 rounded-lg border border-dashed border-primary-ink/60 bg-primary-soft/50 p-2 text-center transition-colors hover:bg-primary-soft disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image;base64,${a.image}`} alt="" className="aspect-square w-full object-contain" />
                  <TileName name={a.name} />
                  <TileBadges labels={[searching && CATEGORY_LABELS[a.category], '추가 예정']} accent />
                </button>
              </li>
            ))}
            {g.items.map(({ item, name, meta, edit, deleted }) => {
              const isPicked = !!selected?.has(item.image);
              return (
                <li key={item.image} className="group relative flex">
                  <button
                    type="button"
                    aria-pressed={selected && !deleted ? isPicked : undefined}
                    disabled={!!selected && deleted}
                    onClick={(e) => {
                      if (selected) return toggle(item, e.shiftKey);
                      if (deleted) return confirm(`${item.name} 삭제를 취소할까요?`) && onUndoDelete(item.image);
                      onEdit(item, visible);
                    }}
                    className={clsx(
                      'flex h-full w-full flex-col items-center gap-1 rounded-lg border bg-surface p-2 text-center transition-[border-color,box-shadow] hover:shadow-e1 disabled:opacity-50',
                      isPicked
                        ? 'border-primary-ink bg-primary-soft ring-2 ring-primary-ink'
                        : deleted
                          ? 'border-danger/50 bg-danger/5'
                          : edit
                            ? 'border-primary-ink'
                            : 'border-line hover:border-ink-subtle/50'
                    )}
                  >
                    {selected && !deleted && (
                      <span
                        aria-hidden="true"
                        className={clsx(
                          'absolute left-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full border-[1.5px]',
                          isPicked ? 'border-primary-ink bg-primary-ink text-white' : 'border-ink-subtle bg-surface'
                        )}
                      >
                        {isPicked && <CheckIcon />}
                      </span>
                    )}
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
                  {!selected && !deleted && (
                    // 창을 열지 않고 바로 숨기기, 맨 앞 고정 (가리키거나 키보드로 오면 보인다)
                    <span className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
                      <QuickToggle label={`${name} ${meta.hidden ? '숨김 해제' : '숨기기'}`} on={meta.hidden} onClick={() => quickMeta(item, { hidden: !meta.hidden })}>
                        {meta.hidden ? <EyeOffIcon /> : <EyeIcon />}
                      </QuickToggle>
                      <QuickToggle label={`${name} ${meta.pinned ? '맨 앞 고정 해제' : '맨 앞에 고정'}`} on={meta.pinned} onClick={() => quickMeta(item, { pinned: !meta.pinned })}>
                        <PinIcon />
                      </QuickToggle>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {groups.length === 0 && (
        <p className="py-16 text-center text-body-md text-ink-subtle">
          {searching ? `‘${query}’ 검색 결과가 없어요` : filter !== 'all' ? '해당하는 아이템이 없어요' : '아직 아이템이 없어요'}
        </p>
      )}

      {selected &&
        bottomSlot &&
        createPortal(
          <div className="border-t border-line bg-surface/95 backdrop-blur">
            {/* 휴대폰: 두 줄 (아래 줄은 옆으로 밀기), 넓은 화면: 한 줄 */}
            <div className="mx-auto max-w-5xl px-4 py-2 sm:flex sm:flex-wrap sm:items-center sm:gap-1" role="toolbar" aria-label="고른 아이템에 한꺼번에">
              <div className="flex items-center gap-1 sm:contents">
                <p className="mr-1 text-label-md text-ink" aria-live="polite">
                  <span className="tabular-nums">{picked.length}</span>개 고름
                </p>
                <Button variant="ghost" onClick={() => setSelected(new Set(visible.map((i) => i.image)))}>
                  모두 고르기
                </Button>
                <Button variant="ghost" disabled={!picked.length} onClick={() => setSelected(new Set())}>
                  고르기 취소
                </Button>
                <Button variant="danger" className="ml-auto sm:order-last" disabled={!picked.length} onClick={bulkDelete}>
                  삭제
                </Button>
              </div>
              <div className="scrollbar-hide -mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:contents">
                <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
                <Button variant="ghost" className="shrink-0" disabled={!picked.length} onClick={() => bulkMeta({ hidden: true })}>
                  숨기기
                </Button>
                <Button variant="ghost" className="shrink-0" disabled={!picked.length} onClick={() => bulkMeta({ hidden: false })}>
                  숨김 해제
                </Button>
                <Button variant="ghost" className="shrink-0" disabled={!picked.length} onClick={() => bulkMeta({ pinned: true })}>
                  맨 앞 고정
                </Button>
                <Button variant="ghost" className="shrink-0" disabled={!picked.length} onClick={() => bulkMeta({ pinned: false })}>
                  고정 해제
                </Button>
                {pickedRarity && (
                  <span className="flex shrink-0 items-center gap-1">
                    <label>
                      <span className="sr-only">옮길 등급</span>
                      <select
                        className="field h-9 w-auto py-0 text-label-md"
                        value={rarityTarget}
                        disabled={!picked.length}
                        onChange={(e) => setRarityTarget(e.target.value as Rarity | '')}
                      >
                        <option value="">등급 고르기</option>
                        {RARITIES.map((r) => (
                          <option key={r} value={r}>
                            {RARITY_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button variant="ghost" disabled={!picked.length || !rarityTarget} onClick={() => rarityTarget && bulkRarity(rarityTarget)}>
                      등급 옮기기
                    </Button>
                  </span>
                )}
              </div>
            </div>
          </div>,
          bottomSlot
        )}
    </>
  );
}

function QuickToggle({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx(
        'grid h-7 w-7 place-items-center rounded-full border shadow-e1 transition-colors',
        on ? 'border-primary-ink bg-primary text-primary-ink' : 'border-line bg-surface text-ink-muted hover:text-ink'
      )}
    >
      {children}
    </button>
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
  position,
  onNavigate,
  onSubmit,
  onDelete,
}: {
  item: StudioItem;
  data: StudioData;
  queue: Queue;
  onClose: () => void;
  previews: Record<string, string>;
  /** 목록에서 몇 번째인지 (이전/다음 버튼) */
  position: { index: number; total: number };
  onNavigate: (dir: -1 | 1) => void;
  onSubmit: (next: { name: string; rarity?: Rarity; meta: MetaFields; replace?: ItemEdit['replace'] }) => string | null;
  onDelete: () => string | null;
}) {
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
  const sharedKinds = Array.from(new Set(sharedWith)).join(', ');
  const sharedHint = sharedWith.length ? ` 같은 이름의 ${sharedKinds}에도 함께 적용돼요.` : '';

  /** 담기. 이전/다음으로 넘길 때는 바꾼 것이 있으면 담고 넘긴다 */
  const submit = (go?: -1 | 1) => {
    if (go && !dirty) return onNavigate(go);
    const name = cleanName(form.name);
    if (!name) return setErrors([`이름을 확인해 주세요 (${NAME_RULE})`]);
    if (nameTaken(data.items, queue, { category: item.category, rarity: form.rarity, name }, { image: item.image }))
      return setErrors([`${name}: 같은 자리에 같은 이름이 이미 있어요`]);
    const aliases = splitAliases(form.aliases);
    if (aliases.length > 10 || aliases.some((a) => a.length > 30)) return setErrors(['다른 이름은 10개까지, 하나에 30자까지 쓸 수 있어요']);
    const meta: MetaFields = { hidden: form.hidden, pinned: form.pinned, aliases, description: form.description.trim() };
    const error = onSubmit({ name, rarity: form.rarity, meta, replace: form.replace });
    if (error) return setErrors([error]);
    if (go) onNavigate(go);
    else onClose();
  };
  const replaceWith = async (files: ArrayLike<File> | null) => {
    const { ok, errors } = await readImages(files, data.local);
    setErrors(errors);
    if (ok[0]) set('replace', { image: ok[0].image, size: ok[0].size });
  };
  const [dropping, setDropping] = useState(false);
  const [editingImage, setEditingImage] = useState(false);

  // Alt + ←/→ : 이전/다음 아이템. 창 어디에 포커스가 있어도 받고, 끝에서도 브라우저 '뒤로 가기'로 페이지를 떠나지 않게 막는다
  // (맥의 Option + ←/→ 는 입력칸에서 낱말 단위 이동이라 입력칸 안에서는 그대로 둔다)
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (mac && (e.target as HTMLElement).matches?.('input, textarea')) return;
      e.preventDefault();
      if (editingImage) return; // 이미지 다듬기 창이 열려 있는 동안은 아이템을 넘기지 않는다 (다듬던 것이 사라지지 않게)
      const go = e.key === 'ArrowLeft' ? -1 : 1;
      const target = position.index + go;
      if (position.index >= 0 && target >= 0 && target < position.total) submitRef.current(go);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [position.index, position.total, editingImage]);

  return (
    <Modal
      title={`${CATEGORY_LABELS[item.category]} 수정`}
      onClose={closeIfConfirmed(dirty, onClose)}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm(`${item.name}${objectParticle(item.name)} 지울까요? 저장하기 전에는 되돌릴 수 있어요.`)) return;
              const error = onDelete();
              if (error) setErrors([error]);
            }}
          >
            삭제
          </Button>
          <Button variant="primary" className="ml-auto" onClick={() => submit()}>
            {current.edit ? '변경 고치기' : '변경 담기'}
          </Button>
        </>
      }
    >
      {position.total > 1 && position.index >= 0 && (
        <div className="flex items-center gap-2 border-b border-line px-5 py-2">
          <Button variant="ghost" disabled={position.index === 0} onClick={() => submit(-1)} aria-label="이전 아이템 (바꾼 내용은 담고 넘어가요)">
            ‹ 이전
          </Button>
          <span className="flex-1 text-center text-caption tabular-nums text-ink-subtle">
            {position.index + 1} / {position.total}
          </span>
          <Button variant="ghost" disabled={position.index === position.total - 1} onClick={() => submit(1)} aria-label="다음 아이템 (바꾼 내용은 담고 넘어가요)">
            다음 ›
          </Button>
        </div>
      )}
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div
          className={clsx('-m-2 flex items-center gap-4 rounded-lg p-2 transition-colors', dropping && 'bg-primary-soft ring-2 ring-primary-ink')}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.stopPropagation();
            setDropping(true);
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropping(false);
            replaceWith(e.dataTransfer.files);
          }}
        >
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
                  await replaceWith(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <button type="button" className="block text-caption font-semibold text-primary-ink underline-offset-2 hover:underline" onClick={() => setEditingImage(true)}>
              이미지 다듬기 (투명하게, 크게)
            </button>
            <p className="text-caption text-ink-subtle [@media(hover:none)]:hidden">새 이미지를 여기에 끌어다 놓아도 돼요</p>
            {form.replace && (
              <button type="button" className="block text-caption text-ink-subtle underline underline-offset-2" onClick={() => set('replace', undefined)}>
                원래 이미지로
              </button>
            )}
          </div>
        </div>
        <Field
          label="이름"
          hint={`이름을 바꿔도 예전 이름으로 저장하거나 공유한 조합표는 그대로 열려요.${sharedWith.length ? ` 같은 이름의 ${sharedKinds}${topicParticle(sharedKinds)} 따로 바꿔 주세요.` : ''}`}
        >
          <input className="field" value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} data-autofocus="fine-pointer" />
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
      {editingImage && (
        <ImageEditor
          name={form.name}
          sources={form.replace ? [`data:image;base64,${form.replace.image}`] : originalSources(item.image, data.repo, item.sha, previews[item.image])}
          onApply={(replace) => {
            set('replace', replace);
            setEditingImage(false);
          }}
          onClose={() => setEditingImage(false)}
        />
      )}
    </Modal>
  );
}

function AddDialog({
  initialCategory,
  initialFiles,
  data,
  queue,
  onClose,
  onSubmit,
}: {
  initialCategory: StudioCategory;
  initialFiles: File[];
  data: StudioData;
  queue: Queue;
  onClose: () => void;
  onSubmit: (drafts: AddDraft[]) => string | null;
}) {
  // 위에서 고른 종류와 등급은 이미 넣은 이미지와 새로 넣을 이미지에 모두 붙는다 (그 뒤에 이미지마다 바꿀 수 있다)
  const [category, setCategory] = useState(initialCategory);
  const [rarity, setRarity] = useState<Rarity | undefined>();
  const [drafts, setDrafts] = useState<AddDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editing = drafts.find((d) => d.key === editingKey);
  const hasRarity = (c: StudioCategory) => RARITY_CATEGORIES.includes(c);
  // '나머지에도 같은 설정 적용'으로 다듬는 중인 진행 (창을 닫으면 멈춘다)
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const batchAbort = useRef<AbortController | null>(null);
  useEffect(() => () => batchAbort.current?.abort(), []);

  // 파일을 읽는 사이에 위쪽 선택을 바꿔도 새 이미지에는 지금 선택이 붙게
  const choice = useRef({ category, rarity });
  choice.current = { category, rarity };
  const pick = async (files: ArrayLike<File> | null) => {
    const { ok, errors } = await readImages(files, data.local);
    setErrors(errors);
    const now = choice.current;
    setDrafts((d) => [...d, ...ok.map((f) => ({ ...f, key: newKey(), category: now.category, rarity: hasRarity(now.category) ? now.rarity : undefined }))]);
  };
  const change = (key: string, patch: Partial<AddDraft>) =>
    setDrafts((list) =>
      list.map((x) => {
        if (x.key !== key) return x;
        const next = { ...x, ...patch };
        return hasRarity(next.category) ? next : { ...next, rarity: undefined };
      })
    );

  // 화면에 놓아서 연 경우 그 이미지부터 (한 번만)
  const first = useRef<File[] | null>(initialFiles);
  useEffect(() => {
    const files = first.current;
    first.current = null;
    if (files?.length) pick(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 다듬기 창에서 고른 설정을 나머지 이미지에도 차례로 적용한다 */
  const applyToOthers = async (exceptKey: string, settings: EditSettings) => {
    const targets = drafts.filter((d) => d.key !== exceptKey);
    const { signal } = (batchAbort.current = new AbortController());
    const failed: string[] = [];
    setBatch({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const d = targets[i];
      if (signal.aborted) return;
      try {
        const pixels = await loadPixels([`data:image;base64,${d.image}`]);
        const result = await processImage(pixels, settings, {
          upscale: (p, options) => upscaleAi(p, options, () => {}, signal),
          segment: (p) => findCharacter(p, signal),
        });
        if (signal.aborted) return;
        change(d.key, await toPngBase64(result));
      } catch (e) {
        if (signal.aborted) return;
        console.error('Failed to edit image:', e);
        failed.push(d.name);
      }
      setBatch({ done: i + 1, total: targets.length });
    }
    setBatch(null);
    if (failed.length) setErrors([`다듬지 못한 이미지가 있어요: ${failed.join(', ')}`]);
  };

  const submit = () => {
    if (batch) return;
    if (drafts.length === 0) return setErrors(['이미지를 골라 주세요']);
    const result: AddDraft[] = [];
    const problems: string[] = [];
    for (const d of drafts) {
      const name = cleanName(d.name);
      const target = { category: d.category, rarity: d.rarity, name: name ?? '' };
      const same = (r: AddDraft) => r.category === d.category && r.rarity === d.rarity && r.name.toLowerCase() === name?.toLowerCase();
      if (!name) problems.push(`${d.name || '이름 없음'}: 이름을 확인해 주세요 (${NAME_RULE})`);
      else if (hasRarity(d.category) && !d.rarity) problems.push(`${name}: 등급을 골라 주세요`);
      else if (nameTaken(data.items, queue, target) || result.some(same)) problems.push(`${name}: 같은 자리에 같은 이름이 이미 있어요`);
      else if (pendingDelete(data.items, queue, target)) problems.push(`${name}: ${PENDING_DELETE_MESSAGE}`);
      else result.push({ ...d, name });
    }
    if (problems.length) return setErrors(problems);
    const error = onSubmit(result);
    if (error) setErrors([error]);
  };

  const totalBytes = drafts.reduce((sum, d) => sum + d.size, 0);

  return (
    <Modal
      title="아이템 추가"
      onClose={closeIfConfirmed(drafts.length > 0, onClose)}
      footer={
        <>
          {drafts.length > 0 && (
            <p className="text-caption text-ink-subtle">
              {drafts.length}장, {totalBytes < 1024 * 1024 ? `${Math.ceil(totalBytes / 1024)}KB` : `${(totalBytes / 1024 / 1024).toFixed(1)}MB`}
              {!data.local && ' (한 번에 3MB까지)'}
            </p>
          )}
          {batch && (
            <p role="status" className="text-caption font-semibold text-ink-muted">
              같은 설정으로 다듬는 중 {batch.done}/{batch.total}
            </p>
          )}
          <Button variant="primary" className="ml-auto" onClick={submit} aria-disabled={!!batch}>
            {drafts.length > 1 ? `${drafts.length}개 담기` : '담기'}
          </Button>
        </>
      }
    >
      <div
        className="space-y-4 p-5"
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            pick(e.clipboardData.files);
          }
        }}
      >
        <div className={clsx('grid gap-3', hasRarity(category) && 'grid-cols-2')}>
          <Field label="종류">
            <select
              className="field"
              value={category}
              onChange={(e) => {
                const next = e.target.value as StudioCategory;
                setCategory(next);
                setDrafts((list) => list.map((d) => ({ ...d, category: next, rarity: hasRarity(next) ? (d.rarity ?? rarity) : undefined })));
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {hasRarity(category) && (
            <RaritySelect
              value={rarity}
              onChange={(next) => {
                setRarity(next);
                setDrafts((list) => list.map((d) => (hasRarity(d.category) ? { ...d, rarity: next } : d)));
              }}
            />
          )}
        </div>
        <DropZone onFiles={pick} local={data.local} />
        {drafts.length > 0 && (
          <ul className="space-y-2" aria-label="올릴 이미지">
            {drafts.map((d, i) => (
              <li key={d.key} className="flex gap-3 rounded-md border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image;base64,${d.image}`} alt="" className="h-16 w-16 shrink-0 self-center rounded bg-surface-sunken/60 object-contain" />
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block">
                    <span className="sr-only">{i + 1}번째 이미지 이름</span>
                    <input className="field" value={d.name} maxLength={40} onChange={(e) => change(d.key, { name: e.target.value })} />
                  </label>
                  <div className="flex gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">{d.name} 종류</span>
                      <select className="field" value={d.category} onChange={(e) => change(d.key, { category: e.target.value as StudioCategory })}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {hasRarity(d.category) && (
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">{d.name} 등급</span>
                        <select className="field" value={d.rarity ?? ''} onChange={(e) => change(d.key, { rarity: e.target.value as Rarity })}>
                          <option value="" disabled>
                            등급 고르기
                          </option>
                          {RARITIES.map((r) => (
                            <option key={r} value={r}>
                              {RARITY_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col justify-center gap-1">
                  {/* 같은 설정으로 다듬는 동안에는 목록을 바꾸지 않는다 */}
                  <Button variant="ghost" onClick={() => !batch && setEditingKey(d.key)} aria-disabled={!!batch} aria-label={`${d.name} 이미지 다듬기`} title="투명하게, 크게">
                    다듬기
                  </Button>
                  <Button variant="ghost" onClick={() => !batch && setDrafts((list) => list.filter((x) => x.key !== d.key))} aria-disabled={!!batch} aria-label={`${d.name} 빼기`}>
                    빼기
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ErrorText errors={errors} />
      </div>
      {editing && (
        <ImageEditor
          name={editing.name}
          sources={[`data:image;base64,${editing.image}`]}
          othersCount={batch ? 0 : drafts.length - 1}
          onApply={(result, settings, toOthers) => {
            change(editing.key, result);
            setEditingKey(null);
            if (toOthers) applyToOthers(editing.key, settings);
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </Modal>
  );
}

/** 이미지 고르기: 누르거나, 끌어다 놓거나 (여러 장) */
function DropZone({ onFiles, local }: { onFiles: (files: FileList) => void; local: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={clsx(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed px-4 py-6 text-center transition-colors focus-within:ring-4 focus-within:ring-primary-ink/15',
        over ? 'border-primary-ink bg-primary-soft' : 'border-line bg-surface-cream hover:border-primary-ink hover:bg-primary-soft/60'
      )}
    >
      <span className="text-primary-ink">
        <ImageIcon />
      </span>
      <span className="text-label-md text-ink">
        {over ? (
          '여기에 놓으세요'
        ) : (
          <>
            <span className="[@media(hover:none)]:hidden">이미지를 끌어다 놓거나 눌러서 고르기</span>
            <span className="hidden [@media(hover:none)]:inline">눌러서 이미지 고르기</span>
          </>
        )}
      </span>
      <span className="text-caption text-ink-subtle">
        PNG, JPG, WEBP{!local && ' (한 번 저장에 모두 합쳐 3MB까지)'}. 여러 장을 한 번에 넣을 수 있어요.
        <span className="[@media(hover:none)]:hidden"> 복사한 이미지는 붙여넣기(Ctrl+V)로도 돼요.</span> 파일 이름이 아이템 이름이 돼요.
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
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
    if (pendingDelete(data.items, queue, { category: draft.category, rarity, name: clean })) return setErrors([`${clean}: ${PENDING_DELETE_MESSAGE}`]);
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
      text: describeNote(n),
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
            {saving ? '저장하는 중' : data.local ? '프로젝트 폴더에 저장' : '저장하고 사이트에 반영'}
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
            <p className="whitespace-pre-line">{error.text}</p>
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
        <p className="text-caption text-ink-subtle">
          {data.local
            ? '저장하면 내 컴퓨터의 프로젝트 폴더에 바로 파일이 바뀌어요. 커밋하고 푸시해야 사이트에 반영돼요.'
            : `저장하면 ${data.repo} 저장소에 바로 올라가고, 1~3분 뒤 사이트에 반영돼요.`}
        </p>
      </div>
    </Modal>
  );
}

const sameNote = (a: Note, b: Note) => a.date === b.date && a.title === b.title && sameList(a.items, b.items);

function NotesTab({
  updates,
  queued,
  onNotes,
}: {
  updates: StudioData['updates'];
  queued: NoteDraft[];
  /** 담아 둔 소식 바꾸기 (한도를 넘으면 이유를 돌려준다) */
  onNotes: (next: (notes: NoteDraft[]) => NoteDraft[]) => string | null;
}) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  // 고치는 중인 것: 담아 둔 소식(key) 또는 저장된 소식(from)
  const [target, setTarget] = useState<{ key?: string; from?: Note } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const fill = (note: Note, next: typeof target) => {
    setDate(note.date);
    setTitle(note.title);
    setBody(note.items.join('\n'));
    setErrors([]);
    setTarget(next);
    formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    formRef.current?.querySelector('input')?.focus({ preventScroll: true });
  };
  const clear = () => {
    setDate(today());
    setTitle('');
    setBody('');
    setErrors([]);
    setTarget(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = body.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!date || !title.trim() || items.length === 0) return setErrors(['날짜, 제목, 내용을 모두 적어 주세요']);
    if ([title, ...items].some((l) => NOTE_SYMBOLS.test(l))) return setErrors([NOTE_SYMBOLS_MESSAGE]);
    if (items.length > 20 || items.some((l) => l.length > 100)) return setErrors(['내용은 20줄까지, 한 줄에 100자까지 쓸 수 있어요']);
    const note = { date, title: title.trim(), items };
    let error: string | null = null;
    if (target?.key) {
      // 담아 둔 소식 고치기: 고친 결과가 저장된 원래 소식과 같아지면 고칠 것이 없다
      const key = target.key;
      error = onNotes((list) =>
        list.flatMap((n) => (n.key !== key ? [n] : n.from && sameNote(n.from, note) ? [] : [{ ...n, ...note, remove: undefined }]))
      );
    } else if (target?.from) {
      const from = target.from;
      // 같은 소식에 담아 둔 다른 변경(고치기, 지우기)은 이번 것으로 바꾼다 (한 소식에 변경은 하나만)
      if (!sameNote(from, note)) error = onNotes((list) => [...list.filter((n) => !(n.from && sameNote(n.from, from))), { key: newKey(), ...note, from }]);
    } else {
      error = onNotes((list) => [...list, { key: newKey(), ...note }]);
    }
    if (error) return setErrors([error]);
    clear();
  };

  const pendingFor = (note: Note) => queued.find((n) => n.from && sameNote(n.from, note));
  const undo = (key: string) => {
    onNotes((list) => list.filter((n) => n.key !== key));
    if (target?.key === key) clear();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form ref={formRef} onSubmit={submit} className="scroll-mt-32 space-y-4 self-start rounded-xl border border-line bg-surface p-5">
        <h2 className="text-title-md text-ink">{target ? '소식 고치기' : '소식 쓰기'}</h2>
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
        <div className="flex gap-2">
          {target && (
            <Button onClick={clear} className="flex-1">
              고치기 취소
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1">
            {target ? '고친 내용 담기' : '담기'}
          </Button>
        </div>
      </form>
      <section aria-labelledby="notes-list" className="space-y-3">
        <h2 id="notes-list" className="text-title-md text-ink">
          사이트에 보이는 소식
        </h2>
        {queued
          .filter((n) => !n.from)
          .map((note) => (
            <NoteCard key={note.key} note={note} badge="추가 예정" pending>
              <NoteAction of={note.title} onClick={() => fill(note, { key: note.key })}>고치기</NoteAction>
              <NoteAction of={note.title} onClick={() => undo(note.key)}>빼기</NoteAction>
            </NoteCard>
          ))}
        {updates.map((saved, i) => {
          // 똑같은 소식이 여러 개면 서버가 앞의 것을 바꾸므로 첫 번째에만 표시
          const pending = updates.findIndex((n) => sameNote(n, saved)) === i ? pendingFor(saved) : undefined;
          if (pending?.remove)
            return (
              <NoteCard key={i} note={saved} badge="삭제 예정" pending removed>
                <NoteAction of={saved.title} onClick={() => undo(pending.key)}>삭제 취소</NoteAction>
              </NoteCard>
            );
          if (pending)
            return (
              <NoteCard key={i} note={pending} badge="고침 예정" pending>
                <NoteAction of={pending.title} onClick={() => fill(pending, { key: pending.key })}>고치기</NoteAction>
                <NoteAction of={pending.title} onClick={() => undo(pending.key)}>원래대로</NoteAction>
              </NoteCard>
            );
          return (
            <NoteCard key={i} note={saved}>
              <NoteAction of={saved.title} onClick={() => fill(saved, { from: saved })}>고치기</NoteAction>
              <NoteAction
                of={saved.title}
                onClick={() => {
                  if (!confirm(`'${saved.title}' 소식을 지울까요? 저장하기 전에는 되돌릴 수 있어요.`)) return;
                  const error = onNotes((list) => [...list.filter((n) => !(n.from && sameNote(n.from, saved))), { key: newKey(), ...saved, from: saved, remove: true }]);
                  if (error) return setErrors([error]);
                  if (target?.from && sameNote(target.from, saved)) clear();
                }}
              >
                삭제
              </NoteAction>
            </NoteCard>
          );
        })}
        {updates.length === 0 && queued.length === 0 && <p className="text-body-md text-ink-subtle">아직 직접 쓴 소식이 없어요</p>}
      </section>
    </div>
  );
}

function NoteCard({
  note,
  badge,
  pending,
  removed,
  children,
}: {
  note: Note;
  badge?: string;
  pending?: boolean;
  removed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className={clsx('rounded-lg border p-4', removed ? 'border-danger/50 bg-danger/5' : pending ? 'border-dashed border-primary-ink/60 bg-primary-soft/50' : 'border-line bg-surface')}>
      <div className="flex items-center gap-2">
        <h3 className={clsx('text-label-md text-ink', removed && 'line-through')}>{note.title}</h3>
        {badge && <span className={clsx('text-[11px]', removed ? 'text-danger' : 'text-primary-ink')}>{badge}</span>}
        <time dateTime={note.date} className="ml-auto text-caption tabular-nums text-ink-subtle">
          {note.date.replaceAll('-', '.')}
        </time>
      </div>
      <ul className={clsx('mt-2 list-disc space-y-1 pl-5 text-body-md text-ink-muted', removed && 'line-through opacity-60')}>
        {note.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ul>
      {children && <div className="mt-2 flex gap-3">{children}</div>}
    </article>
  );
}

/** 소식 카드의 작은 버튼. 화면 읽기 프로그램에는 어느 소식의 버튼인지 함께 읽어 준다 */
function NoteAction({ of, onClick, children }: { of: string; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${of} ${children}`} className="-my-2 inline-flex min-h-[36px] items-center text-caption text-ink-subtle underline underline-offset-2 hover:text-ink">
      {children}
    </button>
  );
}
