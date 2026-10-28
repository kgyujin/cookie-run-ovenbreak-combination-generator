// 마지막 조작이 마우스·터치였는지 (창을 닫을 때 되돌린 포커스의 테두리를 보일지 정한다)
let byPointer = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (byPointer = true), true);
  window.addEventListener(
    'keydown',
    () => {
      byPointer = false;
      document.querySelectorAll('[data-quiet-focus]').forEach((el) => el.removeAttribute('data-quiet-focus'));
    },
    true
  );
}

/**
 * 창이 닫히면 열기 전의 요소로 포커스를 되돌린다 (키보드·화면 읽기 사용자가 제자리에서 이어가게).
 * 마우스·터치로 고른 경우에는 브라우저가 굵은 포커스 테두리를 그리므로, 키보드를 누르기 전까지 숨긴다.
 */
export function restoreFocus(el: HTMLElement | null) {
  if (!el?.focus) return;
  if (byPointer) {
    el.setAttribute('data-quiet-focus', '');
    el.addEventListener('blur', () => el.removeAttribute('data-quiet-focus'), { once: true });
  }
  el.focus();
}
