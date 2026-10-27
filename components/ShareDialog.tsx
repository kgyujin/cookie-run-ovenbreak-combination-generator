'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { pickBoard, useAppStore } from '@/store/useAppStore';
import { createLongLink, createShortLink } from '@/lib/share';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon, CopyIcon, ShareIcon } from './ui/icons';

type State = { status: 'loading' } | { status: 'done'; url: string; fallback: boolean };

// 내용이 그대로면 같은 링크를 다시 쓴다 (열 때마다 DB에 새로 저장하지 않도록)
let lastShort: { key: string; url: string } | null = null;

/** 공유 링크를 만들어 보여주고 복사한다. 짧은 링크를 만들 수 없으면 예비용 긴 링크를 준다. */
export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    (lastShort?.key === key ? Promise.resolve(lastShort.url) : createShortLink(board))
      .then((url) => {
        lastShort = { key, url };
        return { url, fallback: false };
      })
      .catch((e) => {
        console.error('Failed to create short link:', e);
        return { url: createLongLink(board), fallback: true };
      })
      .then(({ url, fallback }) => {
        if (cancelled) return;
        setState({ status: 'done', url, fallback });
        copy(url);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            <div>
              <label htmlFor="share-url" className="sr-only">
                링크 주소
              </label>
              <div className="flex gap-2">
                <input
                  id="share-url"
                  ref={inputRef}
                  readOnly
                  value={state.url}
                  onFocus={(e) => e.target.select()}
                  className="field min-w-0 flex-1"
                />
                <Button
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={() => copy(state.url)}
                  aria-label={copied ? '복사됨, 다시 복사' : '링크 복사'}
                  className={clsx('w-[92px]', copied && 'border-primary text-primary')}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? '복사됨' : '복사'}
                </Button>
              </div>
              <span role="status" className="sr-only">{copied ? '복사했어요' : ''}</span>
              {state.fallback && (
                <p className="mt-3 rounded-md border border-primary/20 bg-primary-soft p-3 text-caption text-ink">
                  짧은 링크를 만들지 못해 긴 링크로 대신했어요. 직접 올린 이미지·글꼴은 빠져요.
                </p>
              )}
            </div>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button className="w-full" onClick={() => navigator.share({ url: state.url, title: '쿠키런 조합표' }).catch(() => {})}>
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
