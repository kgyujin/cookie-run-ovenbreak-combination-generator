'use client';

import { FormEvent, KeyboardEvent, ReactNode, useId, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { LibraryKind, MAX_NAME, STORAGE_FULL_MESSAGE, SavedEntry, useLibrary } from '@/lib/library';
import { track } from '@/lib/analytics';
import { objectParticle } from '@/lib/korean';
import Button from './ui/Button';
import { CopyIcon, PencilIcon, ReplaceIcon, SaveIcon, TrashIcon } from './ui/icons';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const showToast = (message: string, tone?: 'error') => useAppStore.getState().showToast(message, tone);

/** 저장에 실패하면(저장 공간 부족) 알리고 false */
const saved = (ok: boolean) => {
  if (!ok) showToast(STORAGE_FULL_MESSAGE, 'error');
  return ok;
};

/** 새 항목 저장 칸: 이름을 비우면 placeholder 이름으로, 저장하면 칸을 비운다 */
export function NewEntryForm({
  kind,
  label,
  placeholder,
  buttonLabel,
  data,
  onSaved,
  autoFocus = false,
}: {
  kind: LibraryKind;
  label: string;
  placeholder: string;
  buttonLabel: string;
  data: () => object;
  onSaved: () => void;
  /** 창이 열리면 이름 칸부터 (마우스 환경에서만: 휴대폰에서 키보드가 바로 뜨지 않게) */
  autoFocus?: boolean;
}) {
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saved(useLibrary.getState().add(kind, name.trim() || placeholder, data()))) return;
    setName('');
    onSaved();
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder={placeholder} aria-label={label} className="field min-w-0 flex-1" data-autofocus={autoFocus ? 'fine-pointer' : undefined} />
      <Button type="submit" variant="primary">
        <SaveIcon />
        {buttonLabel}
      </Button>
    </form>
  );
}

type Mode = 'rename' | 'overwrite' | 'delete';

/**
 * 이름을 붙여 저장해 둔 항목 목록 (조합표 보관함, 꾸미기 테마 공통).
 * 항목마다 주 동작(불러오기, 적용)과 덮어쓰기, 이름 바꾸기, 복사, 지우기. 덮어쓰기와 지우기는 그 줄 안에서 한 번 더 확인한다.
 */
export default function SavedList({
  kind,
  noun,
  primaryLabel,
  onPrimary,
  current,
  currentLabel,
  emptyText,
}: {
  kind: LibraryKind;
  /** 화면 읽기와 확인 문구용 이름 (예: 조합표, 테마) */
  noun: string;
  primaryLabel: string;
  onPrimary: (entry: SavedEntry) => void;
  /** 덮어쓸 지금 내용 */
  current: () => object;
  /** 덮어쓰기 확인 문구의 '지금 무엇' (예: 지금 조합표, 지금 꾸미기) */
  currentLabel: string;
  emptyText: string;
}) {
  const items = useLibrary((s) => s[kind]);
  const library = useLibrary.getState();
  const [editing, setEditing] = useState<{ id: string; mode: Mode } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const questionId = useId(); // 확인 문구 (한 번에 한 줄만 확인 중)

  /** 줄 모양이 바뀐 뒤 포커스를 옮긴다 (줄이 사라졌거나 버튼이 바뀐 경우) */
  const focusLater = (selector: string) => requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(selector)?.focus());
  const button = (mode: Mode | 'primary', id: string) => `[data-action="${mode}"][data-id="${CSS.escape(id)}"]`;
  const start = (id: string, mode: Mode) => {
    setEditing({ id, mode });
    if (mode !== 'rename') focusLater('[data-confirm]');
  };
  const stop = () => {
    if (editing) focusLater(button(editing.mode, editing.id));
    setEditing(null);
  };

  const confirm = (entry: SavedEntry, index: number) => {
    if (editing?.mode === 'overwrite') {
      if (!saved(library.overwrite(kind, entry.id, current()))) return;
      showToast(`${entry.name}에 덮어썼어요`);
      track(kind === 'boards' ? 'overwrite_board' : 'overwrite_theme');
      return stop();
    }
    if (!saved(library.remove(kind, entry.id))) return;
    setEditing(null);
    const next = items[index + 1] ?? items[index - 1];
    focusLater(next ? button('primary', next.id) : '[data-empty]');
  };

  // Esc는 그 줄의 이름 바꾸기나 확인만 취소한다 (창이나 설정 패널은 닫지 않음)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !editing) return;
    e.preventDefault();
    e.stopPropagation();
    stop();
  };

  return (
    <div ref={rootRef}>
      {!items.length ? (
        <p data-empty tabIndex={-1} className="rounded-lg border border-dashed border-line p-5 text-center text-caption text-ink-subtle outline-none">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((entry, index) => {
            const mode = editing?.id === entry.id ? editing.mode : null;
            return (
              <li key={entry.id} onKeyDown={mode ? onKeyDown : undefined} className="rounded-lg border border-line p-3">
                {mode === 'rename' ? (
                  <RenameForm name={entry.name} label={`${noun} 이름`} onSubmit={(name) => saved(library.rename(kind, entry.id, name)) && stop()} onCancel={stop} />
                ) : mode ? (
                  <div role="group" aria-labelledby={questionId}>
                    {/* 띄어쓰기 없는 긴 이름도 줄을 바꿔 칸 안에 */}
                    <p id={questionId} className="text-body-md text-ink [overflow-wrap:anywhere]">
                      <b className="font-semibold">{entry.name}</b>
                      {mode === 'delete' ? `${objectParticle(entry.name)} 지울까요?` : `에 ${currentLabel}를 덮어쓸까요? 원래 내용은 사라져요.`}
                    </p>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant={mode === 'delete' ? 'danger' : 'primary'} onClick={() => confirm(entry, index)} data-confirm>
                        {mode === 'delete' ? '지우기' : '덮어쓰기'}
                      </Button>
                      <Button onClick={stop}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="truncate text-label-md text-ink">{entry.name}</p>
                    <p className="text-caption text-ink-subtle">{entry.savedAt ? dateFormat.format(entry.savedAt) : '날짜 모름'}</p>
                    {/* 좁은 화면(휴대폰, 설정 패널)에서도 이름이 가려지지 않게 버튼은 아랫줄에 */}
                    <div className="mt-2 flex items-center gap-1">
                      <Button onClick={() => onPrimary(entry)} data-action="primary" data-id={entry.id} aria-label={`${entry.name} ${primaryLabel}`} className="mr-auto">
                        {primaryLabel}
                      </Button>
                      <IconAction mode="overwrite" entry={entry} label={`${currentLabel}로 덮어쓰기`} onClick={() => start(entry.id, 'overwrite')}>
                        <ReplaceIcon />
                      </IconAction>
                      <IconAction mode="rename" entry={entry} label="이름 바꾸기" onClick={() => start(entry.id, 'rename')}>
                        <PencilIcon />
                      </IconAction>
                      <IconAction mode="duplicate" entry={entry} label="복사" onClick={() => saved(library.duplicate(kind, entry.id)) && showToast(`${entry.name} 사본을 만들었어요`)}>
                        <CopyIcon />
                      </IconAction>
                      <IconAction mode="delete" entry={entry} label="지우기" onClick={() => start(entry.id, 'delete')} danger>
                        <TrashIcon />
                      </IconAction>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconAction({ mode, entry, label, onClick, danger, children }: { mode: Mode | 'duplicate'; entry: SavedEntry; label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      className={'w-touch px-0' + (danger ? ' hover:!text-danger' : '')}
      onClick={onClick}
      data-action={mode}
      data-id={entry.id}
      aria-label={`${entry.name} ${label}`}
      title={label}
    >
      {children}
    </Button>
  );
}

function RenameForm({ name, label, onSubmit, onCancel }: { name: string; label: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value);
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={MAX_NAME} aria-label={label} autoFocus className="field min-w-0 flex-1" />
      <Button type="submit" variant="primary" aria-disabled={!value.trim()}>
        저장
      </Button>
      <Button onClick={onCancel}>취소</Button>
    </form>
  );
}
