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
 * 꾹 눌러 옮긴 칸: html2canvas는 transform으로 옮긴 칸 안의 그림을 칸과 다르게 옮겨 그려서(화면 배율에 따라) 잘린다.
 * 저장용 복제본에서는 옮긴 자리를 left/top으로 바로 지정한다.
 */
function placeMoved(originals: HTMLElement[], clones: HTMLElement[]) {
  originals.forEach((el, i) => {
    const clone = clones[i];
    const cs = getComputedStyle(el);
    const [x, y] = [parseFloat(cs.getPropertyValue('--mx')) || 0, parseFloat(cs.getPropertyValue('--my')) || 0];
    if (!clone || (!x && !y)) return;
    // 폭이 left와 right로 정해지는 칸(대체 쿠키 줄)도 있어서 크기도 그대로 고정
    Object.assign(clone.style, {
      left: `${el.offsetLeft + x}px`,
      top: `${el.offsetTop + y}px`,
      width: `${el.offsetWidth}px`,
      height: `${el.offsetHeight}px`,
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
    });
  });
}

const MAX_PNG_BYTES = 8 * 1024 * 1024;

const COPIED_STYLES = [
  'position', 'left', 'top', 'width', 'height', 'zIndex', 'margin', 'padding', 'boxSizing', 'borderRadius', 'backgroundColor',
  'fontFamily', 'fontSize', 'fontWeight', 'color', 'letterSpacing', 'lineHeight', 'textAlign', 'transform', 'textShadow', 'maxHeight',
] as const;

/** 칸 안쪽 폭에 맞게 글자를 줄이고 끝에 '…' */
function fitWithEllipsis(field: HTMLInputElement | HTMLTextAreaElement) {
  const cs = getComputedStyle(field);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return field.value;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const room = field.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let text = field.value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > room) text = text.slice(0, -1);
  return `${text}…`;
}

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
    const isTextarea = field.tagName === 'TEXTAREA';
    // 화면에서 칸을 넘쳐 '…'으로 보이는 긴 점수는 저장 이미지에서도 똑같이 줄인다 (html2canvas는 '…'를 그리지 않음)
    box.textContent = !isTextarea && field.scrollWidth > field.clientWidth + 1 ? fitWithEllipsis(field) : field.value;
    for (const key of COPIED_STYLES) box.style[key] = cs[key];
    Object.assign(box.style, {
      display: 'block',
      whiteSpace: isTextarea ? 'pre-wrap' : 'nowrap',
      // 시즌명은 화면처럼 3줄 높이에서 자른다 (글자 크기를 키워 넘친 줄이 이미지에만 나오지 않게)
      overflow: isTextarea ? 'hidden' : 'visible',
      border: 'none',
      boxShadow: 'none',
    });
    if (!isTextarea) {
      // 한 줄 입력칸: 줄 높이를 칸 높이와 같게 해서 세로 가운데 (html2canvas는 flex 가운데 정렬을 아래로 밀리게 그림)
      Object.assign(box.style, { paddingTop: '0', paddingBottom: '0', lineHeight: `${parseFloat(cs.height)}px` });
    }
    clone.replaceWith(box);
  });
}

/**
 * 조합표를 PNG로 저장한다. 화면 크기와 관계없이 항상 같은 폭(2열 배치)으로 만든다.
 * 저장하는 동안 .is-exporting 클래스로 빈 칸 표시·편집용 요소를 숨긴다.
 */
export async function exportBoardImage(captureArea: HTMLElement, background: BackgroundData, padding: number, customFontUrl?: string) {
  const originalStyle = captureArea.getAttribute('style') ?? '';
  const scrollY = window.scrollY; // 저장용으로 폭을 바꾸면 페이지 길이가 바뀌어 스크롤이 튀므로 나중에 되돌린다
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
      // 미리 받기 링크(분석 스크립트 등)는 그림에 필요 없고, 복제본에서 다시 받게 되므로 뺀다
      ignoreElements: (el) => el.matches('link[rel="preload"]'),
      onclone: async (doc) => {
        const clonedArea = doc.getElementById(captureArea.id);
        if (!clonedArea) return;
        // 직접 올린 글꼴은 화면 문서에만 등록돼 있어서, 저장용 복제본에도 등록하고 다 불러온 뒤 그린다
        // (안 하면 글자 폭이 달라져 겹치거나 줄바꿈이 바뀜)
        if (customFontUrl) {
          const style = doc.createElement('style');
          style.textContent = `@font-face{font-family:'CustomFont';src:url(${JSON.stringify(customFontUrl)})}`;
          doc.head.appendChild(style);
          await doc.fonts.load("16px 'CustomFont'").catch(() => {});
        }
        await doc.fonts.ready;
        applyObjectFit(Array.from(captureArea.querySelectorAll('img')), Array.from(clonedArea.querySelectorAll('img')));
        placeMoved(Array.from(captureArea.querySelectorAll<HTMLElement>('[data-move]')), Array.from(clonedArea.querySelectorAll<HTMLElement>('[data-move]')));
        const fields = 'input:not([type=hidden]), textarea';
        replaceFields(
          Array.from(captureArea.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fields)),
          Array.from(clonedArea.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fields))
        );
      },
    });

    const toBlob = (type: string, quality?: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await toBlob('image/png');
    let ext = 'png';
    // 사진 배경 등으로 너무 크면(메신저 업로드 한도) 화질이 거의 같은 JPG로
    if (blob && blob.size > MAX_PNG_BYTES) {
      const jpg = await toBlob('image/jpeg', 0.92);
      if (jpg && jpg.size < blob.size) [blob, ext] = [jpg, 'jpg'];
    }
    if (!blob) throw new Error('이미지 변환 실패');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    // 파일 이름의 날짜는 이 컴퓨터 시간대 기준 (UTC로 하면 한국 아침 9시 전에는 어제 날짜가 됨)
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    link.download = `쿠키런_조합표_${today}.${ext}`;
    link.href = url;
    // 문서에 붙여서 눌러야 파일 이름이 지켜지는 브라우저가 있다
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    captureArea.classList.remove('is-exporting');
    captureArea.setAttribute('style', originalStyle);
    window.scrollTo(0, scrollY);
  }
}
