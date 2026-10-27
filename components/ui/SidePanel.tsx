'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { CloseIcon } from './icons';

/**
 * 화면을 가리지 않는 설정 패널 (비모달 <dialog>).
 * 넓은 화면은 오른쪽, 좁은 화면은 아래쪽에 붙고, 뒤의 조합표를 보면서 바로 조작할 수 있다.
 */
export default function SidePanel({
  title,
  onClose,
  header,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.show();
    return () => previous?.focus?.();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
      }}
      className="panel bg-surface p-0 text-ink shadow-e3"
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-line bg-surface-cream">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2 py-1.5 pl-5 pr-2">
            <h2 id={titleId} className="text-title-md">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid h-touch w-touch place-items-center rounded-full text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink active:scale-95"
            >
              <CloseIcon />
            </button>
          </div>
          {header}
        </div>
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-offset-[-3px]">
          {children}
        </div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-line bg-surface-cream px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </dialog>
  );
}
