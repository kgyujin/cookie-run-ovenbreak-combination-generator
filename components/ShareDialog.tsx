'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { pickBoard, useAppStore } from '@/store/useAppStore';
import { ShareMode, createLongLink, createShortLink, shareUrl } from '@/lib/share';
import { track } from '@/lib/analytics';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon, CopyIcon, ShareIcon } from './ui/icons';
import { Segmented } from './settings/controls';

/** 짧은 링크는 아이디 하나로 보기 전용과 편집 가능 주소를 만든다. 긴 링크(예비용)는 편집 가능 하나뿐 */
type Link = { status: 'short'; id: string } | { status: 'long'; url: string; dropsUploads: boolean };
type State = { status: 'loading' } | Link;

const MODES: [ShareMode, string][] = [
  ['view', '보기 전용'],
  ['edit', '편집 가능'],
];
const MODE_HELP: Record<ShareMode, string> = {
  view: '받는 사람은 조합표를 보기만 해요. 번호를 누르면 걸어 둔 영상이 열려요.',
  edit: '받는 사람이 자기 화면에서 이 조합표를 고쳐 쓸 수 있어요. 내 조합표는 바뀌지 않아요.',
};

// 내용이 그대로면 같은 링크를 다시 쓴다 (열 때마다 DB에 새로 저장하지 않도록)
let lastShort: { key: string; id: string } | null = null;

/** 공유 링크를 만들어 보여주고 복사한다. 보기 전용(기본)과 편집 가능 중 고를 수 있고, 짧은 링크를 만들 수 없으면 예비용 긴 링크를 준다. */
export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [mode, setMode] = useState<ShareMode>('view');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = state.status === 'short' ? shareUrl(state.id, mode) : state.status === 'long' ? state.url : '';

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 브라우저가 자동 복사를 막은 경우: 주소를 선택해 두고 직접 복사하게 한다
      inputRef.current?.select();
    }
  };

  useEffect(() => {
    const board = pickBoard(useAppStore.getState());
    const key = JSON.stringify(board);
    let cancelled = false;
    (lastShort?.key === key ? Promise.resolve(lastShort.id) : createShortLink(board))
      .then((id): Link => {
        lastShort = { key, id };
        return { status: 'short', id };
      })
      .catch((e): Link => {
        console.error('Failed to create short link:', e);
        // 긴 링크에는 직접 올린 파일을 담을 수 없다
        const dropsUploads = [board.background.imageUrl, board.fontSettings.customFontUrl].some((u) => u?.startsWith('data:'));
        return { status: 'long', url: createLongLink(board), dropsUploads };
      })
      .then((next) => {
        if (cancelled) return;
        setState(next);
        copy(next.status === 'short' ? shareUrl(next.id, 'view') : next.url); // 처음에는 기본(보기 전용) 링크를 복사해 둔다
        track('share_link', { link_type: next.status, share_mode: next.status === 'short' ? 'view' : 'edit' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 종류를 바꾸면 주소가 바뀌므로 다시 복사하게 한다
  const changeMode = (next: ShareMode) => {
    setMode(next);
    setCopied(false);
    track('share_mode', { share_mode: next });
  };

  return (
    <Modal title="링크 공유" onClose={onClose}>
      <div className="space-y-4 p-5">
        {state.status === 'loading' ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">링크를 만드는 중</span>
            <div className="skeleton h-touch rounded-md" aria-hidden="true" />
          </div>
        ) : (
          <>
            {state.status === 'short' && (
              <div className="space-y-2">
                <Segmented label="받는 사람이" value={mode} options={MODES} onChange={changeMode} />
                <p className="text-caption text-ink-muted">{MODE_HELP[mode]}</p>
              </div>
            )}
            <div>
              <label htmlFor="share-url" className="sr-only">
                {state.status === 'short' ? `${mode === 'view' ? '보기 전용' : '편집 가능'} 링크 주소` : '링크 주소'}
              </label>
              <div className="flex gap-2">
                <input id="share-url" ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} className="field min-w-0 flex-1" />
                <Button
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={() => copy(url)}
                  aria-label={copied ? '복사됨, 다시 복사' : '링크 복사'}
                  className={clsx('w-[92px]', copied && 'border-primary-ink text-primary-ink')}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? '복사됨' : '복사'}
                </Button>
              </div>
              <span role="status" className="sr-only">{copied ? '복사했어요' : ''}</span>
              {state.status === 'long' && (
                <p className="mt-3 rounded-md border border-primary-ink/20 bg-primary-soft p-3 text-caption text-ink">
                  짧은 링크를 만들지 못해 편집 가능한 긴 링크로 대신했어요. 보기 전용 링크는 지금 만들 수 없어요.{state.dropsUploads && ' 직접 올린 이미지와 글꼴은 빠져요.'}
                </p>
              )}
            </div>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button className="w-full" onClick={() => navigator.share({ url, title: '쿠키런 조합표' }).catch(() => {})}>
                <ShareIcon />
                다른 앱으로 공유
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
