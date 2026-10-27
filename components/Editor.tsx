'use client';

import { useEffect } from 'react';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { useAppStore } from '@/store/useAppStore';
import { loadShortLink } from '@/lib/share';
import { backgroundCss, backgroundEdgeColor } from '@/lib/board';
import Toolbar from './Toolbar';
import Header from './Header';
import ComboBlock from './ComboBlock';
import ImageSelectModal from './ImageSelectModal';
import Toast from './Toast';

/** 조합표 편집 화면. shareId가 있으면 짧은 링크(/s/[id])로 공유된 조합표를 불러온다. */
export default function Editor({ shareId }: { shareId?: string }) {
  const arenaCount = useAppStore((s) => s.arenas.length);
  const background = useAppStore((s) => s.background);
  const fontSettings = useAppStore((s) => s.fontSettings);
  const picker = useAppStore((s) => s.picker);
  const closePicker = useAppStore((s) => s.closePicker);
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  // 게임 데이터 (빌드 때 생성된 JSON)
  useEffect(() => {
    fetch('/data/gameData.json')
      .then((res) => res.json())
      .then((data) => useAppStore.getState().setGameData(data))
      .catch((err) => console.error('Failed to load game data:', err));
  }, []);

  // 공유된 조합표 불러오기: 짧은 링크 또는 예전 방식의 ?data= 긴 링크
  useEffect(() => {
    const { loadBoard, showToast } = useAppStore.getState();
    if (shareId) {
      loadShortLink(shareId)
        .then((board) => {
          if (!board) throw new Error('not found');
          loadBoard(board);
          showToast('공유된 조합표를 불러왔어요');
          // 불러온 뒤에는 기본 주소로 바꿔, 새로고침해도 이후 수정한 내용이 유지되게 한다
          window.history.replaceState(null, '', '/');
        })
        .catch((err) => {
          console.error('Failed to load share:', err);
          showToast('공유 링크를 찾을 수 없어요', 'error');
        });
      return;
    }
    const data = new URLSearchParams(window.location.search).get('data');
    if (!data) return;
    try {
      const json = decompressFromEncodedURIComponent(data);
      if (json) loadBoard(JSON.parse(json));
      window.history.replaceState(null, '', '/');
    } catch (err) {
      console.error('Failed to load state from URL:', err);
    }
  }, [shareId]);

  useEffect(() => {
    document.body.style.background = backgroundCss(background);
    if (background.type === 'image' && background.imageFit !== 'repeat') document.body.style.backgroundAttachment = 'fixed';
    document.documentElement.style.setProperty('--page-edge', backgroundEdgeColor(background));
  }, [background]);

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
        <div className="board">
          <Header />
          <div className="board-grid">
            {Array.from({ length: arenaCount }, (_, i) => (
              <ComboBlock key={i} arenaIndex={i} />
            ))}
          </div>
        </div>
      </main>
      {picker && <ImageSelectModal request={picker} onClose={closePicker} />}
      <Toast />
    </>
  );
}
