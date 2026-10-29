'use client';

import { useEffect, useState } from 'react';
import { hasBoardData, stopAutosave, useAppStore } from '@/store/useAppStore';
import { loadShortLink, shareIdIn } from '@/lib/share';
import { track } from '@/lib/analytics';
import TopBar from './TopBar';
import Board from './Board';
import SaveImageButton from './SaveImageButton';
import { WithToasts } from './Toast';
import { buttonClass } from './ui/Button';
import { PlusIcon } from './ui/icons';

type Status = 'loading' | 'ready' | 'invalid' | 'missing' | 'broken' | 'error';

const MESSAGES: Record<Exclude<Status, 'ready'>, string> = {
  loading: '공유된 조합표를 불러오고 있어요',
  invalid: '공유 링크 주소가 올바르지 않아요. 주소를 다시 확인해 주세요',
  missing: '공유 링크를 찾을 수 없어요. 주소를 다시 확인해 주세요',
  broken: '공유된 조합표를 열 수 없어요. 보낸 사람에게 링크를 다시 받아 주세요',
  error: '공유된 조합표를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요',
};

/**
 * 보기 전용 공유 화면 (/v/<id>). 공유된 조합표를 이미지 저장과 같은 모습으로 보여 주고, 번호를 누르면 영상을 연다.
 * 이 브라우저에 만들던 조합표에는 저장하지 않는다.
 */
export default function Viewer() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    stopAutosave();
    const { loadGameData, reset, loadBoard } = useAppStore.getState();
    loadGameData();
    const id = shareIdIn(window.location.pathname, 'view');
    if (!id) return setStatus('invalid');
    // 받기 전에 화면이 정리되면(개발 모드에서 효과를 두 번 돌릴 때 등) 늦게 온 결과는 버린다
    let active = true;
    loadShortLink(id)
      .then((board) => {
        if (!active) return;
        if (!board) return setStatus('missing');
        if (!hasBoardData(board)) return setStatus('broken');
        // 이 브라우저에 만들던 조합표 위에 덮지 않고 처음 상태에서 공유된 것만 채운다
        reset('all');
        loadBoard(board);
        setStatus('ready');
        track('open_view_link');
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load share:', err);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <WithToasts>
      <TopBar>
        {status === 'ready' && <SaveImageButton />}
        <a href="/" aria-label="나도 만들기" className={buttonClass('primary', 'w-touch px-0 tb-btn')}>
          <PlusIcon />
          <span className="tb-label hidden">나도 만들기</span>
        </a>
      </TopBar>
      {status === 'ready' ? (
        <Board viewOnly />
      ) : (
        <main className="grid min-h-[60dvh] place-items-center p-4">
          <div role={status === 'loading' ? 'status' : 'alert'} className="flex max-w-sm flex-col items-center gap-3 rounded-xl bg-surface/90 p-6 text-center shadow-e2">
            {status === 'loading' && <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-soft border-t-primary-ink" aria-hidden="true" />}
            <p className="text-body-md text-ink">{MESSAGES[status]}</p>
          </div>
        </main>
      )}
    </WithToasts>
  );
}
