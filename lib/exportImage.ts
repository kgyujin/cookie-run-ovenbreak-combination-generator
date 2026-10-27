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

/** 외곽선을 글자 뒤에 깔리는 그림자 고리로 바꾼다 (html2canvas는 외곽선을 글자 위에 덮어 그려 글자가 얇아지거나 사라짐) */
function strokeAsShadow(width: number, color: string) {
  const steps = Math.max(12, Math.ceil(width * 8));
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return `${(Math.cos(a) * width).toFixed(2)}px ${(Math.sin(a) * width).toFixed(2)}px 0 ${color}`;
  }).join(', ');
}

const COPIED_STYLES = [
  'position', 'left', 'top', 'width', 'height', 'zIndex', 'margin', 'padding', 'boxSizing', 'borderRadius', 'backgroundColor',
  'fontFamily', 'fontSize', 'fontWeight', 'color', 'letterSpacing', 'lineHeight', 'textAlign', 'transform', 'textShadow',
] as const;

/**
 * html2canvas는 입력칸 글자를 따로 그리면서 칸 높이에 맞춰 잘라 버린다(글자가 반만 보임).
 * 저장용 복제본에서는 입력칸을 같은 모양의 일반 글자 상자로 바꾼다.
 */
function replaceFields(originals: (HTMLInputElement | HTMLTextAreaElement)[], clones: (HTMLInputElement | HTMLTextAreaElement)[]) {
  originals.forEach((field, i) => {
    const clone = clones[i];
    if (!clone) return;
    // 복제본 문서의 계산값을 쓴다 (원본은 저장 모드로 바뀌는 전환 효과가 진행 중일 수 있음)
    const cs = clone.ownerDocument.defaultView!.getComputedStyle(clone);
    const box = clone.ownerDocument.createElement('div');
    box.textContent = field.value;
    for (const key of COPIED_STYLES) box.style[key] = cs[key];
    const isTextarea = field.tagName === 'TEXTAREA';
    Object.assign(box.style, {
      display: isTextarea ? 'block' : 'flex',
      alignItems: 'center',
      justifyContent: { left: 'flex-start', right: 'flex-end', start: 'flex-start', end: 'flex-end' }[cs.textAlign] ?? 'center',
      whiteSpace: isTextarea ? 'pre-wrap' : 'nowrap',
      overflow: 'visible',
      border: 'none',
      boxShadow: 'none',
    });
    const strokeWidth = parseFloat(cs.webkitTextStrokeWidth);
    if (strokeWidth > 0) {
      const ring = strokeAsShadow(strokeWidth, cs.webkitTextStrokeColor);
      box.style.textShadow = cs.textShadow && cs.textShadow !== 'none' ? `${ring}, ${cs.textShadow}` : ring;
    }
    clone.replaceWith(box);
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
    // 화면 밖이라 아직 안 불러온(lazy) 이미지도 저장에는 필요하므로 바로 불러오게 한다
    captureArea.querySelectorAll('img[loading="lazy"]').forEach((img) => img.setAttribute('loading', 'eager'));
    await Promise.all([document.fonts?.ready, waitForImages(captureArea)]);

    const { offsetWidth: w, offsetHeight: h } = captureArea;
    const canvas = await html2canvas(captureArea, {
      backgroundColor: null,
      scale: Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * h))),
      useCORS: true,
      logging: false,
      windowWidth: width,
      onclone: (doc) => {
        const clonedArea = doc.getElementById(captureArea.id);
        if (!clonedArea) return;
        applyObjectFit(Array.from(captureArea.querySelectorAll('img')), Array.from(clonedArea.querySelectorAll('img')));
        const fields = 'input:not([type=hidden]), textarea';
        replaceFields(
          Array.from(captureArea.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fields)),
          Array.from(clonedArea.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fields))
        );
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
