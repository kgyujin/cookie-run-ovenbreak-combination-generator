'use client';

import clsx from 'clsx';
import { PointerEvent, useEffect, useRef, useState } from 'react';
import type { Pixels } from '@/lib/studio/imageOps';
import Modal from '../ui/Modal';
import { Segmented } from '../settings/controls';
import { drawPixels } from './imageIO';
import { BACKDROPS, Backdrop, Zoom, useFitScale } from './preview';

type Mode = 'slide' | 'after' | 'before';

/**
 * 이미지 다듬기 '크게 보기': 왼쪽 그림(원본 등)과 결과를 화면 가득 겹쳐 놓고 가운데 막대를 밀어 비교한다.
 * 막대는 끌거나, 막대 아래 조절 칸을 방향키로 옮긴다. 두 그림은 결과 크기에 맞춰 같은 자리에 그린다.
 */
export default function CompareViewer({
  before,
  after,
  beforeLabel,
  initialBackdrop,
  onClose,
}: {
  before: Pixels;
  after: Pixels;
  beforeLabel: string;
  initialBackdrop: Backdrop;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('slide');
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [backdrop, setBackdrop] = useState(initialBackdrop);
  const [position, setPosition] = useState(50);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const size = { width: after.width, height: after.height };
  const scale = useFitScale(area, size, zoom, 32);
  const shown = { width: size.width * scale, height: size.height * scale };

  useEffect(() => {
    if (beforeRef.current) drawPixels(beforeRef.current, before);
    if (afterRef.current) drawPixels(afterRef.current, after);
  }, [before, after, mode]);

  // 막대 끌기: 누른 자리로 옮기고, 누른 채 움직이면 따라간다
  const dragging = useRef(false);
  const moveTo = (e: PointerEvent<HTMLElement>) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    setPosition(Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))));
  };

  const pixelated = zoom !== 'fit' && scale >= 2;
  const canvasClass = 'absolute inset-0 block h-full w-full';
  return (
    <Modal title="크게 보기" onClose={onClose} className="modal-full">
      <div className="flex h-full min-h-[70dvh] flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[22rem]">
            <Segmented
              label="보기"
              value={mode}
              options={[
                ['slide', '밀어서 비교'],
                ['after', '결과만'],
                ['before', `${beforeLabel}만`],
              ]}
              onChange={setMode}
            />
          </div>
          <div className="w-full sm:w-[20rem]">
            <Segmented
              label="확대"
              itemWidth="3.5em"
              value={zoom}
              options={[
                ['fit', '맞춤'],
                ['1', '100%'],
                ['2', '200%'],
                ['4', '400%'],
                ['8', '800%'],
              ]}
              onChange={setZoom}
            />
          </div>
          <div className="w-full sm:w-[13rem]">
            <Segmented
              label="바탕"
              itemWidth="3.5em"
              value={backdrop}
              options={[
                ['checker', '바둑판'],
                ['white', '흰색'],
                ['black', '검은색'],
              ]}
              onChange={setBackdrop}
            />
          </div>
        </div>
        <div ref={area} className={clsx('relative min-h-0 flex-1 overflow-auto rounded-lg border border-line', BACKDROPS[backdrop])}>
          <div className="grid min-h-full min-w-full place-items-center p-4" style={{ width: zoom === 'fit' ? undefined : shown.width + 32 }}>
            <div className="relative" style={{ ...shown, imageRendering: pixelated ? 'pixelated' : 'auto' }}>
              {mode !== 'after' && <canvas ref={beforeRef} role="img" aria-label={beforeLabel} className={canvasClass} />}
              {mode !== 'before' && (
                <canvas
                  ref={afterRef}
                  role="img"
                  aria-label="결과"
                  className={canvasClass}
                  style={mode === 'slide' ? { clipPath: `inset(0 0 0 ${position}%)` } : undefined}
                />
              )}
              {mode === 'slide' && (
                <>
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-caption font-semibold text-white">{beforeLabel}</span>
                  <span className="pointer-events-none absolute right-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-caption font-semibold text-white">결과</span>
                  {/* 막대: 넓게 잡히도록 투명한 띠 안에 선을 그린다 */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 -ml-3 flex w-6 cursor-ew-resize touch-none justify-center"
                    style={{ left: `${position}%` }}
                    onPointerDown={(e) => {
                      dragging.current = true;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => dragging.current && moveTo(e)}
                    onPointerUp={() => (dragging.current = false)}
                    onPointerCancel={() => (dragging.current = false)}
                  >
                    <span className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.45)]" />
                    <span className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-ink/40 bg-white text-caption font-bold text-ink shadow-e1">
                      ↔
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {mode === 'slide' && (
          <label className="flex items-center gap-3 text-caption font-semibold text-ink-muted">
            <span className="shrink-0">비교 위치</span>
            <input type="range" min={0} max={100} value={position} onChange={(e) => setPosition(Number(e.target.value))} className="w-full accent-primary-ink" />
          </label>
        )}
      </div>
    </Modal>
  );
}
