'use client';

import clsx from 'clsx';
import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { MAX_NAME, SavedEntry } from '@/lib/library';
import Button from './ui/Button';
import { CopyIcon, PencilIcon, TrashIcon } from './ui/icons';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * 이름을 붙여 저장해 둔 항목 목록 (조합표 보관함, 꾸미기 테마 공통).
 * 항목마다 주 동작(불러오기, 적용)과 이름 바꾸기, 복사, 지우기. 이름 바꾸기와 지우기 확인은 그 줄 안에서 한다.
 */
export default function SavedList<T>({
  items,
  noun,
  primaryLabel,
  onPrimary,
  onRename,
  onDuplicate,
  onDelete,
  activeId,
  activeLabel,
  emptyText,
}: {
  items: SavedEntry<T>[];
  /** 화면 읽기용 이름 (예: 조합표, 테마) */
  noun: string;
  primaryLabel: string;
  onPrimary: (item: SavedEntry<T>) => void;
  /** 저장에 실패하면 false */
  onRename: (id: string, name: string) => boolean;
  onDuplicate?: (id: string) => void;
  onDelete: (id: string) => void;
  activeId?: string | null;
  activeLabel?: string;
  emptyText: string;
}) {
  const [editing, setEditing] = useState<{ id: string; mode: 'rename' | 'delete' } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /** 줄 모양이 바뀐 뒤 그 줄(또는 이웃 줄)의 버튼으로 포커스를 옮긴다 */
  const focusLater = (selector: string) => requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(selector)?.focus());
  const stopEditing = (id: string) => {
    setEditing(null);
    focusLater(`[data-rename="${id}"]`);
  };
  const remove = (index: number) => {
    onDelete(items[index].id);
    setEditing(null);
    const next = items[index + 1] ?? items[index - 1];
    if (next) focusLater(`[data-primary="${next.id}"]`);
  };

  if (!items.length) return <p className="rounded-lg border border-dashed border-line p-5 text-center text-caption text-ink-subtle">{emptyText}</p>;

  return (
    <ul ref={listRef} className="space-y-2">
      {items.map((item, index) => {
        const mode = editing?.id === item.id ? editing.mode : null;
        return (
          <li key={item.id} className={clsx('rounded-lg border p-3', item.id === activeId ? 'border-primary-ink bg-primary-soft/40' : 'border-line')}>
            {mode === 'rename' ? (
              <RenameForm
                name={item.name}
                label={`${noun} 이름`}
                onSubmit={(name) => onRename(item.id, name) && stopEditing(item.id)}
                onCancel={() => stopEditing(item.id)}
              />
            ) : mode === 'delete' ? (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${item.name} 지우기 확인`}>
                <p className="mr-auto min-w-0 text-body-md text-ink">
                  <b className="font-semibold">{item.name}</b> {noun}를 지울까요?
                </p>
                <Button variant="danger" onClick={() => remove(index)} data-confirm-delete>
                  지우기
                </Button>
                <Button onClick={() => stopEditing(item.id)}>취소</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="mr-auto min-w-0 pr-2">
                  <p className="truncate text-label-md text-ink">{item.name}</p>
                  <p className="text-caption text-ink-subtle">
                    {dateFormat.format(item.savedAt)}
                    {item.id === activeId && activeLabel && <span className="ml-1.5 font-semibold text-primary-ink">{activeLabel}</span>}
                  </p>
                </div>
                <Button onClick={() => onPrimary(item)} data-primary={item.id} aria-label={`${item.name} ${primaryLabel}`}>
                  {primaryLabel}
                </Button>
                <Button variant="ghost" className="w-touch px-0" onClick={() => setEditing({ id: item.id, mode: 'rename' })} data-rename={item.id} aria-label={`${item.name} 이름 바꾸기`} title="이름 바꾸기">
                  <PencilIcon />
                </Button>
                {onDuplicate && (
                  <Button variant="ghost" className="w-touch px-0" onClick={() => onDuplicate(item.id)} aria-label={`${item.name} 복사`} title="복사">
                    <CopyIcon />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-touch px-0 hover:!text-danger"
                  onClick={() => {
                    setEditing({ id: item.id, mode: 'delete' });
                    focusLater('[data-confirm-delete]');
                  }}
                  aria-label={`${item.name} 지우기`}
                  title="지우기"
                >
                  <TrashIcon />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RenameForm({ name, label, onSubmit, onCancel }: { name: string; label: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value);
  };
  // Esc는 이름 바꾸기만 취소하고 창은 닫지 않는다
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };
  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="flex items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={MAX_NAME} aria-label={label} autoFocus className="field min-w-0 flex-1" />
      <Button type="submit" variant="primary" aria-disabled={!value.trim()}>
        저장
      </Button>
      <Button onClick={onCancel}>취소</Button>
    </form>
  );
}
