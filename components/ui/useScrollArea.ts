import { RefObject, useEffect, useState } from 'react';

/**
 * 스크롤 영역은 내용이 넘칠 때만 Tab으로 갈 수 있게 한다 (키보드로 스크롤하기 위함).
 * 넘치지 않으면 쓸데없는 Tab 정지가 생기지 않게 제외.
 */
export function useScrollArea(ref: RefObject<HTMLElement>) {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref]);
  return overflowing ? { tabIndex: 0, role: 'region' as const } : {};
}

/** 창이 열리면 [data-autofocus] 요소에 먼저 포커스 ("fine-pointer"는 마우스 환경에서만: 휴대폰에서 키보드가 바로 뜨지 않게) */
export function focusInitial(root: HTMLElement | null) {
  const target = root?.querySelector<HTMLElement>('[data-autofocus]');
  if (!target) return;
  if (target.dataset.autofocus === 'fine-pointer' && !window.matchMedia('(pointer: fine)').matches) return;
  target.focus();
}
