import clsx from 'clsx';
import { ReactNode, useId, useState } from 'react';

/** 설정 패널 공통 부품: 항목 묶음, 켜고 끄는 스위치, 몇 가지 중 하나 고르기, 슬라이더 */
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

/** 몇 가지 중 하나 고르기 (라디오 버튼을 붙여 놓은 모양) */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-caption font-semibold text-ink-muted">{label}</legend>
      <div className="grid gap-1 rounded-md bg-surface-sunken p-1" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(5.5em, 100%), 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className={clsx(
              'relative flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-1 text-caption font-semibold tabular-nums transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary-ink',
              value === v ? 'bg-surface text-ink shadow-e1 ring-1 ring-ink/40' : 'text-ink-muted hover:text-ink'
            )}
          >
            <input type="radio" className="sr-only" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 슬라이더 + 숫자 직접 입력 */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const shown = String(Math.round(value * 100) / 100);
  // 숫자 칸은 입력하는 동안에는 그대로 두고, 칸을 벗어나거나 Enter를 누를 때 범위에 맞춰 적용
  const [text, setText] = useState(shown);
  const [prev, setPrev] = useState(shown);
  if (shown !== prev) {
    setPrev(shown);
    setText(shown);
  }
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || Number.isNaN(n)) return setText(shown);
    // 슬라이더처럼 칸 단위(step)에 맞춘다
    const next = Math.min(max, Math.max(min, Number((min + Math.round((n - min) / step) * step).toFixed(4))));
    onChange(next);
    setText(String(Math.round(next * 100) / 100));
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-caption font-semibold text-ink-muted">
          {label}
        </label>
        <span className="flex items-center rounded-md border border-line bg-surface pr-2 focus-within:border-primary-ink">
          <input
            type="number"
            value={text}
            min={min}
            max={max}
            step={step}
            aria-label={`${label} 값`}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="h-8 w-14 bg-transparent pl-2 text-right text-caption tabular-nums text-ink focus:outline-none"
          />
          <span className="text-caption text-ink-subtle">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full accent-primary-ink"
      />
    </div>
  );
}
