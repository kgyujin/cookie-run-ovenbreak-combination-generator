'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { CheckIcon } from './ui/icons';

/** 화면 하단 알림. 스크린리더에도 읽힌다. */
export default function Toast() {
  const toast = useAppStore((s) => s.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const message = visible && toast && (
    <p key={toast.id} className="toast flex items-center gap-2 rounded-full bg-ink py-3 pl-3 pr-5 text-label-md text-white shadow-e3">
      <span className={'grid h-6 w-6 place-items-center rounded-full ' + (toast.tone === 'error' ? 'bg-danger text-white' : 'bg-primary text-on-primary')} aria-hidden="true">
        {toast.tone === 'error' ? <span className="text-sm font-bold">!</span> : <CheckIcon />}
      </span>
      {toast.message}
    </p>
  );

  // 성공 알림은 조용히(polite), 오류는 바로(assertive) 읽히도록 영역을 나눈다
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      <div aria-live="polite">{toast?.tone !== 'error' && message}</div>
      <div aria-live="assertive">{toast?.tone === 'error' && message}</div>
    </div>
  );
}
