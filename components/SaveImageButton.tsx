'use client';

import { useEffect, useRef, useState } from 'react';
import { pickBoard, useAppStore } from '@/store/useAppStore';
import { track } from '@/lib/analytics';
import Button from './ui/Button';
import { DownloadIcon } from './ui/icons';

/** 도구 막대의 '이미지 저장' 버튼 (편집 화면, 보기 전용 화면 공통). 저장하는 동안 화면을 가리고 진행 중임을 보여 준다 */
export default function SaveImageButton() {
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 이미지 저장용 라이브러리를 한가할 때 미리 받아 두어, 처음 저장할 때 기다리지 않게 한다
  useEffect(() => {
    const load = () => import('@/lib/exportImage');
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 5000 });
    else setTimeout(load, 3000);
  }, []);

  const saveImage = async () => {
    const area = document.getElementById('capture-area');
    if (!area || saving) return;
    const { showToast } = useAppStore.getState();
    setSaving(true);
    try {
      const { exportBoardImage } = await import('@/lib/exportImage'); // html2canvas는 저장할 때만 불러온다
      const { background, boardStyle, fontSettings } = pickBoard(useAppStore.getState());
      const customFont = fontSettings.fontFamily === 'Custom' ? fontSettings.customFontUrl : undefined;
      await exportBoardImage(area, background, boardStyle.exportPadding, customFont);
      showToast('이미지를 저장했어요');
      track('save_image');
    } catch (e) {
      console.error('Failed to save image:', e);
      showToast('이미지 저장에 실패했어요. 다시 시도해 주세요', 'error');
    } finally {
      buttonRef.current?.focus(); // 저장 중 오버레이가 사라진 뒤 포커스를 버튼으로 돌려놓음
      setSaving(false);
    }
  };

  return (
    <>
      <Button ref={buttonRef} variant="secondary" onClick={saveImage} aria-disabled={saving} aria-label="이미지 저장" className="w-touch px-0 tb-btn">
        <DownloadIcon />
        <span className="tb-label hidden">{saving ? '저장 중…' : '이미지 저장'}</span>
      </Button>
      {saving && (
        <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm [animation:fade-in_.2s_ease-out]">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl bg-surface p-6 text-center shadow-e3 [animation:scale-in_.22s_cubic-bezier(.16,1,.3,1)]">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary-ink" aria-hidden="true" />
            <p className="text-title-md">이미지를 만드는 중…</p>
          </div>
        </div>
      )}
    </>
  );
}
