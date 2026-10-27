'use client';

import clsx from 'clsx';
import { ReactNode, useId, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { backgroundCss, fontFamilyOf } from '@/lib/board';
import { BACKGROUND_PRESETS, isSameBackground } from '@/lib/backgrounds';
import { formatScore } from '@/utils/scoreFormatter';
import { BackgroundData, FontSettings, ScoreDisplayType } from '@/types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CheckIcon } from './ui/icons';

type Section = 'background' | 'font' | 'display';

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

const FONT_OPTIONS: [FontSettings['fontFamily'], string][] = [
  ['Pretendard', 'Pretendard'],
  ['CookieRun', '쿠키런'],
  ['Custom', '직접 올리기'],
];

/**
 * 설정 서랍. 바꾸는 즉시 조합표에 반영되어 보면서 고를 수 있고,
 * '되돌리기'를 누르면 창을 열었을 때 상태로 돌아간다.
 */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
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
  const [section, setSection] = useState<Section>('background');
  const [confirmReset, setConfirmReset] = useState(false);

  const revert = () => {
    setBackground(snapshot.background);
    setF(snapshot.fontSettings);
    setDisplaySettings(snapshot.displaySettings);
  };

  const tabs: [Section, string][] = [
    ['background', '배경'],
    ['font', '글꼴·색'],
    ['display', '점수 표기'],
  ];

  return (
    <>
      <Modal
        title="설정"
        onClose={onClose}
        drawer
        footer={
          <>
            <Button variant="ghost" className="mr-auto !px-3 !text-danger hover:!bg-danger/10" onClick={() => setConfirmReset(true)}>
              전체 초기화
            </Button>
            <Button onClick={revert} disabled={!changed}>
              되돌리기
            </Button>
            <Button variant="primary" onClick={onClose}>
              완료
            </Button>
          </>
        }
      >
        <div role="tablist" aria-label="설정 항목" className="sticky top-0 z-10 flex gap-1 border-b border-line bg-surface/95 px-3 pt-1 backdrop-blur">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={section === key}
              aria-controls={`panel-${key}`}
              onClick={() => setSection(key)}
              className={clsx(
                '-mb-px h-touch flex-1 border-b-2 px-2 text-label-md transition-colors',
                section === key ? 'border-primary text-primary' : 'border-transparent text-ink-subtle hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`} className="space-y-6 p-5">
          {section === 'background' && (
            <>
              <fieldset>
                <legend className="sr-only">배경</legend>
                <div className="grid grid-cols-5 gap-2">
                  {BACKGROUND_PRESETS.map((preset) => {
                    const selected = isSameBackground(background, preset.background);
                    return (
                      <label key={preset.name} title={preset.name} className="group flex cursor-pointer flex-col items-center">
                        <input
                          type="radio"
                          name="bg-preset"
                          aria-label={preset.name}
                          className="peer sr-only"
                          checked={selected}
                          onChange={() => {
                            setBackground(preset.background);
                            setF({ fontColor: preset.ink, scoreColor: preset.ink, scoreStrokeColor: preset.ink === '#ffffff' ? '#1c1917' : '#ffffff' });
                          }}
                        />
                        <span
                          className={clsx(
                            'relative grid aspect-square w-full place-items-center rounded-md border transition-transform group-hover:-translate-y-0.5 group-active:scale-95 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
                            selected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-line'
                          )}
                          style={{ background: backgroundCss(preset.background) }}
                        >
                          {selected && (
                            <span style={{ color: preset.ink }} aria-hidden="true">
                              <CheckIcon className="h-5 w-5" />
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <CustomBackground background={background} onChange={setBackground} />
            </>
          )}

          {section === 'font' && (
            <>
              <div>
                <Segmented label="글꼴" value={font.fontFamily} options={FONT_OPTIONS} onChange={(fontFamily) => setF({ fontFamily })} />
                {font.fontFamily === 'Custom' && (
                  <div className="mt-2">
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
                  </div>
                )}
              </div>

              <Group title="시즌명">
                <Range label="글자 크기" value={font.fontSize} min={12} max={52} onChange={(fontSize) => setF({ fontSize })} />
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
                <ColorField label="글자색" value={font.fontColor ?? '#111827'} onChange={(fontColor) => setF({ fontColor })} />
              </Group>

              <Group title="점수">
                <ColorField label="글자색" value={font.scoreColor ?? '#111827'} onChange={(scoreColor) => setF({ scoreColor })} />
                <Range label="글자 크기" value={font.scoreFontSize ?? 14} min={10} max={48} onChange={(scoreFontSize) => setF({ scoreFontSize })} />
                <Range
                  label="외곽선 두께"
                  value={font.scoreStrokeWidth ?? 0}
                  min={0}
                  max={5}
                  step={0.5}
                  onChange={(scoreStrokeWidth) => setF({ scoreStrokeWidth })}
                />
                {!!font.scoreStrokeWidth && (
                  <ColorField label="외곽선 색" value={font.scoreStrokeColor ?? '#ffffff'} onChange={(scoreStrokeColor) => setF({ scoreStrokeColor })} />
                )}
              </Group>
            </>
          )}

          {section === 'display' && (
            <fieldset className="space-y-2">
              <legend className="sr-only">점수 표기 방식</legend>
              {(
                [
                  ['abbreviated', '숫자 간략화'],
                  ['comma', '기본 숫자'],
                  ['korean', '한글 단위'],
                ] as [ScoreDisplayType, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                    scoreDisplayType === value ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-cream'
                  )}
                >
                  <input
                    type="radio"
                    name="score-display"
                    checked={scoreDisplayType === value}
                    onChange={() => setDisplaySettings({ scoreDisplayType: value })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="flex-1 text-label-md">{label}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatScore('331000000', value)}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </Modal>

      {confirmReset && (
        <Modal
          title="전체 초기화"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <Button className="ml-auto" onClick={() => setConfirmReset(false)}>
                취소
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  reset();
                  showToast('초기화했어요');
                  setConfirmReset(false);
                  onClose();
                }}
              >
                모두 지우기
              </Button>
            </>
          }
        >
          <p className="p-5 text-body-md text-ink">모든 조합과 설정을 지울까요? 되돌릴 수 없어요.</p>
        </Modal>
      )}
    </>
  );
}

/** 직접 만들기: 단색 / 그라데이션 / 이미지 */
function CustomBackground({ background, onChange }: { background: BackgroundData; onChange: (b: BackgroundData) => void }) {
  const [open, setOpen] = useState(() => !BACKGROUND_PRESETS.some((p) => isSameBackground(background, p.background)));
  const color = background.color ?? '#fffbf5';
  const gradient = background.gradient ?? ['#ffc48c', '#f0845c'];

  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-touch w-full items-center justify-between rounded-lg px-4 text-label-md hover:bg-surface-cream"
      >
        직접 설정
        <span className={clsx('text-ink-subtle transition-transform', open && 'rotate-180')} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-line p-4">
          <Segmented
            label="종류"
            value={background.type}
            onChange={(type) => onChange({ ...background, type, color, gradient })}
            options={[
              ['color', '단색'],
              ['gradient', '그라데이션'],
              ['image', '이미지'],
            ]}
          />
          {background.type === 'color' && <ColorField label="배경색" value={color} onChange={(c) => onChange({ ...background, color: c })} />}
          {background.type === 'gradient' && (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <ColorField
                  key={i}
                  label={i === 0 ? '시작 색' : '끝 색'}
                  value={gradient[i]}
                  onChange={(c) => {
                    const next = [...gradient] as [string, string];
                    next[i] = c;
                    onChange({ ...background, gradient: next });
                  }}
                />
              ))}
            </div>
          )}
          {background.type === 'image' && (
            <>
              <FileButton
                label={background.imageUrl?.startsWith('data:') ? '이미지 바꾸기' : '이미지 파일 선택'}
                accept={IMAGE_TYPES.join(',')}
                validate={checkImage}
                onData={(imageUrl) => onChange({ ...background, imageUrl })}
              />
              <Field label="이미지 주소">
                {(id) => (
                  <input
                    id={id}
                    type="url"
                    value={background.imageUrl?.startsWith('data:') ? '' : background.imageUrl ?? ''}
                    onChange={(e) => onChange({ ...background, imageUrl: e.target.value })}
                    placeholder="https://"
                    className="field"
                  />
                )}
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-line p-4">
      <legend className="-ml-1 px-1 text-label-md">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-label-md">
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
      <label htmlFor={id} className="mb-1.5 block text-label-md">
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

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-label-md">
          {label}
        </label>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-caption tabular-nums text-ink-muted">{value}px</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-touch w-full accent-primary"
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
      <legend className="mb-1.5 text-label-md">{label}</legend>
      <div className="grid gap-1 rounded-md bg-surface-sunken p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className={clsx(
              'flex h-10 cursor-pointer items-center justify-center rounded-sm text-label-md transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary',
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
