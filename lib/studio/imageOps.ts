/**
 * 관리 페이지 이미지 다듬기의 픽셀 계산 (화면과 상관없는 순수 함수, RGBA 8비트).
 * - 투명화: 가장자리와 이어진 배경색 지우기 (여러 색, 가장자리 부드럽게, 배경색이 묻은 테두리 색 되돌리기),
 *   AI가 찾은 캐릭터 자리만 남기기, 붓으로 지우거나 살리기
 * - 가장자리 깎기, 가장자리 흐리게, 투명한 여백 자르기, 바깥 여백 넣기
 * - 크기 바꾸기 (투명한 곳의 색이 섞이지 않게), AI로 키운 그림의 색을 원본에 맞추기
 * - 투명한 곳의 색 채우기 (업스케일할 때 테두리에 검은 띠가 생기지 않게)
 */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type Rgb = [number, number, number];

/** 칸마다 0~1 값 (AI가 찾은 캐릭터 자리) */
export interface Mask {
  width: number;
  height: number;
  data: Float32Array;
}

/** 붓으로 그은 한 획. 위치와 굵기는 그림 크기에 대한 비율이라 배율을 바꿔도 같은 자리에 남는다 */
export interface Stroke {
  /** true면 지우기, false면 살리기 (지우기 전 그림으로 되돌림) */
  erase: boolean;
  /** 붓 지름 (그림 너비에 대한 비율) */
  size: number;
  /** 지나간 점 [x, y] (그림 너비, 높이에 대한 비율) */
  points: [number, number][];
}

export interface RemoveOptions {
  /** 지울 배경색 (여러 개면 가장 가까운 색 기준) */
  colors: Rgb[];
  /** 이 거리(0~100)까지 배경색으로 본다 */
  tolerance: number;
  /** 배경과 그림 사이를 이 거리(0~100)만큼 반투명하게 이어 준다 */
  softness: number;
  /** 가장자리와 떨어진 곳(팔 사이 빈틈 등)의 배경색도 지운다 */
  everywhere: boolean;
}

const MAX_DISTANCE = Math.sqrt(3 * 255 * 255);

/** 두 색의 거리 (0~100) */
function distance(data: Uint8ClampedArray, i: number, [r, g, b]: Rgb) {
  return (Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b) / MAX_DISTANCE) * 100;
}

/** 가장 가까운 배경색과 그 거리 */
function nearest(data: Uint8ClampedArray, i: number, colors: Rgb[]) {
  let best = { d: Infinity, color: colors[0] };
  for (const color of colors) {
    const d = distance(data, i, color);
    if (d < best.d) best = { d, color };
  }
  return best;
}

/**
 * 가장자리 픽셀에서 가장 많이 나오는 색 (비슷한 색은 묶어서 센다).
 * 가장자리가 대부분 투명하면(이미 배경이 없는 그림) null: 가장자리에 닿은 그림 색을 배경으로 잘못 고르지 않게
 */
export function detectBackground({ width, height, data }: Pixels): Rgb | null {
  const counts = new Map<number, { n: number; sum: Rgb }>();
  let border = 0;
  let opaque = 0;
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    border++;
    if (data[i + 3] < 128) return;
    opaque++;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bin = counts.get(key) ?? { n: 0, sum: [0, 0, 0] };
    bin.n++;
    bin.sum[0] += data[i];
    bin.sum[1] += data[i + 1];
    bin.sum[2] += data[i + 2];
    counts.set(key, bin);
  };
  for (let x = 0; x < width; x++) add(x, 0), add(x, height - 1);
  for (let y = 1; y < height - 1; y++) add(0, y), add(width - 1, y);
  if (opaque * 2 < border) return null;
  let best: { n: number; sum: Rgb } | undefined;
  counts.forEach((bin) => {
    if (!best || bin.n > best.n) best = bin;
  });
  return best ? (best.sum.map((v) => Math.round(v / best!.n)) as Rgb) : null;
}

/** 배경색을 지운 새 픽셀 */
export function removeBackground(src: Pixels, { colors, tolerance, softness, everywhere }: RemoveOptions): Pixels {
  const { width, height } = src;
  const data = new Uint8ClampedArray(src.data);
  if (!colors.length) return { width, height, data };
  const n = width * height;
  const limit = tolerance + softness; // 이 거리까지는 배경 쪽(투명하거나 반투명)으로 본다
  const near = new Uint8Array(n);
  for (let p = 0; p < n; p++) near[p] = data[p * 4 + 3] > 0 && nearest(data, p * 4, colors).d <= limit ? 1 : 0;

  // 지울 곳: 가장자리에서 배경색끼리 이어진 곳 (everywhere면 배경색 전부).
  // 이미 투명한 곳도 지나갈 수 있다 (투명한 테두리 안쪽의 배경도 이어진 것으로)
  let target = near;
  if (!everywhere) {
    target = new Uint8Array(n);
    const seen = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const seed = (p: number) => {
      if (seen[p] || !(near[p] || data[p * 4 + 3] === 0)) return;
      seen[p] = 1;
      target[p] = near[p];
      queue[tail++] = p;
    };
    for (let x = 0; x < width; x++) seed(x), seed((height - 1) * width + x);
    for (let y = 0; y < height; y++) seed(y * width), seed(y * width + width - 1);
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      if (x > 0) seed(p - 1);
      if (x < width - 1) seed(p + 1);
      if (p >= width) seed(p - width);
      if (p < n - width) seed(p + width);
    }
  }

  for (let p = 0; p < n; p++) {
    if (!target[p]) continue;
    const i = p * 4;
    const { d, color } = nearest(data, i, colors);
    if (d <= tolerance || softness === 0) {
      data[i + 3] = 0;
      continue;
    }
    // 부드러운 테두리: 배경색에 가까울수록 투명하게, 섞여 있던 배경색은 빼서 원래 색으로
    const keep = (d - tolerance) / softness;
    for (let c = 0; c < 3; c++) data[i + c] = (data[i + c] - (1 - keep) * color[c]) / keep;
    data[i + 3] = Math.round(data[i + 3] * keep);
  }
  return { width, height, data };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 거의 투명하지 않은(alpha >= threshold) 픽셀을 모두 담는 가장 작은 상자. 다 투명하면 null */
export function opaqueBounds({ width, height, data }: Pixels, threshold = 8): Box | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return bottom < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** 상자만큼 잘라 낸 새 픽셀 */
export function crop(src: Pixels, { x, y, width: w, height: h }: Box): Pixels {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) out.set(src.data.subarray(((y + row) * src.width + x) * 4, ((y + row) * src.width + x + w) * 4), row * w * 4);
  return { width: w, height: h, data: out };
}

/** 사방에 투명한 여백을 margin 픽셀씩 넣은 새 픽셀 */
export function pad(src: Pixels, margin: number): Pixels {
  if (margin <= 0) return src;
  const width = src.width + margin * 2;
  const height = src.height + margin * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < src.height; y++) data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((y + margin) * width + margin) * 4);
  return { width, height, data };
}

/**
 * 한 줄 방향으로 이웃 radius칸 안의 투명도를 모은다 (가로 한 번, 세로 한 번이면 네모 범위).
 * 그림 틀 밖은 가장 가까운 끝 값으로 본다 (틀에 닿은 그림이 깎이거나 흐려지지 않게)
 */
function alphaPass(alpha: Float32Array, width: number, height: number, radius: number, horizontal: boolean, mode: 'min' | 'mean') {
  const out = new Float32Array(alpha.length);
  const [lines, length, step] = horizontal ? [height, width, 1] : [width, height, width];
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * width : line;
    const at = (i: number) => alpha[start + Math.max(0, Math.min(length - 1, i)) * step];
    let sum = 0;
    if (mode === 'mean') for (let k = -radius; k <= radius; k++) sum += at(k);
    for (let i = 0; i < length; i++) {
      if (mode === 'mean') {
        out[start + i * step] = sum / (radius * 2 + 1);
        sum += at(i + radius + 1) - at(i - radius);
      } else {
        let min = 255;
        for (let k = i - radius; k <= i + radius; k++) min = Math.min(min, at(k));
        out[start + i * step] = min;
      }
    }
  }
  return out;
}

function withAlpha(src: Pixels, change: (alpha: Float32Array) => Float32Array): Pixels {
  const n = src.width * src.height;
  const original = new Float32Array(n);
  for (let p = 0; p < n; p++) original[p] = src.data[p * 4 + 3];
  const alpha = change(original);
  const data = new Uint8ClampedArray(src.data);
  for (let p = 0; p < n; p++) data[p * 4 + 3] = Math.round(alpha[p]);
  return { width: src.width, height: src.height, data };
}

/** 그림 테두리를 radius 픽셀만큼 안으로 깎는다 (지우고 남은 배경색 띠 없애기) */
export function shrinkEdges(src: Pixels, radius: number): Pixels {
  if (radius <= 0) return src;
  const { width, height } = src;
  return withAlpha(src, (a) => alphaPass(alphaPass(a, width, height, radius, true, 'min'), width, height, radius, false, 'min'));
}

/** 테두리를 radius 픽셀만큼 흐리게 (투명한 곳의 색이 번져 보이지 않게 먼저 색을 채운다) */
export function featherEdges(src: Pixels, radius: number): Pixels {
  if (radius <= 0) return src;
  const { width, height } = src;
  return withAlpha(bleedColors(src, radius + 2), (a) => alphaPass(alphaPass(a, width, height, radius, true, 'mean'), width, height, radius, false, 'mean'));
}

/** 한 방향으로 크기를 바꿀 때 새 칸 i에 들어갈 원래 칸들과 비율 (줄일 때는 겹치는 넓이, 키울 때는 거리에 따라) */
function weights(from: number, to: number) {
  const table: [number, number][][] = [];
  const scale = from / to;
  for (let i = 0; i < to; i++) {
    const list: [number, number][] = [];
    if (scale >= 1) {
      const start = i * scale;
      const end = start + scale;
      for (let k = Math.floor(start); k < Math.min(from, Math.ceil(end)); k++) {
        const w = Math.min(end, k + 1) - Math.max(start, k);
        if (w > 0) list.push([k, w / scale]);
      }
    } else {
      const center = (i + 0.5) * scale - 0.5;
      const k = Math.floor(center);
      const t = center - k;
      list.push([Math.max(0, Math.min(from - 1, k)), 1 - t], [Math.max(0, Math.min(from - 1, k + 1)), t]);
    }
    table.push(list);
  }
  return table;
}

/** width × height로 크기를 바꾼 새 픽셀 (색은 투명도를 곱해서 섞어 투명한 곳의 색이 묻어나지 않게) */
export function resample(src: Pixels, width: number, height: number): Pixels {
  if (width === src.width && height === src.height) return src;
  return fromPremultiplied(resampleFloat(premultiplied(src), src.width, src.height, width, height, 4), width, height);
}

/** 투명도를 곱한 RGBA 실수 배열 (색은 0~255×투명도, 투명도는 0~255) */
function premultiplied({ width, height, data }: Pixels) {
  const pre = new Float32Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const a = data[p * 4 + 3] / 255;
    pre[p * 4] = data[p * 4] * a;
    pre[p * 4 + 1] = data[p * 4 + 1] * a;
    pre[p * 4 + 2] = data[p * 4 + 2] * a;
    pre[p * 4 + 3] = data[p * 4 + 3];
  }
  return pre;
}

function fromPremultiplied(pre: Float32Array, width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const a = pre[p * 4 + 3];
    data[p * 4 + 3] = Math.round(a);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.round((pre[p * 4 + c] / a) * 255);
  }
  return { width, height, data };
}

/** 채널이 channels개인 실수 그림의 크기를 바꾼다 (줄일 때는 넓이 평균, 키울 때는 양선형) */
export function resampleFloat(src: Float32Array, sw: number, sh: number, width: number, height: number, channels: number) {
  if (width === sw && height === sh) return src;
  const wx = weights(sw, width);
  const wy = weights(sh, height);
  const mid = new Float32Array(width * sh * channels);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < width; x++)
      for (const [k, w] of wx[x]) for (let c = 0; c < channels; c++) mid[(y * width + x) * channels + c] += src[(y * sw + k) * channels + c] * w;
  const out = new Float32Array(width * height * channels);
  for (let y = 0; y < height; y++)
    for (const [k, w] of wy[y]) for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) out[(y * width + x) * channels + c] += mid[(k * width + x) * channels + c] * w;
  return out;
}

/**
 * 크게 키운 그림(big)의 색을 원본(small)에 맞춘다: big을 원본 크기로 줄였을 때와 원본의 차이를 다시 키워 더한다.
 * AI가 선은 살리되 색을 진하게 바꾸는 것을 되돌린다 (선과 질감은 그대로).
 */
export function matchColors(big: Pixels, small: Pixels): Pixels {
  const preBig = premultiplied(big);
  const preSmall = premultiplied(small);
  const down = resampleFloat(preBig, big.width, big.height, small.width, small.height, 4);
  for (let i = 0; i < down.length; i++) down[i] = preSmall[i] - down[i];
  const diff = resampleFloat(down, small.width, small.height, big.width, big.height, 4);
  for (let p = 0; p < big.width * big.height; p++) {
    const a = Math.min(255, Math.max(0, preBig[p * 4 + 3] + diff[p * 4 + 3]));
    // 색은 투명도를 넘지 않게 (투명도를 곱한 값이라)
    for (let c = 0; c < 3; c++) preBig[p * 4 + c] = Math.min(a, Math.max(0, preBig[p * 4 + c] + diff[p * 4 + c]));
    preBig[p * 4 + 3] = a;
  }
  return fromPremultiplied(preBig, big.width, big.height);
}

/**
 * AI가 찾은 자리(mask)만 남긴다: level(0~1) 근처 edge 폭 안에서는 반투명하게 잇고, 그보다 낮으면 지우고 높으면 그대로 둔다.
 * mask는 원본 크기여도 되고, 그림 크기에 맞춰 늘린다.
 */
export function applyMask(src: Pixels, mask: Mask, level: number, edge: number): Pixels {
  const { width, height } = src;
  const m = resampleFloat(mask.data, mask.width, mask.height, width, height, 1);
  const lo = level - edge / 2;
  const hi = level + edge / 2;
  const data = new Uint8ClampedArray(src.data);
  for (let p = 0; p < width * height; p++) {
    const keep = hi > lo ? Math.min(1, Math.max(0, (m[p] - lo) / (hi - lo))) : m[p] >= level ? 1 : 0;
    data[p * 4 + 3] = Math.round(data[p * 4 + 3] * keep);
  }
  return { width, height, data };
}

/** 붓 자국을 칸마다 0(안 칠함), 1(지우기), 2(살리기)로 (나중에 그은 획이 위에) */
export function paintStrokes(width: number, height: number, strokes: Stroke[]): Uint8Array {
  const out = new Uint8Array(width * height);
  for (const { erase, size, points } of strokes) {
    const value = erase ? 1 : 2;
    const r = Math.max(0.5, (size * width) / 2);
    const stamp = (cx: number, cy: number) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(height - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(width - 1, Math.ceil(cx + r)); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) out[y * width + x] = value;
    };
    // 점 사이는 붓 반지름의 절반 간격으로 찍어 이어지게
    let [px, py] = [points[0][0] * width, points[0][1] * height];
    stamp(px, py);
    for (const [fx, fy] of points.slice(1)) {
      const x = fx * width;
      const y = fy * height;
      const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / Math.max(0.5, r / 2)));
      for (let i = 1; i <= steps; i++) stamp(px + ((x - px) * i) / steps, py + ((y - py) * i) / steps);
      [px, py] = [x, y];
    }
  }
  return out;
}

/** 붓 자국대로 지우거나(투명) 살린다(before의 같은 칸으로 되돌림). before와 src는 크기가 같아야 함 */
export function applyStrokes(src: Pixels, before: Pixels, paint: Uint8Array): Pixels {
  const data = new Uint8ClampedArray(src.data);
  for (let p = 0; p < paint.length; p++) {
    if (paint[p] === 1) data[p * 4 + 3] = 0;
    else if (paint[p] === 2) data.set(before.data.subarray(p * 4, p * 4 + 4), p * 4);
  }
  return { width: src.width, height: src.height, data };
}

/** 두 그림을 섞는다 (amount 0 = a, 1 = b, 크기가 같아야 함). 색은 투명도를 곱해서 섞어 투명한 곳의 색이 묻어나지 않게 */
export function blend(a: Pixels, b: Pixels, amount: number): Pixels {
  if (amount >= 1 || a === b) return b;
  if (amount <= 0) return a;
  const data = new Uint8ClampedArray(a.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const wa = a.data[i + 3] * (1 - amount);
    const wb = b.data[i + 3] * amount;
    const alpha = wa + wb;
    data[i + 3] = alpha;
    if (alpha > 0) for (let c = 0; c < 3; c++) data[i + c] = (a.data[i + c] * wa + b.data[i + c] * wb) / alpha;
  }
  return { width: a.width, height: a.height, data };
}

/** 투명한 곳에 가까운 그림 색을 번지게 채운 새 픽셀 (투명도는 그대로). 업스케일 전에 테두리 색이 검게 섞이지 않게 */
export function bleedColors(src: Pixels, passes = 8): Pixels {
  const { width, height } = src;
  const data = new Uint8ClampedArray(src.data);
  const n = width * height;
  const filled = new Uint8Array(n);
  for (let p = 0; p < n; p++) filled[p] = data[p * 4 + 3] > 0 ? 1 : 0;
  for (let pass = 0; pass < passes; pass++) {
    const next = filled.slice();
    for (let p = 0; p < n; p++) {
      if (filled[p]) continue;
      const x = p % width;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q < 0 || q >= n || !filled[q]) continue;
        r += data[q * 4];
        g += data[q * 4 + 1];
        b += data[q * 4 + 2];
        count++;
      }
      if (!count) continue;
      data[p * 4] = r / count;
      data[p * 4 + 1] = g / count;
      data[p * 4 + 2] = b / count;
      next[p] = 1;
    }
    filled.set(next);
  }
  return { width, height, data };
}

/** 투명한 픽셀이 하나라도 있는지 */
export function hasTransparency({ data }: Pixels) {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}
