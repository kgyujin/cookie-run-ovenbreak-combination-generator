/**
 * 관리 페이지 이미지 다듬기의 픽셀 계산 (화면과 상관없는 순수 함수, RGBA 8비트).
 * - 투명화: 가장자리와 이어진 배경색 지우기 (가장자리 부드럽게, 배경색이 묻은 테두리 색 되돌리기)
 * - 투명한 여백 자르기
 * - 투명한 곳의 색 채우기 (업스케일할 때 테두리에 검은 띠가 생기지 않게)
 */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type Rgb = [number, number, number];

export interface RemoveOptions {
  /** 지울 배경색 */
  color: Rgb;
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

/** 가장자리 픽셀에서 가장 많이 나오는 색 (비슷한 색은 묶어서 센다). 가장자리가 다 투명하면 null */
export function detectBackground({ width, height, data }: Pixels): Rgb | null {
  const counts = new Map<number, { n: number; sum: Rgb }>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) return;
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
  let best: { n: number; sum: Rgb } | undefined;
  counts.forEach((bin) => {
    if (!best || bin.n > best.n) best = bin;
  });
  return best ? (best.sum.map((v) => Math.round(v / best!.n)) as Rgb) : null;
}

/** 배경색을 지운 새 픽셀 */
export function removeBackground(src: Pixels, { color, tolerance, softness, everywhere }: RemoveOptions): Pixels {
  const { width, height } = src;
  const data = new Uint8ClampedArray(src.data);
  const n = width * height;
  const limit = tolerance + softness; // 이 거리까지는 배경 쪽(투명하거나 반투명)으로 본다
  const near = new Uint8Array(n);
  for (let p = 0; p < n; p++) near[p] = data[p * 4 + 3] > 0 && distance(data, p * 4, color) <= limit ? 1 : 0;

  // 지울 곳: 가장자리에서 배경색끼리 이어진 곳 (everywhere면 배경색 전부)
  let target = near;
  if (!everywhere) {
    target = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const seed = (p: number) => {
      if (near[p] && !target[p]) (target[p] = 1), (queue[tail++] = p);
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
    const d = distance(data, i, color);
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

/** 거의 투명한(alpha < threshold) 바깥 여백을 잘라 낸 새 픽셀. 다 투명하면 그대로 */
export function trimTransparent(src: Pixels, threshold = 8): Pixels {
  const { width, height, data } = src;
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
  if (bottom < 0 || (top === 0 && left === 0 && bottom === height - 1 && right === width - 1)) return src;
  const w = right - left + 1;
  const h = bottom - top + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(data.subarray(((top + y) * width + left) * 4, ((top + y) * width + left + w) * 4), y * w * 4);
  return { width: w, height: h, data: out };
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
