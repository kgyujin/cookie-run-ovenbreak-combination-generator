'use client';

import { compressToEncodedURIComponent } from 'lz-string';
import { useAppStore } from '@/store/useAppStore';

export default function ActionButtons() {
  const handleShare = () => {
    const state = useAppStore.getState();
    const compressed = compressToEncodedURIComponent(JSON.stringify({
      arenas: state.arenas,
      seasonName: state.seasonName,
      ingredients: state.ingredients,
      background: state.background,
      displaySettings: state.displaySettings,
      fontSettings: state.fontSettings,
    }));
    const params = new URLSearchParams({ data: compressed });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    navigator.clipboard.writeText(url).then(() => {
      alert('공유 링크가 복사되었습니다!');
    }).catch(() => {
      // fallback for browsers without clipboard permission
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('공유 링크가 복사되었습니다!');
      } catch (e) {
        alert('링크 복사에 실패했습니다. 수동으로 복사해 주세요.');
      }
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <button
        onClick={handleShare}
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all hover:scale-105"
      >
        🔗 공유
      </button>
    </div>
  );
}
