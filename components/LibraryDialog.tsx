'use client';

import { FormEvent, useState } from 'react';
import { pickBoard, useAppStore } from '@/store/useAppStore';
import { MAX_NAME, SavedEntry, STORAGE_FULL_MESSAGE, useLibrary } from '@/lib/library';
import { track } from '@/lib/analytics';
import { BoardState } from '@/types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import SavedList from './SavedList';

/** 새로 저장할 때 기본 이름: 시즌명 첫 줄, 없으면 '조합표 n' */
const defaultName = (count: number) => useAppStore.getState().seasonName.split('\n')[0].trim().slice(0, MAX_NAME) || `조합표 ${count + 1}`;

/** 조합표 보관함: 지금 조합표를 이름 붙여 저장하고, 저장해 둔 조합표를 불러오거나 정리한다 (이 브라우저에만 저장) */
export default function LibraryDialog({ onClose }: { onClose: () => void }) {
  const boards = useLibrary((s) => s.boards);
  const activeId = useLibrary((s) => s.activeBoardId);
  const active = boards.find((b) => b.id === activeId);
  const [name, setName] = useState(() => defaultName(boards.length));
  const { showToast } = useAppStore.getState();
  const library = useLibrary.getState();

  const save = (overwrite?: SavedEntry<BoardState>) => {
    const id = library.save('boards', name, pickBoard(useAppStore.getState()), overwrite?.id);
    if (!id) return showToast(STORAGE_FULL_MESSAGE, 'error');
    showToast(overwrite ? `${overwrite.name}에 덮어썼어요` : '보관함에 저장했어요');
    track('save_board', { save_type: overwrite ? 'overwrite' : 'new' });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };
  const load = (entry: SavedEntry<BoardState>) => {
    useAppStore.getState().loadBoard(entry.data);
    library.setActiveBoard(entry.id);
    showToast(`${entry.name} 조합표를 불러왔어요. 실행 취소로 되돌릴 수 있어요`);
    track('load_board');
    onClose();
  };
  const failIfFull = (ok: unknown) => {
    if (!ok) showToast(STORAGE_FULL_MESSAGE, 'error');
    return !!ok;
  };

  return (
    <Modal
      title="조합표 보관함"
      onClose={onClose}
      footer={
        <Button className="ml-auto" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-5 p-5">
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="library-name" className="block text-label-md text-ink">
            지금 조합표 저장
          </label>
          <div className="flex gap-2">
            <input id="library-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="이름" className="field min-w-0 flex-1" data-autofocus="fine-pointer" />
            <Button type="submit" variant="primary">
              새로 저장
            </Button>
          </div>
          {active && (
            <Button className="w-full" onClick={() => save(active)}>
              {active.name}에 덮어쓰기
            </Button>
          )}
          <p className="text-caption text-ink-subtle">이 브라우저에만 저장돼요. 다른 기기에서 보려면 링크 공유를 써 주세요.</p>
        </form>

        <section aria-labelledby="library-list" className="space-y-2">
          <h3 id="library-list" className="text-label-md text-ink">
            저장한 조합표 {boards.length > 0 && <span className="text-ink-subtle">{boards.length}</span>}
          </h3>
          <SavedList
            items={boards}
            noun="조합표"
            primaryLabel="불러오기"
            onPrimary={load}
            onRename={(id, next) => failIfFull(library.rename('boards', id, next))}
            onDuplicate={(id) => failIfFull(library.duplicate('boards', id))}
            onDelete={(id) => failIfFull(library.remove('boards', id))}
            activeId={activeId}
            activeLabel="최근 사용"
            emptyText="아직 저장한 조합표가 없어요."
          />
        </section>
      </div>
    </Modal>
  );
}
