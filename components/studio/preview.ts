import { RefObject, useEffect, useState } from 'react';

/** 이미지 다듬기 미리보기와 크게 보기가 함께 쓰는 확대, 바탕 */
export type Zoom = 'fit' | '1' | '2' | '4' | '8';
export type Backdrop = 'checker' | 'white' | 'black';

export const BACKDROPS: Record<Backdrop, string> = {
  checker: 'bg-[repeating-conic-gradient(#e7e2da_0_25%,#fff_0_50%)] bg-[length:16px_16px]',
  white: 'bg-white',
  black: 'bg-[#1c1917]',
};

/** 화면 1px에 그림 몇 px인지: 맞춤이면 칸(안쪽 여백 padding 빼고)에 꼭 맞게, 아니면 배율 그대로 */
export function useFitScale(area: RefObject<HTMLElement>, size: { width: number; height: number }, zoom: Zoom, padding: number) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBox({ width: el.clientWidth - padding, height: el.clientHeight - padding }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [area, padding]);
  return zoom === 'fit' ? Math.max(0.01, Math.min(box.width / size.width, box.height / size.height)) : Number(zoom);
}
