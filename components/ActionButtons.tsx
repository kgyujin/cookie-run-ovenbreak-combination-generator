'use client';

import { useEffect } from 'react';
import html2canvas from 'html2canvas';
import { compressToEncodedURIComponent } from 'lz-string';
import { useAppStore } from '@/store/useAppStore';

export default function ActionButtons() {
  const appState = useAppStore();
  const isExporting = useAppStore((state) => state.isExporting);
  const setIsExporting = useAppStore((state) => state.setIsExporting);

  // 저장 버튼 클릭 시: isExporting을 true로 설정
  const handleSaveImage = () => {
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

        // B. DOM 렌더링 대기 후 캡처 (isExporting=true 상태에서 모든 스타일이 숨겨짐)
        setTimeout(() => {
          html2canvas(captureArea, {
            backgroundColor: null,
            scale: 2,
            allowTaint: true,
            useCORS: true,
            logging: false,
          })
            .then((canvas) => {
              const link = document.createElement('a');
              link.download = `쿠키런_조합표_${new Date().getTime()}.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
            })
            .catch((error) => {
              console.error('Failed to save image:', error);
              alert('이미지 저장에 실패했습니다.');
            })
            .finally(() => {
              // C. 캡처 완료 후: 배경 스타일 원복 및 편집 모드 복귀
              captureArea.style.background = originalBackground;
              captureArea.style.backgroundImage = originalBackgroundImage;
              captureArea.style.backgroundSize = originalBackgroundSize;
              captureArea.style.backgroundPosition = originalBackgroundPosition;
              
              setIsExporting(false);
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
    <div className="flex gap-2">
      <button
        onClick={handleSaveImage}
        className="flex-1 glass rounded-lg px-4 py-2 text-white text-sm font-bold hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        이미지로 저장
      </button>
      <button
        onClick={handleShare}
        className="flex-1 glass rounded-lg px-4 py-2 text-white text-sm font-bold hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        URL 공유
      </button>
    </div>
  );
}
