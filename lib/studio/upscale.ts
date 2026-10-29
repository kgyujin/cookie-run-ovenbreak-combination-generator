import type * as TF from '@tensorflow/tfjs-core';
import { AiError, Graph, halfToFloat, loadErrorMessage, loadGraph, loadTf, once, runGraph } from './graphModel';
import { Pixels, bleedColors, hasTransparency, matchColors } from './imageOps';

/**
 * AI로 키우기 (관리 페이지 전용). 브라우저의 WebGL로 돌린다. 두 가지 모델 중 고른다.
 * - waifu2x (CUNet, 2배): 원본 색과 선을 충실히 지킨다. 노이즈 제거 단계를 고르고, 4배는 2배를 두 번 한다.
 *   가중치: public/models/waifu2x-cunet-2x*.bin (scripts/convertGraphModel.py)
 * - Real-ESRGAN (애니 그림용 RRDBNet 6블록, 4배): 더 선명하게 그린다. 원본보다 색이 진해지지 않게 결과를 원본 색에 맞춘다.
 *   가중치: public/models/realesrgan-x4-anime-6b.bin (scripts/convertUpscaleModel.py로 만든 float16)
 * 2배, 3배는 쓰는 쪽에서 결과를 줄인다 (바로 작게 키우는 것보다 선이 깨끗함, 배율을 바꿔도 다시 계산하지 않게).
 * 투명한 그림은 색과 투명도를 따로 키운다 (투명도도 같은 모델로 키워 테두리가 흐려지지 않게).
 */
export type Engine = 'waifu2x' | 'esrgan';
/** waifu2x 노이즈 제거 단계 (-1이면 안 함) */
export type Noise = -1 | 0 | 1 | 2 | 3;

const MODEL_URL = '/models/realesrgan-x4-anime-6b.bin';
const waifu2xUrl = (noise: Noise) => `/models/waifu2x-cunet-2x${noise < 0 ? '' : `-noise${noise}`}.bin`;
/** waifu2x가 조각 둘레에서 더 보는 폭 (모델이 이만큼 줄여서 내놓음) */
const W2X_CONTEXT = 18;
const W2X_TILE = 128;
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

const loadEsrgan = once(async () => {
  const tf = await loadTf();
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
});

const waifu2xModels = new Map<Noise, () => Promise<Graph>>();
const loadWaifu2x = (noise: Noise) => {
  if (!waifu2xModels.has(noise)) waifu2xModels.set(noise, once(async () => loadGraph(await loadTf(), waifu2xUrl(noise))));
  return waifu2xModels.get(noise)!();
};

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

/**
 * 채널 3개(0~1) 그림을 waifu2x로 2배. 그림 바깥은 가장자리 색을 늘려 채우고, 조각마다 둘레 W2X_CONTEXT만큼 더 넣어 계산한다
 * (모델이 그만큼 줄여서 내놓으므로 조각 경계가 이어진다). 모델은 짝수 크기만 받아서 홀수면 한 칸 늘려 계산하고 자른다.
 */
async function waifu2xChannels(tf: typeof TF, graph: Graph, input: Float32Array, width: number, height: number, onTile: () => void, signal?: AbortSignal) {
  const evenW = width + (width % 2);
  const evenH = height + (height % 2);
  const C = W2X_CONTEXT;
  const PW = evenW + 2 * C;
  const PH = evenH + 2 * C;
  const padded = new Float32Array(PW * PH * 3);
  for (let y = 0; y < PH; y++) {
    const sy = Math.min(height - 1, Math.max(0, y - C));
    for (let x = 0; x < PW; x++) {
      const sx = Math.min(width - 1, Math.max(0, x - C));
      padded.set(input.subarray((sy * width + sx) * 3, (sy * width + sx) * 3 + 3), (y * PW + x) * 3);
    }
  }
  const W = width * 2;
  const out = new Float32Array(W * height * 2 * 3);
  for (let ty = 0; ty < evenH; ty += W2X_TILE) {
    for (let tx = 0; tx < evenW; tx += W2X_TILE) {
      signal?.throwIfAborted();
      const tw = Math.min(W2X_TILE, evenW - tx);
      const th = Math.min(W2X_TILE, evenH - ty);
      const iw = tw + 2 * C;
      const ih = th + 2 * C;
      const tile = new Float32Array(iw * ih * 3);
      for (let y = 0; y < ih; y++) tile.set(padded.subarray(((ty + y) * PW + tx) * 3, ((ty + y) * PW + tx + iw) * 3), y * iw * 3);
      const input4d = tf.tensor4d(tile, [1, ih, iw, 3]);
      let data: Float32Array;
      try {
        const raw = await runGraph(tf, graph, input4d, { signal });
        const result = tf.tidy(() => tf.clipByValue(raw, 0, 1));
        raw.dispose();
        try {
          data = (await result.data()) as Float32Array;
        } finally {
          result.dispose();
        }
      } finally {
        input4d.dispose();
      }
      // 결과는 조각의 정확히 2배 (늘려 계산한 칸은 그림 밖이면 버림)
      const keepW = Math.min(tw, width - tx) * 2;
      const keepH = Math.min(th, height - ty) * 2;
      for (let y = 0; y < keepH; y++) out.set(data.subarray(y * tw * 2 * 3, (y * tw * 2 + keepW) * 3), ((ty * 2 + y) * W + tx * 2) * 3);
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

export interface AiOptions {
  engine: Engine;
  /** waifu2x 노이즈 제거 단계 */
  noise: Noise;
  /** waifu2x를 몇 번 거칠지 (1이면 2배, 2이면 4배) */
  passes: 1 | 2;
}

/** AI 결과의 배율 (waifu2x 2배나 4배, Real-ESRGAN 4배) */
export const aiScale = (o: AiOptions) => (o.engine === 'esrgan' ? 4 : 2 ** o.passes);

/** AI로 키운 새 픽셀 (aiScale배). onProgress(0~1). signal로 멈추면 AbortError */
export async function upscaleAi(src: Pixels, options: AiOptions, onProgress: (done: number) => void, signal?: AbortSignal): Promise<Pixels> {
  const { engine, noise, passes } = options;
  let run: (input: Float32Array, width: number, height: number, onTile: () => void) => Promise<Float32Array>;
  let tileCount: (width: number, height: number) => number;
  try {
    if (engine === 'esrgan') {
      const { tf, model } = await loadEsrgan();
      run = (input, width, height, onTile) => upscaleChannels(tf, model, input, width, height, onTile, signal);
      tileCount = (width, height) => Math.ceil(width / TILE) * Math.ceil(height / TILE);
    } else {
      const tf = await loadTf();
      // 두 번째로 키울 때는 노이즈가 이미 없으므로 노이즈 제거 없는 모델을 쓴다
      const [first, second] = await Promise.all([loadWaifu2x(noise), passes === 2 ? loadWaifu2x(-1) : null]);
      run = async (input, width, height, onTile) => {
        const out = await waifu2xChannels(tf, first, input, width, height, onTile, signal);
        return second ? waifu2xChannels(tf, second, out, width * 2, height * 2, onTile, signal) : out;
      };
      tileCount = (width, height) =>
        Math.ceil(width / W2X_TILE) * Math.ceil(height / W2X_TILE) + (passes === 2 ? Math.ceil((width * 2) / W2X_TILE) * Math.ceil((height * 2) / W2X_TILE) : 0);
    }
  } catch (e) {
    console.error('Failed to load upscale model:', e);
    throw new AiError(loadErrorMessage(e, 'AI로 키울'));
  }
  onProgress(0); // 모델을 다 불러왔고 계산을 시작한다
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
  const tiles = tileCount(width, height) * (alpha ? 2 : 1);
  let done = 0;
  const step = () => onProgress(++done / tiles);
  const bigRgb = await run(rgb, width, height, step);
  let bigAlpha: Float32Array | null = null;
  if (alpha) {
    const big = await run(alpha, width, height, step);
    bigAlpha = new Float32Array(big.length / 3);
    for (let p = 0; p < bigAlpha.length; p++) bigAlpha[p] = big[p * 3];
  }
  const scale = aiScale(options);
  const result = toPixels(bigRgb, bigAlpha, width * scale, height * scale);
  // Real-ESRGAN은 원본보다 색이 진해지는 버릇이 있어 원본 색에 맞춘다
  return engine === 'esrgan' ? matchColors(result, src) : result;
}
