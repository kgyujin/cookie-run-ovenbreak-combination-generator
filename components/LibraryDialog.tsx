'use client';

import { pickBoard, useAppStore } from '@/store/useAppStore';
import { MAX_NAME, SavedEntry, useLibrary } from '@/lib/library';
import { track } from '@/lib/analytics';
import { objectParticle } from '@/lib/korean';
import Modal from './ui/Modal';
import Button from './ui/Button';
import SavedList, { NewEntryForm } from './SavedList';

/** 지금 조합표 (보관함에 저장하거나 덮어쓸 내용) */
const currentBoard = () => pickBoard(useAppStore.getState());

/** 조합표 보관함: 지금 조합표를 이름 붙여 저장하고, 저장해 둔 조합표를 불러오거나 정리한다 (이 브라우저에만 저장) */
export default function LibraryDialog({ onClose }: { onClose: () => void }) {
  const count = useLibrary((s) => s.boards.length);
  // 이름을 비우고 저장하면: 시즌명 첫 줄, 없으면 '조합표 n'
  const seasonName = useAppStore((s) => s.seasonName.split('\n')[0].trim().slice(0, MAX_NAME));
  const { showToast, loadBoard, setSettingsOpen } = useAppStore.getState();

  const load = (entry: SavedEntry) => {
    loadBoard(entry.data);
    // 설정 패널의 '되돌리기'는 패널을 연 때의 꾸미기로 돌아가므로, 다른 조합표를 불러오면 패널을 닫는다
    setSettingsOpen(false);
    showToast(`${entry.name}${objectParticle(entry.name)} 불러왔어요. 실행 취소로 되돌릴 수 있어요`);
    track('load_board');
    onClose();
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
        <section aria-labelledby="library-save" className="space-y-2">
          <h3 id="library-save" className="text-label-md text-ink">
            지금 조합표 저장
          </h3>
          <NewEntryForm
            kind="boards"
            label="저장할 이름"
            placeholder={seasonName || `조합표 ${count + 1}`}
            buttonLabel="새로 저장"
            data={currentBoard}
            autoFocus
            onSaved={() => {
              showToast('보관함에 저장했어요');
              track('save_board');
            }}
          />
          <p className="text-caption text-ink-subtle">이 브라우저에만 저장돼요. 다른 기기에서 보려면 링크 공유를 써 주세요.</p>
        </section>

        <section aria-labelledby="library-list" className="space-y-2">
          <h3 id="library-list" className="text-label-md text-ink">
            저장한 조합표 {count > 0 && <span className="text-ink-subtle">{count}</span>}
          </h3>
          <SavedList kind="boards" noun="조합표" primaryLabel="불러오기" onPrimary={load} current={currentBoard} currentLabel="지금 조합표" emptyText="아직 저장한 조합표가 없어요." />
        </section>
      </div>
    </Modal>
  );
}
