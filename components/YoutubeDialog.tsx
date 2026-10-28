'use client';

import { FormEvent, useState } from 'react';
import { MAX_YOUTUBE_LINKS, MAX_YOUTUBE_TITLE, safeYoutubeUrl, useAppStore } from '@/store/useAppStore';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CloseIcon, PlayIcon } from './ui/icons';

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

type Row = { key: number; title: string; url: string };
let nextKey = 0;
const emptyRow = (): Row => ({ key: nextKey++, title: '', url: '' });

/** 아레나 번호에 거는 유튜브 영상 목록 (최대 MAX_YOUTUBE_LINKS개, 이름은 비워도 됨) */
export default function YoutubeDialog({ arenaIndex, onClose }: { arenaIndex: number; onClose: () => void }) {
  const saved = useAppStore((s) => s.arenas[arenaIndex].youtubeLinks);
  const setArenaYoutubeLinks = useAppStore((s) => s.setArenaYoutubeLinks);
  const [rows, setRows] = useState<Row[]>(() => (saved.length ? saved.map((l) => ({ key: nextKey++, ...l })) : [emptyRow()]));
  const [invalid, setInvalid] = useState<number[]>([]);
  const full = rows.length >= MAX_YOUTUBE_LINKS;

  const focusUrl = (key: number) => requestAnimationFrame(() => document.getElementById(`yt-url-${key}`)?.focus());
  const update = (key: number, patch: Partial<Row>) => {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setInvalid(invalid.filter((k) => k !== key));
  };
  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    if (!next.length) next.push(emptyRow());
    setRows(next);
    focusUrl(next[Math.min(index, next.length - 1)].key);
  };
  const add = () => {
    if (full) return;
    const row = emptyRow();
    setRows([...rows, row]);
    focusUrl(row.key);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    // 이름만 쓰고 주소를 비웠거나, 유튜브 주소가 아니면 저장하지 않고 알려 준다
    const bad = rows.filter((r) => (r.url.trim() || r.title.trim()) && !safeYoutubeUrl(normalize(r.url))).map((r) => r.key);
    if (bad.length) {
      setInvalid(bad);
      return focusUrl(bad[0]);
    }
    const links = rows.filter((r) => r.url.trim()).map((r) => ({ title: r.title.trim(), url: safeYoutubeUrl(normalize(r.url)) }));
    setArenaYoutubeLinks(arenaIndex, links);
    onClose();
  };

  return (
    <Modal
      title={`${arenaIndex + 1}번 유튜브 영상`}
      onClose={onClose}
      // 버튼은 창 아래에 고정: 영상이 많아도 저장 버튼이 화면 밖으로 밀리지 않게
      footer={
        <>
          <Button onClick={add} aria-disabled={full}>
            영상 추가
          </Button>
          <Button type="submit" form="youtube-form" variant="primary" className="ml-auto">
            저장
          </Button>
        </>
      }
    >
      <form id="youtube-form" onSubmit={save} className="space-y-3 p-5">
        <ol className="space-y-3">
          {rows.map((row, i) => {
            const n = i + 1;
            const id = youtubeId(row.url);
            const url = safeYoutubeUrl(normalize(row.url));
            const bad = invalid.includes(row.key);
            return (
              <li key={row.key} className="flex gap-3 rounded-lg border border-line p-3">
                {/* 미리보기 (주소가 맞으면 영상 썸네일) */}
                <span className="relative mt-0.5 hidden aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-surface-sunken min-[420px]:block" aria-hidden="true">
                  {id && (
                    <img
                      src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                    />
                  )}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className={'grid h-6 w-8 place-items-center rounded-md text-white ' + (id ? 'bg-[#ff0000]' : 'bg-ink-subtle/60')}>
                      <PlayIcon />
                    </span>
                  </span>
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => update(row.key, { title: e.target.value })}
                    maxLength={MAX_YOUTUBE_TITLE}
                    placeholder={`영상 ${n} (이름은 선택)`}
                    aria-label={`영상 ${n} 이름`}
                    className="field"
                  />
                  <input
                    id={`yt-url-${row.key}`}
                    type="text"
                    inputMode="url"
                    data-autofocus={i === 0 ? true : undefined}
                    value={row.url}
                    onChange={(e) => update(row.key, { url: e.target.value })}
                    placeholder="https://youtu.be/..."
                    aria-label={`영상 ${n} 주소`}
                    aria-invalid={bad}
                    aria-describedby={bad ? `yt-help-${row.key}` : undefined}
                    className="field"
                  />
                  {bad && (
                    <p id={`yt-help-${row.key}`} className="text-caption font-semibold text-danger">
                      유튜브 영상 주소를 입력해 주세요.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`영상 ${n} 열기`} title="영상 열기" className="grid h-touch w-touch place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
                      <PlayIcon />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`영상 ${n} 지우기`}
                    title="지우기"
                    className="grid h-touch w-touch place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-danger"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-ink-subtle">영상은 {MAX_YOUTUBE_LINKS}개까지 걸 수 있어요. 주소를 비운 칸은 저장하지 않아요.</p>
      </form>
    </Modal>
  );
}
