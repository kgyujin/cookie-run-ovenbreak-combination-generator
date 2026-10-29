'use client';

import clsx from 'clsx';
import { CSSProperties, KeyboardEvent, PointerEvent, memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, ComboField } from '@/store/useAppStore';
import { formatScore } from '@/utils/scoreFormatter';
import { ARENA_HEIGHT, MAX_MEMO, cardStyle, fontFamilyOf, moved, outlineShadow, textGlow, u, withOpacity } from '@/lib/board';
import { Category, HiddenPart, LayoutKey, MagicCandyData } from '@/types';
import Slot from './Slot';
import CookiePair from './CookiePair';
import YoutubeDialog from './YoutubeDialog';
import ArenaVideos from './ArenaVideos';
import { useMoveDrag } from './useMoveDrag';
import { useViewOnly } from './ViewOnly';

const CARD_TRIM = 68; // 카드 아래 여백을 위와 같게(12) 맞추려고 줄이는 높이 (보드 px)
const MIN_RATIO = 30;
const MAX_RATIO = 70;

/**
 * 아레나 1개의 조합표. 칸 크기는 기존 디자인 그대로이며, 위치는 꾹 눌러 옮길 수 있다 (useMoveDrag, 12개 아레나 공통).
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
      mainPairGap: s.boardStyle.mainPairGap,
      subPairGap: s.boardStyle.subPairGap,
      layout: s.boardStyle.layout,
      hidden: s.boardStyle.hidden,
    }))
  );
  const openPicker = useAppStore((s) => s.openPicker);
  const setArenaCombo = useAppStore((s) => s.setArenaCombo);
  const setArenaMagicCandy = useAppStore((s) => s.setArenaMagicCandy);
  const setArenaDish = useAppStore((s) => s.setArenaDish);
  const setCookieRatio = useAppStore((s) => s.setCookieRatio);
  const setArenaScore = useAppStore((s) => s.setArenaScore);
  const setArenaMemo = useAppStore((s) => s.setArenaMemo);
  const scoreDisplayType = useAppStore((s) => s.displaySettings.scoreDisplayType);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const { sectionRef, guides, onPointerDown, onKeyDown: onMoveKey } = useMoveDrag();
  const viewOnly = useViewOnly();
  const at = (key: LayoutKey) => moved(boardStyle.layout[key]);
  // 설정에서 숨긴 영역은 그리지 않는다 (내용은 그대로 남아 다시 켜면 보인다)
  const show = (part: HiddenPart) => !boardStyle.hidden.includes(part);
  const formatScoreAs = (value: string) => formatScore(value, scoreDisplayType);

  const n = arenaIndex + 1;
  const hasVideo = arena.youtubeLinks.length > 0;
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
  const main1 = comboSlot('mainCombo', 'cookie1', 'cookies', '선달 쿠키');
  const main2 = comboSlot('mainCombo', 'cookie2', 'cookies', '이달 쿠키');
  const sub1 = comboSlot('subCombo', 'cookie1', 'cookies', '대체 선달 쿠키');
  const sub2 = comboSlot('subCombo', 'cookie2', 'cookies', '대체 이달 쿠키');
  // 크기 자동 맞춤에서 두 쿠키가 다 있으면 크기 손잡이는 두 쿠키 사이 간격 한가운데에 (칸 경계에 두면 쿠키 그림 위에 겹침)
  const mainPaired = boardStyle.cookieFit && !!main1.image && !!main2.image;
  const subPaired = boardStyle.cookieFit && !!sub1.image && !!sub2.image;
  const inGap: CSSProperties = { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 'var(--pair-handle)', transform: 'translateX(-50%)' };
  const mainHandle = (style: CSSProperties) => (
    <RatioHandle
      label="메인 조합 선달과 이달 쿠키 크기 비율 (모든 아레나 공통)"
      tabbable={arenaIndex === 0}
      value={arena.mainCookieRatio}
      space={56}
      onChange={(r) => setCookieRatio('mainCookieRatio', r)}
      style={style}
    />
  );
  const subHandle = (style: CSSProperties) => (
    <RatioHandle
      label="대체 조합 선달과 이달 쿠키 크기 비율 (모든 아레나 공통)"
      tabbable={arenaIndex === 0}
      value={arena.subCookieRatio}
      space={96}
      onChange={(r) => setCookieRatio('subCookieRatio', r)}
      style={style}
    />
  );

  const numberClass = 'slot-overlay absolute flex items-center justify-center font-bold';
  const numberStyle: CSSProperties = { zIndex: 30, width: u(48), height: u(48), top: u(12), left: u(12), fontSize: u(fontSettings.numberSize ?? 18), ...at('number') };
  const numberFace = (
    <>
      {boardStyle.numberBg ? (
        <span className="absolute inset-0 rounded-[8px]" style={{ backgroundColor: boardStyle.numberBgColor }} aria-hidden="true" />
      ) : (
        <span data-edit-only className="badge absolute inset-0" aria-hidden="true" />
      )}
      <span
        className="relative"
        style={{
          color: hasVideo ? '#dc2626' : numberColor,
          textShadow: textGlow(hasVideo ? '#dc2626' : numberColor),
        }}
      >
        {hasVideo && '▶ '}
        {n}
      </span>
    </>
  );

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
      ref={sectionRef}
      onPointerDown={viewOnly ? undefined : onPointerDown}
      onKeyDown={viewOnly ? undefined : onMoveKey}
      data-ratio-area
      aria-label={`${n}번 아레나`}
      className="arena relative w-full"
      // 카드를 켜면 맨 아래 칸(보물) 밑의 빈 공간(80)만큼 아래 여백이 위(12)보다 커 보이므로, 카드 바탕은 그만큼 짧게 그리고
      // 아래 아레나를 그만큼 당겨 아레나 사이 간격이 설정값 그대로 보이게 한다 (칸 위치와 크기는 그대로)
      style={{ height: u(ARENA_HEIGHT), ...(boardStyle.card && { marginBottom: u(-CARD_TRIM) }) }}
    >
      {boardStyle.card && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ bottom: u(CARD_TRIM), ...cardStyle(boardStyle) }} />}
      {/* ===== TOP LAYER (Tab 순서상 먼저: 번호 → 요리 → 나머지) ===== */}
      {/* 아레나 번호 (유튜브 링크: 편집 화면에서는 링크를 고치고, 보기 전용 화면에서는 영상을 연다) */}
      {viewOnly ? (
        <ArenaVideos n={n} links={arena.youtubeLinks} className={clsx(hasVideo && 'slot', numberClass)} style={numberStyle}>
          {numberFace}
        </ArenaVideos>
      ) : (
        <button
          type="button"
          onClick={() => setYoutubeOpen(true)}
          aria-label={`${n}번 아레나 유튜브 링크 ${hasVideo ? `${arena.youtubeLinks.length}개, 보기와 수정` : '추가'}`}
          title={`유튜브 링크 ${hasVideo ? `${arena.youtubeLinks.length}개` : '추가'}`}
          className={clsx('slot', numberClass)}
          data-move="number"
          style={numberStyle}
        >
          {numberFace}
        </button>
      )}

      {/* 요리 */}
      {show('dish') && (
        <Slot
          image={arena.dish}
          label={`${n}번 요리`}
          text="요리"
          onSelect={pick('dishes', '요리', arena.dish, (image) => setArenaDish(arenaIndex, image))}
          emptyClassName="badge"
          className="slot-overlay"
          move="dish"
          style={{ zIndex: 30, width: u(60), height: u(60), top: u(12), right: u(12), ...at('dish') }}
        />
      )}

      {/* ===== BASE LAYER ===== */}
      {/* 크기 자동 맞춤: 쿠키 그림은 한 쌍으로 따로 그리고(칸 두 개와 손잡이를 합친 자리), 칸은 누르는 자리로 */}
      {boardStyle.cookieFit && (
        <CookiePair
          images={[main1.image, main2.image]}
          ratio={arena.mainCookieRatio}
          gap={boardStyle.mainPairGap}
          align="left"
          full
          onSelect={[main1.onSelect, main2.onSelect]}
          handle={mainPaired && mainHandle(inGap)}
          move="mainCookies"
          style={{ zIndex: 15, width: '58%', height: '44.3%', top: '22%', left: '2%', ...at('mainCookies') }}
        />
      )}
      <Slot
        {...main1}
        full
        hideImage={boardStyle.cookieFit}
        labelSize={18}
        imageClassName="object-contain object-bottom"
        move="mainCookies"
        style={{ zIndex: 10, width: `${mainCookie1Width}%`, height: '44.3%', top: '22%', left: '2%', ...at('mainCookies') }}
      />
      {!mainPaired && mainHandle({ position: 'absolute', zIndex: 25, width: '2%', height: '44.3%', top: '22%', left: `${2 + mainCookie1Width}%`, ...at('mainCookies') })}
      <Slot
        {...main2}
        full
        hideImage={boardStyle.cookieFit}
        labelSize={16}
        imageClassName="object-contain object-bottom"
        move="mainCookies"
        style={{ zIndex: 10, width: `${mainCookie2Width}%`, height: '44.3%', top: '22%', left: `${2 + mainCookie1Width + 2}%`, ...at('mainCookies') }}
      />

      {/* ===== MID LAYER ===== */}
      {show('pet') && <Slot {...comboSlot('mainCombo', 'pet', 'pets', '펫')} move="pet" style={{ zIndex: 20, width: u(75), height: u(75), top: '8%', left: '4%', ...at('pet') }} />}
      {show('treasure') && [0, 1, 2].map((t) => (
        <Slot
          key={t}
          {...comboSlot('mainCombo', `treasure${t}` as ComboField, 'treasures', `보물${t + 1}`)}
          move={`treasure${t}` as LayoutKey}
          style={{ zIndex: 20, width: u(50), height: u(50), bottom: u(80), left: `calc(2% + ${t * 60} * var(--u))`, ...at(`treasure${t}` as LayoutKey) }}
        />
      ))}

      <BoardInput
        value={arena.score.value}
        onChange={(v) => setArenaScore(arenaIndex, 'score', v)}
        format={formatScoreAs}
        label={`${n}번 최고점`}
        placeholder="최고점"
        maxLength={20}
        stroke={scoreStroke}
        move="score"
        // 오른쪽 끝은 요리 칸에 가려지므로 오른쪽 정렬일 때 글자를 그만큼 안쪽에서 끝낸다 (요리 칸을 숨기면 끝까지)
        style={{ ...scoreStyle, zIndex: 20, width: '35%', height: '10%', top: '9%', right: '3%', ...(fontSettings.scoreAlign === 'right' && show('dish') && { paddingRight: u(60) }), ...at('score') }}
      />

      {/* 마법사탕 + 축복 (축복은 사탕 우측 하단 1/4에 겹침) */}
      {show('candy') && ([1, 2] as const).map((c) => (
        <div
          key={c}
          className={clsx('absolute', !arena.magicCandy[`cookie${c}Candy`] && 'slot-empty')}
          data-move={`candy${c}`}
          style={{ zIndex: 20, width: u(72), height: u(72), top: '9%', left: c === 1 ? '38%' : '49%', ...at(`candy${c}`) }}
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
      {show('sub') && (
        <div className="absolute" style={{ zIndex: 20, top: '22%', right: '3%', width: '35%', height: '56%' }}>
          {show('pet') && <Slot {...comboSlot('subCombo', 'pet', 'pets', '대체 펫')} move="subPet" style={{ top: '2%', left: '2%', width: u(40), height: u(40), ...at('subPet') }} />}
          <BoardInput
            value={arena.subScore.value}
            onChange={(v) => setArenaScore(arenaIndex, 'subScore', v)}
            format={formatScoreAs}
            label={`${n}번 대체 최고점`}
            placeholder="대체 최고점"
            maxLength={20}
            stroke={scoreStroke}
            move="subScore"
            style={{ ...scoreStyle, top: '2%', left: `calc(2% + 50 * var(--u))`, right: '2%', height: u(40), ...at('subScore') }}
          />
          <div data-ratio-area data-move="subCookies" className="absolute flex" style={{ top: '25%', left: '2%', right: '2%', height: '54%', ...at('subCookies') }}>
            {boardStyle.cookieFit && (
              <CookiePair
                images={[sub1.image, sub2.image]}
                ratio={arena.subCookieRatio}
                gap={boardStyle.subPairGap}
                align="right"
                onSelect={[sub1.onSelect, sub2.onSelect]}
                handle={subPaired && subHandle(inGap)}
                move="subCookies"
                style={{ zIndex: 1, inset: 0 }}
              />
            )}
            <Slot
              {...sub1}
              text={'대체\n선달\n쿠키'}
              labelSize={10}
              className="!relative h-full"
              hideImage={boardStyle.cookieFit}
              imageClassName="object-contain object-bottom"
              style={{ width: `${subCookie1Width}%` }}
            />
            {subPaired ? <span className="w-[2%] shrink-0" /> : subHandle({ position: 'relative', width: '2%' })}
            <Slot
              {...sub2}
              text={'대체\n이달\n쿠키'}
              labelSize={10}
              className="!relative h-full"
              hideImage={boardStyle.cookieFit}
              imageClassName="object-contain object-bottom"
              style={{ width: `${subCookie2Width}%` }}
            />
          </div>
        </div>
      )}

      {show('sub') && show('treasure') && [0, 1, 2].map((t) => (
        <Slot
          key={t}
          {...comboSlot('subCombo', `treasure${t}` as ComboField, 'treasures', `대체 보물${t + 1}`)}
          text={`보물${t + 1}`}
          move={`subTreasure${t}` as LayoutKey}
          style={{ zIndex: 20, width: u(40), height: u(40), bottom: u(80), right: `calc(3% + ${(2 - t) * 50} * var(--u))`, ...at(`subTreasure${t}` as LayoutKey) }}
        />
      ))}

      {/* 한 줄 메모: 메인 보물과 대체 보물 사이 */}
      {show('memo') && (
        <BoardInput
          value={arena.memo}
          onChange={(v) => setArenaMemo(arenaIndex, v)}
          label={`${n}번 메모`}
          placeholder="메모"
          maxLength={MAX_MEMO}
          stroke={scoreStroke}
          move="memo"
          style={{ ...scoreStyle, zIndex: 20, height: u(50), bottom: u(80), left: `calc(2% + 182 * var(--u))`, right: `calc(3% + 152 * var(--u))`, ...at('memo') }}
        />
      )}

      {/* 꾹 눌러 옮기는 동안 맞춘 줄 */}
      {guides.map((g) => (
        <span
          key={g.axis}
          data-edit-only
          aria-hidden="true"
          className={clsx('move-guide', g.axis)}
          style={g.axis === 'x' ? { left: u(g.at), top: 0, bottom: 0 } : { top: u(g.at), left: 0, right: 0 }}
        />
      ))}

      {youtubeOpen && <YoutubeDialog arenaIndex={arenaIndex} onClose={() => setYoutubeOpen(false)} />}
    </section>
  );
});

/**
 * 조합표 위 글자 칸 (최고점, 메모). 점수 글자 설정(색, 크기, 굵기, 외곽선, 바탕)을 함께 쓴다.
 * format이 있으면 입력 중이 아닐 때 그 모양으로 보여 주고, 누르면 전체를 선택해 바로 덮어쓸 수 있게 한다.
 * 보기 전용 화면에서는 글자만 보여 준다.
 */
function BoardInput({
  value,
  onChange,
  format,
  label,
  placeholder,
  maxLength,
  stroke,
  style,
  move,
}: {
  value: string;
  onChange: (value: string) => void;
  format?: (value: string) => string;
  label: string;
  placeholder: string;
  maxLength: number;
  stroke?: string; // 외곽선 (text-shadow 값, outlineShadow)
  style: CSSProperties;
  move: LayoutKey;
}) {
  const boardStyle = useAppStore(
    useShallow((s) => ({
      scoreBg: s.boardStyle.scoreBg,
      scoreBgColor: s.boardStyle.scoreBgColor,
      scoreBgOpacity: s.boardStyle.scoreBgOpacity,
      scoreBgRadius: s.boardStyle.scoreBgRadius,
    }))
  );
  const [editing, setEditing] = useState(false);
  const viewOnly = useViewOnly();
  const fieldStyle: CSSProperties = {
    ...style,
    // 외곽선은 입력한 글자에만 (빈 칸 안내 글자에는 그리지 않음)
    textShadow: value ? stroke : undefined,
    ...(value && boardStyle.scoreBg && { backgroundColor: withOpacity(boardStyle.scoreBgColor, boardStyle.scoreBgOpacity), borderRadius: u(boardStyle.scoreBgRadius) }),
  };

  // 보기 전용: 입력한 글자만 (비어 있으면 그리지 않음). 한 줄로, 넘치면 말줄임
  if (viewOnly) {
    if (!value) return null;
    return (
      <p data-move={move} className="absolute flex min-w-0 items-center px-2 py-1" style={fieldStyle}>
        <span className="sr-only">{label} </span>
        <span className="w-full truncate">{format ? format(value) : value}</span>
      </p>
    );
  }

  return (
    <input
      type="text"
      spellCheck={false}
      aria-label={label}
      value={editing || !value || !format ? value : format(value)}
      onFocus={(e) => {
        setEditing(true);
        if (!format) return;
        // 표시 형식 → 입력한 그대로로 바뀌면서 선택이 풀리므로, 다시 전체 선택해 바로 덮어쓸 수 있게
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      data-move={move}
      className={clsx('slot absolute min-w-0 text-ellipsis bg-transparent px-2 py-1 placeholder:text-ink-subtle', !value && 'slot-empty')}
      style={fieldStyle}
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
    // 비율을 나누는 영역 (메인 조합: 아레나, 대체 조합: 대체 쿠키 줄). 손잡이가 쿠키 사이에 들어가 있어도 같은 기준
    const container = handle.closest<HTMLElement>('[data-ratio-area]');
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
