'use client';

import { useEffect, useState } from 'react';

export default function OrientationGuard() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // 화면의 가로가 세로보다 작으면 세로 모드
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    // 초기 체크
    checkOrientation();

    // 화면 회전 및 리사이즈 감지
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-8">
      <div className="text-center">
        {/* 회전 아이콘 */}
        <div className="mb-8 animate-bounce">
          <svg 
            className="w-24 h-24 text-white mx-auto" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </div>
        
        {/* 메시지 */}
        <h2 className="text-white text-2xl font-bold mb-4">
          화면을 가로로 회전해주세요
        </h2>
        <p className="text-white/80 text-lg">
          이 사이트는 가로 모드에 최적화되어 있습니다
        </p>
      </div>
    </div>
  );
}
