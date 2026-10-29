import type * as TF from '@tensorflow/tfjs-core';

/**
 * scripts/convertGraphModel.py로 만든 모델 파일(GRPH)을 TensorFlow.js(WebGL)로 실행한다 (관리 페이지 전용).
 * waifu2x(그림 키우기)와 isnet-anime(캐릭터 인식)이 같은 형식을 쓴다.
 * 층마다 계산이 끝난 중간 결과는 바로 지워서 그래픽 메모리를 아낀다.
 */

type Act = 'relu' | 'lrelu' | 'sigmoid' | null;
type Node =
  | { op: 'input'; out: string }
  | { op: 'output'; in: [string] }
  | { op: 'conv' | 'deconv'; in: [string]; out: string; w: number; b: number; stride: number; pad: number; dil?: number; act: Act }
  | { op: 'crop'; in: [string, string]; out: string; offset: number }
  | { op: 'resize'; in: [string]; out: string; ratio: number }
  | { op: 'mean' | 'maxpool' | 'relu' | 'sigmoid'; in: [string]; out: string }
  | { op: 'add' | 'mul' | 'concat'; in: string[]; out: string };

interface TensorInfo {
  shape: number[];
  dtype: 'f16' | 'i8';
  offset: number;
  scale?: number;
}

export interface Graph {
  nodes: Node[];
  weights: TF.Tensor[];
  /** 이름마다 마지막으로 쓰이는 층 번호 (그 뒤에 지운다) */
  lastUse: Map<string, number>;
}

let tfLoading: Promise<typeof TF> | null = null;

/** 계산 도구(TensorFlow.js, WebGL)를 처음 쓸 때 한 번만 불러온다 (관리 페이지에서만 받음) */
export function loadTf() {
  tfLoading ??= (async () => {
    const tf = await import('@tensorflow/tfjs-core');
    await import('@tensorflow/tfjs-backend-webgl');
    if (!(await tf.setBackend('webgl'))) throw new Error('webgl');
    return tf;
  })();
  tfLoading.catch(() => (tfLoading = null)); // 실패하면 다음에 다시 시도
  return tfLoading;
}

/** 모델을 처음 쓸 때 한 번만 불러온다 (실패하면 다음에 다시 시도) */
export function once<T>(load: () => Promise<T>) {
  let loading: Promise<T> | null = null;
  return () => {
    loading ??= load();
    loading.catch(() => (loading = null));
    return loading;
  };
}

/** 화면에 그대로 보여 줄 수 있는 AI 오류 */
export class AiError extends Error {}

/** 모델을 불러오지 못한 까닭을 화면에 보일 문장으로 */
export function loadErrorMessage(e: unknown, what: string) {
  return e instanceof Error && e.message === 'webgl'
    ? `이 브라우저에서는 그래픽 가속(WebGL)을 쓸 수 없어 ${what} 수 없어요`
    : 'AI 모델을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요';
}

/** float16 → float32 */
export function halfToFloat(half: Uint16Array) {
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

/** 모델 파일을 받아 가중치를 그래픽 메모리에 올린다 */
export async function loadGraph(tf: typeof TF, url: string): Promise<Graph> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`모델 파일 (${res.status})`);
  const buffer = await res.arrayBuffer();
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) !== 'GRPH') throw new Error('모델 파일 형식이 맞지 않음');
  const headerSize = view.getUint32(4, true);
  const { nodes, tensors } = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerSize))) as { nodes: Node[]; tensors: TensorInfo[] };
  const base = 8 + headerSize;
  const weights: TF.Tensor[] = [];
  try {
    for (const t of tensors) {
      const count = t.shape.reduce((a, b) => a * b, 1);
      let data: Float32Array;
      if (t.dtype === 'f16') {
        data = halfToFloat(new Uint16Array(buffer, base + t.offset, count));
      } else {
        // 8비트: 출력 채널(마지막 축)마다 저장된 배율을 곱해 되살린다
        const q = new Int8Array(buffer, base + t.offset, count);
        const channels = t.shape[t.shape.length - 1];
        const scale = new Float32Array(buffer, base + t.scale!, channels);
        data = new Float32Array(count);
        for (let i = 0; i < count; i++) data[i] = q[i] * scale[i % channels];
      }
      weights.push(tf.tensor(data, t.shape));
    }
  } catch (e) {
    weights.forEach((w) => w.dispose());
    throw e;
  }
  const lastUse = new Map<string, number>();
  nodes.forEach((node, i) => 'in' in node && node.in.forEach((name) => lastUse.set(name, i)));
  return { nodes, weights, lastUse };
}

/**
 * 모델 한 번 통과: [1, h, w, c] → 결과 텐서 (쓰는 쪽에서 지운다). signal로 멈추면 AbortError.
 * onProgress를 주면 몇 층마다 화면에 차례를 넘기며 진행(0~1)을 알린다 (큰 모델을 돌리는 동안 화면이 멈추지 않게).
 */
export async function runGraph(
  tf: typeof TF,
  graph: Graph,
  x: TF.Tensor4D,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number) => void } = {}
): Promise<TF.Tensor4D> {
  const { nodes, weights, lastUse } = graph;
  const size = x.shape[1];
  const env = new Map<string, TF.Tensor4D>();
  const activation = (act: Act) => (act === 'lrelu' ? 'leakyrelu' : act ?? 'linear');
  try {
    for (let i = 0; i < nodes.length; i++) {
      if (onProgress && i % 8 === 7) {
        onProgress(i / nodes.length);
        await new Promise((resolve) => setTimeout(resolve)); // 다른 탭에 있어도 멈추지 않게 (requestAnimationFrame이 아니라)
      }
      signal?.throwIfAborted();
      const node = nodes[i];
      if (node.op === 'input') {
        env.set(node.out, x);
        continue;
      }
      const ins = node.in.map((name) => env.get(name)!);
      if (node.op === 'output') {
        const out = ins[0];
        env.delete(node.in[0]);
        return out;
      }
      const result = tf.tidy((): TF.Tensor4D => {
        switch (node.op) {
          case 'conv':
            return tf.fused.conv2d({
              x: ins[0],
              filter: weights[node.w] as TF.Tensor4D,
              strides: node.stride,
              pad: node.pad || 'valid',
              dilations: node.dil ?? 1,
              bias: weights[node.b],
              activation: activation(node.act),
              leakyreluAlpha: 0.1,
            });
          case 'deconv': {
            const [, h, w] = ins[0].shape;
            const [k, , outC] = weights[node.w].shape;
            const full = tf.conv2dTranspose(ins[0], weights[node.w] as TF.Tensor4D, [1, (h - 1) * node.stride + k, (w - 1) * node.stride + k, outC], node.stride, 'valid');
            const p = node.pad;
            const cut = p ? tf.slice(full, [0, p, p, 0], [1, full.shape[1] - 2 * p, full.shape[2] - 2 * p, outC]) : full;
            const biased = tf.add(cut, weights[node.b]) as TF.Tensor4D;
            return node.act === 'lrelu' ? tf.leakyRelu(biased, 0.1) : node.act === 'relu' ? tf.relu(biased) : node.act === 'sigmoid' ? tf.sigmoid(biased) : biased;
          }
          case 'crop': {
            const [, h, w] = ins[1].shape;
            return tf.slice(ins[0], [0, node.offset, node.offset, 0], [1, h, w, -1]);
          }
          case 'resize': {
            const s = Math.round(size * node.ratio);
            return tf.image.resizeBilinear(ins[0], [s, s], false, true);
          }
          case 'mean':
            return tf.mean(ins[0], [1, 2], true);
          case 'maxpool':
            return tf.maxPool(ins[0], 2, 2, 'valid');
          case 'relu':
            return tf.relu(ins[0]);
          case 'sigmoid':
            return tf.sigmoid(ins[0]);
          case 'add':
            return tf.add(ins[0], ins[1]);
          case 'mul':
            return tf.mul(ins[0], ins[1]);
          case 'concat':
            return tf.concat(ins, 3);
        }
      });
      env.set(node.out, result);
      // 이 층이 마지막으로 쓴 중간 결과는 지운다 (입력은 쓰는 쪽 것이라 남김)
      for (const name of node.in) {
        if (lastUse.get(name) === i && env.get(name) !== x) {
          env.get(name)?.dispose();
          env.delete(name);
        }
      }
    }
    throw new Error('모델에 출력이 없음');
  } finally {
    env.forEach((t) => t !== x && t.dispose());
  }
}
