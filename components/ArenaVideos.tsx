'use client';

import { CSSProperties, ReactNode, useState } from 'react';
import { track } from '@/lib/analytics';
import { YoutubeLink } from '@/types';
import Modal from './ui/Modal';
import { PlayIcon } from './ui/icons';

const videoName = (link: YoutubeLink, i: number) => link.title || `영상 ${i + 1}`;

/**
 * 보기 전용 화면의 아레나 번호. 영상이 있으면 눌러서 연다.
 * 1개면 바로 새 탭으로, 여러 개면 영상 목록 창에서 골라서 연다. 영상이 없으면 번호만 보인다.
 */
export default function ArenaVideos({ n, links, className, style, children }: { n: number; links: YoutubeLink[]; className: string; style: CSSProperties; children: ReactNode }) {
  const [listOpen, setListOpen] = useState(false);
  const common = { className, style, 'data-move': 'number' };

  if (!links.length) return <div {...common}>{children}</div>;

  if (links.length === 1) {
    return (
      <a href={links[0].url} target="_blank" rel="noopener noreferrer" aria-label={`${n}번 아레나 영상 열기: ${videoName(links[0], 0)}`} title="영상 열기" onClick={() => track('open_video')} {...common}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`${n}번 아레나 영상 ${links.length}개 보기`} title={`영상 ${links.length}개`} onClick={() => setListOpen(true)} {...common}>
        {children}
      </button>
      {listOpen && (
        <Modal title={`${n}번 아레나 영상`} onClose={() => setListOpen(false)}>
          <ul className="space-y-2 p-5">
            {links.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('open_video')}
                  className="flex min-h-touch items-center gap-3 rounded-lg border border-line px-4 py-2 text-label-md text-ink transition-colors hover:border-primary-ink hover:bg-surface-sunken"
                >
                  <span className="grid h-6 w-8 shrink-0 place-items-center rounded-md bg-[#ff0000] text-white" aria-hidden="true">
                    <PlayIcon />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{videoName(link, i)}</span>
                  <span className="sr-only">(새 탭에서 열림)</span>
                </a>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
