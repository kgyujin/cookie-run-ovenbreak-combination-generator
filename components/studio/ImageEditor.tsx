'use client';

import clsx from 'clsx';
import { UIEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Pixels, Rgb, blend, detectBackground, resample } from '@/lib/studio/imageOps';
import { DEFAULT_SETTINGS, EditSettings, MAX_ENLARGE_SIDE, canEnlarge, clean, enlarge, finish, keepBox } from '@/lib/studio/editImage';
import { UpscaleError, upscale4x } from '@/lib/studio/upscale';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CloseIcon } from '../ui/icons';
import { Range, Segmented, Toggle } from '../settings/controls';
import { drawPixels, loadPixels, toPngBase64 } from './imageIO';

type Compare = 'original' | 'plain' | 'beforeBg';
type Zoom = 'fit' | '1' | '2' | '4';
type Backdrop = 'checker' | 'white' | 'black';
type Ai = { status: 'idle' } | { status: 'running'; progress: number } | { status: 'done'; pixels: Pixels } | { status: 'error'; message: string };

const MAX_COLORS = 5;
const BACKDROPS: Record<Backdrop, string> = {
  checker: 'bg-[repeating-conic-gradient(#e7e2da_0_25%,#fff_0_50%)] bg-[length:16px_16px]',
  white: 'bg-white',
  black: 'bg-[#1c1917]',
};
const toHex = (rgb: Rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * 이미지 다듬기 창 (관리 페이지): AI로 키우기, 배경 투명하게, 테두리 다듬기, 여백.
 * 왼쪽(원본, 그냥 키운 것, 투명화 전 중 하나)과 오른쪽(결과)을 나란히 같은 크기로 보여 주고, 확대하면 함께 움직인다.
 * 적용하면 PNG로 돌려주고, 여러 장을 올리는 중이면 같은 설정을 나머지에도 쓸 수 있다.
 */
export default function ImageEditor({
  sources,
  name,
  othersCount = 0,
  onApply,
  onClose,
}: {
  sources: string[];
  name: string;
  /** 같은 설정을 함께 적용할 수 있는 다른 이미지 수 (아이템 추가 창) */
  othersCount?: number;
  onApply: (result: { image: string; size: number }, settings: EditSettings, toOthers: boolean) => void;
  onClose: () => void;
}) {
  const [original, setOriginal] = useState<Pixels | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [ai, setAi] = useState<Ai>({ status: 'idle' });
  const [compare, setCompare] = useState<Compare>('original');
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [backdrop, setBackdrop] = useState<Backdrop>('checker');
  const [picking, setPicking] = useState(false);
  const [toOthers, setToOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EditSettings>) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    let active = true;
    loadPixels(sources)
      .then((pixels) => active && setOriginal(pixels))
      .catch((e) => {
        console.error('Failed to load image for editing:', e);
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
    // 처음 연 이미지만 (주소 목록이 새로 만들어져도 다시 불러오지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 슬라이더를 끄는 동안에도 화면이 버벅이지 않게, 무거운 계산은 조금 늦게 따라온다
  const s = useDeferredValue(settings);
  const ai4x = ai.status === 'done' ? ai.pixels : null;
  const plain = useMemo(() => original && enlarge(original, null, { scale: s.scale, aiStrength: 0 }), [original, s.scale]);
  const aiOnly = useMemo(
    () => (original && plain && ai4x && plain !== original ? resample(ai4x, plain.width, plain.height) : plain),
    [original, plain, ai4x],
  );
  const base = useMemo(() => plain && aiOnly && blend(plain, aiOnly, s.aiStrength / 100), [plain, aiOnly, s.aiStrength]);
  const autoColor = useMemo(() => base && detectBackground(base), [base]);
  // 슬라이더 하나를 움직일 때 그와 상관없는 단계는 다시 계산하지 않는다
  const { removeBg, colors, tolerance, softness, everywhere, shrink, feather, trim } = s;
  const cleaned = useMemo(
    () =>
      base &&
      clean(base, { ...DEFAULT_SETTINGS, removeBg, colors: colors ?? (autoColor ? [autoColor] : []), tolerance, softness, everywhere, shrink, feather }),
    [base, autoColor, removeBg, colors, tolerance, softness, everywhere, shrink, feather],
  );
  const box = useMemo(() => cleaned && keepBox(cleaned, { ...DEFAULT_SETTINGS, trim }), [cleaned, trim]);

  const outSize = box && { width: box.width + s.margin * 2, height: box.height + s.margin * 2 };
  const changed = !!original && !!base && (base !== original || cleaned !== base || outSize?.width !== original.width || outSize?.height !== original.height);

  // 창을 닫으면 진행 중인 키우기를 멈춘다 (그래픽 카드를 계속 쓰지 않게)
  const running = ai.status === 'running';
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const runAi = async () => {
    if (!original || !canEnlarge(original) || running) return;
    const controller = (abort.current = new AbortController());
    const { signal } = controller;
    setAi({ status: 'running', progress: 0 });
    try {
      const pixels = await upscale4x(original, (progress) => !signal.aborted && setAi({ status: 'running', progress }), signal);
      if (signal.aborted) return;
      setAi({ status: 'done', pixels });
      setSettings((s) => (s.scale === 1 ? { ...s, scale: 2 } : s));
      setCompare('plain'); // AI 전후를 바로 비교
    } catch (e) {
      if (signal.aborted) return;
      console.error('Failed to upscale:', e);
      setAi({ status: 'error', message: e instanceof UpscaleError ? e.message : 'AI로 키우지 못했어요. 이미지를 작게 해서 다시 해 주세요' });
    }
  };

  // 지울 색 더하기 (자동이었으면 자동으로 찾은 색도 함께 남긴다)
  const addColor = (color: Rgb) => {
    const current = settings.colors ?? (autoColor ? [autoColor] : []);
    if (!current.some((c) => c.every((v, k) => v === color[k]))) set({ colors: [...current, color].slice(-MAX_COLORS) });
  };

  // 미리보기를 누른 자리의 색을 지울 색으로 (지우기 전 그림에서)
  const pick = (x: number, y: number) => {
    if (!base) return;
    const i = (Math.min(base.height - 1, y) * base.width + Math.min(base.width - 1, x)) * 4;
    if (base.data[i + 3] < 128) return; // 이미 투명한 곳
    addColor([base.data[i], base.data[i + 1], base.data[i + 2]]);
    setPicking(false);
  };

  // 색 고르는 중에 Esc를 누르면 창을 닫지 않고 고르기만 그만둔다
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setPicking(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picking]);
  const colorInput = useRef<HTMLInputElement>(null);

  const apply = async () => {
    if (!original || !changed || running || saving) return;
    setSaving(true);
    try {
      // 늦게 따라오는 미리보기가 아니라 지금 설정 그대로 (AI를 돌리지 않았으면 나머지 이미지에도 AI를 쓰지 않음)
      const used = { ...settings, aiStrength: ai4x ? settings.aiStrength : 0 };
      const result = finish(clean(enlarge(original, ai4x, used), used), used);
      onApply(await toPngBase64(result), used, toOthers);
    } finally {
      setSaving(false);
    }
  };

  // 두 미리보기는 같이 움직인다
  const scrollers = useRef<(HTMLDivElement | null)[]>([]);
  const syncScroll = (from: number) => (e: UIEvent<HTMLDivElement>) => {
    const other = scrollers.current[1 - from];
    if (!other) return;
    other.scrollLeft = e.currentTarget.scrollLeft;
    other.scrollTop = e.currentTarget.scrollTop;
  };

  const compareOptions: [Compare, string][] = [['original', '원본']];
  if (settings.scale > 1) compareOptions.push(['plain', '그냥 키운 것']);
  if (cleaned !== base) compareOptions.push(['beforeBg', '투명화 전']);
  // 고른 비교 대상이 없어지면(배율을 되돌리는 등) 원본으로
  const shownCompare = compareOptions.some(([v]) => v === compare) ? compare : 'original';
  const left = shownCompare === 'plain' ? plain : shownCompare === 'beforeBg' ? base : original;

  const enlargeable = !!original && canEnlarge(original);

  return (
    <Modal
      title={`이미지 다듬기: ${name}`}
      onClose={onClose}
      className="modal-full"
      footer={
        <>
          <p className="text-caption tabular-nums text-ink-muted">
            {original && outSize && `${original.width}×${original.height} → ${outSize.width}×${outSize.height}px`}
          </p>
          {othersCount > 0 && (
            <label className="ml-auto flex items-center gap-2 text-caption font-semibold text-ink-muted">
              <input type="checkbox" checked={toOthers} onChange={(e) => setToOthers(e.target.checked)} className="h-4 w-4 accent-primary-ink" />
              나머지 {othersCount}장에도 같은 설정 적용
            </label>
          )}
          <Button className={othersCount > 0 ? '' : 'ml-auto'} onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={apply} aria-disabled={!changed || running || saving}>
            {saving ? '적용하는 중…' : '적용'}
          </Button>
        </>
      }
    >
      <div className="flex min-h-full flex-col gap-4 p-4 lg:h-full lg:flex-row">
        {/* 미리보기 (좁은 화면에서는 설정을 내려도 미리보기가 위에 남는다) */}
        <div className="flex min-w-0 flex-col gap-3 max-lg:contents lg:flex-1">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:min-w-[16rem] sm:flex-1">
              <Segmented label="왼쪽에 보기" value={shownCompare} options={compareOptions} onChange={setCompare} />
            </div>
            <div className="w-full sm:w-[24rem]">
              <Segmented
                label="확대"
                value={zoom}
                options={[
                  ['fit', '맞춤'],
                  ['1', '100%'],
                  ['2', '200%'],
                  ['4', '400%'],
                ]}
                onChange={setZoom}
              />
            </div>
            <div className="w-full sm:w-[19rem]">
              <Segmented
                label="바탕"
                value={backdrop}
                options={[
                  ['checker', '바둑판'],
                  ['white', '흰색'],
                  ['black', '검은색'],
                ]}
                onChange={setBackdrop}
              />
            </div>
          </div>
          <div className="grid h-[36dvh] min-h-0 grid-cols-2 gap-2 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:-mx-4 max-lg:bg-surface max-lg:px-4 max-lg:py-2 lg:h-auto lg:flex-1">
            {loadError ? (
              <p role="alert" className="col-span-2 self-center text-center text-body-md text-ink">
                이미지를 불러오지 못했어요. 사이트에 반영된 뒤 다시 해 주세요.
              </p>
            ) : !original || !left || !cleaned || !box ? (
              <span className="col-span-2 h-8 w-8 animate-spin place-self-center rounded-full border-4 border-primary-soft border-t-primary-ink" role="status" aria-label="이미지를 불러오는 중" />
            ) : (
              <>
                <Preview
                  label={compareOptions.find(([v]) => v === shownCompare)![1]}
                  pixels={left}
                  size={cleaned}
                  zoom={zoom}
                  backdrop={backdrop}
                  picking={picking}
                  onPick={pick}
                  scrollRef={(el) => (scrollers.current[0] = el)}
                  onScroll={syncScroll(0)}
                />
                <Preview
                  label="결과"
                  pixels={cleaned}
                  size={cleaned}
                  box={box}
                  zoom={zoom}
                  backdrop={backdrop}
                  picking={picking}
                  onPick={pick}
                  scrollRef={(el) => (scrollers.current[1] = el)}
                  onScroll={syncScroll(1)}
                />
              </>
            )}
          </div>
          <p className="text-caption text-ink-subtle">
            {picking ? '지울 색이 있는 곳을 미리보기에서 눌러 주세요.' : '점선 안이 저장돼요. 확대하면 두 그림이 함께 움직여요.'}
          </p>
        </div>

        {/* 설정 */}
        <div className="space-y-6 lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <section className="space-y-3" aria-labelledby="edit-enlarge">
            <h3 id="edit-enlarge" className="text-label-md text-ink">
              키우기
            </h3>
            {enlargeable ? (
              <>
                <Segmented
                  label="배율"
                  value={String(settings.scale)}
                  options={[
                    ['1', '그대로'],
                    ['2', '2배'],
                    ['3', '3배'],
                    ['4', '4배'],
                  ]}
                  onChange={(v) => set({ scale: Number(v) as EditSettings['scale'] })}
                />
                {ai.status === 'done' ? (
                  <Range label="AI 강도 (0이면 그냥 키운 것)" unit="%" value={settings.aiStrength} min={0} max={100} step={5} onChange={(aiStrength) => set({ aiStrength })} />
                ) : running ? (
                  <div role="status" className="space-y-1">
                    <p className="text-caption text-ink-muted">{ai.progress === 0 ? '모델을 불러오는 중 (처음 한 번 약 9MB)' : `AI로 키우는 중 ${Math.round(ai.progress * 100)}%`}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                      <div className="h-full bg-primary-ink transition-[width]" style={{ width: `${ai.progress * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <Button className="w-full" onClick={runAi} aria-disabled={!original}>
                      AI로 선명하게 키우기
                    </Button>
                    {ai.status === 'error' && (
                      <p role="alert" className="text-caption font-semibold text-danger">
                        {ai.message}
                      </p>
                    )}
                  </>
                )}
                <p className="text-caption text-ink-subtle">
                  애니메이션 그림용 Real-ESRGAN으로 선을 살려 키워요. 이 컴퓨터의 그래픽 카드로 계산해서 몇 초 걸려요. 왼쪽을 &apos;그냥 키운 것&apos;으로 두면 AI 전후를 비교할 수 있어요.
                </p>
              </>
            ) : (
              <p className="text-caption text-ink-subtle">{MAX_ENLARGE_SIDE}px보다 큰 이미지는 키우지 않아요 (이미 충분히 커요).</p>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-bg">
            <h3 id="edit-bg" className="text-label-md text-ink">
              배경 투명하게
            </h3>
            <Toggle
              label="배경 지우기"
              checked={settings.removeBg}
              onChange={(removeBg) => {
                set({ removeBg });
                if (!removeBg) setPicking(false);
              }}
            />
            {settings.removeBg && (
              <>
                <div className="space-y-2">
                  <p className="text-caption font-semibold text-ink-muted">지울 색</p>
                  <ul className="flex flex-wrap gap-2">
                    {settings.colors ? (
                      settings.colors.map((color, i) => (
                        <li key={i} className="flex items-center gap-1 rounded-full border border-line py-1 pl-1 pr-1.5">
                          <span className="h-5 w-5 rounded-full border border-line" style={{ backgroundColor: toHex(color) }} aria-hidden="true" />
                          <span className="text-caption tabular-nums text-ink-muted">{toHex(color)}</span>
                          <button
                            type="button"
                            aria-label={`${toHex(color)} 빼기`}
                            onClick={() => set({ colors: settings.colors!.length > 1 ? settings.colors!.filter((_, j) => j !== i) : null })}
                            className="grid h-6 w-6 place-items-center rounded-full text-ink-subtle hover:bg-surface-sunken hover:text-ink [&_svg]:h-3.5 [&_svg]:w-3.5"
                          >
                            <CloseIcon />
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-2.5">
                        <span className="h-5 w-5 rounded-full border border-line" style={{ backgroundColor: autoColor ? toHex(autoColor) : undefined }} aria-hidden="true" />
                        <span className="text-caption text-ink-muted">{autoColor ? `자동 (가장자리 색 ${toHex(autoColor)})` : '자동 (가장자리가 이미 투명해서 지울 색 없음)'}</span>
                      </li>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <Button className="flex-1" aria-pressed={picking} onClick={() => setPicking((p) => !p)}>
                      {picking ? '고르기 취소' : '미리보기에서 색 고르기'}
                    </Button>
                    {settings.colors && <Button onClick={() => set({ colors: null })}>자동으로</Button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={colorInput} type="color" defaultValue="#ffffff" aria-label="직접 고를 색" className="h-touch w-12 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1" />
                    <Button
                      className="flex-1"
                      onClick={() => {
                        const hex = colorInput.current?.value ?? '';
                        addColor([1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as Rgb);
                      }}
                    >
                      이 색 더하기
                    </Button>
                  </div>
                </div>
                <Range label="비슷한 색까지" unit="" value={settings.tolerance} min={0} max={40} onChange={(tolerance) => set({ tolerance })} />
                <Range label="가장자리 부드럽게" unit="" value={settings.softness} min={0} max={30} onChange={(softness) => set({ softness })} />
                <Toggle label="떨어진 곳도 지우기" checked={settings.everywhere} onChange={(everywhere) => set({ everywhere })} />
                <p className="text-caption text-ink-subtle">가장자리와 이어진 배경만 지워요. 팔 사이 빈틈처럼 막힌 곳도 지우려면 켜 주세요. 너무 높이면 그림 속 비슷한 색까지 지워져요.</p>
              </>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-edge">
            <h3 id="edit-edge" className="text-label-md text-ink">
              테두리
            </h3>
            <Range label="가장자리 깎기 (남은 배경 띠 없애기)" value={settings.shrink} min={0} max={4} onChange={(shrink) => set({ shrink })} />
            <Range label="가장자리 흐리게" value={settings.feather} min={0} max={3} onChange={(feather) => set({ feather })} />
          </section>

          <section className="space-y-3" aria-labelledby="edit-margin">
            <h3 id="edit-margin" className="text-label-md text-ink">
              여백
            </h3>
            <Toggle label="투명한 여백 자르기" checked={settings.trim} onChange={(trim) => set({ trim })} />
            <Range label="바깥 여백" value={settings.margin} min={0} max={64} onChange={(margin) => set({ margin })} />
          </section>
        </div>
      </div>
    </Modal>
  );
}

/** 미리보기 한 칸. size(결과 크기) 기준으로 그려서 왼쪽과 오른쪽이 같은 크기로 겹쳐 보이게 한다 */
function Preview({
  label,
  pixels,
  size,
  box,
  zoom,
  backdrop,
  picking,
  onPick,
  scrollRef,
  onScroll,
}: {
  label: string;
  pixels: Pixels;
  size: { width: number; height: number };
  box?: { x: number; y: number; width: number; height: number };
  zoom: Zoom;
  backdrop: Backdrop;
  picking: boolean;
  onPick: (x: number, y: number) => void;
  scrollRef: (el: HTMLDivElement | null) => void;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (canvasRef.current) drawPixels(canvasRef.current, pixels);
  }, [pixels]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setArea({ width: el.clientWidth - 16, height: el.clientHeight - 16 }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 화면 1px에 결과 몇 px인지: 맞춤이면 칸에 꼭 맞게, 아니면 배율 그대로
  const scale = zoom === 'fit' ? Math.max(0.01, Math.min(area.width / size.width, area.height / size.height)) : Number(zoom);
  const shown = { width: size.width * scale, height: size.height * scale };

  return (
    <figure className="flex min-h-0 min-w-0 flex-col gap-1">
      <figcaption className="text-caption font-semibold text-ink-muted">{label}</figcaption>
      <div
        ref={(el) => {
          areaRef.current = el;
          scrollRef(el);
        }}
        onScroll={onScroll}
        className={clsx('relative min-h-0 flex-1 overflow-auto rounded-lg border border-line', BACKDROPS[backdrop])}
      >
        <div className="grid min-h-full min-w-full place-items-center p-2" style={{ width: zoom === 'fit' ? undefined : shown.width + 16 }}>
          <div className="relative" style={shown}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={label}
              onClick={(e) => picking && onPick(Math.floor(e.nativeEvent.offsetX / scale), Math.floor(e.nativeEvent.offsetY / scale))}
              className={clsx('block h-full w-full', picking && 'cursor-crosshair')}
              // 직접 확대했을 때는 픽셀을 그대로 (맞춤일 때는 자연스럽게)
              style={{ imageRendering: zoom !== 'fit' && scale >= 2 ? 'pixelated' : 'auto' }}
            />
            {box && (box.width !== size.width || box.height !== size.height) && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute border-2 border-dashed border-primary-ink"
                style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}
              />
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
