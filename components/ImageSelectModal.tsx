'use client';

import clsx from 'clsx';
import { KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PickerRequest, useAppStore } from '@/store/useAppStore';
import { CATEGORY_LABELS, isNew } from '@/lib/items';
import { GameItem } from '@/types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon, SearchIcon } from './ui/icons';

const RARITY_LABELS = { legendary: '레전더리', epic: '에픽', rare: '레어', common: '커먼' } as const;
type Rarity = keyof typeof RARITY_LABELS;
type Filter = 'all' | 'new' | Rarity;

// 등급 색 점 (글자와 함께 쓰므로 색만으로 구분하지 않음)
const RARITY_DOT: Record<string, string> = {
  legendary: 'bg-amber-600',
  epic: 'bg-fuchsia-600',
  rare: 'bg-sky-600',
  common: 'bg-stone-500',
};

// 처음에는 화면에 보일 만큼만 그리고, 나머지는 바로 다음에 그린다 (창이 빨리 열리게)
const FIRST_BATCH = 20;
const BATCH = 40;

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export default function ImageSelectModal({ request, onClose }: { request: PickerRequest; onClose: () => void }) {
  const gameData = useAppStore((s) => s.gameData);
  const gameDataError = useAppStore((s) => s.gameDataError);
  const [query, setQuery] = useState('');
  // 등급은 여러 개 함께 고를 수 있고, '신규'는 등급과 함께 걸리는 별도 조건
  const [selectedRarities, setSelectedRarities] = useState<Rarity[]>([]);
  const [newOnly, setNewOnly] = useState(false);
  const [shown, setShown] = useState(FIRST_BATCH);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const noFilter = selectedRarities.length === 0 && !newOnly;

  const items = useMemo(() => gameData?.[request.category] ?? [], [gameData, request.category]);
  const now = useMemo(() => Date.now(), []);
  const hasNew = items.some((i) => isNew(i, now));
  const rarities = (Object.keys(RARITY_LABELS) as Rarity[]).filter((r) => items.some((i) => i.rarity === r));

  const filtered = useMemo(() => {
    const q = normalize(query);
    const matches = (item: GameItem) =>
      (selectedRarities.length === 0 || selectedRarities.includes(item.rarity as Rarity)) &&
      (!newOnly || isNew(item, now)) &&
      (!q || [item.name, ...(item.aliases ?? [])].some((n) => normalize(n).includes(q)));
    const list = items.filter(matches);
    // '전체'에서는 신규 아이템을 앞쪽에 (고정 아이템 다음)
    return noFilter && !q
      ? [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(isNew(b, now)) - Number(isNew(a, now)))
      : list;
  }, [items, query, selectedRarities, newOnly, noFilter, now]);

  const selectedIndex = filtered.findIndex((item) => item.image === request.current);
  // 고른 아이템이 가운데 오도록 그 뒤로 몇 줄 더
  const visible = filtered.slice(0, Math.max(shown, selectedIndex + 16));

  useEffect(() => {
    if (!gameData || shown >= filtered.length) return;
    // 창이 그려진 다음, 브라우저가 한가할 때 조금씩 나눠 그린다 (그동안 입력이 멈추지 않게)
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 50));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setShown((n) => n + BATCH), { timeout: 300 } as never);
    return () => cancel(id);
  }, [gameData, shown, filtered.length]);

  // 다시 열면 지금 고른 아이템이 보이게 (창 안의 목록만 스크롤)
  useEffect(() => {
    const card = listRef.current?.querySelector('[aria-pressed="true"]');
    const scroller = card?.closest('.overflow-y-auto');
    if (!card || !scroller) return;
    const offset = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += offset - scroller.clientHeight / 2 + card.clientHeight / 2;
  }, [gameData]);

  const isOn = (key: Filter) => (key === 'all' ? noFilter : key === 'new' ? newOnly : selectedRarities.includes(key));
  const toggle = (key: Filter) => {
    if (key === 'all') {
      setSelectedRarities([]);
      setNewOnly(false);
    } else if (key === 'new') setNewOnly((v) => !v);
    else setSelectedRarities((list) => (list.includes(key) ? list.filter((r) => r !== key) : [...list, key]));
  };
  const clearFilters = () => {
    setQuery('');
    toggle('all');
    searchRef.current?.focus(); // 누른 버튼이 사라지므로 검색칸으로
  };

  const select = useCallback(
    (image: string) => {
      request.apply(image);
      onClose();
    },
    [request, onClose]
  );

  // 화살표 키로 카드 사이를 이동 (Tab을 수백 번 누르지 않아도 되게)
  const onGridKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const columns = getComputedStyle(e.currentTarget).gridTemplateColumns.split(' ').length || 1;
    const step = keys[e.key] ?? (e.key === 'ArrowDown' ? columns : e.key === 'ArrowUp' ? -columns : e.key === 'Home' ? -index : e.key === 'End' ? buttons.length : 0);
    if (!step) return;
    e.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, index + step))]?.focus();
  };

  const filters: [Filter, string][] = [
    ['all', '전체'],
    ...(hasNew ? [['new', '신규'] as [Filter, string]] : []),
    ...rarities.map((r) => [r, RARITY_LABELS[r]] as [Filter, string]),
  ];

  return (
    <Modal title={`${request.label} 선택`} onClose={onClose} className="modal-wide">
      <div className="picker-head sticky top-0 z-10 space-y-2 border-b border-line bg-surface px-5 pb-2 pt-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
              <SearchIcon />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 검색"
              aria-label={`${CATEGORY_LABELS[request.category]} 이름 검색`}
              data-autofocus="fine-pointer"
              className="field pl-9"
            />
          </div>
          {request.current && (
            <Button variant="secondary" onClick={() => select('')}>
              선택 해제
            </Button>
          )}
        </div>
        {filters.length > 1 && (
          <div
            role="group"
            aria-label="필터 (여러 개 선택 가능)"
            className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto py-1 pl-1 pr-6 [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] sm:pr-1 sm:[mask-image:none]"
          >
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={isOn(key)}
                onClick={() => toggle(key)}
                className={clsx(
                  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label-md transition-colors active:scale-95',
                  isOn(key) ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-muted hover:text-ink'
                )}
              >
                {/* 아이콘 칸은 항상 같은 폭: 켜고 끌 때 옆 칩이 밀리지 않게 */}
                {key !== 'all' && (
                  <span className="grid w-3.5 place-items-center" aria-hidden="true">
                    {isOn(key) ? <CheckIcon className="h-3.5 w-3.5" /> : key in RARITY_DOT ? <span className={clsx('h-2 w-2 rounded-full', RARITY_DOT[key])} /> : <span className="h-2 w-2 rounded-full bg-primary-ink" />}
                  </span>
                )}
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {gameData && `${filtered.length}개`}
        </p>
      </div>

      {!gameData && gameDataError ? (
        <div role="alert" className="px-5 pb-12 pt-8 text-center">
          <p className="text-label-md text-ink">아이템 목록을 불러오지 못했어요</p>
          <p className="mt-1 text-body-md text-ink-muted">인터넷 연결을 확인해 주세요.</p>
          <Button variant="primary" className="mt-4" onClick={() => (useAppStore.getState().loadGameData(), searchRef.current?.focus())}>
            다시 불러오기
          </Button>
        </div>
      ) : !gameData ? (
        <ul className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-5" aria-label="불러오는 중">
          {Array.from({ length: 15 }, (_, i) => (
            <li key={i} className="skeleton aspect-[4/5] rounded-lg" />
          ))}
        </ul>
      ) : (
        <ul ref={listRef} onKeyDown={onGridKey} className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-5">
          {visible.map((item, i) => (
            <PickerCard key={item.id} item={item} index={i} selected={item.image === request.current} isNewItem={isNew(item, now)} onSelect={select} />
          ))}
        </ul>
      )}
      {gameData && filtered.length === 0 && (
        <div className="px-5 pb-12 pt-6 text-center">
          <p className="text-3xl" aria-hidden="true">
            🍪
          </p>
          <p className="mt-2 text-label-md text-ink">{query ? `‘${query}’ 검색 결과가 없어요` : '해당하는 아이템이 없어요'}</p>
          <Button className="mt-4" onClick={clearFilters}>
            {query ? '검색어와 필터 지우기' : '필터 지우기'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

const PickerCard = memo(function PickerCard({
  item,
  index,
  selected,
  isNewItem,
  onSelect,
}: {
  item: GameItem;
  index: number;
  selected: boolean;
  isNewItem: boolean;
  onSelect: (image: string) => void;
}) {
  const rarity = item.rarity as Rarity | undefined;
  return (
    // scroll-margin: 키보드로 옮긴 카드가 위쪽 검색·필터 머리말에 가려지지 않게
    <li className={clsx('flex scroll-mb-4 scroll-mt-36', index < 24 && 'blur-fade')} style={{ ['--i' as string]: index }}>
      <button
        type="button"
        onClick={() => onSelect(item.image)}
        aria-pressed={selected}
        aria-label={[item.name, rarity && RARITY_LABELS[rarity], isNewItem && '신규'].filter(Boolean).join(', ')}
        title={item.description ?? item.name}
        // 같은 줄의 카드는 높이를 맞추고, 이름 칸은 항상 두 줄 높이 (카드마다 들쭉날쭉하지 않게)
        className={clsx(
          'relative flex h-full w-full flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-offset-2 active:scale-[.97]',
          selected ? 'border-primary-ink bg-primary-soft ring-1 ring-primary-ink' : 'border-line bg-surface hover:border-ink-subtle/50 hover:bg-surface-cream hover:shadow-e1'
        )}
      >
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-cream p-2">
          <img src={item.thumb ?? item.image} alt="" loading={index < 20 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" />
          {/* 이미지 칸 모서리에 고정: 왼쪽 위 = 등급, 오른쪽 위 = NEW, 선택 */}
          {rarity && (
            <span title={RARITY_LABELS[rarity]} className={clsx('absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', RARITY_DOT[rarity])}>
              <span className="sr-only">{RARITY_LABELS[rarity]}</span>
            </span>
          )}
          <span className="absolute right-1 top-1 flex items-center gap-1">
            {isNewItem && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-primary shadow-e1">NEW</span>}
            {selected && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-ink text-surface shadow-e1">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </span>
        <span className="flex min-h-[2.5em] w-full items-center justify-center text-caption font-semibold leading-tight text-ink">
          <span className="line-clamp-2">{item.name}</span>
        </span>
        {item.description && <span className="line-clamp-2 text-[11px] leading-tight text-ink-subtle">{item.description}</span>}
      </button>
    </li>
  );
});
