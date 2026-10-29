import { AiError, loadErrorMessage, loadGraph, loadTf, once, runGraph } from './graphModel';
import { Mask, Pixels, resampleFloat } from './imageOps';

/**
 * AI 캐릭터 인식 (관리 페이지 전용): 애니 그림 캐릭터 인식 모델 isnet-anime로 그림에서 캐릭터가 있는 곳을 0~1로 찾는다.
 * 배경과 그림의 색이 비슷해서 색으로는 지우기 어려울 때 쓴다.
 * 가중치: public/models/isnet-anime.bin (scripts/convertGraphModel.py, 8비트로 줄임)
 * 원본 학습 크기는 1024지만 작은 그림을 크게 늘리면 흐려져 잘 못 찾아서, 그림 크기의 약 1.7배(512~1024, 64의 배수)로 계산한다.
 */
const MODEL_URL = '/models/isnet-anime.bin';
/** 모델이 학습한 입력 정규화 (rembg와 같음): 가장 밝은 값으로 나눈 뒤 채널마다 뺀다 */
const MEAN = [0.485, 0.456, 0.406];

const loadModel = once(async () => loadGraph(await loadTf(), MODEL_URL));
let running = 0;
let savedIm2col = true;

/** 모델에 넣을 정사각형 크기 */
export function segmentSize(width: number, height: number) {
  return Math.min(1024, Math.max(512, Math.ceil((Math.max(width, height) * 1.7) / 64) * 64));
}

/** 그림에서 캐릭터가 있는 곳 (그림과 같은 크기, 0~1). onProgress(0~1)는 모델을 다 불러온 뒤부터. signal로 멈추면 AbortError */
export async function findCharacter(src: Pixels, signal?: AbortSignal, onProgress?: (done: number) => void): Promise<Mask> {
  let tf: Awaited<ReturnType<typeof loadTf>>;
  let graph: Awaited<ReturnType<typeof loadModel>>;
  try {
    [tf, graph] = await Promise.all([loadTf(), loadModel()]);
  } catch (e) {
    console.error('Failed to load segmentation model:', e);
    throw new AiError(loadErrorMessage(e, '캐릭터를 찾을'));
  }
  signal?.throwIfAborted();
  const { width, height, data } = src;
  const size = segmentSize(width, height);
  // 투명한 곳은 흰 바탕 위에 놓은 것으로 본다
  const rgb = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const a = data[p * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = data[p * 4 + c] * a + 255 * (1 - a);
  }
  const input = resampleFloat(rgb, width, height, size, size, 3);
  let max = 1;
  for (let i = 0; i < input.length; i++) max = Math.max(max, input[i]);
  for (let i = 0; i < input.length; i++) input[i] = input[i] / max - MEAN[i % 3];

  // 큰 합성곱을 행렬곱으로 펼치면 그래픽 메모리를 수백 MB 더 써서, 이 계산 동안만 끈다 (겹쳐 돌면 마지막 계산이 끝날 때 되돌림)
  if (running++ === 0) savedIm2col = tf.env().getBool('WEBGL_CONV_IM2COL');
  tf.env().set('WEBGL_CONV_IM2COL', false);
  let out: Float32Array;
  let x: ReturnType<typeof tf.tensor4d> | null = null;
  try {
    x = tf.tensor4d(input, [1, size, size, 3]);
    onProgress?.(0);
    const result = await runGraph(tf, graph, x, { signal, onProgress });
    try {
      out = (await result.data()) as Float32Array;
    } finally {
      result.dispose();
    }
  } finally {
    x?.dispose();
    if (--running === 0) tf.env().set('WEBGL_CONV_IM2COL', savedIm2col);
  }
  signal?.throwIfAborted();
  const mask = resampleFloat(out, size, size, width, height, 1);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.min(1, Math.max(0, mask[i]));
  return { width, height, data: mask };
}
