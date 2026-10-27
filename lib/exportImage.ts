import html2canvas from 'html2canvas';
import { BackgroundData } from '@/types';
import { backgroundCss, BOARD_WIDTH } from './board';

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
 * html2canvas는 object-fit을 지원하지 않아 이미지를 칸 크기대로 늘려 그린다(쿠키가 눌려 보임).
 * 그래서 복제본의 각 이미지를 원래 비율대로 계산한 크기·위치로 바꿔 둔다.
 */
function applyObjectFit(originals: HTMLImageElement[], clones: HTMLImageElement[]) {
  originals.forEach((img, i) => {
    const clone = clones[i];
    const { naturalWidth: nw, naturalHeight: nh, offsetWidth: w, offsetHeight: h } = img;
    if (!clone || !nw || !nh || !w || !h) return;
    const style = getComputedStyle(img);
    if (style.objectFit !== 'contain') return;
    const scale = Math.min(w / nw, h / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    const [px, py] = style.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    Object.assign(clone.style, {
      position: 'absolute',
      inset: 'auto',
      left: `${img.offsetLeft + (w - dw) * (isNaN(px) ? 0.5 : px)}px`,
      top: `${img.offsetTop + (h - dh) * (isNaN(py) ? 0.5 : py)}px`,
      width: `${dw}px`,
      height: `${dh}px`,
      objectFit: 'fill',
    });
  });
}

/**
 * 조합표를 PNG로 저장한다. 화면 크기와 관계없이 항상 같은 폭(2열 배치)으로 만든다.
 * 저장하는 동안 .is-exporting 클래스로 빈 칸 표시·편집용 요소를 숨긴다.
 */
export async function exportBoardImage(captureArea: HTMLElement, background: BackgroundData, padding: number) {
  const originalStyle = captureArea.getAttribute('style') ?? '';
  const width = BOARD_WIDTH + padding * 2;
  captureArea.classList.add('is-exporting');
  captureArea.style.setProperty('--export-pad', `${padding}px`);
  captureArea.style.width = `${width}px`;
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
      windowWidth: width,
      onclone: (doc) => {
        doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((el) => (el.placeholder = ''));
        const clonedArea = doc.getElementById(captureArea.id);
        if (clonedArea) applyObjectFit(Array.from(captureArea.querySelectorAll('img')), Array.from(clonedArea.querySelectorAll('img')));
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
