'use client';

import { useEffect, useState } from 'react';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { isBoardEmpty, pickBoard, useAppStore } from '@/store/useAppStore';
import { loadShortLink } from '@/lib/share';
import { track } from '@/lib/analytics';
import { backgroundCss, backgroundEdgeColor } from '@/lib/board';
import Toolbar from './Toolbar';
import Header from './Header';
import ComboBlock from './ComboBlock';
import ImageSelectModal from './ImageSelectModal';
import Toast from './Toast';
import Modal from './ui/Modal';
import Button from './ui/Button';

function applyShared(board: unknown) {
  const { loadBoard, showToast } = useAppStore.getState();
  loadBoard(board);
  showToast('공유된 조합표를 불러왔어요');
  track('open_shared_link');
}

/** 조합표 편집 화면. 주소가 /s/<id>(짧은 링크) 또는 /?data=(예전 긴 링크)면 공유된 조합표를 불러온다. */
export default function Editor() {
  const arenaCount = useAppStore((s) => s.arenas.length);
  const background = useAppStore((s) => s.background);
  const fontSettings = useAppStore((s) => s.fontSettings);
  const picker = useAppStore((s) => s.picker);
  const closePicker = useAppStore((s) => s.closePicker);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const gap = useAppStore((s) => s.boardStyle.gap);

  // 게임 데이터 (빌드 때 생성된 JSON)
  useEffect(() => {
    useAppStore.getState().loadGameData();
  }, []);

  // 공유된 조합표 불러오기: 짧은 링크 또는 예전 방식의 ?data= 긴 링크.
  // 이미 만들던 조합표가 있으면 바로 덮어쓰지 않고 먼저 물어본다.
  const [incoming, setIncoming] = useState<unknown>(null);
  useEffect(() => {
    const { showToast } = useAppStore.getState();
    const receive = (board: unknown) => {
      window.history.replaceState(null, '', '/'); // 새로고침해도 이후 수정한 내용이 유지되게
      if (isBoardEmpty(pickBoard(useAppStore.getState()))) applyShared(board);
      else setIncoming(board);
    };
    const sharePath = window.location.pathname.match(/^\/s\/([^/]*)\/?$/);
    const shareId = sharePath?.[1].match(/^[A-Za-z0-9]{4,16}$/)?.[0];
    if (sharePath && !shareId) {
      window.history.replaceState(null, '', '/');
      showToast('공유 링크 주소가 올바르지 않아요. 주소를 다시 확인해 주세요', 'error');
      return;
    }
    if (shareId) {
      showToast('공유된 조합표를 불러오고 있어요', 'loading');
      loadShortLink(shareId)
        .then((board) => {
          if (board) return receive(board);
          window.history.replaceState(null, '', '/');
          showToast('공유 링크를 찾을 수 없어요. 주소를 다시 확인해 주세요', 'error');
        })
        .catch((err) => {
          // 연결 문제일 때는 주소를 그대로 두어 새로고침으로 다시 시도할 수 있게
          console.error('Failed to load share:', err);
          showToast('공유된 조합표를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요', 'error');
        });
      return;
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

  // 직접 올린 배경 사진은 짧은 blob: 주소로 바꿔서 쓴다 (밝기 등을 바꿀 때마다 수 MB 문자열을 다시 넣지 않게)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    const dataUrl = background.imageUrl;
    if (!dataUrl?.startsWith('data:')) return setPhotoUrl(null);
    let objectUrl = '';
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => setPhotoUrl((objectUrl = URL.createObjectURL(blob))))
      .catch(() => setPhotoUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhotoUrl(null);
    };
  }, [background.imageUrl]);

  useEffect(() => {
    document.body.style.background = backgroundCss(photoUrl ? { ...background, imageUrl: photoUrl } : background);
    if (background.type === 'image' && background.imageFit !== 'repeat') document.body.style.backgroundAttachment = 'fixed';
    document.documentElement.style.setProperty('--page-edge', backgroundEdgeColor(background));
    // 저장된 조합표와 배경을 적용한 뒤에 보여준다 (빈 화면 → 내 조합표로 바뀌는 깜빡임 방지, layout.tsx)
    document.documentElement.dataset.ready = '';
  }, [background, photoUrl]);

  // 직접 올린 글꼴 적용 (FontFace API — 주소가 CSS로 해석되지 않음)
  useEffect(() => {
    const url = fontSettings.customFontUrl;
    if (fontSettings.fontFamily !== 'Custom' || !url) return;
    const ext = url.match(/^data:font\/(\w+)/)?.[1] ?? url.split('?')[0].split('.').pop();
    const format = { woff2: 'woff2', woff: 'woff', otf: 'opentype' }[ext ?? ''] ?? 'truetype';
    const face = new FontFace('CustomFont', `url(${JSON.stringify(url)}) format("${format}")`, { display: 'swap' });
    face
      .load()
      .then(() => document.fonts.add(face))
      .catch((err) => console.error('Failed to load custom font:', err));
    return () => {
      document.fonts.delete(face);
    };
  }, [fontSettings.fontFamily, fontSettings.customFontUrl]);

  return (
    <>
      <Toolbar />
      <main id="capture-area" className={'board-wrap px-3 py-4 sm:px-8 sm:py-8 lg:p-16' + (settingsOpen ? ' panel-open' : '')}>
        <div className="board" style={{ ['--gap' as string]: gap }}>
          <Header />
          <div className="board-grid">
            {Array.from({ length: arenaCount }, (_, i) => (
              <ComboBlock key={i} arenaIndex={i} />
            ))}
          </div>
        </div>
      </main>
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
      <Toast />
    </>
  );
}
