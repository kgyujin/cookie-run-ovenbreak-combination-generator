'use client';

import clsx from 'clsx';
import { PointerEvent, UIEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Mask, Pixels, Rgb, Stroke, blend, detectBackground, resample } from '@/lib/studio/imageOps';
import { DEFAULT_SETTINGS, EditSettings, MAX_ENLARGE_SIDE, aiKey, aiOptions, canEnlarge, clean, edges, enlarge, finish, keepBox, paint, removeBg } from '@/lib/studio/editImage';
import { AiError } from '@/lib/studio/graphModel';
import { findCharacter } from '@/lib/studio/segment';
import { upscaleAi } from '@/lib/studio/upscale';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CloseIcon, EraserIcon, UndoIcon } from '../ui/icons';
import { Range, Segmented, Toggle } from '../settings/controls';
import CompareViewer from './CompareViewer';
import { drawPixels, loadPixels, toPngBase64 } from './imageIO';
import { BACKDROPS, Backdrop, Zoom, useFitScale } from './preview';

type Compare = 'original' | 'plain' | 'beforeBg';
/** 미리보기를 눌렀을 때: 크게 보기, 지울 색 고르기, 지우기 붓, 살리기 붓 */
type Tool = 'view' | 'pick' | 'erase' | 'keep';
/** 진행 중인 AI 계산 (한 번에 하나). progress가 null이면 아직 모델을 불러오는 중. label은 시작할 때의 설정 */
type Job = { kind: 'upscale' | 'segment'; progress: number | null; label?: string };

const MAX_COLORS = 5;
const toHex = (rgb: Rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const NOISES: [string, string][] = [
  ['-1', '없음'],
  ['0', '약'],
  ['1', '중'],
  ['2', '강'],
  ['3', '최강'],
];
const failMessage = (e: unknown, fallback: string) => (e instanceof AiError ? e.message : fallback);

/**
 * 이미지 다듬기 창 (관리 페이지): AI로 키우기(waifu2x, Real-ESRGAN), 배경 투명하게(색 또는 AI 캐릭터 인식), 붓으로 고치기, 테두리, 여백.
 * 왼쪽(원본, 그냥 키운 것, 투명화 전 중 하나)과 오른쪽(결과)을 나란히 같은 크기로 보여 주고, 확대하면 함께 움직인다. 누르면 크게 겹쳐 비교한다.
 * 적용하면 PNG로 돌려주고, 여러 장을 올리는 중이면 같은 설정을 나머지에도 쓸 수 있다 (붓 자국은 이 그림에만).
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
  /** AI로 키운 결과 (설정마다 한 번만 계산) */
  const [aiResults, setAiResults] = useState<Record<string, Pixels>>({});
  const [mask, setMask] = useState<Mask | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [maskError, setMaskError] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [compare, setCompare] = useState<Compare>('original');
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [backdrop, setBackdrop] = useState<Backdrop>('checker');
  const [tool, setTool] = useState<Tool>('view');
  const [brush, setBrush] = useState(20);
  const [viewing, setViewing] = useState(false);
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
  const enlargeable = !!original && canEnlarge(original);
  const aiPixels = aiResults[aiKey(s)] ?? null;
  const plain = useMemo(() => original && enlarge(original, null, { scale: s.scale, aiStrength: 0 }), [original, s.scale]);
  const aiSized = useMemo(() => (plain && aiPixels && enlargeable ? resample(aiPixels, plain.width, plain.height) : null), [plain, aiPixels, enlargeable]);
  const base = useMemo(() => plain && (aiSized ? blend(plain, aiSized, s.aiStrength / 100) : plain), [plain, aiSized, s.aiStrength]);
  const autoColor = useMemo(() => base && detectBackground(base), [base]);
  // 슬라이더 하나를 움직일 때 그와 상관없는 단계는 다시 계산하지 않는다
  const { removeBg: removeOn, bgMethod, aiLevel, aiEdge, colors, tolerance, softness, everywhere, shrink, feather, trim } = s;
  const removed = useMemo(
    () =>
      base &&
      removeBg(
        base,
        { ...DEFAULT_SETTINGS, removeBg: removeOn, bgMethod, aiLevel, aiEdge, colors: colors ?? (autoColor ? [autoColor] : []), tolerance, softness, everywhere },
        mask
      ),
    [base, autoColor, mask, removeOn, bgMethod, aiLevel, aiEdge, colors, tolerance, softness, everywhere]
  );
  const painted = useMemo(() => removed && base && paint(removed, base, strokes), [removed, base, strokes]);
  const cleaned = useMemo(() => painted && edges(painted, { shrink, feather }), [painted, shrink, feather]);
  const box = useMemo(() => cleaned && keepBox(cleaned, { trim }), [cleaned, trim]);

  const outSize = box && { width: box.width + s.margin * 2, height: box.height + s.margin * 2 };
  const changed = !!original && !!base && (base !== original || cleaned !== base || outSize?.width !== original.width || outSize?.height !== original.height);

  // 창을 닫으면 진행 중인 AI 계산을 멈춘다 (그래픽 카드를 계속 쓰지 않게)
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const startJob = (job: Job) => {
    const controller = (abort.current = new AbortController());
    setJob(job);
    return controller.signal;
  };

  const runAi = async () => {
    if (!original || !enlargeable || job) return;
    const key = aiKey(settings);
    // 계산하는 동안 설정을 바꿔도 결과는 시작할 때의 설정에 저장된다 (진행 표시에 그 설정을 함께 보여 줌)
    const label = `${settings.engine === 'esrgan' ? 'Real-ESRGAN' : `waifu2x 노이즈 ${NOISES.find(([v]) => v === String(settings.noise))![1]}`}, ${settings.scale === 1 ? '크기 그대로' : `${settings.scale}배`}`;
    const signal = startJob({ kind: 'upscale', progress: null, label });
    setAiError(null);
    try {
      const pixels = await upscaleAi(original, aiOptions(settings), (progress) => !signal.aborted && setJob({ kind: 'upscale', progress, label }), signal);
      if (signal.aborted) return;
      setAiResults((r) => ({ ...r, [key]: pixels }));
      if (settings.scale > 1) setCompare('plain'); // AI 전후를 바로 비교
    } catch (e) {
      if (signal.aborted) return;
      console.error('Failed to upscale:', e);
      setAiError(failMessage(e, 'AI로 키우지 못했어요. 이미지를 작게 해서 다시 해 주세요'));
    } finally {
      if (!signal.aborted) setJob(null);
    }
  };

  const runSegment = async () => {
    if (!original || job) return;
    const signal = startJob({ kind: 'segment', progress: null });
    setMaskError(null);
    try {
      const found = await findCharacter(original, signal, (progress) => !signal.aborted && setJob({ kind: 'segment', progress }));
      if (signal.aborted) return;
      setMask(found);
    } catch (e) {
      if (signal.aborted) return;
      console.error('Failed to find character:', e);
      setMaskError(failMessage(e, '캐릭터를 찾지 못했어요. 다시 해 주세요'));
    } finally {
      if (!signal.aborted) setJob(null);
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
    setTool('view');
  };

  // 붓으로 그은 획 (화면에서는 결과 픽셀 좌표, 저장은 그림 크기에 대한 비율이라 배율을 바꿔도 같은 자리)
  const addStroke = (points: [number, number][]) => {
    if (!cleaned || !points.length || (tool !== 'erase' && tool !== 'keep')) return;
    const { width, height } = cleaned;
    setStrokes((list) => [...list, { erase: tool === 'erase', size: brush / width, points: points.map(([x, y]) => [x / width, y / height]) }]);
  };
  const undoStroke = () => setStrokes((list) => list.slice(0, -1));

  // Esc: 창을 닫지 않고 도구만 내려놓는다. Ctrl+Z: 붓 한 획 되돌리기 (입력 칸에서는 원래대로)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewing) return;
      if (e.key === 'Escape' && tool !== 'view') {
        e.preventDefault();
        e.stopPropagation();
        setTool('view');
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, textarea')) {
        e.preventDefault();
        setStrokes((list) => list.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tool, viewing]);
  const colorInput = useRef<HTMLInputElement>(null);

  const apply = async () => {
    if (!original || !changed || job || saving) return;
    setSaving(true);
    try {
      // 늦게 따라오는 미리보기가 아니라 지금 설정 그대로. 계산하지 않은 AI는 쓰지 않는다 (나머지 이미지에도)
      const ai = aiResults[aiKey(settings)] ?? null;
      const used: EditSettings = {
        ...settings,
        aiStrength: ai ? settings.aiStrength : 0,
        removeBg: settings.removeBg && (settings.bgMethod === 'color' || !!mask),
      };
      const result = finish(clean(enlarge(original, ai, used), used, mask, strokes), used);
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
  if (settings.scale > 1 && enlargeable) compareOptions.push(['plain', '그냥 키운 것']);
  if (removed !== base) compareOptions.push(['beforeBg', '투명화 전']);
  // 고른 비교 대상이 없어지면(배율을 되돌리는 등) 원본으로
  const shownCompare = compareOptions.some(([v]) => v === compare) ? compare : 'original';
  const left = shownCompare === 'plain' ? plain : shownCompare === 'beforeBg' ? base : original;
  const leftLabel = compareOptions.find(([v]) => v === shownCompare)![1];

  const hasAi = !!aiResults[aiKey(settings)];
  const running = job?.kind;
  const modelSize = settings.engine === 'esrgan' ? '약 9MB' : settings.scale > 2 && settings.noise >= 0 ? '약 5MB' : '약 3MB';
  const toggleTool = (t: Tool) => setTool((now) => (now === t ? 'view' : t));
  const hint =
    tool === 'pick'
      ? '지울 색이 있는 곳을 미리보기에서 눌러 주세요. Esc를 누르면 그만둬요.'
      : tool === 'erase' || tool === 'keep'
        ? `미리보기 위를 문질러 ${tool === 'erase' ? '지울' : '살릴'} 곳을 칠해 주세요. Ctrl+Z로 한 획씩 되돌리고, Esc를 누르면 붓을 내려놓아요.`
        : '그림을 누르면 크게 겹쳐 볼 수 있어요. 점선 안이 저장돼요. 확대하면 두 그림이 함께 움직여요.';

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
          <Button variant="primary" onClick={apply} aria-disabled={!changed || !!job || saving}>
            {saving ? '적용하는 중…' : '적용'}
          </Button>
        </>
      }
    >
      <div className="flex min-h-full flex-col gap-4 p-4 lg:h-full lg:flex-row">
        {/* 미리보기 (좁은 화면에서는 설정을 내려도 미리보기가 위에 남는다) */}
        <div className="flex min-w-0 flex-col gap-3 max-lg:contents lg:flex-1">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:min-w-[12rem] sm:flex-1">
              <Segmented label="왼쪽에 보기" value={shownCompare} options={compareOptions} onChange={setCompare} />
            </div>
            <div className="w-full sm:w-[16rem]">
              <Segmented
                label="확대"
                itemWidth="3.5em"
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
            <div className="w-full sm:w-[13rem]">
              <Segmented
                label="바탕"
                itemWidth="3.5em"
                value={backdrop}
                options={[
                  ['checker', '바둑판'],
                  ['white', '흰색'],
                  ['black', '검은색'],
                ]}
                onChange={setBackdrop}
              />
            </div>
            <Button onClick={() => cleaned && setViewing(true)} aria-disabled={!cleaned} className="max-sm:w-full">
              크게 보기
            </Button>
          </div>
          <div className="grid h-[36dvh] min-h-0 grid-cols-2 gap-2 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:-mx-4 max-lg:bg-surface max-lg:px-4 max-lg:py-2 lg:h-auto lg:flex-1">
            {loadError ? (
              <p role="alert" className="col-span-2 self-center text-center text-body-md text-ink">
                이미지를 불러오지 못했어요. 사이트에 반영된 뒤 다시 해 주세요.
              </p>
            ) : !original || !left || !cleaned || !box ? (
              <span className="col-span-2 h-8 w-8 animate-spin place-self-center rounded-full border-4 border-primary-soft border-t-primary-ink" role="status" aria-label="이미지를 불러오는 중" />
            ) : (
              [left, cleaned].map((pixels, i) => (
                <Preview
                  key={i}
                  label={i ? '결과' : leftLabel}
                  pixels={pixels}
                  size={cleaned}
                  box={i ? box : undefined}
                  zoom={zoom}
                  backdrop={backdrop}
                  tool={tool}
                  brush={brush}
                  onPick={pick}
                  onStroke={addStroke}
                  onOpen={() => setViewing(true)}
                  scrollRef={(el) => (scrollers.current[i] = el)}
                  onScroll={syncScroll(i)}
                />
              ))
            )}
          </div>
          <p className="text-caption text-ink-subtle">{hint}</p>
        </div>

        {/* 설정 */}
        <div className="space-y-6 lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <section className="space-y-3" aria-labelledby="edit-enlarge">
            <h3 id="edit-enlarge" className="text-label-md text-ink">
              AI로 키우기
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
                <Segmented
                  label="AI 모델"
                  value={settings.engine}
                  options={[
                    ['waifu2x', 'waifu2x'],
                    ['esrgan', 'Real-ESRGAN'],
                  ]}
                  onChange={(engine) => set({ engine })}
                />
                {settings.engine === 'waifu2x' && (
                  <Segmented label="노이즈 제거" itemWidth="3em" value={String(settings.noise)} options={NOISES} onChange={(v) => set({ noise: Number(v) as EditSettings['noise'] })} />
                )}
                {running === 'upscale' ? (
                  <div role="status" className="space-y-1">
                    <p className="text-caption text-ink-muted">
                      {job?.progress == null ? `모델을 불러오는 중 (처음 한 번 ${modelSize})` : `AI로 계산하는 중 ${Math.round(job.progress * 100)}%`} ({job?.label})
                    </p>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                      <div className="h-full bg-primary-ink transition-[width]" style={{ width: `${(job?.progress ?? 0) * 100}%` }} />
                    </div>
                  </div>
                ) : hasAi ? (
                  <Range label="AI 강도 (0이면 그냥 키운 것)" unit="%" value={settings.aiStrength} min={0} max={100} step={5} onChange={(aiStrength) => set({ aiStrength })} />
                ) : (
                  <>
                    <Button variant="primary" className="w-full" onClick={runAi} aria-disabled={!original || !!job}>
                      {settings.scale === 1 ? 'AI로 다듬기 (크기 그대로)' : `AI로 ${settings.scale}배 키우기`}
                    </Button>
                    {aiError && (
                      <p role="alert" className="text-caption font-semibold text-danger">
                        {aiError}
                      </p>
                    )}
                  </>
                )}
                <p className="text-caption text-ink-subtle">
                  {settings.engine === 'waifu2x'
                    ? 'waifu2x 사이트와 같은 모델이에요. 원본 색과 선을 그대로 지키면서 키워요. JPG처럼 뭉개진 그림일수록 노이즈 제거를 높여 주세요. 3배, 4배는 2배를 두 번 해요.'
                    : '선을 더 또렷하게 그려 넣어요. 색은 원본과 달라지지 않게 맞춰요. 작은 무늬나 반짝이는 뭉개질 수 있어요.'}{' '}
                  이 컴퓨터의 그래픽 카드로 계산해요. 왼쪽을 &apos;그냥 키운 것&apos;으로 두면 AI 전후를 비교할 수 있어요.
                </p>
              </>
            ) : (
              <p className="text-caption text-ink-subtle">{MAX_ENLARGE_SIDE}px보다 큰 이미지는 키우지 않아요 (이미 충분히 커요). 배경 지우기는 쓸 수 있어요.</p>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-bg">
            <h3 id="edit-bg" className="text-label-md text-ink">
              배경 투명하게
            </h3>
            <Toggle
              label="배경 지우기"
              checked={settings.removeBg}
              onChange={(on) => {
                set({ removeBg: on });
                if (!on && tool === 'pick') setTool('view');
              }}
            />
            {settings.removeBg && (
              <>
                <Segmented
                  label="지우는 방법"
                  value={settings.bgMethod}
                  options={[
                    ['color', '색으로'],
                    ['ai', 'AI로 캐릭터 찾기'],
                  ]}
                  onChange={(m) => {
                    set({ bgMethod: m });
                    if (tool === 'pick') setTool('view');
                  }}
                />
                {settings.bgMethod === 'ai' ? (
                  <>
                    {mask ? (
                      <>
                        <Range label="남길 기준 (높일수록 확실한 곳만)" unit="%" value={settings.aiLevel} min={5} max={95} onChange={(v) => set({ aiLevel: v })} />
                        <Range label="경계 부드럽게" unit="%" value={settings.aiEdge} min={0} max={100} step={5} onChange={(v) => set({ aiEdge: v })} />
                      </>
                    ) : running === 'segment' ? (
                      <div role="status" className="space-y-1">
                        <p className="text-caption text-ink-muted">
                          {job?.progress == null ? '모델을 불러오는 중 (처음 한 번 약 44MB)' : `캐릭터를 찾는 중 ${Math.round(job.progress * 100)}%`}
                        </p>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                          <div className="h-full bg-primary-ink transition-[width]" style={{ width: `${(job?.progress ?? 0) * 100}%` }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button variant="primary" className="w-full" onClick={runSegment} aria-disabled={!original || !!job}>
                          AI로 캐릭터 찾기
                        </Button>
                        {maskError && (
                          <p role="alert" className="text-caption font-semibold text-danger">
                            {maskError}
                          </p>
                        )}
                      </>
                    )}
                    <p className="text-caption text-ink-subtle">
                      애니 그림 캐릭터를 알아보는 모델(isnet-anime)로 배경과 색이 비슷해도 캐릭터만 남겨요. 남거나 빠진 곳은 아래 붓으로 고쳐 주세요.
                    </p>
                  </>
                ) : (
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
                        <Button className="flex-1" aria-pressed={tool === 'pick'} onClick={() => toggleTool('pick')}>
                          {tool === 'pick' ? '고르기 취소' : '미리보기에서 색 고르기'}
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
                    <Range label="비슷한 색까지" unit="" value={settings.tolerance} min={0} max={40} onChange={(v) => set({ tolerance: v })} />
                    <Range label="가장자리 부드럽게" unit="" value={settings.softness} min={0} max={30} onChange={(v) => set({ softness: v })} />
                    <Toggle label="떨어진 곳도 지우기" checked={settings.everywhere} onChange={(v) => set({ everywhere: v })} />
                    <p className="text-caption text-ink-subtle">
                      가장자리와 이어진 배경만 지워요. 팔 사이 빈틈처럼 막힌 곳도 지우려면 켜 주세요. 너무 높이면 그림 속 비슷한 색까지 지워져요. 배경과 그림 색이 비슷하면
                      &apos;AI로 캐릭터 찾기&apos;를 써 주세요.
                    </p>
                  </>
                )}
              </>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-brush">
            <h3 id="edit-brush" className="text-label-md text-ink">
              붓으로 고치기
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button aria-pressed={tool === 'erase'} onClick={() => toggleTool('erase')} className={clsx(tool === 'erase' && 'ring-2 ring-primary-ink')}>
                <EraserIcon />
                지우기 붓
              </Button>
              <Button aria-pressed={tool === 'keep'} onClick={() => toggleTool('keep')} className={clsx(tool === 'keep' && 'ring-2 ring-primary-ink')}>
                <BrushIcon />
                살리기 붓
              </Button>
            </div>
            <Range label="붓 크기" value={brush} min={2} max={200} onChange={setBrush} />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={undoStroke} aria-disabled={!strokes.length}>
                <UndoIcon className="h-4 w-4" />
                한 획 되돌리기
              </Button>
              <Button className="flex-1" onClick={() => setStrokes([])} aria-disabled={!strokes.length}>
                붓 자국 모두 지우기
              </Button>
            </div>
            <p className="text-caption text-ink-subtle">
              살리기 붓은 배경을 지우기 전 그림으로 되돌려요. 붓 자국은 이 이미지에만 남고, 나머지 이미지에 같은 설정을 적용할 때는 빠져요.
            </p>
          </section>

          <section className="space-y-3" aria-labelledby="edit-edge">
            <h3 id="edit-edge" className="text-label-md text-ink">
              테두리
            </h3>
            <Range label="가장자리 깎기 (남은 배경 띠 없애기)" value={settings.shrink} min={0} max={4} onChange={(v) => set({ shrink: v })} />
            <Range label="가장자리 흐리게" value={settings.feather} min={0} max={3} onChange={(v) => set({ feather: v })} />
          </section>

          <section className="space-y-3" aria-labelledby="edit-margin">
            <h3 id="edit-margin" className="text-label-md text-ink">
              여백
            </h3>
            <Toggle label="투명한 여백 자르기" checked={settings.trim} onChange={(v) => set({ trim: v })} />
            <Range label="바깥 여백" value={settings.margin} min={0} max={64} onChange={(v) => set({ margin: v })} />
          </section>
        </div>
      </div>
      {viewing && cleaned && left && <CompareViewer before={left} after={cleaned} beforeLabel={leftLabel} initialBackdrop={backdrop} onClose={() => setViewing(false)} />}
    </Modal>
  );
}

const BrushIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2L14 4ZM4 20c1.5 0 3-.5 3.5-2" />
  </svg>
);

/** 미리보기 한 칸. size(결과 크기) 기준으로 그려서 왼쪽과 오른쪽이 같은 크기로 겹쳐 보이게 한다 */
function Preview({
  label,
  pixels,
  size,
  box,
  zoom,
  backdrop,
  tool,
  brush,
  onPick,
  onStroke,
  onOpen,
  scrollRef,
  onScroll,
}: {
  label: string;
  pixels: Pixels;
  size: { width: number; height: number };
  box?: { x: number; y: number; width: number; height: number };
  zoom: Zoom;
  backdrop: Backdrop;
  tool: Tool;
  /** 붓 지름 (결과 픽셀) */
  brush: number;
  onPick: (x: number, y: number) => void;
  onStroke: (points: [number, number][]) => void;
  onOpen: () => void;
  scrollRef: (el: HTMLDivElement | null) => void;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(areaRef, size, zoom, 16);
  const shown = { width: size.width * scale, height: size.height * scale };
  const painting = tool === 'erase' || tool === 'keep';
  const points = useRef<[number, number][] | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawPixels(canvasRef.current, pixels);
  }, [pixels]);

  // 누른 자리 (결과 픽셀 좌표)
  const at = (e: { clientX: number; clientY: number; currentTarget: Element }): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * size.width, ((e.clientY - rect.top) / rect.height) * size.height];
  };
  // 긋는 중인 획은 겹친 캔버스에 바로 그려 보여 주고, 손을 떼면 넘긴다
  const drawLive = () => {
    const c = strokeRef.current;
    const pts = points.current;
    if (!c || !pts) return;
    c.width = size.width;
    c.height = size.height;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = ctx.fillStyle = tool === 'erase' ? 'rgba(220,38,38,.55)' : 'rgba(22,163,74,.55)';
    ctx.lineWidth = brush;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.arc(pts[0][0], pts[0][1], brush / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  };
  const endStroke = () => {
    if (points.current) onStroke(points.current);
    points.current = null;
    strokeRef.current?.getContext('2d')?.clearRect(0, 0, size.width, size.height);
  };

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
          <div
            className={clsx('relative', painting ? 'cursor-none touch-none' : tool === 'pick' ? 'cursor-crosshair' : 'cursor-zoom-in')}
            style={shown}
            onClick={(e) => {
              if (tool === 'pick') {
                const [x, y] = at(e);
                onPick(Math.floor(x), Math.floor(y));
              } else if (tool === 'view') onOpen();
            }}
            onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
              if (!painting || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              points.current = [at(e)];
              drawLive();
            }}
            onPointerMove={(e) => {
              if (!painting) return;
              const [x, y] = at(e);
              setCursor({ x, y });
              if (!points.current) return;
              points.current.push([x, y]);
              drawLive();
            }}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() => setCursor(null)}
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={label}
              className="block h-full w-full"
              // 직접 확대했을 때는 픽셀을 그대로 (맞춤일 때는 자연스럽게)
              style={{ imageRendering: zoom !== 'fit' && scale >= 2 ? 'pixelated' : 'auto' }}
            />
            <canvas ref={strokeRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
            {box && (box.width !== size.width || box.height !== size.height) && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute border-2 border-dashed border-primary-ink"
                style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}
              />
            )}
            {painting && cursor && (
              <span
                aria-hidden="true"
                className={clsx('pointer-events-none absolute rounded-full border-2', tool === 'erase' ? 'border-danger' : 'border-[#16a34a]')}
                style={{ left: (cursor.x - brush / 2) * scale, top: (cursor.y - brush / 2) * scale, width: brush * scale, height: brush * scale }}
              />
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}
