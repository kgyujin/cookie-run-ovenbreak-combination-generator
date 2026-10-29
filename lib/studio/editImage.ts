import { type Box, type Pixels, type Rgb, blend, crop, detectBackground, featherEdges, opaqueBounds, pad, removeBackground, resample, shrinkEdges } from './imageOps';

/**
 * 관리 페이지 이미지 다듬기의 설정과 순서. 다듬기 창과 '여러 장에 같은 설정 적용'이 같은 순서로 처리한다.
 * 원본 → 키우기(AI 결과와 그냥 키운 것을 섞음) → 배경 지우기 → 가장자리 깎기, 흐리게 → 여백 자르기 → 바깥 여백
 */
export interface EditSettings {
  /** 키우는 배율 (1이면 그대로) */
  scale: 1 | 2 | 3 | 4;
  /** AI 결과를 쓰는 정도 (0~100, 0이면 그냥 키운 것) */
  aiStrength: number;
  removeBg: boolean;
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
  aiStrength: 100,
  removeBg: false,
  colors: null,
  tolerance: 12,
  softness: 10,
  everywhere: false,
  shrink: 0,
  feather: 0,
  trim: true,
  margin: 0,
};

/** AI로 키울 수 있는 가장 긴 변 (이보다 크면 이미 충분히 크고, 오래 걸림) */
export const MAX_ENLARGE_SIDE = 512;
export const canEnlarge = (p: Pixels) => Math.max(p.width, p.height) <= MAX_ENLARGE_SIDE;

/** 배율만큼 키운 그림: AI 결과(4배)를 배율에 맞게 줄이고, AI 강도만큼 그냥 키운 것과 섞는다 (AI 결과가 없으면 그냥 키운 것) */
export function enlarge(original: Pixels, ai4x: Pixels | null, { scale, aiStrength }: Pick<EditSettings, 'scale' | 'aiStrength'>): Pixels {
  if (scale === 1 || !canEnlarge(original)) return original;
  const width = original.width * scale;
  const height = original.height * scale;
  const plain = resample(original, width, height);
  if (!ai4x || aiStrength <= 0) return plain;
  return blend(plain, resample(ai4x, width, height), aiStrength / 100);
}

/** 배경 지우기와 테두리 다듬기까지 (자르기 전, 크기는 그대로) */
export function clean(base: Pixels, s: EditSettings): Pixels {
  // 지울 색을 정해 두지 않았으면 그림 가장자리에서 찾는다 (가장자리가 이미 투명하면 없음)
  const found = s.removeBg && !s.colors && detectBackground(base);
  const colors = !s.removeBg ? [] : s.colors ?? (found ? [found] : []);
  let out = colors.length ? removeBackground(base, { colors, tolerance: s.tolerance, softness: s.softness, everywhere: s.everywhere }) : base;
  out = shrinkEdges(out, s.shrink);
  return featherEdges(out, s.feather);
}

/** 마지막에 남길 부분 (여백 자르기를 끄거나 다 투명하면 전체) */
export function keepBox(cleaned: Pixels, s: EditSettings): Box {
  const all = { x: 0, y: 0, width: cleaned.width, height: cleaned.height };
  return (s.trim && opaqueBounds(cleaned)) || all;
}

/** 자르고 바깥 여백을 넣은 최종 그림 */
export function finish(cleaned: Pixels, s: EditSettings): Pixels {
  const box = keepBox(cleaned, s);
  const kept = box.width === cleaned.width && box.height === cleaned.height ? cleaned : crop(cleaned, box);
  return pad(kept, s.margin);
}

/** 설정을 그대로 적용한 결과 (여러 장에 같은 설정을 적용할 때). AI가 필요하면 upscale로 키운다 */
export async function processImage(original: Pixels, s: EditSettings, upscale: (p: Pixels) => Promise<Pixels>): Promise<Pixels> {
  const ai4x = s.scale > 1 && s.aiStrength > 0 && canEnlarge(original) ? await upscale(original) : null;
  return finish(clean(enlarge(original, ai4x, s), s), s);
}
