'use client';

import { useEffect, useState } from 'react';
import { isReturningVisitor, useAppStore } from '@/store/useAppStore';
import { markUpdatesSeen, unseenCount } from '@/lib/updates';
import { track } from '@/lib/analytics';
import Button from './ui/Button';
import { BellIcon, FolderIcon, LinkIcon, SettingsIcon, UndoIcon } from './ui/icons';
import TopBar from './TopBar';
import SaveImageButton from './SaveImageButton';
import SettingsPanel from './SettingsPanel';
import ShareDialog from './ShareDialog';
import LibraryDialog from './LibraryDialog';
import UpdatesDialog from './UpdatesDialog';

// 공유 링크로 들어왔는지는 처음 주소로 판단한다 (공유 조합표를 불러오면 주소가 '/'로 바뀜)
const openedFromShare = typeof window !== 'undefined' && (/^\/s\//.test(window.location.pathname) || window.location.search.includes('data='));

function undo() {
  const { canUndo, undo, showToast } = useAppStore.getState();
  if (!canUndo || !undo()) return;
  showToast('되돌렸어요');
  track('undo');
}

/** 편집 화면의 도구 막대 */
export default function Toolbar() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const canUndo = useAppStore((s) => s.canUndo);
  const [shareOpen, setShareOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newUpdates, setNewUpdates] = useState(0);
  const [updatesOpen, setUpdatesOpen] = useState(false);

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

  // Ctrl+Z (맥은 Cmd+Z). 글자를 입력하는 칸에서는 그 칸의 입력 취소가 먼저.
  // 한글 자판이어도 같은 자리의 키로, 다른 영문 자판(AZERTY 등)은 Z 글자로. 선택 창 같은 모달이 열려 있으면 뒤의 조합표는 그대로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isZ = /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() === 'z' : e.code === 'KeyZ';
      if (!isZ || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || document.querySelector('dialog:modal')) return;
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

  // 버튼 글자는 globals.css의 .tb-label에서 em 기준으로 켠다 (브라우저 글자를 키우면 좁은 화면처럼 아이콘만)
  return (
    <>
      <TopBar>
        <Button variant="ghost" onClick={() => setUpdatesOpen(true)} aria-label={newUpdates ? '업데이트 (새 소식 있음)' : '업데이트'} className="w-touch px-0">
          <BellIcon />
          {newUpdates > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface-cream" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" onClick={undo} aria-disabled={!canUndo} aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" className="w-touch px-0">
          <UndoIcon />
        </Button>
        <Button variant="ghost" onClick={() => setLibraryOpen(true)} aria-label="조합표 보관함" className="w-touch px-0 tb-btn">
          <FolderIcon />
          <span className="tb-label hidden">보관함</span>
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
        <SaveImageButton />
        <Button variant="primary" onClick={() => setShareOpen(true)} aria-label="링크 공유" className="w-touch px-0 tb-btn">
          <LinkIcon />
          <span className="tb-label hidden">링크 공유</span>
        </Button>
      </TopBar>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      {libraryOpen && <LibraryDialog onClose={() => setLibraryOpen(false)} />}
      {updatesOpen && <UpdatesDialog updates={updates ?? []} newCount={newUpdates} onClose={closeUpdates} />}
    </>
  );
}
