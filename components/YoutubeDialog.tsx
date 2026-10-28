'use client';

import { FormEvent, useState } from 'react';
import { safeYoutubeUrl, useAppStore } from '@/store/useAppStore';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { PlayIcon } from './ui/icons';

/** 'youtube.com/...'처럼 앞부분을 빼고 붙여 넣거나 http:// 로 시작해도 https 주소로 맞춘다 */
const normalize = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:/i, 'https:') : `https://${trimmed}`;
};

/** 유튜브 주소에서 영상 ID 추출 (watch?v=, youtu.be/, shorts/, live/, embed/) */
function youtubeId(url: string) {
  try {
    const u = new URL(normalize(url));
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname !== 'youtube.com' && !u.hostname.endsWith('.youtube.com')) return null;
    return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default function YoutubeDialog({ arenaIndex, onClose }: { arenaIndex: number; onClose: () => void }) {
  const saved = useAppStore((s) => s.arenas[arenaIndex].youtubeUrl);
  const setArenaYoutubeUrl = useAppStore((s) => s.setArenaYoutubeUrl);
  const [url, setUrl] = useState(saved ?? '');
  const [error, setError] = useState(false);
  const videoId = youtubeId(url);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const valid = safeYoutubeUrl(normalize(url));
    if (url.trim() && !valid) return setError(true);
    setArenaYoutubeUrl(arenaIndex, valid || null);
    onClose();
  };

  return (
    <Modal
      title={`${arenaIndex + 1}번 유튜브 링크`}
      onClose={onClose}
      // 버튼은 창 아래에 고정: 미리보기가 커도(가로 휴대폰) 저장 버튼이 화면 밖으로 밀리지 않게
      footer={
        <>
          {saved && (
            <a href={saved} target="_blank" rel="noopener noreferrer" className="btn-link">
              <PlayIcon /> 영상 열기
            </a>
          )}
          {saved && (
            <Button
              variant="ghost"
              onClick={() => {
                setArenaYoutubeUrl(arenaIndex, null);
                onClose();
              }}
            >
              링크 삭제
            </Button>
          )}
          <Button type="submit" form="youtube-form" variant="primary" className="ml-auto">
            저장
          </Button>
        </>
      }
    >
      <form id="youtube-form" onSubmit={save} className="space-y-4 p-5">
        <div>
          <label htmlFor="youtube-url" className="mb-1.5 block text-label-md">
            영상 주소
          </label>
          <input
            id="youtube-url"
            type="text"
            inputMode="url"
            data-autofocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(false);
            }}
            placeholder="https://youtu.be/..."
            aria-invalid={error}
            aria-describedby={error ? 'youtube-url-help' : undefined}
            className="field"
          />
          {error && (
            <p id="youtube-url-help" className="mt-1.5 text-caption font-semibold text-danger">
              유튜브 영상 주소를 입력해 주세요.
            </p>
          )}
        </div>
        {videoId && (
          <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-sunken [animation:scale-in_.22s_cubic-bezier(.16,1,.3,1)]">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="영상 미리보기"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
            />
            <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <span className="grid h-12 w-16 place-items-center rounded-xl bg-[#ff0000] text-white shadow-e2">
                <PlayIcon />
              </span>
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}
