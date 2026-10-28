'use client';

import clsx from 'clsx';
import { CSSProperties, Fragment, ReactNode } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getItemMap } from '@/lib/items';
import { u } from '@/lib/board';

/**
 * 쿠키 크기 자동 맞춤: 선달과 이달 쿠키를 한 쌍으로 나란히 그린다.
 * - 크기는 ratio(선달 쿠키 비율 %)로, 두 쿠키 사이는 gap(보드 px)으로 따로 정한다
 * - 각 쿠키는 투명 여백을 뺀 그림 영역(crop)만 보이고 아래를 맞춘다. 영역보다 넓어지면 비율을 유지한 채 함께 줄어든다
 * - 컨테이너 단위로 크기를 계산하므로 저장 이미지에도 같은 모양으로 그려진다
 * - 칸(Slot)은 그대로 누르는 자리로 두고 그림만 여기서 그린다. 그림을 눌러도 그 쿠키의 선택 창이 열린다
 */
export default function CookiePair({
  images,
  ratio,
  gap,
  align,
  full = false,
  onSelect,
  handle,
  style,
}: {
  images: [string, string];
  ratio: number;
  gap: number;
  /** 카드 가장자리 쪽으로 붙인다 (메인 조합은 왼쪽, 대체 조합은 오른쪽) */
  align: 'left' | 'right';
  /** 크게 보이는 메인 쿠키는 원본, 대체 쿠키는 작은 이미지 */
  full?: boolean;
  onSelect: [() => void, () => void];
  /** 두 쿠키가 다 있을 때 사이에 두는 크기 손잡이 */
  handle?: ReactNode;
  style: CSSProperties;
}) {
  const map = useAppStore((s) => getItemMap(s.gameData));
  const loaded = useAppStore((s) => !!s.gameData);
  // 아이템 목록(그림 영역)을 불러오기 전에는 그리지 않는다 (크기가 바뀌며 깜빡이지 않게)
  if (!loaded) return null;

  const big = Math.max(ratio, 100 - ratio);
  const parts = images.flatMap((image, i) => {
    if (!image) return [];
    const item = map.get(image);
    return [{ i, image, src: (!full && item?.thumb) || image, crop: item?.crop ?? [0, 0, 1, 1, 1], scale: (i === 0 ? ratio : 100 - ratio) / big }];
  });
  if (!parts.length) return null;

  // 큰 쪽 쿠키의 높이: 영역 높이, 또는 두 쿠키와 간격이 영역 폭에 딱 맞는 높이 중 작은 쪽
  // (간격은 바깥 보드 단위로 계산한 --pair-gap: globals.css)
  const widthPerHeight = parts.reduce((sum, p) => sum + p.crop[4] * p.scale, 0);
  const unit = `min(100cqh, (100cqw - var(--pair-gap)) / ${widthPerHeight})`;

  return (
    <div
      className={clsx('pointer-events-none absolute flex items-end', align === 'left' ? 'justify-start' : 'justify-end')}
      style={{ ...style, containerType: 'size', ['--pair-gap' as string]: parts.length > 1 ? u(gap) : '0px', ['--pair-handle' as string]: u(14) }}
    >
      {parts.map(({ i, src, crop: [x, y, w, h, r], scale }) => (
        <Fragment key={i}>
          {/* 두 쿠키 사이 간격. 크기 손잡이는 그 한가운데에 */}
          {i === 1 && parts.length > 1 && (
            <span className="relative shrink-0 self-stretch" style={{ width: 'var(--pair-gap)' }}>
              {handle}
            </span>
          )}
          <span
            aria-hidden="true"
            onClick={onSelect[i]}
            className="pointer-events-auto relative shrink-0 cursor-pointer overflow-hidden"
            style={{ width: `calc(${r * scale} * ${unit})`, height: `calc(${scale} * ${unit})` }}
          >
            <img
              src={src}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              loading="lazy"
              decoding="async"
              className="absolute max-w-none"
              style={{ width: `${100 / w}%`, height: `${100 / h}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
            />
          </span>
        </Fragment>
      ))}
    </div>
  );
}
