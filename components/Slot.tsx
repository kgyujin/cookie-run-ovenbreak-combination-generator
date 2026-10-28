'use client';

import clsx from 'clsx';
import { CSSProperties } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getItemMap } from '@/lib/items';
import { u } from '@/lib/board';
import type { GameItem } from '@/types';

/**
 * 조합표의 이미지 칸 하나. 누르면 아이템 선택 창이 열린다.
 * 비어 있을 때만 카드 모양과 이름표가 보이고, 이미지 저장 시에는 둘 다 숨겨진다 (globals.css .is-exporting).
 */
export default function Slot({
  image,
  label,
  text = label,
  onSelect,
  style,
  className,
  emptyClassName = 'slot-empty',
  labelSize = 12,
  imageClassName = 'object-contain',
  full = false,
  fit,
  labelClassName,
}: {
  image: string;
  /** 스크린리더용 이름 */
  label: string;
  /** 빈 칸에 보이는 글자 (줄바꿈은 \n) */
  text?: string;
  onSelect: () => void;
  style?: CSSProperties;
  className?: string;
  emptyClassName?: string;
  labelSize?: number;
  imageClassName?: string;
  /** 크게 보이는 칸(메인 쿠키, 시즌 요리)은 원본, 나머지는 작은 이미지(최대 320px)로 빠르게 */
  full?: boolean;
  /**
   * 쿠키 크기 자동 맞춤: 투명 여백을 뺀 그림 영역만 보이게 하고, 칸 높이의 scale만큼만 채운다 (아래 맞춤).
   * 칸 자체의 위치와 크기는 그대로 두고 그 안의 그림만 바뀐다.
   */
  fit?: { scale: number };
  /** 빈 칸 글자 위치 조정 (다른 칸이 겹쳐 올라오는 자리 피하기) */
  labelClassName?: string;
}) {
  const item = useAppStore((s) => (image ? getItemMap(s.gameData).get(image) : undefined));
  // 크기 자동 맞춤은 아이템 목록의 그림 영역을 써야 하므로, 목록을 불러오기 전에는 그리지 않는다 (크기가 바뀌며 깜빡이지 않게)
  const waiting = useAppStore((s) => !!fit && !s.gameData);
  const name = item?.name;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={image ? `${label}: ${name ?? '선택됨'}, 변경` : `${label} 선택`}
      title={item?.description ?? name}
      className={clsx('slot absolute overflow-hidden', !image && emptyClassName, className)}
      style={style}
    >
      {image && waiting ? null : image && fit && item?.crop ? (
        <Cropped src={(!full && item.thumb) || image} crop={item.crop} scale={fit.scale} />
      ) : image ? (
        <img
          src={(!full && item?.thumb) || image}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          loading="lazy"
          decoding="async"
          className={clsx('absolute bottom-0 left-0 w-full', !fit && 'top-0 h-full', imageClassName)}
          style={fit && { height: `${fit.scale * 100}%` }}
        />
      ) : (
        <span
          data-edit-only
          className={clsx('absolute inset-0 flex items-center justify-center whitespace-pre-line text-center font-semibold leading-tight text-ink-muted', labelClassName)}
          style={{ fontSize: u(labelSize) }}
        >
          {text}
        </span>
      )}
    </button>
  );
}

/**
 * 이미지 파일은 그대로 두고 그림 영역(crop)만 보이게: 칸 높이의 scale만큼인 상자에 그림 영역을 비율대로 꽉 맞춰 아래 가운데에 둔다.
 * (컨테이너 단위로 상자 크기를 재므로 저장 이미지에도 같은 모양으로 그려진다)
 */
function Cropped({ src, crop: [x, y, w, h, ratio], scale }: { src: string; crop: NonNullable<GameItem['crop']>; scale: number }) {
  return (
    <span className="absolute bottom-0 left-0 flex w-full items-end justify-center" style={{ height: `${scale * 100}%`, containerType: 'size' }}>
      <span className="relative overflow-hidden" style={{ width: `min(100cqw, ${ratio} * 100cqh)`, height: `min(100cqh, 100cqw / ${ratio})` }}>
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
    </span>
  );
}
