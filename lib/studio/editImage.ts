import {
  type Box,
  type Mask,
  type Pixels,
  type Rgb,
  type Stroke,
  applyMask,
  applyStrokes,
  blend,
  crop,
  detectBackground,
  featherEdges,
  opaqueBounds,
  pad,
  paintStrokes,
  removeBackground,
  resample,
  shrinkEdges,
} from './imageOps';

/**
 * 관리 페이지 이미지 다듬기의 설정과 순서. 다듬기 창과 '여러 장에 같은 설정 적용'이 같은 순서로 처리한다.
 * 원본 → 키우기(AI 결과와 그냥 키운 것을 섞음) → 배경 지우기(색 또는 AI 인식) → 붓 → 가장자리 깎기, 흐리게 → 여백 자르기 → 바깥 여백
 */
export interface EditSettings {
  /** 키우는 배율 (1이면 그대로) */
  scale: 1 | 2 | 3 | 4;
  /** AI 모델: waifu2x(원본에 충실), Real-ESRGAN(더 선명) */
  engine: 'waifu2x' | 'esrgan';
  /** waifu2x 노이즈 제거 단계 (-1이면 안 함) */
  noise: -1 | 0 | 1 | 2 | 3;
  /** AI 결과를 쓰는 정도 (0~100, 0이면 AI를 쓰지 않음) */
  aiStrength: number;
  removeBg: boolean;
  /** 배경 지우는 방법: 색으로, AI로 캐릭터 찾기 */
  bgMethod: 'color' | 'ai';
  /** AI 인식: 이 값(0~100)보다 확실한 곳만 남긴다 */
  aiLevel: number;
  /** AI 인식: 남길 곳과 지울 곳 사이를 반투명하게 잇는 폭 (0~100) */
  aiEdge: number;
  /** 지울 배경색. null이면 그림마다 가장자리에서 찾는다 */
  colors: Rgb[] | null;
  /** 이 거리(0~100)까지 배경색으로 본다 */
  tolerance: number;
  /** 배경과 그림 사이를 반투명하게 잇는 폭 (0~100) */
  softness: number;
  /** 가장자리와 떨어진 곳의 배경색도 지운다 */
  everywhere: boolean;
  /** 테두리를 안으로 깎는 픽셀 (남은 배경색 띠 없애기) */
  shrink: number;
  /** 테두리를 흐리게 하는 픽셀 */
  feather: number;
  /** 투명한 바깥 여백 자르기 */
  trim: boolean;
  /** 마지막에 사방으로 넣는 투명한 여백 (픽셀) */
  margin: number;
}

export const DEFAULT_SETTINGS: EditSettings = {
  scale: 1,
  engine: 'waifu2x',
  noise: 0,
  aiStrength: 100,
  removeBg: false,
  bgMethod: 'color',
  aiLevel: 45,
  aiEdge: 50,
  colors: null,
  tolerance: 12,
  softness: 10,
  everywhere: false,
  shrink: 0,
  feather: 0,
  trim: true,
  margin: 0,
};

/** AI로 다룰 수 있는 가장 긴 변 (이보다 크면 이미 충분히 크고, 오래 걸림) */
export const MAX_ENLARGE_SIDE = 512;
export const canEnlarge = (p: Pixels) => Math.max(p.width, p.height) <= MAX_ENLARGE_SIDE;

/** 이 설정에 필요한 AI 계산 (waifu2x는 3배, 4배일 때 2배를 두 번) */
export const aiOptions = (s: Pick<EditSettings, 'scale' | 'engine' | 'noise'>) => ({
  engine: s.engine,
  noise: s.noise,
  passes: (s.scale > 2 ? 2 : 1) as 1 | 2,
});
/** 같은 값이면 같은 AI 결과라 다시 계산하지 않아도 된다 */
export const aiKey = (s: Pick<EditSettings, 'scale' | 'engine' | 'noise'>) => {
  const o = aiOptions(s);
  return o.engine === 'esrgan' ? 'esrgan' : `waifu2x:${o.noise}:${o.passes}`;
};

/** 배율만큼 키운 그림: AI 결과를 배율에 맞게 줄이고, AI 강도만큼 그냥 키운 것과 섞는다 (AI 결과가 없으면 그냥 키운 것) */
export function enlarge(original: Pixels, ai: Pixels | null, { scale, aiStrength }: Pick<EditSettings, 'scale' | 'aiStrength'>): Pixels {
  if (!canEnlarge(original)) return original;
  const width = original.width * scale;
  const height = original.height * scale;
  const plain = resample(original, width, height);
  if (!ai || aiStrength <= 0) return plain;
  return blend(plain, resample(ai, width, height), aiStrength / 100);
}

/** 배경 지우기까지 (붓, 테두리 전). AI 인식은 mask가 있어야 지운다 */
export function removeBg(base: Pixels, s: EditSettings, mask: Mask | null): Pixels {
  if (!s.removeBg) return base;
  if (s.bgMethod === 'ai') return mask ? applyMask(base, mask, s.aiLevel / 100, s.aiEdge / 100) : base;
  // 지울 색을 정해 두지 않았으면 그림 가장자리에서 찾는다 (가장자리가 이미 투명하면 없음)
  const found = !s.colors && detectBackground(base);
  const colors = s.colors ?? (found ? [found] : []);
  return colors.length ? removeBackground(base, { colors, tolerance: s.tolerance, softness: s.softness, everywhere: s.everywhere }) : base;
}

/** 붓 자국 (살리기는 배경을 지우기 전 그림으로 되돌림) */
export function paint(removed: Pixels, base: Pixels, strokes: Stroke[]): Pixels {
  return strokes.length ? applyStrokes(removed, base, paintStrokes(base.width, base.height, strokes)) : removed;
}

/** 테두리 다듬기 */
export function edges(painted: Pixels, s: Pick<EditSettings, 'shrink' | 'feather'>): Pixels {
  return featherEdges(shrinkEdges(painted, s.shrink), s.feather);
}

/** 배경 지우기부터 테두리 다듬기까지 (자르기 전, 크기는 그대로) */
export function clean(base: Pixels, s: EditSettings, mask: Mask | null = null, strokes: Stroke[] = []): Pixels {
  return edges(paint(removeBg(base, s, mask), base, strokes), s);
}

/** 마지막에 남길 부분 (여백 자르기를 끄거나 다 투명하면 전체) */
export function keepBox(cleaned: Pixels, s: Pick<EditSettings, 'trim'>): Box {
  const all = { x: 0, y: 0, width: cleaned.width, height: cleaned.height };
  return (s.trim && opaqueBounds(cleaned)) || all;
}

/** 자르고 바깥 여백을 넣은 최종 그림 */
export function finish(cleaned: Pixels, s: Pick<EditSettings, 'trim' | 'margin'>): Pixels {
  const box = keepBox(cleaned, s);
  const kept = box.width === cleaned.width && box.height === cleaned.height ? cleaned : crop(cleaned, box);
  return pad(kept, s.margin);
}

/** AI 계산 (화면 쪽에서 넣어 준다) */
export interface AiTools {
  upscale: (p: Pixels, options: ReturnType<typeof aiOptions>) => Promise<Pixels>;
  segment: (p: Pixels) => Promise<Mask>;
}

/** 설정을 그대로 적용한 결과 (여러 장에 같은 설정을 적용할 때. 붓 자국은 그림마다 달라서 빼고). AI가 필요하면 tools로 계산한다 */
export async function processImage(original: Pixels, s: EditSettings, tools: AiTools): Promise<Pixels> {
  const ai = s.aiStrength > 0 && canEnlarge(original) ? await tools.upscale(original, aiOptions(s)) : null;
  const mask = s.removeBg && s.bgMethod === 'ai' ? await tools.segment(original) : null;
  return finish(clean(enlarge(original, ai, s), s, mask), s);
}
