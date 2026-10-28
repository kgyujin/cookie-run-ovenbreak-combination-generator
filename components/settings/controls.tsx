import clsx from 'clsx';
import { ReactNode } from 'react';

/** 설정 패널 공통 부품: 항목 묶음과 켜고 끄는 스위치 */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`set-${id}`} aria-labelledby={`set-${id}-title`} className="scroll-mt-2 space-y-4 px-5 py-5">
      <h3 id={`set-${id}-title`} className="text-label-md text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-caption font-semibold text-ink-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors', checked ? 'border-primary-ink bg-primary-ink' : 'border-ink-subtle bg-surface-sunken')}
      >
        <span
          className={clsx('absolute top-[2.5px] h-5 w-5 rounded-full shadow-e1 transition-[left]', checked ? 'left-[22px] bg-white' : 'left-[2.5px] bg-ink-subtle')}
          aria-hidden="true"
        />
      </button>
    </label>
  );
}
