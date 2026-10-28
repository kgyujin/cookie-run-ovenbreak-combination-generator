'use client';

import clsx from 'clsx';
import { memo, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { cardStyle, fontFamilyOf, u } from '@/lib/board';
import Slot from './Slot';

const MAX_LINES = 3;

/** 시즌명 글자 단위 (1열 화면에서는 globals.css에서 칸 폭 비율만큼 줄어든다) */
const tu = (px: number) => `calc(${px} * var(--title-u))`;

/** 조합표 상단: 시즌명(80%) + 시즌 요리·재료(20%) */
export default memo(function Header() {
  const seasonName = useAppStore((s) => s.seasonName);
  const seasonDish = useAppStore((s) => s.seasonDish);
  const seasonIngredients = useAppStore((s) => s.seasonIngredients);
  const fontSettings = useAppStore((s) => s.fontSettings);
  const boardStyle = useAppStore((s) => s.boardStyle);
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
  }, [seasonName, fontSettings.fontSize, fontSettings.fontFamily, fontSettings.lineHeight, fontSettings.letterSpacing, fontSettings.fontWeight]);

  const ingredientsEmpty = !seasonIngredients.some(Boolean);
  // 1열 화면(휴대폰·태블릿)의 시즌명 칸은 저장 이미지(2열)보다 좁다. 글자 크기·간격도 같은 비율로 줄여
  // 줄바꿈이 저장 이미지와 똑같게 한다 (칸 폭 = 80% × (보드 폭 − 카드 안쪽 여백 − 간격) − 좌우 여백)
  const pad = boardStyle.card && boardStyle.headerCard ? 24 : 0;
  const narrowScale = (0.8 * (764 - pad - 6) - 16) / (0.8 * (1552 - pad - 6) - 16);

  return (
    <div
      className="flex"
      style={{
        height: u(400),
        marginBottom: u(16),
        gap: u(6),
        ...(boardStyle.card && boardStyle.headerCard ? { ...cardStyle(boardStyle), padding: u(12) } : {}),
      }}
    >
      {/* 시즌명 */}
      <div
        className={clsx('flex h-full w-[80%] justify-center', !seasonName && 'card-empty')}
        style={{ alignItems: { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[fontSettings.verticalAlign ?? 'middle'], paddingInline: u(8) }}
      >
        <textarea
          ref={textareaRef}
          value={seasonName}
          rows={1}
          maxLength={300}
          aria-label="시즌명 (최대 3줄)"
          onChange={(e) => {
            const field = e.target;
            let next = field.value.split('\n').slice(0, MAX_LINES).join('\n');
            // 자동 줄바꿈까지 쳐서 3줄을 넘으면 넘치는 만큼 새로 넣은 글자를 뒤에서부터 덜어낸다
            // (화면에서는 잘려 안 보이는데 저장 이미지에는 나오는 일이 없게, 길게 붙여 넣어도 들어갈 만큼은 들어가게)
            const max = parseFloat(getComputedStyle(field).maxHeight);
            let caret = field.selectionStart ?? next.length;
            let extra = next.length - seasonName.length;
            const typed = extra;
            while (extra > 0 && caret > 0 && field.scrollHeight > max + 2) {
              next = next.slice(0, caret - 1) + next.slice(caret);
              field.value = next;
              caret--;
              extra--;
            }
            if (next === seasonName) return;
            setSeasonName(next);
            if (typed > 1 && extra < typed) useAppStore.getState().showToast('시즌명은 3줄까지 들어가요. 넘치는 글자는 뺐어요', 'error');
          }}
          onKeyDown={(e) => {
            // 이미 3줄이면 줄바꿈을 막는다 (막지 않으면 다음 글자가 3번째 줄 끝에 붙음)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && seasonName.split('\n').length >= MAX_LINES) e.preventDefault();
          }}
          placeholder="시즌명"
          className="title-input scrollbar-hide w-full resize-none overflow-hidden border-none bg-transparent p-0 placeholder:text-ink-subtle"
          style={{
            ['--title-k' as string]: narrowScale,
            fontSize: tu(fontSettings.fontSize),
            fontFamily: fontFamilyOf(fontSettings.fontFamily),
            textAlign: fontSettings.textAlign,
            color: fontSettings.fontColor || '#1c1917',
            fontWeight: fontSettings.fontWeight ?? 700,
            WebkitTextStroke: fontSettings.seasonStrokeWidth && seasonName ? `${tu(fontSettings.seasonStrokeWidth)} ${fontSettings.seasonStrokeColor}` : undefined,
            paintOrder: 'stroke fill',
            lineHeight: fontSettings.lineHeight ?? 1.2,
            letterSpacing: tu(fontSettings.letterSpacing ?? 0),
            transform: `translate(${tu(fontSettings.offsetX ?? 0)}, ${tu(fontSettings.offsetY ?? 0)})`,
            maxHeight: `calc(${fontSettings.fontSize} * var(--title-u) * ${fontSettings.lineHeight ?? 1.2} * ${MAX_LINES})`,
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* 시즌 요리 + 재료 */}
      <div className="flex h-full w-[20%] flex-col" style={{ gap: u(4) }}>
        <div className={clsx('relative h-[55%]', !seasonDish && 'card-empty')} style={{ padding: u(2) }}>
          <Slot
            image={seasonDish}
            full
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
});
