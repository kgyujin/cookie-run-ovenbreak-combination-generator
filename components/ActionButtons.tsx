'use client';

import { useEffect } from 'react';
import html2canvas from 'html2canvas';
import { compressToEncodedURIComponent } from 'lz-string';
import { useAppStore } from '@/store/useAppStore';
import type { AppStore } from '@/store/useAppStore';

export default function ActionButtons() {
  const appState = useAppStore() as AppStore;
  const isExporting = useAppStore((state: AppStore) => state.isExporting);
  const exportProgress = useAppStore((state: AppStore) => state.exportProgress);
  const setIsExporting = useAppStore((state: AppStore) => state.setIsExporting);
  const setExportProgress = useAppStore((state: AppStore) => state.setExportProgress);

  // 저장 버튼 클릭 시: isExporting을 true로 설정
  const handleSaveImage = () => {
    setExportProgress(0);
    setIsExporting(true);
  };

  // isExporting이 true가 되면 실제 캡처 실행
  useEffect(() => {
    if (isExporting) {
      const captureArea = document.getElementById('capture-area') as HTMLElement;
      
      if (captureArea) {
        // A. 캡처 시작 전: body의 배경을 capture-area로 복사
        const backgroundValue = appState.background;
        let originalBackground = captureArea.style.background;
        let originalBackgroundImage = captureArea.style.backgroundImage;
        let originalBackgroundSize = captureArea.style.backgroundSize;
        let originalBackgroundPosition = captureArea.style.backgroundPosition;

        // 스크롤을 맨 위로 이동
        const originalScrollTop = captureArea.scrollTop;
        captureArea.scrollTop = 0;

        // 배경 타입에 따라 capture-area에 임시 적용
        if (backgroundValue.type === 'color' && backgroundValue.color) {
          captureArea.style.background = backgroundValue.color;
        } else if (backgroundValue.type === 'gradient' && backgroundValue.gradient) {
          const [color1, color2] = backgroundValue.gradient;
          captureArea.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
        } else if (backgroundValue.type === 'image' && backgroundValue.imageUrl) {
          captureArea.style.backgroundImage = `url(${backgroundValue.imageUrl})`;
          captureArea.style.backgroundSize = 'cover';
          captureArea.style.backgroundPosition = 'center';
        }

        // B. DOM 렌더링/자원 로드 대기 후 캡처 (폰트/이미지 로딩 보장)
        const waitForImages = (root: HTMLElement) => new Promise<void>((resolve) => {
          const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
          if (imgs.length === 0) return resolve();
          let loaded = 0;
          const check = () => { loaded += 1; if (loaded >= imgs.length) resolve(); };
          imgs.forEach((img) => {
            if (img.complete) check();
            else {
              img.addEventListener('load', check);
              img.addEventListener('error', check);
            }
          });
        });
        // start a fake progress updater to show activity until real completion
        let progress = 0;
        setExportProgress(0);
        const interval = setInterval(() => {
          progress = Math.min(95, progress + Math.floor(Math.random() * 8) + 2);
          setExportProgress(progress);
        }, 180);

        setTimeout(() => {
          Promise.all([
            (document as any).fonts ? (document as any).fonts.ready : Promise.resolve(),
            waitForImages(captureArea),
          ]).then(() => {
            html2canvas(captureArea, {
              backgroundColor: null,
              scale: 2,
              allowTaint: true,
              useCORS: true,
              logging: false,
              imageTimeout: 0,
            })
              .then((canvas) => {
                // finalize progress
                clearInterval(interval);
                setExportProgress(100);
                // small delay to allow UI show 100%
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.download = `쿠키런_조합표_${new Date().getTime()}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                }, 300);
              })
              .catch((error) => {
                clearInterval(interval);
                console.error('Failed to save image:', error);
                alert('이미지 저장에 실패했습니다.');
              })
              .finally(() => {
                // C. 캡처 완료 후: 배경 스타일 원복 및 편집 모드 복귀
                captureArea.style.background = originalBackground;
                captureArea.style.backgroundImage = originalBackgroundImage;
                captureArea.style.backgroundSize = originalBackgroundSize;
                captureArea.style.backgroundPosition = originalBackgroundPosition;
                captureArea.scrollTop = originalScrollTop;
                
                // reset exporting state after tiny delay so UI can show 100%
                setTimeout(() => {
                  setIsExporting(false);
                  setExportProgress(0);
                }, 500);
              });
          }).catch((e) => {
            clearInterval(interval);
            console.error('Resource wait error:', e);
            setIsExporting(false);
            setExportProgress(0);
          });
        }, 150);
      } else {
        setIsExporting(false);
      }
    }
  }, [isExporting, setIsExporting, appState.background]);

  const handleShare = () => {
    try {
      const stateToShare = {
        background: appState.background,
        seasonName: appState.seasonName,
        seasonDish: appState.seasonDish,
        seasonIngredients: appState.seasonIngredients,
        arenas: appState.arenas,
      };

      const jsonString = JSON.stringify(stateToShare);
      const compressed = compressToEncodedURIComponent(jsonString);
      const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;

      navigator.clipboard.writeText(url).then(() => {
        alert('공유 링크가 클립보드에 복사되었습니다!');
      }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('공유 링크가 클립보드에 복사되었습니다!');
      });
    } catch (error) {
      console.error('Failed to share:', error);
      alert('공유 링크 생성에 실패했습니다.');
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleSaveImage}
        disabled={isExporting}
        className="flex-1 macos-button px-6 py-3 text-gray-800 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        이미지로 저장
      </button>
      <button
        onClick={handleShare}
        disabled={isExporting}
        className="flex-1 macos-button px-6 py-3 text-gray-800 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        URL 공유
      </button>
    </div>
  );
}
