'use client';

import clsx from 'clsx';
import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { initialBoard, useAppStore } from '@/store/useAppStore';
import { backgroundCss } from '@/lib/board';
import { BACKGROUND_PRESETS, isSameBackground } from '@/lib/backgrounds';
import { formatScore } from '@/utils/scoreFormatter';
import { BackgroundData, FontSettings, ScoreDisplayType } from '@/types';
import SidePanel from './ui/SidePanel';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon } from './ui/icons';

// 공유 서버(share-assets 버킷)가 받는 형식·크기와 맞춘다
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const checkImage = (file: File) =>
  !IMAGE_TYPES.includes(file.type) ? 'PNG, JPG, WEBP, GIF 이미지만 올릴 수 있어요' : file.size > MAX_FILE_SIZE ? '5MB 이하 파일만 올릴 수 있어요' : '';
const checkFont = (file: File) =>
  !/\.(ttf|otf|woff2?)$/i.test(file.name) ? 'TTF, OTF, WOFF, WOFF2 파일만 올릴 수 있어요' : file.size > MAX_FILE_SIZE ? '5MB 이하 파일만 올릴 수 있어요' : '';

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * 배경 사진은 화면에 필요한 크기(긴 변 2560px)로 줄여 webp로 저장한다.
 * 브라우저 저장 공간(약 5MB)을 넘으면 자동 저장이 멈추기 때문. 움직이는 GIF는 그대로 둔다.
 */
async function shrinkImage(dataUrl: string, file: File) {
  if (file.type === 'image/gif') return dataUrl;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const small = canvas.toDataURL('image/webp', 0.88);
    return small.startsWith('data:image/webp') && small.length < dataUrl.length ? small : dataUrl;
  } catch {
    return dataUrl;
  }
}

const WEIGHTS: [string, string][] = [
  ['400', '보통'],
  ['700', '굵게'],
  ['900', '아주 굵게'],
];

const SECTIONS = [
  ['bg', '배경'],
  ['font', '글꼴'],
  ['season', '시즌명'],
  ['score', '점수'],
  ['number', '번호'],
  ['style', '카드와 여백'],
] as const;

/** 설정 패널. 바꾸는 즉시 조합표에 반영되고, '되돌리기'로 패널을 열었을 때 상태로 돌아간다. */
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const background = useAppStore((s) => s.background);
  const font = useAppStore((s) => s.fontSettings);
  const scoreDisplayType = useAppStore((s) => s.displaySettings.scoreDisplayType);
  const style = useAppStore((s) => s.boardStyle);
  const { setBackground, setFontSettings: setF, setDisplaySettings, setBoardStyle: setS, reset, showToast } = useAppStore.getState();
  const [snapshot] = useState(() => {
    const s = useAppStore.getState();
    return { background: s.background, fontSettings: s.fontSettings, displaySettings: s.displaySettings, boardStyle: s.boardStyle };
  });
  const changed =
    background !== snapshot.background ||
    font !== snapshot.fontSettings ||
    style !== snapshot.boardStyle ||
    scoreDisplayType !== snapshot.displaySettings.scoreDisplayType;
  const [confirm, setConfirm] = useState<'style' | 'all' | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 합치기(merge)가 아니라 통째로 바꿔야 나중에 추가된 값(번호 색, 글꼴 파일 등)까지 되돌아간다
  const revert = () => useAppStore.setState(snapshot);
  const setBg = (patch: Partial<BackgroundData>) => setBackground({ ...background, ...patch });
  const [active, setActive] = useState<string>('bg');

  // 패널 안쪽 목록만 스크롤한다 (scrollIntoView는 패널 전체를 밀어 올림)
  const jump = (id: string) => {
    const list = bodyRef.current?.parentElement;
    const target = bodyRef.current?.querySelector<HTMLElement>(`#set-${id}`);
    if (!list || !target) return;
    list.scrollTo({ top: target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop, behavior: 'smooth' });
  };

  // 지금 보고 있는 항목을 위쪽 목차에 표시
  useEffect(() => {
    const list = bodyRef.current?.parentElement;
    if (!list) return;
    const onScroll = () => {
      const top = list.getBoundingClientRect().top + 40;
      const sections = SECTIONS.map(([id]) => list.querySelector<HTMLElement>(`#set-${id}`)).filter((el): el is HTMLElement => !!el);
      const current = sections.filter((el) => el.getBoundingClientRect().top <= top).pop() ?? sections[0];
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
      setActive((atEnd ? sections[sections.length - 1] : current).id.slice(4));
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, []);

  const resetStyle = () => {
    const { background: bg, fontSettings, displaySettings, boardStyle } = initialBoard();
    useAppStore.setState({ background: bg, fontSettings, displaySettings, boardStyle });
  };

  return (
    <>
      <SidePanel
        title="설정"
        onClose={onClose}
        header={
          <nav aria-label="설정 항목" className="scrollbar-hide flex gap-1 overflow-x-auto px-3 pb-2">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => jump(id)}
                aria-current={active === id ? 'true' : undefined}
                className={clsx(
                  'h-8 shrink-0 rounded-full px-3 text-caption font-semibold transition-colors',
                  active === id ? 'bg-primary text-on-primary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        }
        footer={
          <>
            <Button onClick={revert} disabled={!changed} className="flex-1">
              되돌리기
            </Button>
            <Button variant="primary" onClick={onClose} className="flex-1">
              닫기
            </Button>
          </>
        }
      >
        <div ref={bodyRef} className="divide-y divide-line">
          <Section id="bg" title="배경">
            <div role="radiogroup" aria-label="추천 배경" onKeyDown={radioArrows(5)} className="grid grid-cols-5 gap-2">
              {BACKGROUND_PRESETS.map((preset, i) => {
                const selected = isSameBackground(background, preset.background);
                const anySelected = BACKGROUND_PRESETS.some((p) => isSameBackground(background, p.background));
                return (
                  <button
                    key={preset.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected || (!anySelected && i === 0) ? 0 : -1}
                    aria-label={preset.name}
                    title={preset.name}
                    onClick={() => {
                      setBackground(preset.background);
                      setF({ fontColor: preset.ink, scoreColor: preset.ink, numberColor: preset.ink, scoreStrokeColor: preset.ink === '#ffffff' ? '#1c1917' : '#ffffff' });
                    }}
                    className={clsx(
                      'grid aspect-square place-items-center rounded-md border transition-transform hover:-translate-y-0.5 active:scale-95',
                      selected ? 'border-primary-ink ring-2 ring-primary-ink ring-offset-2' : 'border-line'
                    )}
                    style={{ background: backgroundCss(preset.background) }}
                  >
                    {selected && (
                      <span style={{ color: preset.ink }} aria-hidden="true">
                        <CheckIcon className="h-5 w-5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <Segmented
              label="종류"
              value={background.type}
              onChange={(type) =>
                setBg({ type, color: background.color ?? '#fffbf5', gradient: background.gradient ?? ['#ffc48c', '#f0845c'] })
              }
              options={[
                ['color', '단색'],
                ['gradient', '그라데이션'],
                ['image', '이미지'],
              ]}
            />

            {background.type === 'color' && <ColorField label="색" value={background.color ?? '#fffbf5'} onChange={(color) => setBg({ color })} />}

            {background.type === 'gradient' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <ColorField
                      key={i}
                      label={i === 0 ? '시작 색' : '끝 색'}
                      value={background.gradient?.[i] ?? '#ffffff'}
                      onChange={(c) => {
                        const gradient = [...(background.gradient ?? ['#ffc48c', '#f0845c'])] as [string, string];
                        gradient[i] = c;
                        setBg({ gradient });
                      }}
                    />
                  ))}
                </div>
                <Range label="방향" unit="°" value={background.angle ?? 135} min={0} max={360} step={15} onChange={(angle) => setBg({ angle })} />
              </>
            )}

            {background.type === 'image' && (
              <>
                <FileButton
                  label={background.imageUrl?.startsWith('data:') ? '이미지 바꾸기' : '이미지 파일 선택'}
                  accept={IMAGE_TYPES.join(',')}
                  validate={checkImage}
                  onData={async (imageUrl, file) => setBg({ imageUrl: await shrinkImage(imageUrl, file) })}
                />
                <Field label="이미지 주소">
                  {(id) => (
                    <input
                      id={id}
                      type="url"
                      value={background.imageUrl?.startsWith('data:') ? '' : background.imageUrl ?? ''}
                      onChange={(e) => setBg({ imageUrl: e.target.value })}
                      placeholder="https://"
                      className="field"
                    />
                  )}
                </Field>
                <Segmented
                  label="맞춤"
                  value={background.imageFit ?? 'cover'}
                  onChange={(imageFit) => setBg({ imageFit })}
                  options={[
                    ['cover', '채우기'],
                    ['contain', '맞추기'],
                    ['repeat', '반복'],
                  ]}
                />
                <Range
                  label="어둡게"
                  unit="%"
                  value={Math.round((background.dim ?? 0) * 100)}
                  min={0}
                  max={60}
                  step={5}
                  onChange={(v) => setBg({ dim: v / 100 })}
                />
              </>
            )}
          </Section>

          <Section id="font" title="글꼴">
            <Segmented
              label="글꼴"
              value={font.fontFamily}
              options={[
                ['Pretendard', 'Pretendard'],
                ['CookieRun', '쿠키런'],
                ['Custom', '직접 올리기'],
              ]}
              onChange={(fontFamily) => setF({ fontFamily })}
            />
            {font.fontFamily === 'Custom' && (
              <FileButton
                label={font.customFontName || '글꼴 파일 선택'}
                accept=".ttf,.otf,.woff,.woff2"
                validate={checkFont}
                onData={(url, file) => {
                  // 확장자에 맞는 MIME으로 바꿔 둔다 (글꼴 형식 판별·공유 업로드에 사용)
                  const ext = file.name.split('.').pop()!.toLowerCase();
                  setF({ customFontName: file.name.replace(/\.[^/.]+$/, ''), customFontUrl: url.replace(/^data:[^;]*;/, `data:font/${ext};`) });
                }}
              />
            )}
          </Section>

          <Section id="season" title="시즌명">
            <Range label="크기" value={font.fontSize} min={12} max={52} onChange={(fontSize) => setF({ fontSize })} />
            <Segmented label="굵기" value={String(font.fontWeight ?? 700)} options={WEIGHTS} onChange={(w) => setF({ fontWeight: Number(w) })} />
            <ColorField label="색" value={font.fontColor ?? '#1c1917'} onChange={(fontColor) => setF({ fontColor })} />
            <div className="grid grid-cols-[auto_1fr] items-start gap-4">
              <AlignGrid
                horizontal={font.textAlign}
                vertical={font.verticalAlign ?? 'middle'}
                onChange={(textAlign, verticalAlign) => setF({ textAlign, verticalAlign })}
              />
              <div className="space-y-1">
                <Range label="가로 이동" value={font.offsetX ?? 0} min={-200} max={200} onChange={(offsetX) => setF({ offsetX })} />
                <Range label="세로 이동" value={font.offsetY ?? 0} min={-150} max={150} onChange={(offsetY) => setF({ offsetY })} />
                {(!!font.offsetX || !!font.offsetY) && (
                  <button type="button" onClick={() => setF({ offsetX: 0, offsetY: 0 })} className="text-caption font-semibold text-primary-ink hover:underline">
                    이동 초기화
                  </button>
                )}
              </div>
            </div>
            <Range label="줄 간격" unit="배" value={font.lineHeight ?? 1.2} min={0.8} max={2} step={0.05} onChange={(lineHeight) => setF({ lineHeight })} />
            <Range label="자간" value={font.letterSpacing ?? 0} min={-5} max={20} step={0.5} onChange={(letterSpacing) => setF({ letterSpacing })} />
            <Stroke
              width={font.seasonStrokeWidth ?? 0}
              color={font.seasonStrokeColor ?? '#ffffff'}
              max={8}
              onChange={(w, c) => setF({ seasonStrokeWidth: w, seasonStrokeColor: c })}
            />
          </Section>

          <Section id="score" title="점수">
            <Segmented
              label="표기"
              value={scoreDisplayType}
              onChange={(v: ScoreDisplayType) => setDisplaySettings({ scoreDisplayType: v })}
              options={(['abbreviated', 'comma', 'korean'] as ScoreDisplayType[]).map((v) => [v, formatScore('331000000', v)])}
            />
            <Range label="크기" value={font.scoreFontSize ?? 14} min={10} max={48} onChange={(scoreFontSize) => setF({ scoreFontSize })} />
            <Segmented
              label="정렬"
              value={font.scoreAlign ?? 'center'}
              onChange={(scoreAlign) => setF({ scoreAlign })}
              options={[
                ['left', '왼쪽'],
                ['center', '가운데'],
                ['right', '오른쪽'],
              ]}
            />
            <Segmented label="굵기" value={String(font.scoreFontWeight ?? 400)} options={WEIGHTS} onChange={(w) => setF({ scoreFontWeight: Number(w) })} />
            <ColorField label="색" value={font.scoreColor ?? '#1c1917'} onChange={(scoreColor) => setF({ scoreColor })} />
            <Stroke
              width={font.scoreStrokeWidth ?? 0}
              color={font.scoreStrokeColor ?? '#ffffff'}
              max={5}
              onChange={(w, c) => setF({ scoreStrokeWidth: w, scoreStrokeColor: c })}
            />
          </Section>

          <Section id="number" title="아레나 번호">
            <Range label="크기" value={font.numberSize ?? 18} min={12} max={32} onChange={(numberSize) => setF({ numberSize })} />
            <ColorField label="색" value={font.numberColor ?? font.fontColor ?? '#1c1917'} onChange={(numberColor) => setF({ numberColor })} />
          </Section>

          <Section id="style" title="카드와 여백">
            <Toggle label="아레나 카드" checked={style.card} onChange={(card) => setS({ card })} />
            {style.card && (
              <div className="space-y-4 rounded-lg bg-surface-cream p-3">
                <ColorField label="카드 색" value={style.cardColor} onChange={(cardColor) => setS({ cardColor })} />
                <Range label="불투명도" unit="%" value={style.cardOpacity} min={0} max={100} step={5} onChange={(cardOpacity) => setS({ cardOpacity })} />
                <Range label="모서리" value={style.cardRadius} min={0} max={60} onChange={(cardRadius) => setS({ cardRadius })} />
                <Range label="테두리" value={style.cardBorderWidth} min={0} max={8} step={0.5} onChange={(cardBorderWidth) => setS({ cardBorderWidth })} />
                {style.cardBorderWidth > 0 && (
                  <ColorField label="테두리 색" value={style.cardBorderColor} onChange={(cardBorderColor) => setS({ cardBorderColor })} />
                )}
                <Toggle label="그림자" checked={style.cardShadow} onChange={(cardShadow) => setS({ cardShadow })} />
                <Toggle label="시즌 영역에도 적용" checked={style.headerCard} onChange={(headerCard) => setS({ headerCard })} />
              </div>
            )}
            <Toggle label="점수 바탕" checked={style.scoreBg} onChange={(scoreBg) => setS({ scoreBg })} />
            {style.scoreBg && (
              <div className="space-y-4 rounded-lg bg-surface-cream p-3">
                <ColorField label="바탕 색" value={style.scoreBgColor} onChange={(scoreBgColor) => setS({ scoreBgColor })} />
                <Range label="불투명도" unit="%" value={style.scoreBgOpacity} min={0} max={100} step={5} onChange={(scoreBgOpacity) => setS({ scoreBgOpacity })} />
                <Range label="모서리" value={style.scoreBgRadius} min={0} max={30} onChange={(scoreBgRadius) => setS({ scoreBgRadius })} />
              </div>
            )}
            <Toggle label="아레나 번호 바탕" checked={style.numberBg} onChange={(numberBg) => setS({ numberBg })} />
            {style.numberBg && <ColorField label="바탕 색" value={style.numberBgColor} onChange={(numberBgColor) => setS({ numberBgColor })} />}
            <Range label="아레나 사이 간격" value={style.gap} min={0} max={80} onChange={(gap) => setS({ gap })} />
            <Range label="저장 이미지 바깥 여백" value={style.exportPadding} min={0} max={160} step={4} onChange={(exportPadding) => setS({ exportPadding })} />
          </Section>

          <Section id="reset" title="초기화">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setConfirm('style')}>설정만</Button>
              <Button className="!text-danger hover:!bg-danger/10" onClick={() => setConfirm('all')}>
                전체
              </Button>
            </div>
          </Section>
        </div>
      </SidePanel>

      {confirm && (
        <Modal
          title={confirm === 'all' ? '전체 초기화' : '설정 초기화'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button className="ml-auto" onClick={() => setConfirm(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm === 'all') {
                    reset();
                    onClose();
                  } else resetStyle();
                  showToast('초기화했어요');
                  setConfirm(null);
                }}
              >
                초기화
              </Button>
            </>
          }
        >
          <p className="p-5 text-body-md text-ink">
            {confirm === 'all' ? '모든 조합과 설정을 지울까요? 되돌릴 수 없어요.' : '조합은 그대로 두고 꾸미기 설정만 처음 상태로 되돌릴까요?'}
          </p>
        </Modal>
      )}
    </>
  );
}

/**
 * 라디오 묶음 키보드 조작: Tab으로는 선택된 하나만 들어가고, 화살표로 옮기며 바로 선택한다.
 * cols: 한 줄에 몇 개인지 (위/아래 화살표 이동 거리)
 */
function radioArrows(cols: number) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!step) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const index = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    e.preventDefault();
    const next = radios[(index + step + radios.length) % radios.length];
    next.focus();
    next.click();
  };
}

/** 9칸 위치 고르기 (가로 정렬 × 세로 위치) */
function AlignGrid({
  horizontal,
  vertical,
  onChange,
}: {
  horizontal: FontSettings['textAlign'];
  vertical: NonNullable<FontSettings['verticalAlign']>;
  onChange: (h: FontSettings['textAlign'], v: NonNullable<FontSettings['verticalAlign']>) => void;
}) {
  const rows = [
    ['top', '위'],
    ['middle', '가운데'],
    ['bottom', '아래'],
  ] as const;
  const cols = [
    ['left', '왼쪽'],
    ['center', '가운데'],
    ['right', '오른쪽'],
  ] as const;
  return (
    <div>
      <p className="mb-1.5 text-caption font-semibold text-ink-muted" id="align-grid-label">
        위치
      </p>
      <div role="radiogroup" aria-labelledby="align-grid-label" onKeyDown={radioArrows(3)} className="grid w-[108px] grid-cols-3 gap-1 rounded-md bg-surface-sunken p-1">
        {rows.flatMap(([v, vLabel]) =>
          cols.map(([h, hLabel]) => {
            const on = horizontal === h && vertical === v;
            return (
              <button
                key={`${v}-${h}`}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                aria-label={`${vLabel} ${hLabel}`}
                onClick={() => onChange(h, v)}
                className={clsx(
                  'grid h-8 place-items-center rounded-sm transition-colors',
                  on ? 'bg-primary shadow-e1 ring-1 ring-primary-ink' : 'hover:bg-surface'
                )}
              >
                <span className={clsx('h-1.5 rounded-full', on ? 'w-4 bg-ink' : 'w-2.5 bg-ink-subtle/60')} aria-hidden="true" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`set-${id}`} aria-labelledby={`set-${id}-title`} className="scroll-mt-2 space-y-4 px-5 py-5">
      <h3 id={`set-${id}-title`} className="text-label-md text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-caption font-semibold text-ink-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** 색 고르기 + #코드 직접 입력 */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }
  const commit = () => (/^#[0-9a-f]{6}$/i.test(text) ? onChange(text.toLowerCase()) : setText(value));

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-caption font-semibold text-ink-muted">
        {label}
      </label>
      <div className="flex h-touch items-center gap-2 rounded-md border border-line bg-surface pl-1.5 pr-2 focus-within:border-primary-ink focus-within:ring-4 focus-within:ring-primary-ink/15">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} 고르기`}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-sm"
        />
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          spellCheck={false}
          maxLength={7}
          className="w-full min-w-0 bg-transparent text-body-md uppercase tabular-nums text-ink focus:outline-none"
        />
      </div>
    </div>
  );
}

/** 외곽선: 두께가 0보다 크면 색 고르기가 나타난다 */
function Stroke({ width, color, max, onChange }: { width: number; color: string; max: number; onChange: (w: number, c: string) => void }) {
  return (
    <>
      <Range label="외곽선" value={width} min={0} max={max} step={0.5} onChange={(w) => onChange(w, color)} />
      {width > 0 && <ColorField label="외곽선 색" value={color} onChange={(c) => onChange(width, c)} />}
    </>
  );
}

/** 슬라이더 + 숫자 직접 입력 */
function Range({
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
    const next = Math.min(max, Math.max(min, n));
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

function Segmented<T extends string>({
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

function FileButton({
  label,
  accept,
  validate,
  onData,
}: {
  label: string;
  accept: string;
  validate: (file: File) => string;
  onData: (dataUrl: string, file: File) => void;
}) {
  const id = useId();
  const [error, setError] = useState('');
  return (
    <div className="relative">
      <input
        id={id}
        type="file"
        accept={accept}
        className="peer sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const message = validate(file);
          setError(message);
          if (!message) onData(await readFile(file), file);
        }}
      />
      <label
        htmlFor={id}
        className="flex h-touch cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-line px-4 text-label-md text-ink-muted transition-colors hover:border-primary-ink hover:text-primary-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary-ink"
      >
        {label}
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-caption font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
