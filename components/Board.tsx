'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { backgroundCss, backgroundEdgeColor } from '@/lib/board';
import Header from './Header';
import ComboBlock from './ComboBlock';
import { ViewOnlyContext } from './ViewOnly';

/**
 * 조합표 본문(시즌 + 아레나)과 페이지 배경, 직접 올린 글꼴. 편집 화면과 보기 전용 화면이 함께 쓴다.
 * 이미지 저장은 이 영역(#capture-area)을 그린다.
 */
export default function Board({ viewOnly = false, className }: { viewOnly?: boolean; className?: string }) {
  const arenaCount = useAppStore((s) => s.arenas.length);
  const background = useAppStore((s) => s.background);
  const fontSettings = useAppStore((s) => s.fontSettings);
  const gap = useAppStore((s) => s.boardStyle.gap);

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
    <ViewOnlyContext.Provider value={viewOnly}>
      <main id="capture-area" className={clsx('board-wrap px-3 py-4 sm:px-8 sm:py-8 lg:p-16', viewOnly && 'view-only', className)}>
        <div className="board" style={{ ['--gap' as string]: gap }}>
          <Header />
          <div className="board-grid">
            {Array.from({ length: arenaCount }, (_, i) => (
              <ComboBlock key={i} arenaIndex={i} />
            ))}
          </div>
        </div>
      </main>
    </ViewOnlyContext.Provider>
  );
}
