import type * as TF from '@tensorflow/tfjs-core';
import { Pixels, bleedColors, hasTransparency } from './imageOps';

/**
 * AI로 키우기 (관리 페이지 전용). Real-ESRGAN 애니 그림용 모델(RRDBNet 6블록, 4배)을 브라우저의 WebGL로 돌린다.
 * 늘 4배로 키우고, 2배나 3배는 쓰는 쪽에서 줄인다 (바로 작게 키우는 것보다 선이 깨끗함, 배율을 바꿔도 다시 계산하지 않게).
 * 가중치: public/models/realesrgan-x4-anime-6b.bin (scripts/convertUpscaleModel.py로 만든 float16)
 * 투명한 그림은 색과 투명도를 따로 키운다 (투명도도 같은 모델로 키워 테두리가 흐려지지 않게).
 */
const MODEL_URL = '/models/realesrgan-x4-anime-6b.bin';
const FEAT = 64;
const GROW = 32;
const BLOCKS = 6;
const SCALE = 4;
/** 한 번에 계산하는 조각 크기와 이웃 조각과 겹치는 폭 (그래픽 메모리를 넘지 않게, 조각 경계가 티 나지 않게) */
const TILE = 96;
const OVERLAP = 12;

interface Conv {
  w: TF.Tensor4D;
  b: TF.Tensor1D;
}
interface Model {
  first: Conv;
  body: Conv[][][]; // [RRDB][RDB 3개][합성곱 5개]
  bodyConv: Conv;
  up1: Conv;
  up2: Conv;
  hr: Conv;
  last: Conv;
}

/** 원본에 저장된 순서대로 합성곱의 [입력, 출력] 채널 수 */
function convShapes() {
  const shapes: [number, number][] = [[3, FEAT]];
  for (let block = 0; block < BLOCKS; block++)
    for (let rdb = 0; rdb < 3; rdb++) for (let c = 0; c < 5; c++) shapes.push([FEAT + c * GROW, c === 4 ? FEAT : GROW]);
  shapes.push([FEAT, FEAT], [FEAT, FEAT], [FEAT, FEAT], [FEAT, FEAT], [FEAT, 3]);
  return shapes;
}

/** float16 → float32 */
function halfToFloat(half: Uint16Array) {
  const out = new Float32Array(half.length);
  for (let i = 0; i < half.length; i++) {
    const h = half[i];
    const sign = h & 0x8000 ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    out[i] = exp === 0 ? sign * 2 ** -14 * (frac / 1024) : exp === 31 ? (frac ? NaN : sign * Infinity) : sign * 2 ** (exp - 15) * (1 + frac / 1024);
  }
  return out;
}

let loading: Promise<{ tf: typeof TF; model: Model }> | null = null;

/** 계산 도구와 모델을 처음 쓸 때 한 번만 불러온다 (관리 페이지에서만 받음) */
function load() {
  loading ??= (async () => {
    const tf = await import('@tensorflow/tfjs-core');
    await import('@tensorflow/tfjs-backend-webgl');
    if (!(await tf.setBackend('webgl'))) throw new Error('webgl');
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`모델 파일 (${res.status})`);
    const weights = halfToFloat(new Uint16Array(await res.arrayBuffer()));
    const shapes = convShapes();
    if (shapes.reduce((sum, [inC, outC]) => sum + 9 * inC * outC + outC, 0) !== weights.length) throw new Error('모델 파일 크기가 맞지 않음');
    let offset = 0;
    const take = (size: number) => weights.subarray(offset, (offset += size));
    // tidy: 만드는 도중에 실패하면 이미 만든 텐서도 그래픽 메모리에서 지운다
    const convs = tf.tidy(() => shapes.map(([inC, outC]) => ({ w: tf.tensor4d(take(9 * inC * outC), [3, 3, inC, outC]), b: tf.tensor1d(take(outC)) })));
    const body = Array.from({ length: BLOCKS }, (_, block) => Array.from({ length: 3 }, (_, rdb) => convs.slice(1 + (block * 3 + rdb) * 5, 1 + (block * 3 + rdb) * 5 + 5)));
    const [bodyConv, up1, up2, hr, last] = convs.slice(-5);
    return { tf, model: { first: convs[0], body, bodyConv, up1, up2, hr, last } };
  })();
  loading.catch(() => (loading = null)); // 실패하면 다음에 다시 시도
  return loading;
}

/** 모델 한 번 통과: [1, h, w, 3] (0~1) → [1, 4h, 4w, 3] */
function forward(tf: typeof TF, m: Model, x: TF.Tensor4D): TF.Tensor4D {
  const conv = (t: TF.Tensor4D, c: Conv) => tf.add(tf.conv2d(t, c.w, 1, 'same'), c.b) as TF.Tensor4D;
  const lrelu = (t: TF.Tensor4D) => tf.leakyRelu(t, 0.2);
  const rdb = (t: TF.Tensor4D, c: Conv[]) => {
    const feats = [t];
    for (let i = 0; i < 4; i++) feats.push(lrelu(conv(tf.concat(feats, 3), c[i])));
    return tf.add(tf.mul(conv(tf.concat(feats, 3), c[4]), 0.2), t) as TF.Tensor4D;
  };
  const rrdb = (t: TF.Tensor4D, rdbs: Conv[][]) => tf.add(tf.mul(rdbs.reduce(rdb, t), 0.2), t) as TF.Tensor4D;
  const up = (t: TF.Tensor4D) => tf.image.resizeNearestNeighbor(t, [t.shape[1] * 2, t.shape[2] * 2]);

  const feat = conv(x, m.first);
  let out = tf.add(feat, conv(m.body.reduce(rrdb, feat), m.bodyConv)) as TF.Tensor4D;
  out = lrelu(conv(up(out), m.up1));
  out = lrelu(conv(up(out), m.up2));
  return tf.clipByValue(conv(lrelu(conv(out, m.hr)), m.last), 0, 1);
}

/** 채널 3개(0~1) 그림을 조각으로 나눠 4배로 키운다. signal로 중간에 멈춘다 (조각마다 확인) */
async function upscaleChannels(tf: typeof TF, model: Model, input: Float32Array, width: number, height: number, onTile: () => void, signal?: AbortSignal) {
  const W = width * SCALE;
  const out = new Float32Array(W * height * SCALE * 3);
  for (let ty = 0; ty < height; ty += TILE) {
    for (let tx = 0; tx < width; tx += TILE) {
      signal?.throwIfAborted();
      // 이웃과 겹치게 넓혀 계산하고, 가운데(원래 조각)만 쓴다
      const x0 = Math.max(0, tx - OVERLAP);
      const y0 = Math.max(0, ty - OVERLAP);
      const x1 = Math.min(width, tx + TILE + OVERLAP);
      const y1 = Math.min(height, ty + TILE + OVERLAP);
      const w = x1 - x0;
      const h = y1 - y0;
      const tile = new Float32Array(w * h * 3);
      for (let y = 0; y < h; y++) tile.set(input.subarray(((y0 + y) * width + x0) * 3, ((y0 + y) * width + x1) * 3), y * w * 3);
      const result = tf.tidy(() => forward(tf, model, tf.tensor4d(tile, [1, h, w, 3])));
      let data: Float32Array;
      try {
        data = (await result.data()) as Float32Array;
      } finally {
        result.dispose();
      }
      const keepW = (Math.min(width, tx + TILE) - tx) * SCALE;
      const keepH = (Math.min(height, ty + TILE) - ty) * SCALE;
      const offX = (tx - x0) * SCALE;
      const offY = (ty - y0) * SCALE;
      for (let y = 0; y < keepH; y++) {
        const from = ((offY + y) * w * SCALE + offX) * 3;
        out.set(data.subarray(from, from + keepW * 3), ((ty * SCALE + y) * W + tx * SCALE) * 3);
      }
      onTile();
      await tf.nextFrame(); // 화면이 멈추지 않게
    }
  }
  return out;
}

/** 색(0~1)과 투명도(0~1)를 8비트 RGBA로 */
function toPixels(rgb: Float32Array, alpha: Float32Array | null, width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = rgb[p * 3] * 255;
    data[p * 4 + 1] = rgb[p * 3 + 1] * 255;
    data[p * 4 + 2] = rgb[p * 3 + 2] * 255;
    data[p * 4 + 3] = alpha ? alpha[p] * 255 : 255;
  }
  return { width, height, data };
}

export class UpscaleError extends Error {}

/** 4배로 키운 새 픽셀. onProgress(0~1). signal로 멈추면 AbortError */
export async function upscale4x(src: Pixels, onProgress: (done: number) => void, signal?: AbortSignal): Promise<Pixels> {
  let loaded: Awaited<ReturnType<typeof load>>;
  try {
    loaded = await load();
  } catch (e) {
    console.error('Failed to load upscale model:', e);
    throw new UpscaleError(
      e instanceof Error && e.message === 'webgl'
        ? '이 브라우저에서는 그래픽 가속(WebGL)을 쓸 수 없어 AI로 키울 수 없어요'
        : 'AI 모델을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요'
    );
  }
  const { tf, model } = loaded;
  const { width, height } = src;
  const transparent = hasTransparency(src);
  const pixels = transparent ? bleedColors(src) : src;
  const n = width * height;
  const rgb = new Float32Array(n * 3);
  const alpha = transparent ? new Float32Array(n * 3) : null;
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = pixels.data[p * 4 + c] / 255;
    if (alpha) alpha.fill(pixels.data[p * 4 + 3] / 255, p * 3, p * 3 + 3);
  }
  const tiles = Math.ceil(width / TILE) * Math.ceil(height / TILE) * (alpha ? 2 : 1);
  let done = 0;
  const step = () => onProgress(++done / tiles);
  const bigRgb = await upscaleChannels(tf, model, rgb, width, height, step, signal);
  let bigAlpha: Float32Array | null = null;
  if (alpha) {
    const big = await upscaleChannels(tf, model, alpha, width, height, step, signal);
    bigAlpha = new Float32Array(big.length / 3);
    for (let p = 0; p < bigAlpha.length; p++) bigAlpha[p] = big[p * 3];
  }
  return toPixels(bigRgb, bigAlpha, width * SCALE, height * SCALE);
}
