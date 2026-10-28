'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ARENA_HEIGHT } from '@/lib/board';
import { LayoutKey } from '@/types';

const LONG_PRESS = 500; // ms
const SLOP = 8; // 꾹 누르는 동안 이만큼(화면 px) 움직이면 스크롤이나 클릭으로 본다
const SNAP = 8; // 다른 칸과 이만큼(화면 px) 가까우면 줄을 맞춘다

/** 맞춘 줄 (보드 px, 아레나 왼쪽 위 기준). 끄는 동안 점선으로 보여 준다 */
export type Guide = { axis: 'x' | 'y'; at: number };

let dragging = false;

/**
 * 아레나 칸을 꾹 눌러(0.5초) 옮긴다. [data-move] 칸을 누르면 같은 이름의 칸이 함께 움직이고(12개 아레나 공통),
 * 다른 칸이나 아레나의 왼쪽, 가운데, 오른쪽(위, 가운데, 아래) 줄에 가까워지면 그 줄에 맞춘다.
 * 짧게 누르면 지금처럼 그 칸의 선택 창이 열린다.
 */
export function useMoveDrag() {
  const sectionRef = useRef<HTMLElement>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  // 꾹 누른 뒤 끄는 동안 화면이 스크롤되지 않게. 터치가 시작될 때 이미 있어야 막을 수 있어서 늘 걸어 둔다
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const block = (e: TouchEvent) => dragging && e.cancelable && e.preventDefault();
    section.addEventListener('touchmove', block, { passive: false });
    return () => section.removeEventListener('touchmove', block);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const item = target.closest<HTMLElement>('[data-move]');
    if (e.button !== 0 || !item || target.closest('.ratio-handle') || dragging) return;
    const section = e.currentTarget;
    const key = item.dataset.move as LayoutKey;
    const { pointerId: id, clientX: sx, clientY: sy } = e;
    const blockMenu = (ev: Event) => ev.preventDefault(); // 터치로 꾹 누르면 뜨는 메뉴
    const waitMove = (ev: PointerEvent) => ev.pointerId === id && Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP && stopWaiting();
    const stopWaiting = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', waitMove);
      window.removeEventListener('pointerup', stopWaiting);
      window.removeEventListener('pointercancel', stopWaiting);
      window.removeEventListener('contextmenu', blockMenu);
    };
    window.addEventListener('pointermove', waitMove);
    window.addEventListener('pointerup', stopWaiting);
    window.addEventListener('pointercancel', stopWaiting);
    window.addEventListener('contextmenu', blockMenu);
    const timer = setTimeout(() => {
      stopWaiting();
      startDrag(section, key, id, sx, sy);
    }, LONG_PRESS);
  };

  const startDrag = (section: HTMLElement, key: LayoutKey, id: number, sx: number, sy: number) => {
    dragging = true;
    // 창 밖에서 손을 떼도 끝나게
    try {
      section.setPointerCapture(id);
    } catch {}
    const area = section.getBoundingClientRect();
    const unit = area.height / ARENA_HEIGHT; // 화면 px / 보드 px
    const boxOf = (name: string) => {
      const rects = Array.from(section.querySelectorAll(`[data-move="${name}"]`), (el) => el.getBoundingClientRect()).filter((r) => r.width);
      if (!rects.length) return null;
      const [l, t] = [Math.min(...rects.map((r) => r.left)), Math.min(...rects.map((r) => r.top))];
      const [r, b] = [Math.max(...rects.map((r) => r.right)), Math.max(...rects.map((r) => r.bottom))];
      return { x: [l, (l + r) / 2, r], y: [t, (t + b) / 2, b] };
    };
    const box = boxOf(key);
    const names = new Set(Array.from(section.querySelectorAll<HTMLElement>('[data-move]'), (el) => el.dataset.move!));
    names.delete(key);
    const others = [{ x: [area.left, (area.left + area.right) / 2, area.right], y: [area.top, (area.top + area.bottom) / 2, area.bottom] }];
    names.forEach((name) => {
      const b = boxOf(name);
      if (b) others.push(b);
    });
    const [ox, oy] = useAppStore.getState().boardStyle.layout[key] ?? [0, 0];
    const parts = section.querySelectorAll<HTMLElement>(`[data-move="${key}"]`);
    parts.forEach((el) => (el.dataset.lifted = ''));
    document.documentElement.classList.add('is-moving');
    (document.activeElement as HTMLElement | null)?.blur(); // 점수 칸을 꾹 누른 경우 글자 선택 대신 옮기기
    window.getSelection()?.removeAllRanges();
    navigator.vibrate?.(10);

    // 한 방향(가로 또는 세로)에서 가장 가까운 줄에 맞춘다
    const snap = (axis: 'x' | 'y', d: number) => {
      if (!box) return { d };
      let best: { diff: number; at: number } | null = null;
      for (const other of others)
        for (const line of other[axis])
          for (const edge of box[axis]) {
            const diff = line - (edge + d);
            if (Math.abs(diff) <= SNAP && (!best || Math.abs(diff) < Math.abs(best.diff))) best = { diff, at: line };
          }
      return best ? { d: d + best.diff, at: best.at } : { d };
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const x = snap('x', ev.clientX - sx);
      const y = snap('y', ev.clientY - sy);
      const round = (v: number) => Math.round(v * 10) / 10;
      useAppStore.getState().setLayout(key, [round(ox + x.d / unit), round(oy + y.d / unit)]);
      const lines: Guide[] = [];
      if (x.at !== undefined) lines.push({ axis: 'x', at: (x.at - area.left) / unit });
      if (y.at !== undefined) lines.push({ axis: 'y', at: (y.at - area.top) / unit });
      setGuides(lines);
    };
    // 놓을 때 이어지는 클릭(선택 창 열기)은 막는다
    const swallowClick = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      dragging = false;
      parts.forEach((el) => delete el.dataset.lifted);
      document.documentElement.classList.remove('is-moving');
      setGuides([]);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.addEventListener('click', swallowClick, true);
      setTimeout(() => {
        window.removeEventListener('click', swallowClick, true);
        window.removeEventListener('contextmenu', swallowClick);
      }, 400);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('contextmenu', swallowClick);
  };

  return { sectionRef, guides, onPointerDown };
}
