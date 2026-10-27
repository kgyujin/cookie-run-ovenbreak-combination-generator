import html2canvas from 'html2canvas';
import { BackgroundData } from '@/types';
import { backgroundCss, EXPORT_WIDTH } from './board';

// iOS Safari 캔버스 최대 픽셀 수(약 16.7M)를 넘지 않게 배율을 정한다
const MAX_CANVAS_PIXELS = 16_000_000;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

const waitForImages = (root: HTMLElement) =>
  Promise.all(
    Array.from(root.querySelectorAll('img'))
      .filter((img) => !img.complete)
      .map((img) => new Promise((r) => {
        img.addEventListener('load', r);
        img.addEventListener('error', r);
      }))
  );

/**
 * 조합표를 PNG로 저장한다. 화면 크기와 관계없이 항상 같은 폭(2열 배치)으로 만든다.
 * 저장하는 동안 .is-exporting 클래스로 빈 칸 표시·편집용 요소를 숨긴다.
 */
export async function exportBoardImage(captureArea: HTMLElement, background: BackgroundData) {
  const originalStyle = captureArea.getAttribute('style') ?? '';
  captureArea.classList.add('is-exporting');
  captureArea.style.width = `${EXPORT_WIDTH}px`;
  captureArea.style.background = backgroundCss(background);

  try {
    await nextFrame();
    await nextFrame();
    await Promise.all([document.fonts?.ready, waitForImages(captureArea)]);

    const { offsetWidth: w, offsetHeight: h } = captureArea;
    const canvas = await html2canvas(captureArea, {
      backgroundColor: null,
      scale: Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * h))),
      useCORS: true,
      logging: false,
      windowWidth: EXPORT_WIDTH,
      onclone: (doc) => {
        doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((el) => (el.placeholder = ''));
      },
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('이미지 변환 실패');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `쿠키런_조합표_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    captureArea.classList.remove('is-exporting');
    captureArea.setAttribute('style', originalStyle);
  }
}
