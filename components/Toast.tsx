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

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      {visible && toast && (
        <p key={toast.id} className="toast flex items-center gap-2 rounded-full bg-ink py-3 pl-3 pr-5 text-label-md text-white shadow-e3">
          <span className={'grid h-6 w-6 place-items-center rounded-full text-white ' + (toast.tone === 'error' ? 'bg-danger' : 'bg-primary')} aria-hidden="true">
            {toast.tone === 'error' ? <span className="text-sm font-bold">!</span> : <CheckIcon />}
          </span>
          {toast.message}
        </p>
      )}
    </div>
  );
}
