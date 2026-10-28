'use client';

import { useEffect, useRef, useState } from 'react';
import { isReturningVisitor, pickBoard, useAppStore } from '@/store/useAppStore';
import { markUpdatesSeen, unseenCount } from '@/lib/updates';
import { track } from '@/lib/analytics';
import Button from './ui/Button';
import { BellIcon, CookieLogo, DownloadIcon, LinkIcon, SettingsIcon, UndoIcon } from './ui/icons';
import SettingsPanel from './SettingsPanel';
import ShareDialog from './ShareDialog';
import UpdatesDialog from './UpdatesDialog';

/** 화면 상단 고정 도구 막대 (이미지 저장 대상이 아님) */
// 공유 링크로 들어왔는지는 처음 주소로 판단한다 (공유 조합표를 불러오면 주소가 '/'로 바뀜)
const openedFromShare = typeof window !== 'undefined' && (/^\/s\//.test(window.location.pathname) || window.location.search.includes('data='));

function undo() {
  const { canUndo, undo, showToast } = useAppStore.getState();
  if (!canUndo) return;
  undo();
  showToast('되돌렸어요');
  track('undo');
}

export default function Toolbar() {
  const showToast = useAppStore((s) => s.showToast);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const canUndo = useAppStore((s) => s.canUndo);
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
  const updates = useAppStore((s) => s.gameData?.updates);
  useEffect(() => {
    if (!updates?.length) return;
    const count = unseenCount(updates);
    if (count === -1 && !isReturningVisitor) return markUpdatesSeen(updates);
    const unseen = count === -1 ? 1 : count;
    setNewUpdates(unseen);
    // 공유 링크로 들어온 경우는 공유된 조합표가 먼저: 소식은 종 표시로만 알린다 (창이 두 개 겹치지 않게)
    if (unseen > 0 && !openedFromShare && !document.querySelector('dialog:modal')) setUpdatesOpen(true);
  }, [updates]);

  // Ctrl+Z (맥은 Cmd+Z). 글자를 입력하는 칸에서는 그 칸의 입력 취소가 먼저. 한글 자판이어도 같은 키로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyZ' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'color', 'button'].includes((el as HTMLInputElement).type));
      if (typing) return;
      e.preventDefault();
      undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const closeUpdates = () => {
    if (updates) markUpdatesSeen(updates);
    setUpdatesOpen(false);
    setNewUpdates(0);
  };

  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveImage = async () => {
    const area = document.getElementById('capture-area');
    if (!area || saving) return;
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
      saveButtonRef.current?.focus(); // 저장 중 오버레이가 사라진 뒤 포커스를 버튼으로 돌려놓음
      setSaving(false);
    }
  };

  // 버튼 글자는 globals.css의 .tb-label에서 em 기준으로 켠다 (브라우저 글자를 키우면 좁은 화면처럼 아이콘만)
  return (
    <>
      <header className="sticky top-0 z-40 px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-1 rounded-xl border border-white/70 bg-surface-cream/85 pl-2 pr-1.5 shadow-e2 backdrop-blur-md sm:gap-2 sm:pl-3">
          <h1 className="mr-auto flex min-w-0 items-center gap-2">
            <span className="shrink-0">
              <CookieLogo />
            </span>
            {/* 좁은 화면에서는 버튼 자리를 위해 로고만 (이름은 화면 읽기 프로그램에) */}
            <span className="truncate text-title-md text-ink max-[439px]:sr-only">쿠키런 조합표</span>
          </h1>
          <Button variant="ghost" onClick={() => setUpdatesOpen(true)} aria-label={newUpdates ? '업데이트 (새 소식 있음)' : '업데이트'} className="w-touch px-0">
            <BellIcon />
            {newUpdates > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-cream" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" onClick={undo} aria-disabled={!canUndo} aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" className="w-touch px-0">
            <UndoIcon />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="설정"
            aria-expanded={settingsOpen}
            className={'w-touch px-0 tb-btn' + (settingsOpen ? ' bg-surface-sunken !text-ink' : '')}
          >
            <SettingsIcon />
            <span className="tb-label hidden">설정</span>
          </Button>
          <Button
            ref={saveButtonRef}
            variant="secondary"
            onClick={saveImage}
            aria-disabled={saving}
            aria-label="이미지 저장" className="w-touch px-0 tb-btn">
            <DownloadIcon />
            <span className="tb-label hidden">{saving ? '저장 중…' : '이미지 저장'}</span>
          </Button>
          <Button variant="primary" onClick={() => setShareOpen(true)} aria-label="링크 공유" className="w-touch px-0 tb-btn">
            <LinkIcon />
            <span className="tb-label hidden">링크 공유</span>
          </Button>
        </div>
      </header>

      {saving && (
        <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm [animation:fade-in_.2s_ease-out]">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl bg-surface p-6 text-center shadow-e3 [animation:scale-in_.22s_cubic-bezier(.16,1,.3,1)]">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary-ink" aria-hidden="true" />
            <p className="text-title-md">이미지를 만드는 중…</p>
          </div>
        </div>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      {updatesOpen && <UpdatesDialog updates={updates ?? []} newCount={newUpdates} onClose={closeUpdates} />}
    </>
  );
}
