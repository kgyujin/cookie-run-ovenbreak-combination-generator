import type { Pixels } from '@/lib/studio/imageOps';

/** 관리 페이지 이미지 다듬기: 이미지 주소, 캔버스, PNG와 픽셀 사이를 오간다 (브라우저 전용) */

/** 이미지 주소 → 픽셀. 앞의 주소부터 열리는 것으로 (다른 사이트 이미지는 CORS를 허용해야 읽을 수 있음) */
export async function loadPixels(sources: string[]): Promise<Pixels> {
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

export function drawPixels(canvas: HTMLCanvasElement, { width, height, data }: Pixels) {
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
}

/** 픽셀 → PNG (data: 접두어 없는 base64)와 파일 크기 */
export async function toPngBase64(pixels: Pixels) {
  const canvas = document.createElement('canvas');
  drawPixels(canvas, pixels);
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
