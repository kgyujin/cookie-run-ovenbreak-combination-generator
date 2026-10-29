'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pixels, Rgb, detectBackground, removeBackground, trimTransparent } from '@/lib/studio/imageOps';
import { UpscaleError, upscale2x } from '@/lib/studio/upscale';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Range, Toggle } from '../settings/controls';

/** 이보다 큰 이미지는 키우지 않는다 (이미 충분히 크고, 오래 걸림) */
const MAX_UPSCALE_SIDE = 512;
const WHITE: Rgb = [255, 255, 255];

/** 이미지 주소 → 픽셀. 앞의 주소부터 열리는 것으로 (다른 사이트 이미지는 CORS를 허용해야 읽을 수 있음) */
async function loadPixels(sources: string[]): Promise<Pixels> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  for (let i = 0; i < sources.length; i++) {
    image.src = sources[i];
    try {
      await image.decode();
      break;
    } catch (e) {
      if (i === sources.length - 1) throw e;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data };
}

function draw(canvas: HTMLCanvasElement, { width, height, data }: Pixels) {
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
}

/** 픽셀 → PNG (data: 접두어 없는 base64) */
async function toPngBase64(pixels: Pixels) {
  const canvas = document.createElement('canvas');
  draw(canvas, pixels);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG로 바꾸지 못함');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { image: url.split(',')[1] ?? '', size: blob.size };
}

const toHex = (rgb: Rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

type Upscale = { status: 'idle' } | { status: 'running'; progress: number } | { status: 'done'; pixels: Pixels } | { status: 'error'; message: string };

/**
 * 이미지 다듬기 창 (관리 페이지): 배경 투명하게, AI로 2배 키우기, 투명한 여백 자르기.
 * 바뀐 모습을 바로 보여 주고, 적용하면 PNG로 돌려준다. 순서: 원본 → (2배) → (배경 지우기) → (여백 자르기)
 */
export default function ImageEditor({ sources, name, onApply, onClose }: { sources: string[]; name: string; onApply: (result: { image: string; size: number }) => void; onClose: () => void }) {
  const [original, setOriginal] = useState<Pixels | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [upscale, setUpscale] = useState<Upscale>({ status: 'idle' });
  const [removeBg, setRemoveBg] = useState(false);
  const [color, setColor] = useState<Rgb>(WHITE);
  const [tolerance, setTolerance] = useState(12);
  const [softness, setSoftness] = useState(10);
  const [everywhere, setEverywhere] = useState(false);
  const [trim, setTrim] = useState(true);
  const [compare, setCompare] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    loadPixels(sources)
      .then((pixels) => {
        if (!active) return;
        setOriginal(pixels);
        setColor(detectBackground(pixels) ?? WHITE);
      })
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

  const base = upscale.status === 'done' ? upscale.pixels : original;
  const result = useMemo(() => {
    if (!base) return null;
    const cut = removeBg ? removeBackground(base, { color, tolerance, softness, everywhere }) : base;
    return trim ? trimTransparent(cut) : cut;
  }, [base, removeBg, color, tolerance, softness, everywhere, trim]);
  const changed = !!result && result !== original;

  useEffect(() => {
    const shown = compare ? original : result;
    if (canvasRef.current && shown) draw(canvasRef.current, shown);
  }, [compare, original, result]);

  // 창을 닫으면 진행 중인 키우기를 멈춘다 (그래픽 카드를 계속 쓰지 않게)
  const running = upscale.status === 'running';
  const tooBig = !!original && Math.max(original.width, original.height) > MAX_UPSCALE_SIDE;
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const runUpscale = async () => {
    if (!original || tooBig || running) return;
    const controller = (abort.current = new AbortController());
    const { signal } = controller;
    setUpscale({ status: 'running', progress: 0 });
    try {
      const pixels = await upscale2x(original, (progress) => !signal.aborted && setUpscale({ status: 'running', progress }), signal);
      if (!signal.aborted) setUpscale({ status: 'done', pixels });
    } catch (e) {
      if (signal.aborted) return;
      console.error('Failed to upscale:', e);
      setUpscale({ status: 'error', message: e instanceof UpscaleError ? e.message : 'AI로 키우지 못했어요. 이미지를 작게 해서 다시 해 주세요' });
    }
  };

  const pickFromScreen = async () => {
    try {
      // 크롬, 엣지: 화면의 아무 곳에서나 색 고르기
      const { sRGBHex } = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open();
      setColor(fromHex(sRGBHex));
    } catch {
      // 고르기를 취소함
    }
  };

  const apply = async () => {
    if (!result || !changed || saving || running) return;
    setSaving(true);
    try {
      onApply(await toPngBase64(result));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`이미지 다듬기: ${name}`}
      onClose={onClose}
      className="max-w-[46rem]"
      footer={
        <>
          {result && (
            <p className="text-caption tabular-nums text-ink-subtle">
              {original && `${original.width}×${original.height}`} → {result.width}×{result.height}px
            </p>
          )}
          <Button className="ml-auto" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={apply} aria-disabled={!changed || running || saving}>
            적용
          </Button>
        </>
      }
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_15rem]">
        <div className="space-y-2">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(#e7e2da_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
            {loadError ? (
              <p role="alert" className="text-center text-body-md text-ink">
                이미지를 불러오지 못했어요. 사이트에 반영된 뒤 다시 해 주세요.
              </p>
            ) : !original ? (
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-soft border-t-primary-ink" role="status" aria-label="이미지를 불러오는 중" />
            ) : (
              <canvas ref={canvasRef} role="img" aria-label={compare ? '원본' : '다듬은 결과'} className="h-full w-full object-contain" />
            )}
          </div>
          <Button className="w-full" aria-pressed={compare} onClick={() => changed && setCompare((c) => !c)} aria-disabled={!changed}>
            {compare ? '다듬은 결과 보기' : '원본과 비교'}
          </Button>
        </div>

        <div className="space-y-5">
          <section className="space-y-3" aria-labelledby="edit-upscale">
            <h3 id="edit-upscale" className="text-label-md text-ink">
              AI로 2배 키우기
            </h3>
            {upscale.status === 'done' ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-ink-muted">2배로 키웠어요</p>
                <Button onClick={() => setUpscale({ status: 'idle' })}>되돌리기</Button>
              </div>
            ) : running ? (
              <div role="status" className="space-y-1">
                <p className="text-caption text-ink-muted">
                  {upscale.progress === 0 ? '모델을 불러오는 중 (처음 한 번 약 9MB)' : `키우는 중 ${Math.round(upscale.progress * 100)}%`}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <div className="h-full bg-primary-ink transition-[width]" style={{ width: `${upscale.progress * 100}%` }} />
                </div>
              </div>
            ) : (
              <>
                <Button className="w-full" onClick={runUpscale} aria-disabled={!original || tooBig}>
                  2배로 키우기
                </Button>
                <p className="text-caption text-ink-subtle">
                  {tooBig ? `${MAX_UPSCALE_SIDE}px보다 큰 이미지는 키우지 않아요.` : '애니메이션 그림용 Real-ESRGAN으로 선을 살려 키워요. 이 컴퓨터에서 계산해서 몇 초 걸려요.'}
                </p>
                {upscale.status === 'error' && (
                  <p role="alert" className="text-caption font-semibold text-danger">
                    {upscale.message}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-bg">
            <h3 id="edit-bg" className="text-label-md text-ink">
              배경 투명하게
            </h3>
            <Toggle label="배경 지우기" checked={removeBg} onChange={setRemoveBg} />
            {removeBg && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-caption font-semibold text-ink-muted">
                    지울 색
                    <input type="color" value={toHex(color)} onChange={(e) => setColor(fromHex(e.target.value))} className="h-8 w-10 cursor-pointer rounded border border-line bg-surface" />
                  </label>
                  {typeof window !== 'undefined' && 'EyeDropper' in window && (
                    <Button variant="ghost" className="h-8 px-2 text-caption" onClick={pickFromScreen}>
                      화면에서 고르기
                    </Button>
                  )}
                </div>
                <Range label="비슷한 색까지" unit="" value={tolerance} min={0} max={40} onChange={setTolerance} />
                <Range label="가장자리 부드럽게" unit="" value={softness} min={0} max={30} onChange={setSoftness} />
                <p className="text-caption text-ink-subtle">너무 높이면 그림 속 비슷한 색까지 지워져요. 미리보기에서 확인해 주세요.</p>
                <Toggle label="떨어진 곳도 지우기" checked={everywhere} onChange={setEverywhere} />
                <p className="text-caption text-ink-subtle">가장자리와 이어진 배경만 지워요. 팔 사이 빈틈처럼 막힌 곳도 지우려면 켜 주세요.</p>
              </>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="edit-trim">
            <h3 id="edit-trim" className="text-label-md text-ink">
              여백
            </h3>
            <Toggle label="투명한 여백 자르기" checked={trim} onChange={setTrim} />
          </section>
        </div>
      </div>
    </Modal>
  );
}
