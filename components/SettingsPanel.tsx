'use client';

import clsx from 'clsx';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
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
  ['reset', '초기화'],
] as const;

/** 설정 패널. 바꾸는 즉시 조합표에 반영되고, '되돌리기'로 패널을 열었을 때 상태로 돌아간다. */
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const background = useAppStore((s) => s.background);
  const font = useAppStore((s) => s.fontSettings);
  const scoreDisplayType = useAppStore((s) => s.displaySettings.scoreDisplayType);
  const { setBackground, setFontSettings: setF, setDisplaySettings, reset, showToast } = useAppStore.getState();
  const [snapshot] = useState(() => {
    const s = useAppStore.getState();
    return { background: s.background, fontSettings: s.fontSettings, displaySettings: s.displaySettings };
  });
  const changed =
    background !== snapshot.background || font !== snapshot.fontSettings || scoreDisplayType !== snapshot.displaySettings.scoreDisplayType;
  const [confirm, setConfirm] = useState<'style' | 'all' | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const revert = () => {
    setBackground(snapshot.background);
    setF(snapshot.fontSettings);
    setDisplaySettings(snapshot.displaySettings);
  };
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
      const sections = Array.from(list.querySelectorAll<HTMLElement>('section[id^="set-"]'));
      const current = sections.filter((el) => el.getBoundingClientRect().top <= top).pop() ?? sections[0];
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
      setActive((atEnd ? sections[sections.length - 1] : current).id.slice(4));
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, []);

  const resetStyle = () => {
    const { background: bg, fontSettings, displaySettings } = initialBoard();
    setBackground(bg);
    setF(fontSettings);
    setDisplaySettings(displaySettings);
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
            <div role="radiogroup" aria-label="추천 배경" className="grid grid-cols-5 gap-2">
              {BACKGROUND_PRESETS.map((preset) => {
                const selected = isSameBackground(background, preset.background);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={preset.name}
                    title={preset.name}
                    onClick={() => {
                      setBackground(preset.background);
                      setF({ fontColor: preset.ink, scoreColor: preset.ink, numberColor: preset.ink, scoreStrokeColor: preset.ink === '#ffffff' ? '#1c1917' : '#ffffff' });
                    }}
                    className={clsx(
                      'grid aspect-square place-items-center rounded-md border transition-transform hover:-translate-y-0.5 active:scale-95',
                      selected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-line'
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
                  onData={(imageUrl) => setBg({ imageUrl })}
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
              label="시즌명·점수 글꼴"
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
            <Segmented
              label="정렬"
              value={font.textAlign}
              onChange={(textAlign) => setF({ textAlign })}
              options={[
                ['left', '왼쪽'],
                ['center', '가운데'],
                ['right', '오른쪽'],
              ]}
            />
            <ColorField label="색" value={font.fontColor ?? '#111827'} onChange={(fontColor) => setF({ fontColor })} />
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
            <Segmented label="굵기" value={String(font.scoreFontWeight ?? 400)} options={WEIGHTS} onChange={(w) => setF({ scoreFontWeight: Number(w) })} />
            <ColorField label="색" value={font.scoreColor ?? '#111827'} onChange={(scoreColor) => setF({ scoreColor })} />
            <Stroke
              width={font.scoreStrokeWidth ?? 0}
              color={font.scoreStrokeColor ?? '#ffffff'}
              max={5}
              onChange={(w, c) => setF({ scoreStrokeWidth: w, scoreStrokeColor: c })}
            />
          </Section>

          <Section id="number" title="아레나 번호">
            <Range label="크기" value={font.numberSize ?? 18} min={12} max={32} onChange={(numberSize) => setF({ numberSize })} />
            <ColorField label="색" value={font.numberColor ?? font.fontColor ?? '#111827'} onChange={(numberColor) => setF({ numberColor })} />
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
            {confirm === 'all' ? '모든 조합과 설정을 지울까요? 되돌릴 수 없어요.' : '배경·글꼴·점수 표기를 처음 상태로 되돌릴까요?'}
          </p>
        </Modal>
      )}
    </>
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
      <div className="flex h-touch items-center gap-2 rounded-md border border-line bg-surface pl-1.5 pr-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
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
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-caption font-semibold text-ink-muted">
          {label}
        </label>
        <span className="flex items-center rounded-md border border-line bg-surface pr-2 focus-within:border-primary">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            aria-label={`${label} 값`}
            onChange={(e) => e.target.value !== '' && onChange(clamp(Number(e.target.value)))}
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
        className="h-9 w-full accent-primary"
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
      <div className="grid gap-1 rounded-md bg-surface-sunken p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className={clsx(
              'flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-1 text-caption font-semibold tabular-nums transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary',
              value === v ? 'bg-surface text-ink shadow-e1' : 'text-ink-muted hover:text-ink'
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
    <div>
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
        className="flex h-touch cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-line px-4 text-label-md text-ink-muted transition-colors hover:border-primary hover:text-primary peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary"
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
