'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ModalExtras } from './ui/Modal';
import { CheckIcon } from './ui/icons';

type ToastState = ReturnType<typeof useAppStore.getState>['toast'];

/** 성공 알림은 조용히(polite), 오류는 바로(assertive) 읽히도록 영역을 나눈다 */
function LiveRegions({ toast, children }: { toast: ToastState; children: ReactNode }) {
  return (
    <>
      <div aria-live="polite">{toast && toast.tone !== 'error' && children}</div>
      <div aria-live="assertive">{toast?.tone === 'error' && children}</div>
    </>
  );
}

/** 창(모달) 안에서 알림을 읽어 준다. 모달이 열려 있으면 창 밖의 알림 영역은 화면 읽기 프로그램에 닿지 않는다 */
function ToastAnnouncer() {
  const toast = useAppStore((s) => s.toast);
  return (
    <div className="sr-only">
      <LiveRegions toast={toast}>{toast?.message}</LiveRegions>
    </div>
  );
}

/** 화면 하단 알림. 스크린리더에도 읽힌다. */
export default function Toast() {
  const toast = useAppStore((s) => s.toast);
  const areaRef = useRef<HTMLDivElement>(null);

  // 창(showModal)은 맨 위 층(top layer)에 떠서 z-index로는 알림이 그 뒤에 가려진다.
  // 알림 영역을 popover로 맨 위 층에 두고, 새 알림마다 다시 올려 가장 최근 창보다 위에 보이게 한다 (지원하지 않는 브라우저는 그대로)
  useEffect(() => {
    const area = areaRef.current;
    if (!toast || !area?.showPopover) return;
    if (area.matches(':popover-open')) area.hidePopover();
    area.showPopover();
  }, [toast]);

  // 잠시 뒤 알림을 지운다 (불러오는 중 알림은 결과 알림으로 바뀔 때까지 계속 보인다)
  useEffect(() => {
    if (!toast || toast.tone === 'loading') return;
    const timer = setTimeout(useAppStore.getState().hideToast, 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const message = toast && (
    <p key={toast.id} className="toast flex items-center gap-2 rounded-full bg-ink py-3 pl-3 pr-5 text-label-md text-white shadow-e3">
      <span className={'grid h-6 w-6 place-items-center rounded-full ' + (toast.tone === 'error' ? 'bg-danger text-white' : 'bg-primary text-on-primary')} aria-hidden="true">
        {toast.tone === 'error' ? (
          <span className="text-sm font-bold">!</span>
        ) : toast.tone === 'loading' ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <CheckIcon />
        )}
      </span>
      {toast.message}
    </p>
  );

  // popover 기본 모양(width: fit-content)을 w-auto로 풀어야 화면 너비를 채워 가운데 정렬된다
  return (
    <div
      ref={areaRef}
      {...{ popover: 'manual' }}
      className="toast-area pointer-events-none fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] top-auto z-[60] m-0 flex w-auto justify-center overflow-visible border-0 bg-transparent p-0 px-4"
    >
      <LiveRegions toast={toast}>{message}</LiveRegions>
    </div>
  );
}

/** 화면(편집, 보기 전용)을 감싸 화면 아래 알림을 두고, 그 안에서 여는 창마다 알림을 읽어 주는 영역을 넣는다 */
export function WithToasts({ children }: { children: ReactNode }) {
  return (
    <ModalExtras.Provider value={<ToastAnnouncer />}>
      {children}
      <Toast />
    </ModalExtras.Provider>
  );
}
