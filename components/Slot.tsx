'use client';

import clsx from 'clsx';
import { CSSProperties } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getItemMap } from '@/lib/items';
import { u } from '@/lib/board';

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
}) {
  const item = useAppStore((s) => (image ? getItemMap(s.gameData).get(image) : undefined));
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
      {image ? (
        <img src={image} alt="" crossOrigin="anonymous" draggable={false} loading="lazy" decoding="async" className={clsx('absolute inset-0 h-full w-full', imageClassName)} />
      ) : (
        <span
          data-edit-only
          className="absolute inset-0 flex items-center justify-center whitespace-pre-line text-center font-semibold leading-tight text-ink-muted"
          style={{ fontSize: u(labelSize) }}
        >
          {text}
        </span>
      )}
    </button>
  );
}
