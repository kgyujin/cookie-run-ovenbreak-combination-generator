'use client';

import clsx from 'clsx';
import { cloneElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CATEGORY_FOLDERS, RARITIES, RARITY_CATEGORIES, Rarity, StudioCategory } from '@/lib/studio/config';
import { CATEGORY_LABELS, MAX_IMAGE_BYTES, MAX_OPS, MAX_TOTAL_IMAGE_BYTES, RARITY_LABELS, StudioOp, cleanName, describeOp } from '@/lib/studio/ops';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CookieLogo, SearchIcon } from '../ui/icons';

export interface StudioItem {
  category: StudioCategory;
  rarity?: Rarity;
  name: string;
  image: string;
}

interface Meta {
  pinned?: string[];
  hidden?: string[];
  aliases?: Record<string, string[]>;
  descriptions?: Record<string, string>;
}

interface StudioData {
  user: { login: string; avatar: string };
  repo: string;
  items: StudioItem[];
  meta: Meta;
  updates: { date: string; title: string; items: string[] }[];
}

const CATEGORIES = Object.keys(CATEGORY_FOLDERS) as StudioCategory[];
const LOGIN_ERRORS: Record<string, string> = {
  denied: '이 GitHub 계정에는 저장소 쓰기 권한이 없어요. 저장소 관리자에게 협업자 초대를 요청해 주세요.',
  failed: '로그인하지 못했어요. 다시 시도해 주세요.',
};
const imageUrl = (image: string) => image.split('/').map(encodeURIComponent).join('/');
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const dirKey = (category: StudioCategory, rarity?: string) => `${category}/${RARITY_CATEGORIES.includes(category) ? rarity : ''}`;
const base64Size = (b64: string) => Math.floor((b64.length * 3) / 4);

/** 파일 → base64 (data: 접두어 없이) */
const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** 데이터 관리 화면. 바꾼 내용은 모아 두었다가 한 번에 저장(main에 커밋 1개)한다 */
export default function Studio() {
  const [status, setStatus] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState<StudioData | null>(null);
  const [pending, setPending] = useState<StudioOp[]>([]);
  const [tab, setTab] = useState<'items' | 'notes'>('items');
  const [category, setCategory] = useState<StudioCategory>('cookies');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StudioItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; url?: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/studio', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      setData(await res.json());
      setStatus('ready');
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
    load();
  }, [load]);

  // 저장하지 않은 변경이 있으면 나가기 전에 물어본다
  useEffect(() => {
    if (pending.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending.length]);

  const queue = (ops: StudioOp[]) => {
    if (pending.length + ops.length > MAX_OPS) {
      setMessage({ tone: 'error', text: `한 번에 ${MAX_OPS}개까지 저장할 수 있어요. 먼저 저장해 주세요` });
      return false;
    }
    setPending((p) => [...p, ...ops]);
    setMessage(null);
    return true;
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops: pending }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setSaving(false);
    setReviewing(false);
    if (res?.ok) {
      setPending([]);
      setMessage({ tone: 'ok', text: '저장했어요. 1~3분 뒤 사이트에 반영돼요.', url: body.url });
      load();
    } else if (res?.status === 401) {
      setStatus('login');
      setLoginError(body?.error ?? '다시 로그인해 주세요');
    } else {
      setMessage({ tone: 'error', text: body?.error ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
    }
  };

  const logout = async () => {
    if (pending.length && !confirm('저장하지 않은 변경이 사라져요. 로그아웃할까요?')) return;
    await fetch('/api/studio/logout', { method: 'POST' }).catch(() => null);
    setPending([]);
    setData(null);
    setStatus('login');
  };

  if (status !== 'ready' || !data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-cream p-6">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-e1">
          <div className="mx-auto w-fit">
            <CookieLogo />
          </div>
          <h1 className="mt-3 text-title-md text-ink">데이터 관리</h1>
          {status === 'loading' && <p className="mt-4 text-body-md text-ink-muted">확인하고 있어요</p>}
          {status === 'error' && <p className="mt-4 text-body-md text-ink-muted">불러오지 못했어요. 새로고침해 주세요.</p>}
          {status === 'login' && (
            <>
              <p className="mt-2 text-body-md text-ink-muted">저장소에 쓰기 권한이 있는 GitHub 계정만 들어올 수 있어요.</p>
              {loginError && (
                <p role="alert" className="mt-4 rounded-md bg-danger/10 p-3 text-left text-body-md text-danger">
                  {loginError}
                </p>
              )}
              <a href="/api/studio/login" className="btn-shine relative mt-5 inline-flex h-touch w-full items-center justify-center overflow-hidden rounded-md bg-primary px-4 text-label-md text-on-primary shadow-e1 hover:bg-primary-hover">
                GitHub로 로그인
              </a>
            </>
          )}
        </div>
      </main>
    );
  }

  const meta = data.meta;
  const touched = new Set(pending.flatMap((op) => ('from' in op ? [op.from] : op.type === 'delete' ? [op.image] : op.type === 'meta' ? [op.name] : [])));
  const q = query.trim().normalize('NFC').toLowerCase();
  const items = data.items
    .filter((item) => item.category === category && (!q || item.name.toLowerCase().includes(q) || meta.aliases?.[item.name]?.some((a) => a.toLowerCase().includes(q))))
    .sort((a, b) => RARITIES.indexOf(a.rarity!) - RARITIES.indexOf(b.rarity!) || a.name.localeCompare(b.name, 'ko'));
  const pendingAdds = pending.filter((op): op is Extract<StudioOp, { type: 'add' }> => op.type === 'add');

  return (
    <div className="min-h-dvh bg-surface-cream pb-28">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <CookieLogo />
          <h1 className="text-title-md text-ink">데이터 관리</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.user.avatar} alt="" className="h-7 w-7 rounded-full" />
            <span className="hidden text-label-md text-ink-muted sm:inline">{data.user.login}</span>
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
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={clsx('mb-4 rounded-md p-3 text-body-md', message.tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-ink')}
          >
            {message.text}{' '}
            {message.url && (
              <a href={message.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                커밋 보기
              </a>
            )}
          </p>
        )}

        {tab === 'items' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1" role="group" aria-label="종류">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={clsx(
                      'h-9 rounded-full px-3 text-label-md transition-colors',
                      category === c ? 'bg-ink text-surface' : 'bg-surface text-ink-muted ring-1 ring-line hover:text-ink'
                    )}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-56">
                  <span className="sr-only">이름 검색</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
                    <SearchIcon />
                  </span>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 검색" className="field pl-9" />
                </label>
                <Button variant="primary" onClick={() => setAdding(true)}>
                  추가
                </Button>
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
              {pendingAdds
                .filter((op) => op.category === category)
                .map((op) => (
                  <li key={`new-${op.name}-${op.rarity}`} className="rounded-lg border border-dashed border-primary-ink/50 bg-primary-soft/40 p-2 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image;base64,${op.image}`} alt="" className="mx-auto aspect-square w-full object-contain" />
                    <p className="mt-1 truncate text-caption text-ink">{op.name}</p>
                    <p className="text-[11px] text-primary-ink">추가 예정</p>
                  </li>
                ))}
              {items.map((item) => {
                const hidden = meta.hidden?.includes(item.name);
                return (
                  <li key={item.image}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className={clsx(
                        'w-full rounded-lg border bg-surface p-2 text-center transition-colors hover:border-primary-ink/60',
                        touched.has(item.image) || touched.has(item.name) ? 'border-primary-ink' : 'border-line',
                        hidden && 'opacity-60'
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(item.image)} alt="" loading="lazy" className="mx-auto aspect-square w-full object-contain" />
                      <span className="mt-1 block truncate text-caption text-ink">{item.name}</span>
                      <span className="block text-[11px] text-ink-subtle">
                        {[item.rarity && RARITY_LABELS[item.rarity], hidden && '숨김', meta.pinned?.includes(item.name) && '맨 앞', (touched.has(item.image) || touched.has(item.name)) && '변경 예정']
                          .filter(Boolean)
                          .join(', ') || ' '}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length === 0 && <p className="py-10 text-center text-body-md text-ink-subtle">찾는 아이템이 없어요</p>}
          </>
        ) : (
          <NotesTab updates={data.updates} pending={pending} onQueue={queue} />
        )}
      </main>

      {pending.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <p className="text-label-md text-ink">
              저장 전 변경 <span className="tabular-nums">{pending.length}</span>건
            </p>
            <Button variant="primary" className="ml-auto" onClick={() => setReviewing(true)}>
              확인하고 저장
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <EditDialog
          item={editing}
          meta={meta}
          items={data.items}
          onClose={() => setEditing(null)}
          onQueue={(ops) => queue(ops) && setEditing(null)}
        />
      )}
      {adding && (
        <AddDialog
          initialCategory={category}
          items={data.items}
          pending={pending}
          onClose={() => setAdding(false)}
          onQueue={(ops) => queue(ops) && setAdding(false)}
        />
      )}
      {reviewing && (
        <Modal
          title="저장할 변경"
          onClose={() => !saving && setReviewing(false)}
          footer={
            <>
              <Button disabled={saving} onClick={() => setPending([])} variant="ghost">
                모두 취소
              </Button>
              <Button variant="primary" className="ml-auto" disabled={saving} onClick={save}>
                {saving ? '저장하는 중' : '저장하고 사이트에 반영'}
              </Button>
            </>
          }
        >
          <ul className="divide-y divide-line px-5 py-2">
            {pending.map((op, i) => (
              <li key={i} className="flex items-center gap-2 py-2">
                <span className="flex-1 text-body-md text-ink">{describeOp(op)}</span>
                <Button variant="ghost" disabled={saving} onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label={`${describeOp(op)} 취소`}>
                  빼기
                </Button>
              </li>
            ))}
          </ul>
          {pending.length === 0 && <p className="p-5 text-body-md text-ink-subtle">저장할 변경이 없어요</p>}
          <p className="px-5 pb-5 text-caption text-ink-subtle">저장하면 {data.repo} 저장소에 바로 올라가고, 1~3분 뒤 사이트에 반영돼요.</p>
        </Modal>
      )}
    </div>
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
    <label className="flex items-start gap-3 rounded-md border border-line p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary-ink" />
      <span>
        <span className="block text-label-md text-ink">{label}</span>
        <span className="block text-caption text-ink-subtle">{hint}</span>
      </span>
    </label>
  );
}

const nameTaken = (items: StudioItem[], category: StudioCategory, rarity: string | undefined, name: string, except?: string) =>
  items.some((i) => i.image !== except && dirKey(i.category, i.rarity) === dirKey(category, rarity) && i.name === name);

function EditDialog({
  item,
  meta,
  items,
  onClose,
  onQueue,
}: {
  item: StudioItem;
  meta: Meta;
  items: StudioItem[];
  onClose: () => void;
  onQueue: (ops: StudioOp[]) => void;
}) {
  const initial = {
    name: item.name,
    rarity: item.rarity,
    hidden: meta.hidden?.includes(item.name) ?? false,
    pinned: meta.pinned?.includes(item.name) ?? false,
    aliases: (meta.aliases?.[item.name] ?? []).join(', '),
    description: meta.descriptions?.[item.name] ?? '',
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const hasRarity = RARITY_CATEGORIES.includes(item.category);

  const submit = () => {
    const name = cleanName(form.name);
    if (!name) return setError('이름을 확인해 주세요 (40자 이내, / : * ? " < > | 같은 기호 제외)');
    if ((name !== item.name || form.rarity !== item.rarity) && nameTaken(items, item.category, form.rarity, name, item.image))
      return setError('같은 이름이 이미 있어요');
    const ops: StudioOp[] = [];
    if (name !== item.name || form.rarity !== item.rarity) {
      ops.push({ type: 'move', category: item.category, from: item.image, name, ...(form.rarity !== item.rarity && { rarity: form.rarity }) });
    }
    const metaOp: Extract<StudioOp, { type: 'meta' }> = { type: 'meta', name };
    if (form.hidden !== initial.hidden) metaOp.hidden = form.hidden;
    if (form.pinned !== initial.pinned) metaOp.pinned = form.pinned;
    if (form.aliases !== initial.aliases) metaOp.aliases = form.aliases.split(',').map((a) => a.trim()).filter(Boolean);
    if (form.description !== initial.description) metaOp.description = form.description;
    if (Object.keys(metaOp).length > 2) ops.push(metaOp);
    if (ops.length === 0) return onClose();
    onQueue(ops);
  };

  return (
    <Modal
      title={`${CATEGORY_LABELS[item.category]} 수정`}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => confirm(`${item.name}을(를) 지울까요? 저장하기 전까지는 취소할 수 있어요.`) && onQueue([{ type: 'delete', category: item.category, image: item.image }])}
          >
            삭제
          </Button>
          <Button variant="primary" className="ml-auto" onClick={submit}>
            변경 담기
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
        <img src={imageUrl(item.image)} alt="" className="mx-auto h-28 w-28 object-contain" />
        <Field label="이름" hint="이름을 바꿔도 예전 이름으로 저장하거나 공유한 조합표는 그대로 열려요">
          <input className="field" value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </Field>
        {hasRarity && <RaritySelect value={form.rarity} onChange={(r) => set('rarity', r)} />}
        <Field label="다른 이름" hint="쉼표로 구분. 검색할 때 함께 찾아져요">
          <input className="field" value={form.aliases} onChange={(e) => set('aliases', e.target.value)} placeholder="예: 파김치, 파쿠" />
        </Field>
        <Field label="설명" hint="선택 창에 함께 보여요 (80자 이내)">
          <input className="field" value={form.description} maxLength={80} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Check label="맨 앞에 고정" hint="선택 창에서 항상 먼저 보여요" checked={form.pinned} onChange={(v) => set('pinned', v)} />
        <Check label="숨기기" hint="이미지는 남겨 두고 선택 창에서만 빼요" checked={form.hidden} onChange={(v) => set('hidden', v)} />
        {error && (
          <p role="alert" className="text-body-md text-danger">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

interface Draft {
  key: string;
  name: string;
  image: string;
  size: number;
}

function AddDialog({
  initialCategory,
  items,
  pending,
  onClose,
  onQueue,
}: {
  initialCategory: StudioCategory;
  items: StudioItem[];
  pending: StudioOp[];
  onClose: () => void;
  onQueue: (ops: StudioOp[]) => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [rarity, setRarity] = useState<Rarity | undefined>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const hasRarity = RARITY_CATEGORIES.includes(category);

  const pendingBytes = useMemo(() => pending.reduce((sum, op) => sum + (op.type === 'add' ? base64Size(op.image) : 0), 0), [pending]);

  const pick = async (files: FileList | null) => {
    setError('');
    const next: Draft[] = [];
    for (const file of Array.from(files ?? [])) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        setError(`${file.name}: PNG, JPG, WEBP 이미지만 올릴 수 있어요`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`${file.name}: 이미지는 1.5MB 이하로 올려 주세요`);
        continue;
      }
      next.push({ key: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name.replace(/\.[^.]+$/, '').normalize('NFC'), image: await readBase64(file), size: file.size });
    }
    setDrafts((d) => [...d, ...next]);
  };

  const submit = () => {
    if (drafts.length === 0) return setError('이미지를 골라 주세요');
    if (hasRarity && !rarity) return setError('등급을 골라 주세요');
    const names = new Set<string>();
    const queued = pending.filter((op): op is Extract<StudioOp, { type: 'add' }> => op.type === 'add');
    for (const d of drafts) {
      const name = cleanName(d.name);
      if (!name) return setError(`${d.name || '이름 없음'}: 이름을 확인해 주세요 (40자 이내, / : * ? " < > | 같은 기호 제외)`);
      if (names.has(name) || nameTaken(items, category, rarity, name) || queued.some((op) => dirKey(op.category, op.rarity) === dirKey(category, rarity) && op.name === name))
        return setError(`${name}: 같은 이름이 이미 있어요`);
      names.add(name);
    }
    if (pendingBytes + drafts.reduce((s, d) => s + d.size, 0) > MAX_TOTAL_IMAGE_BYTES)
      return setError('한 번에 올리는 이미지가 너무 커요 (모두 합쳐 3MB까지). 먼저 저장한 뒤 이어서 추가해 주세요');
    onQueue(drafts.map((d) => ({ type: 'add', category, ...(hasRarity && { rarity }), name: cleanName(d.name)!, image: d.image })));
  };

  return (
    <Modal
      title="아이템 추가"
      onClose={onClose}
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
        <Field label="이미지" hint="PNG, JPG, WEBP (1장 1.5MB 이하). 여러 장을 한 번에 골라도 돼요. 파일 이름이 아이템 이름이 돼요">
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="field h-auto py-2" onChange={(e) => (pick(e.target.files), (e.target.value = ''))} />
        </Field>
        {drafts.length > 0 && (
          <ul className="space-y-2">
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
        {error && (
          <p role="alert" className="text-body-md text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function NotesTab({ updates, pending, onQueue }: { updates: StudioData['updates']; pending: StudioOp[]; onQueue: (ops: StudioOp[]) => boolean }) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const queued = pending.filter((op): op is Extract<StudioOp, { type: 'note' }> => op.type === 'note');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = body.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || items.length === 0) return setError('제목과 내용을 적어 주세요');
    if (onQueue([{ type: 'note', date, title: title.trim(), items }])) {
      setTitle('');
      setBody('');
      setError('');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-title-md text-ink">소식 쓰기</h2>
        <p className="text-caption text-ink-subtle">새 아이템은 소식을 쓰지 않아도 자동으로 올라가요. 그 밖의 바뀐 점을 알릴 때 써 주세요.</p>
        <Field label="날짜">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="제목">
          <input className="field" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="예: 새 시즌 준비" />
        </Field>
        <Field label="내용" hint="한 줄에 하나씩">
          <textarea className="field h-32 py-2" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-body-md text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full">
          담기
        </Button>
      </form>
      <section aria-labelledby="notes-list" className="space-y-3">
        <h2 id="notes-list" className="text-title-md text-ink">
          지금 올라가 있는 소식
        </h2>
        {[...queued.map((n) => ({ ...n, queued: true })), ...updates.map((n) => ({ ...n, queued: false }))].map((note, i) => (
          <article key={i} className={clsx('rounded-lg border p-4', note.queued ? 'border-dashed border-primary-ink/50 bg-primary-soft/40' : 'border-line bg-surface')}>
            <div className="flex items-center gap-2">
              <h3 className="text-label-md text-ink">{note.title}</h3>
              {note.queued && <span className="text-[11px] text-primary-ink">저장 전</span>}
              <time className="ml-auto text-caption tabular-nums text-ink-subtle">{note.date.replaceAll('-', '.')}</time>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md text-ink-muted">
              {note.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
        {updates.length === 0 && queued.length === 0 && <p className="text-body-md text-ink-subtle">아직 소식이 없어요</p>}
      </section>
    </div>
  );
}
