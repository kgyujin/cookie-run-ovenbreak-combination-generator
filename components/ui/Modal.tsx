'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { CloseIcon } from './icons';
import { focusInitial, useScrollArea } from './useScrollArea';

/**
 * 네이티브 <dialog> 기반 창. 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저가 처리하고,
 * 닫히면 원래 포커스로 돌아간다. 640px 미만에서는 아래에서 올라오는 시트 모양 (globals.css .modal).
 * drawer: 화면 오른쪽 서랍 (뒤의 조합표를 보면서 설정을 바꿀 때)
 */
export default function Modal({
  title,
  onClose,
  children,
  footer,
  className,
  drawer = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const pressedOutside = useRef(false);
  const releasedOutside = useRef(false);
  const scrollArea = useScrollArea(bodyRef);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    focusInitial(dialog);
    return () => previous?.focus?.();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return; // 안쪽 파일 선택 창을 닫을 때 올라오는 cancel은 무시
        e.preventDefault();
        onClose();
      }}
      // 바깥(배경)을 눌렀다 뗐을 때만 닫는다 (입력칸에서 글자를 드래그해 밖에서 놓은 경우는 닫지 않음)
      onPointerDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onPointerUp={(e) => (releasedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOutside.current && releasedOutside.current) onClose();
      }}
      className={'modal overflow-hidden bg-surface p-0 text-ink shadow-e3 ' + (drawer ? 'modal-drawer ' : '') + (className ?? '')}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="shrink-0 border-b border-line bg-surface-cream">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2 py-2 pl-5 pr-2 sm:py-3">
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
        </div>
        <div ref={bodyRef} {...scrollArea} aria-labelledby={titleId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-offset-[-3px]">
          {children}
        </div>
        {footer && <div className="flex shrink-0 flex-wrap gap-2 border-t border-line bg-surface-cream px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </dialog>
  );
}
