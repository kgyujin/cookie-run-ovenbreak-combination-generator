'use client';

import { useEffect, useState } from 'react';
import { isReturningVisitor, pickBoard, useAppStore } from '@/store/useAppStore';
import { markUpdatesSeen, unseenCount } from '@/lib/updates';
import Button from './ui/Button';
import { BellIcon, CookieLogo, DownloadIcon, LinkIcon, SettingsIcon } from './ui/icons';
import SettingsPanel from './SettingsPanel';
import ShareDialog from './ShareDialog';
import UpdatesDialog from './UpdatesDialog';

/** 화면 상단 고정 도구 막대 (이미지 저장 대상이 아님) */
export default function Toolbar() {
  const showToast = useAppStore((s) => s.showToast);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUpdates, setNewUpdates] = useState(0);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  // 이미지 저장용 라이브러리를 한가할 때 미리 받아 두어, 처음 저장할 때 기다리지 않게 한다
  useEffect(() => {
    const load = () => import('@/lib/exportImage');
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 5000 });
    else setTimeout(load, 3000);
  }, []);

  // 확인하지 않은 업데이트가 있으면 바로 보여준다 (처음 온 사람은 확인한 것으로 처리)
  useEffect(() => {
    const count = unseenCount();
    if (count === -1 && !isReturningVisitor) return markUpdatesSeen();
    const unseen = count === -1 ? 1 : count;
    setNewUpdates(unseen);
    if (unseen > 0) setUpdatesOpen(true);
  }, []);

  const closeUpdates = () => {
    markUpdatesSeen();
    setUpdatesOpen(false);
    setNewUpdates(0);
  };

  const saveImage = async () => {
    const area = document.getElementById('capture-area');
    if (!area || saving) return;
    setSaving(true);
    try {
      const { exportBoardImage } = await import('@/lib/exportImage'); // html2canvas는 저장할 때만 불러온다
      await exportBoardImage(area, pickBoard(useAppStore.getState()).background);
      showToast('이미지를 저장했어요');
    } catch (e) {
      console.error('Failed to save image:', e);
      showToast('이미지 저장에 실패했어요. 다시 시도해 주세요', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-1 rounded-xl border border-white/70 bg-surface-cream/85 pl-2 pr-1.5 shadow-e2 backdrop-blur-md sm:gap-2 sm:pl-3">
          <h1 className="mr-auto flex min-w-0 items-center gap-2">
            <CookieLogo />
            <span className="truncate text-title-md text-ink">쿠키런 조합표</span>
          </h1>
          <Button variant="ghost" onClick={() => setUpdatesOpen(true)} aria-label={newUpdates ? '업데이트 (새 소식 있음)' : '업데이트'} className="w-touch px-0">
            <BellIcon />
            {newUpdates > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-cream" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="설정"
            aria-expanded={settingsOpen}
            className={'w-touch px-0 sm:w-auto sm:px-3' + (settingsOpen ? ' bg-surface-sunken !text-ink' : '')}
          >
            <SettingsIcon />
            <span className="hidden sm:inline">설정</span>
          </Button>
          <Button variant="secondary" onClick={saveImage} disabled={saving} aria-label="이미지로 저장" className="w-touch px-0 sm:w-auto sm:px-4">
            <DownloadIcon />
            <span className="hidden sm:inline">{saving ? '저장 중…' : '이미지 저장'}</span>
          </Button>
          <Button variant="primary" onClick={() => setShareOpen(true)} aria-label="공유 링크 만들기" className="w-touch px-0 sm:w-auto sm:px-4">
            <LinkIcon />
            <span className="hidden sm:inline">링크 공유</span>
          </Button>
        </div>
      </header>

      {saving && (
        <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm [animation:fade-in_.2s_ease-out]">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl bg-surface p-6 text-center shadow-e3 [animation:scale-in_.22s_cubic-bezier(.16,1,.3,1)]">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" aria-hidden="true" />
            <p className="text-title-md">이미지를 만드는 중…</p>
          </div>
        </div>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      {updatesOpen && <UpdatesDialog newCount={newUpdates} onClose={closeUpdates} />}
    </>
  );
}
