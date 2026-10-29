'use client';

import { useEffect, useState } from 'react';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { hasBoardData, isBoardEmpty, pickBoard, useAppStore } from '@/store/useAppStore';
import { loadShortLink, shareIdIn } from '@/lib/share';
import { track } from '@/lib/analytics';
import Toolbar from './Toolbar';
import Board from './Board';
import ImageSelectModal from './ImageSelectModal';
import { WithToasts } from './Toast';
import Modal from './ui/Modal';
import Button from './ui/Button';

function applyShared(board: unknown) {
  const { loadBoard, showToast } = useAppStore.getState();
  try {
    loadBoard(board);
  } catch (err) {
    // 여기서 멈추면 '불러오고 있어요' 알림이 계속 남으므로 실패를 알린다
    console.error('Failed to apply shared board:', err);
    showToast('공유된 조합표를 열지 못했어요. 링크를 다시 확인해 주세요', 'error');
    return;
  }
  showToast('공유된 조합표를 불러왔어요');
  track('open_shared_link');
}

/** 조합표 편집 화면. 주소가 /s/<id>(짧은 링크) 또는 /?data=(예전 긴 링크)면 공유된 조합표를 불러온다. */
export default function Editor() {
  const picker = useAppStore((s) => s.picker);
  const closePicker = useAppStore((s) => s.closePicker);
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  // 게임 데이터 (빌드 때 생성된 JSON)
  useEffect(() => {
    useAppStore.getState().loadGameData();
  }, []);

  // 공유된 조합표 불러오기: 짧은 링크 또는 예전 방식의 ?data= 긴 링크.
  // 이미 만들던 조합표가 있으면 바로 덮어쓰지 않고 먼저 물어본다.
  const [incoming, setIncoming] = useState<unknown>(null);
  useEffect(() => {
    const { showToast, hideToast } = useAppStore.getState();
    const receive = (board: unknown) => {
      window.history.replaceState(null, '', '/'); // 새로고침해도 이후 수정한 내용이 유지되게
      if (!hasBoardData(board)) return showToast('공유 링크를 열 수 없어요', 'error');
      if (isBoardEmpty(pickBoard(useAppStore.getState()))) return applyShared(board);
      // 다 받았으니 '불러오고 있어요' 알림은 내리고 물어본다 (지금 것 유지를 골라도 알림이 남지 않게)
      hideToast();
      setIncoming(board);
    };
    const shareId = shareIdIn(window.location.pathname, 'edit');
    if (shareId === '') {
      window.history.replaceState(null, '', '/');
      showToast('공유 링크 주소가 올바르지 않아요. 주소를 다시 확인해 주세요', 'error');
      return;
    }
    if (shareId) {
      // 받기 전에 화면이 정리되면(개발 모드에서 효과를 두 번 돌릴 때 등) 늦게 온 결과는 버린다
      let active = true;
      showToast('공유된 조합표를 불러오고 있어요', 'loading');
      loadShortLink(shareId)
        .then((board) => {
          if (!active) return;
          if (board) return receive(board);
          window.history.replaceState(null, '', '/');
          showToast('공유 링크를 찾을 수 없어요. 주소를 다시 확인해 주세요', 'error');
        })
        .catch((err) => {
          if (!active) return;
          // 연결 문제일 때는 주소를 그대로 두어 새로고침으로 다시 시도할 수 있게
          console.error('Failed to load share:', err);
          showToast('공유된 조합표를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요', 'error');
        });
      return () => {
        active = false;
      };
    }
    const data = new URLSearchParams(window.location.search).get('data');
    if (!data) return;
    try {
      const json = data.length <= 20_000 ? decompressFromEncodedURIComponent(data) : null;
      if (!json || json.length > 200_000) throw new Error('too large');
      receive(JSON.parse(json));
    } catch (err) {
      console.error('Failed to load state from URL:', err);
      window.history.replaceState(null, '', '/');
      showToast('공유 링크를 열 수 없어요', 'error');
    }
  }, []);

  return (
    <WithToasts>
      <Toolbar />
      <Board className={settingsOpen ? 'panel-open' : undefined} />
      {picker && <ImageSelectModal request={picker} onClose={closePicker} />}
      {incoming !== null && (
        <Modal
          title="공유된 조합표 열기"
          onClose={() => setIncoming(null)}
          footer={
            <>
              <Button className="ml-auto" onClick={() => setIncoming(null)}>
                지금 것 유지
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  applyShared(incoming);
                  setIncoming(null);
                }}
              >
                열기
              </Button>
            </>
          }
        >
          <p className="p-5 text-body-md text-ink">공유된 조합표를 열면 지금 만들던 조합표가 바뀌어요.</p>
        </Modal>
      )}
    </WithToasts>
  );
}
