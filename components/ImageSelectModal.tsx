'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { PickerRequest, useAppStore } from '@/store/useAppStore';
import { CATEGORY_LABELS, isNew } from '@/lib/items';
import { GameItem } from '@/types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon, SearchIcon } from './ui/icons';

const RARITY_LABELS = { legendary: '레전더리', epic: '에픽', rare: '레어', common: '커먼' } as const;
type Filter = 'all' | 'new' | keyof typeof RARITY_LABELS;

// 등급 색 점 (글자와 함께 쓰므로 색만으로 구분하지 않음)
const RARITY_DOT: Record<string, string> = {
  legendary: 'bg-amber-500',
  epic: 'bg-fuchsia-500',
  rare: 'bg-sky-500',
  common: 'bg-stone-400',
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export default function ImageSelectModal({ request, onClose }: { request: PickerRequest; onClose: () => void }) {
  const gameData = useAppStore((s) => s.gameData);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => gameData?.[request.category] ?? [], [gameData, request.category]);
  const now = useMemo(() => Date.now(), []);
  const hasNew = items.some((i) => isNew(i, now));
  const rarities = (Object.keys(RARITY_LABELS) as (keyof typeof RARITY_LABELS)[]).filter((r) => items.some((i) => i.rarity === r));

  const filtered = useMemo(() => {
    const q = normalize(query);
    const matches = (item: GameItem) =>
      (filter === 'all' || (filter === 'new' ? isNew(item, now) : item.rarity === filter)) &&
      (!q || [item.name, ...(item.aliases ?? [])].some((n) => normalize(n).includes(q)));
    const list = items.filter(matches);
    // '전체'에서는 신규 아이템을 앞쪽에 (고정 아이템 다음)
    return filter === 'all' && !q
      ? [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(isNew(b, now)) - Number(isNew(a, now)))
      : list;
  }, [items, query, filter, now]);

  const select = (image: string) => {
    request.apply(image);
    onClose();
  };

  const filters: [Filter, string][] = [
    ['all', '전체'],
    ...(hasNew ? [['new', '신규'] as [Filter, string]] : []),
    ...rarities.map((r) => [r, RARITY_LABELS[r]] as [Filter, string]),
  ];

  return (
    <Modal
      title={`${request.label} 선택`}
      onClose={onClose}
      className="modal-wide"
      footer={
        <>
          {request.current && (
            <Button variant="ghost" className="ml-auto" onClick={() => select('')}>
              선택 해제
            </Button>
          )}
        </>
      }
    >
      <div className="sticky top-0 z-10 space-y-3 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름으로 검색"
            aria-label={`${CATEGORY_LABELS[request.category]} 이름 검색`}
            className="field pl-9"
          />
        </div>
        {filters.length > 1 && (
          <div role="group" aria-label="등급 필터" className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={clsx(
                  'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label-md transition-[background-color,color,transform] active:scale-95',
                  filter === key ? 'bg-primary text-on-primary shadow-e1' : 'bg-surface-sunken text-ink-muted hover:text-ink'
                )}
              >
                {key in RARITY_DOT && <span className={clsx('h-2 w-2 rounded-full', RARITY_DOT[key], filter === key && 'ring-2 ring-white/70')} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!gameData ? (
        <ul className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-5" aria-label="불러오는 중">
          {Array.from({ length: 15 }, (_, i) => (
            <li key={i} className="skeleton aspect-[4/5] rounded-lg" />
          ))}
        </ul>
      ) : (
        <ul key={filter} className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-5">
          {filtered.map((item, i) => {
            const selected = item.image === request.current;
            return (
              <li key={item.id} className="blur-fade" style={{ ['--i' as string]: i }}>
                <button
                  type="button"
                  onClick={() => select(item.image)}
                  aria-pressed={selected}
                  title={item.description}
                  className={clsx(
                    'group relative flex w-full flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-e1 active:translate-y-0 active:scale-[.97]',
                    selected ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-line bg-surface hover:border-ink-subtle/40'
                  )}
                >
                  <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-cream">
                    <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105" />
                  </span>
                  <span className="line-clamp-2 w-full text-caption font-semibold leading-tight text-ink">{item.name}</span>
                  {item.description && <span className="line-clamp-2 text-[11px] leading-tight text-ink-subtle">{item.description}</span>}
                  {item.rarity && (
                    <span className={clsx('absolute bottom-2 right-2 h-2 w-2 rounded-full', RARITY_DOT[item.rarity])}>
                      <span className="sr-only">{RARITY_LABELS[item.rarity as keyof typeof RARITY_LABELS]}</span>
                    </span>
                  )}
                  {isNew(item, now) && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-primary shadow-e1">NEW</span>
                  )}
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary shadow-e1">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {gameData && filtered.length === 0 && (
        <div className="px-5 pb-12 pt-6 text-center">
          <p className="text-3xl" aria-hidden="true">🍪</p>
          <p className="mt-2 text-label-md text-ink">{query ? `‘${query}’ 검색 결과가 없어요` : '해당하는 아이템이 없어요'}</p>
        </div>
      )}
    </Modal>
  );
}
