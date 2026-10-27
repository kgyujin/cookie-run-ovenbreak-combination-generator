'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { fontFamilyOf, u } from '@/lib/board';
import Slot from './Slot';

const MAX_LINES = 3;

/** 조합표 상단: 시즌명(80%) + 시즌 요리·재료(20%) */
export default function Header() {
  const seasonName = useAppStore((s) => s.seasonName);
  const seasonDish = useAppStore((s) => s.seasonDish);
  const seasonIngredients = useAppStore((s) => s.seasonIngredients);
  const fontSettings = useAppStore((s) => s.fontSettings);
  const setSeasonName = useAppStore((s) => s.setSeasonName);
  const setSeasonDish = useAppStore((s) => s.setSeasonDish);
  const setSeasonIngredient = useAppStore((s) => s.setSeasonIngredient);
  const openPicker = useAppStore((s) => s.openPicker);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea 높이를 내용에 맞춤 (화면 크기가 바뀌면 줄바꿈도 바뀌므로 다시 계산)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement!);
    return () => observer.disconnect();
  }, [seasonName, fontSettings.fontSize, fontSettings.fontFamily]);

  const ingredientsEmpty = !seasonIngredients.some(Boolean);

  return (
    <div className="flex" style={{ height: u(400), marginBottom: u(16), gap: u(6) }}>
      {/* 시즌명 */}
      <div className={clsx('flex h-full w-[80%] items-center justify-center px-2', !seasonName && 'card-empty')}>
        <textarea
          ref={textareaRef}
          value={seasonName}
          rows={1}
          aria-label="시즌명 (최대 3줄)"
          onChange={(e) => {
            if (e.target.value.split('\n').length <= MAX_LINES) setSeasonName(e.target.value);
          }}
          placeholder="시즌명"
          className="title-input scrollbar-hide w-full resize-none overflow-hidden border-none bg-transparent p-0 placeholder:text-ink-subtle"
          style={{
            fontSize: u(fontSettings.fontSize),
            fontFamily: fontFamilyOf(fontSettings.fontFamily),
            textAlign: fontSettings.textAlign,
            color: fontSettings.fontColor || '#1f2937',
            fontWeight: fontSettings.fontWeight ?? 700,
            WebkitTextStroke: fontSettings.seasonStrokeWidth ? `${fontSettings.seasonStrokeWidth}px ${fontSettings.seasonStrokeColor}` : undefined,
            paintOrder: 'stroke fill',
            lineHeight: 1.2,
            maxHeight: `calc(${fontSettings.fontSize} * var(--u) * 1.2 * ${MAX_LINES})`,
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* 시즌 요리 + 재료 */}
      <div className="flex h-full w-[20%] flex-col" style={{ gap: u(4) }}>
        <div className={clsx('relative h-[55%]', !seasonDish && 'card-empty')} style={{ padding: u(2) }}>
          <Slot
            image={seasonDish}
            label="시즌 요리"
            labelSize={14}
            emptyClassName="slot-soft"
            onSelect={() => openPicker({ category: 'dishes', label: '시즌 요리', current: seasonDish, apply: setSeasonDish })}
            style={{ inset: u(2) }}
          />
        </div>
        <div className={clsx('grid h-[40%] grid-cols-3', ingredientsEmpty && 'card-empty')} style={{ gap: u(2), padding: u(2) }}>
          {([0, 1, 2] as const).map((i) => (
            <div key={i} className="relative h-full">
              <Slot
                image={seasonIngredients[i]}
                label={`재료 ${i + 1}`}
                emptyClassName="slot-soft"
                onSelect={() =>
                  openPicker({
                    category: 'ingredients',
                    label: `재료 ${i + 1}`,
                    current: seasonIngredients[i],
                    apply: (image) => setSeasonIngredient(i, image),
                  })
                }
                style={{ inset: 0 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
