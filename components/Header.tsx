'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import SettingsModal from './SettingsModal';
import ImageSelectModal from './ImageSelectModal';

export default function Header() {
  const { seasonName, setSeasonName, seasonDish, seasonIngredients, isExporting, fontSettings } = useAppStore();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectingType, setSelectingType] = useState<'dish' | 'ingredient' | null>(null);
  const [selectingIndex, setSelectingIndex] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [seasonName, fontSettings.fontSize]);

  const openDishModal = () => {
    if (isExporting) return; // 저장 중에는 이미지 변경 불가
    setSelectingType('dish');
    setShowImageModal(true);
  };

  const openIngredientModal = (index: number) => {
    if (isExporting) return; // 저장 중에는 이미지 변경 불가
    setSelectingType('ingredient');
    setSelectingIndex(index);
    setShowImageModal(true);
  };

  // macOS 스타일
  const macosStyle = isExporting 
    ? 'bg-transparent border-none backdrop-filter-none shadow-none' 
    : 'macos-card-elevated';

  return (
    <>
      <div className="relative mb-4" style={{ height: '400px' }}>
        {/* Settings Button - Floating */}
        {!isExporting && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="absolute -top-1 -left-1 macos-button p-1.5 text-gray-700 hover:text-gray-900 z-30"
            title="설정"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Header Layout - 고정 높이로 제한 */}
        <div className="flex gap-1.5 h-full">
          {/* Left: Season Name (80%) */}
          <div className={clsx(
            "w-[80%] h-full px-2 flex items-center justify-center",
            seasonName && !isExporting ? 'bg-transparent border-none backdrop-filter-none shadow-none' : macosStyle
          )}>
            <textarea
              ref={textareaRef}
              value={seasonName}
              onChange={(e) => {
                const newValue = e.target.value;
                const lines = newValue.split('\n');
                
                // 줄바꿈은 최대 2번(총 3줄)까지만 허용
                if (lines.length <= 3) {
                  setSeasonName(newValue);
                }
              }}
              onKeyDown={(e) => {
                const lines = seasonName.split('\n');
                if (e.key === 'Enter' && lines.length >= 3) {
                  e.preventDefault();
                }
              }}
              disabled={isExporting}
              placeholder="시즌명"
              className="w-full bg-transparent border-none text-gray-800 font-bold placeholder-gray-400 focus:outline-none resize-none scrollbar-hide disabled:cursor-not-allowed"
              style={{
                fontSize: `${fontSettings.fontSize}px`,
                fontFamily: fontSettings.fontFamily === 'CookieRun' ? 'CookieRun' : fontSettings.fontFamily === 'Custom' ? 'CustomFont' : 'Pretendard',
                textAlign: fontSettings.textAlign as any,
                color: fontSettings.fontColor || '#1f2937',
                padding: '0',
                lineHeight: '1.2',
                maxHeight: `calc(${fontSettings.fontSize}px * 1.2 * 3)`,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>

          {/* Right: Season Dish + Ingredients (20%) */}
          <div className="w-[20%] h-full flex flex-col gap-1">
            {/* Season Dish */}
            <div className={clsx(
              "p-0.5 h-[55%]",
              seasonDish && !isExporting ? 'bg-transparent border-none backdrop-filter-none shadow-none' : macosStyle
            )}>
              <div
                onClick={openDishModal}
                className={clsx(
                  "w-full h-full rounded-lg cursor-pointer transition-all flex items-center justify-center overflow-hidden relative",
                  {
                    "bg-gray-100 hover:bg-gray-200": !isExporting && !seasonDish,
                    "bg-transparent": isExporting || seasonDish
                  }
                )}
              >
                {seasonDish ? (
                  <img crossOrigin="anonymous" src={seasonDish} alt="시즌 요리" className="w-full h-full object-contain" />
                ) : (
                  !isExporting && <span className="text-gray-500 text-sm font-semibold absolute inset-0 flex items-center justify-center">시즌 요리</span>
                )}
              </div>
            </div>

            {/* Ingredients (3 columns) */}
            <div className={clsx(
              "grid grid-cols-3 gap-0.5 p-0.5 h-[40%]",
              seasonIngredients.some(ing => ing) && !isExporting ? 'bg-transparent border-none backdrop-filter-none shadow-none' : macosStyle
            )}>
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col items-center h-full">
                  <div
                    onClick={() => openIngredientModal(index)}
                    className={clsx(
                      "w-full h-full rounded-md cursor-pointer transition-all flex items-center justify-center overflow-hidden relative",
                      {
                        "bg-gray-100 hover:bg-gray-200": !isExporting && !seasonIngredients[index],
                        "bg-transparent": isExporting || seasonIngredients[index]
                      }
                    )}
                  >
                    {seasonIngredients[index] ? (
                      <img crossOrigin="anonymous" src={seasonIngredients[index]} alt={`재료${index+1}`} className="max-w-full max-h-full object-contain" />
                    ) : (
                      !isExporting && <span className="text-gray-500 text-xs font-semibold absolute inset-0 flex items-center justify-center">재료 {index + 1}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showImageModal && (
        <ImageSelectModal
          category={selectingType === 'dish' ? 'dishes' : 'ingredients'}
          onClose={() => setShowImageModal(false)}
          onSelect={(id) => {
            if (selectingType === 'dish') {
              useAppStore.getState().setSeasonDish(id);
            } else if (selectingType === 'ingredient') {
              useAppStore.getState().setSeasonIngredient(selectingIndex as 0 | 1 | 2, id);
            }
            setShowImageModal(false);
          }}
        />
      )}
    </>
  );
}
