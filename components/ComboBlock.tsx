'use client';

import clsx from 'clsx';
import { CSSProperties, KeyboardEvent, PointerEvent, memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, ComboField } from '@/store/useAppStore';
import { formatScore } from '@/utils/scoreFormatter';
import { cardStyle, fontFamilyOf, outlineShadow, textGlow, u, withOpacity } from '@/lib/board';
import { Category, MagicCandyData } from '@/types';
import Slot from './Slot';
import YoutubeDialog from './YoutubeDialog';

const CARD_TRIM = 68; // 카드 아래 여백을 위와 같게(12) 맞추려고 줄이는 높이 (보드 px)
const MIN_RATIO = 30;
const MAX_RATIO = 70;

/**
 * 아레나 1개의 조합표. 배치(위치·크기)는 기존 디자인 그대로이며,
 * 모든 px 값은 u()로 감싸 보드 배율에 맞춰 함께 커지고 작아진다.
 */
export default memo(function ComboBlock({ arenaIndex }: { arenaIndex: number }) {
  const arena = useAppStore((s) => s.arenas[arenaIndex]);
  // 이 아레나에 쓰는 설정만 구독 (시즌명 글자 크기 같은 다른 설정을 바꿀 때 12개 아레나를 다시 그리지 않게)
  const fontSettings = useAppStore(
    useShallow((s) => ({
      fontFamily: s.fontSettings.fontFamily,
      fontColor: s.fontSettings.fontColor,
      numberColor: s.fontSettings.numberColor,
      numberSize: s.fontSettings.numberSize,
      scoreColor: s.fontSettings.scoreColor,
      scoreFontSize: s.fontSettings.scoreFontSize,
      scoreFontWeight: s.fontSettings.scoreFontWeight,
      scoreAlign: s.fontSettings.scoreAlign,
      scoreStrokeWidth: s.fontSettings.scoreStrokeWidth,
      scoreStrokeColor: s.fontSettings.scoreStrokeColor,
    }))
  );
  const boardStyle = useAppStore(
    useShallow((s) => ({
      card: s.boardStyle.card,
      cardColor: s.boardStyle.cardColor,
      cardOpacity: s.boardStyle.cardOpacity,
      cardRadius: s.boardStyle.cardRadius,
      cardBorderWidth: s.boardStyle.cardBorderWidth,
      cardBorderColor: s.boardStyle.cardBorderColor,
      cardShadow: s.boardStyle.cardShadow,
      numberBg: s.boardStyle.numberBg,
      numberBgColor: s.boardStyle.numberBgColor,
      cookieFit: s.boardStyle.cookieFit,
    }))
  );
  const openPicker = useAppStore((s) => s.openPicker);
  const setArenaCombo = useAppStore((s) => s.setArenaCombo);
  const setArenaMagicCandy = useAppStore((s) => s.setArenaMagicCandy);
  const setArenaDish = useAppStore((s) => s.setArenaDish);
  const setCookieRatio = useAppStore((s) => s.setCookieRatio);
  const [youtubeOpen, setYoutubeOpen] = useState(false);

  const n = arenaIndex + 1;
  const numberColor = fontSettings.numberColor ?? fontSettings.fontColor;
  const pick = (category: Category, label: string, current: string, apply: (image: string) => void) => () =>
    openPicker({ category, label: `${n}번 ${label}`, current, apply });

  const comboSlot = (combo: 'mainCombo' | 'subCombo', field: ComboField, category: Category, label: string) => {
    const current = field.startsWith('treasure') ? arena[combo].treasures[Number(field.slice(-1))] : arena[combo][field as 'pet'];
    return {
      image: current,
      label: `${n}번 ${label}`,
      text: label,
      onSelect: pick(category, label, current, (image) => setArenaCombo(arenaIndex, combo, field, image)),
    };
  };
  const candySlot = (field: keyof MagicCandyData, category: Category, label: string) => ({
    image: arena.magicCandy[field],
    label: `${n}번 ${label}`,
    text: label,
    onSelect: pick(category, label, arena.magicCandy[field], (image) => setArenaMagicCandy(arenaIndex, field, image)),
  });

  // 메인 조합 쿠키 크기 (총 56% 공간을 비율에 따라 분배)
  const mainCookie1Width = (arena.mainCookieRatio / 100) * 56;
  const mainCookie2Width = ((100 - arena.mainCookieRatio) / 100) * 56;
  // 대체 조합 쿠키 크기 (총 96% 공간을 비율에 따라 분배)
  const subCookie1Width = (arena.subCookieRatio / 100) * 96;
  const subCookie2Width = ((100 - arena.subCookieRatio) / 100) * 96;
  // 크기 자동 맞춤: 칸 폭 비율대로 그림 크기도 맞춘다 (칸 높이가 같아 정사각형에 가까운 그림은 비율을 바꿔도 같은 크기로 보이던 문제)
  const fitOf = (width: number, other: number) => (boardStyle.cookieFit ? { scale: width / Math.max(width, other) } : undefined);

  const scoreStyle: CSSProperties = {
    color: fontSettings.scoreColor,
    fontSize: u(fontSettings.scoreFontSize ?? 14),
    fontWeight: fontSettings.scoreFontWeight ?? 400,
    textAlign: fontSettings.scoreAlign ?? 'center',
    fontFamily: fontFamilyOf(fontSettings.fontFamily),
  };
  const scoreStroke = fontSettings.scoreStrokeWidth ? outlineShadow(fontSettings.scoreStrokeWidth, fontSettings.scoreStrokeColor ?? '#ffffff', u) : undefined;

  return (
    <section
      aria-label={`${n}번 아레나`}
      className="relative w-full"
      // 카드를 켜면 맨 아래 칸(보물) 밑의 빈 공간(80)만큼 아래 여백이 위(12)보다 커 보이므로, 카드 바탕은 그만큼 짧게 그리고
      // 아래 아레나를 그만큼 당겨 아레나 사이 간격이 설정값 그대로 보이게 한다 (칸 위치와 크기는 그대로)
      style={{ height: u(425), ...(boardStyle.card && { marginBottom: u(-CARD_TRIM) }) }}
    >
      {boardStyle.card && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ bottom: u(CARD_TRIM), ...cardStyle(boardStyle) }} />}
      {/* ===== TOP LAYER (Tab 순서상 먼저: 번호 → 요리 → 나머지) ===== */}
      {/* 아레나 번호 (유튜브 링크) */}
      <button
        type="button"
        onClick={() => setYoutubeOpen(true)}
        aria-label={`${n}번 아레나 유튜브 링크 ${arena.youtubeUrl ? '수정' : '추가'}`}
        title={`유튜브 링크 ${arena.youtubeUrl ? '수정' : '추가'}`}
        className="slot slot-overlay absolute flex items-center justify-center font-bold"
        style={{ zIndex: 30, width: u(48), height: u(48), top: u(12), left: u(12), fontSize: u(fontSettings.numberSize ?? 18) }}
      >
        {boardStyle.numberBg ? (
          <span className="absolute inset-0 rounded-[8px]" style={{ backgroundColor: boardStyle.numberBgColor }} aria-hidden="true" />
        ) : (
          <span data-edit-only className="badge absolute inset-0" aria-hidden="true" />
        )}
        <span
          className="relative"
          style={{
            color: arena.youtubeUrl ? '#dc2626' : numberColor,
            textShadow: textGlow(arena.youtubeUrl ? '#dc2626' : numberColor),
          }}
        >
          {arena.youtubeUrl && '▶ '}
          {n}
        </span>
      </button>

      {/* 요리 */}
      <Slot
        image={arena.dish}
        label={`${n}번 요리`}
        text="요리"
        onSelect={pick('dishes', '요리', arena.dish, (image) => setArenaDish(arenaIndex, image))}
        emptyClassName="badge"
        className="slot-overlay"
        style={{ zIndex: 30, width: u(60), height: u(60), top: u(12), right: u(12) }}
      />

      {/* ===== BASE LAYER ===== */}
      <Slot
        {...comboSlot('mainCombo', 'cookie1', 'cookies', '선달 쿠키')}
        full
        fit={fitOf(mainCookie1Width, mainCookie2Width)}
        labelSize={18}
        imageClassName="object-contain object-bottom"
        style={{ zIndex: 10, width: `${mainCookie1Width}%`, height: '44.3%', top: '22%', left: '2%' }}
      />
      <RatioHandle
        label="메인 조합 선달과 이달 쿠키 크기 비율 (모든 아레나 공통)"
        tabbable={arenaIndex === 0}
        value={arena.mainCookieRatio}
        space={56}
        onChange={(r) => setCookieRatio('mainCookieRatio', r)}
        style={{ position: 'absolute', zIndex: 25, width: '2%', height: '44.3%', top: '22%', left: `${2 + mainCookie1Width}%` }}
      />
      <Slot
        {...comboSlot('mainCombo', 'cookie2', 'cookies', '이달 쿠키')}
        full
        fit={fitOf(mainCookie2Width, mainCookie1Width)}
        labelSize={16}
        imageClassName="object-contain object-bottom"
        style={{ zIndex: 10, width: `${mainCookie2Width}%`, height: '44.3%', top: '22%', left: `${2 + mainCookie1Width + 2}%` }}
      />

      {/* ===== MID LAYER ===== */}
      <Slot {...comboSlot('mainCombo', 'pet', 'pets', '펫')} style={{ zIndex: 20, width: u(75), height: u(75), top: '8%', left: '4%' }} />
      {[0, 1, 2].map((t) => (
        <Slot
          key={t}
          {...comboSlot('mainCombo', `treasure${t}` as ComboField, 'treasures', `보물${t + 1}`)}
          style={{ zIndex: 20, width: u(50), height: u(50), bottom: u(80), left: `calc(2% + ${t * 60} * var(--u))` }}
        />
      ))}

      <ScoreInput
        arenaIndex={arenaIndex}
        field="score"
        label="최고점"
        placeholder="최고점"
        stroke={scoreStroke}
        // 오른쪽 끝은 요리 칸에 가려지므로 오른쪽 정렬일 때 글자를 그만큼 안쪽에서 끝낸다
        style={{ ...scoreStyle, zIndex: 20, width: '35%', height: '10%', top: '9%', right: '3%', ...(fontSettings.scoreAlign === 'right' && { paddingRight: u(60) }) }}
      />

      {/* 마법사탕 + 축복 (축복은 사탕 우측 하단 1/4에 겹침) */}
      {([1, 2] as const).map((c) => (
        <div
          key={c}
          className={clsx('absolute', !arena.magicCandy[`cookie${c}Candy`] && 'slot-empty')}
          style={{ zIndex: 20, width: u(72), height: u(72), top: '9%', left: c === 1 ? '38%' : '49%' }}
        >
          <Slot
            {...candySlot(`cookie${c}Candy`, 'magicCandies', `${c === 1 ? '선달' : '이달'} 마법사탕`)}
            text={`${c === 1 ? '선달' : '이달'}\n사탕`}
            labelSize={10}
            labelClassName="pb-[38%] pr-[18%]"
            emptyClassName=""
            className="inset-0"
          />
          <Slot
            {...candySlot(`cookie${c}Blessing`, 'blessings', `${c === 1 ? '선달' : '이달'} 축복`)}
            text="축복"
            labelSize={8}
            emptyClassName="badge"
            className="slot-overlay"
            style={{ zIndex: 30, bottom: -2, right: -2, width: '50%', height: '50%' }}
          />
        </div>
      ))}

      {/* 대체 조합 (width 35%) */}
      <div className="absolute" style={{ zIndex: 20, top: '22%', right: '3%', width: '35%', height: '56%' }}>
        <Slot {...comboSlot('subCombo', 'pet', 'pets', '대체 펫')} style={{ top: '2%', left: '2%', width: u(40), height: u(40) }} />
        <ScoreInput
          arenaIndex={arenaIndex}
          field="subScore"
          label="대체 최고점"
          placeholder="대체 최고점"
          stroke={scoreStroke}
          style={{ ...scoreStyle, top: '2%', left: `calc(2% + 50 * var(--u))`, right: '2%', height: u(40) }}
        />
        <div className="absolute flex" style={{ top: '25%', left: '2%', right: '2%', height: '54%' }}>
          <Slot
            {...comboSlot('subCombo', 'cookie1', 'cookies', '대체 선달 쿠키')}
            text={'대체\n선달\n쿠키'}
            labelSize={10}
            className="!relative h-full"
            fit={fitOf(subCookie1Width, subCookie2Width)}
            imageClassName="object-contain object-bottom"
            style={{ width: `${subCookie1Width}%` }}
          />
          <RatioHandle
            label="대체 조합 선달과 이달 쿠키 크기 비율 (모든 아레나 공통)"
            tabbable={arenaIndex === 0}
            value={arena.subCookieRatio}
            space={96}
            onChange={(r) => setCookieRatio('subCookieRatio', r)}
            style={{ position: 'relative', width: '2%' }}
          />
          <Slot
            {...comboSlot('subCombo', 'cookie2', 'cookies', '대체 이달 쿠키')}
            text={'대체\n이달\n쿠키'}
            labelSize={10}
            className="!relative h-full"
            fit={fitOf(subCookie2Width, subCookie1Width)}
            imageClassName="object-contain object-bottom"
            style={{ width: `${subCookie2Width}%` }}
          />
        </div>
      </div>

      {[0, 1, 2].map((t) => (
        <Slot
          key={t}
          {...comboSlot('subCombo', `treasure${t}` as ComboField, 'treasures', `대체 보물${t + 1}`)}
          text={`보물${t + 1}`}
          style={{ zIndex: 20, width: u(40), height: u(40), bottom: u(80), right: `calc(3% + ${(2 - t) * 50} * var(--u))` }}
        />
      ))}

      {youtubeOpen && <YoutubeDialog arenaIndex={arenaIndex} onClose={() => setYoutubeOpen(false)} />}
    </section>
  );
});

/** 최고점 입력. 입력 중에는 숫자 그대로, 그 외에는 설정한 표기 방식으로 보여준다. */
function ScoreInput({
  arenaIndex,
  field,
  label,
  placeholder,
  stroke,
  style,
}: {
  arenaIndex: number;
  field: 'score' | 'subScore';
  label: string;
  placeholder: string;
  stroke?: string; // 외곽선 (text-shadow 값, outlineShadow)
  style: CSSProperties;
}) {
  const value = useAppStore((s) => s.arenas[arenaIndex][field].value);
  const displayType = useAppStore((s) => s.displaySettings.scoreDisplayType);
  const boardStyle = useAppStore(
    useShallow((s) => ({
      scoreBg: s.boardStyle.scoreBg,
      scoreBgColor: s.boardStyle.scoreBgColor,
      scoreBgOpacity: s.boardStyle.scoreBgOpacity,
      scoreBgRadius: s.boardStyle.scoreBgRadius,
    }))
  );
  const setArenaScore = useAppStore((s) => s.setArenaScore);
  const [editing, setEditing] = useState(false);

  return (
    <input
      type="text"
      inputMode="numeric"
      spellCheck={false}
      aria-label={`${arenaIndex + 1}번 ${label}`}
      value={editing || !value ? value : formatScore(value, displayType)}
      onFocus={(e) => {
        setEditing(true);
        // 표시 형식 → 숫자로 바뀌면서 선택이 풀리므로, 다시 전체 선택해 바로 덮어쓸 수 있게
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => setArenaScore(arenaIndex, field, e.target.value)}
      placeholder={placeholder}
      maxLength={20}
      className={clsx('slot absolute min-w-0 text-ellipsis bg-transparent px-2 py-1 placeholder:text-ink-subtle', !value && 'slot-empty')}
      style={{
        ...style,
        // 외곽선은 입력한 점수에만 (빈 칸 안내 글자에는 그리지 않음)
        textShadow: value ? stroke : undefined,
        ...(value && boardStyle.scoreBg && { backgroundColor: withOpacity(boardStyle.scoreBgColor, boardStyle.scoreBgOpacity), borderRadius: u(boardStyle.scoreBgRadius) }),
      }}
    />
  );
}

/** 선달/이달 쿠키 사이 크기 조절 손잡이. 마우스·터치로 끌거나, 포커스 후 ←/→ 키로 조절. */
function RatioHandle({
  label,
  value,
  space,
  onChange,
  style,
  tabbable,
}: {
  label: string;
  /** 12개 아레나에 함께 적용되므로 키보드로는 첫 아레나 것만 고를 수 있게 */
  tabbable: boolean;
  value: number;
  /** 두 쿠키가 나눠 쓰는 전체 폭 (부모 폭 대비 %) */
  space: number;
  onChange: (ratio: number) => void;
  style: CSSProperties;
}) {
  const clamp = (r: number) => Math.max(MIN_RATIO, Math.min(MAX_RATIO, r));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget;
    const container = handle.parentElement;
    if (!container) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startRatio = value;
    const move = (ev: globalThis.PointerEvent) =>
      onChange(clamp(startRatio + ((ev.clientX - startX) / container.offsetWidth) * 100 * (100 / space)));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1;
    const next = { ArrowLeft: value - step, ArrowRight: value + step, Home: MIN_RATIO, End: MAX_RATIO }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div
      data-edit-only
      role="slider"
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-valuemin={MIN_RATIO}
      aria-valuemax={MAX_RATIO}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`선달 ${Math.round(value)}%, 이달 ${100 - Math.round(value)}%`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="ratio-handle"
      style={style}
    >
      <span aria-hidden="true">⋮</span>
    </div>
  );
}
