'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import BackgroundModal from './BackgroundModal';
import ImageSelectModal from './ImageSelectModal';

export default function Header() {
  const { seasonName, setSeasonName, seasonDish, seasonIngredients, isExporting } = useAppStore();
  const [showBgModal, setShowBgModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectingType, setSelectingType] = useState<'dish' | 'ingredient' | null>(null);
  const [selectingIndex, setSelectingIndex] = useState<number>(0);

  const openDishModal = () => {
    setSelectingType('dish');
    setShowImageModal(true);
  };

  const openIngredientModal = (index: number) => {
    setSelectingType('ingredient');
    setSelectingIndex(index);
    setShowImageModal(true);
  };

  // 글라스모피즘 스타일
  const glassStyle = isExporting 
    ? 'bg-transparent border-none backdrop-filter-none' 
    : 'bg-white/10 backdrop-blur-md border border-white/20 rounded-lg';

  return (
    <>
      <div className="relative mb-4">
        {/* Settings Button - Floating */}
        {!isExporting && (
          <button
            onClick={() => setShowBgModal(true)}
            className="absolute -top-2 -left-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-2 text-white hover:bg-white/20 transition-colors z-30 shadow-lg"
            title="배경 설정"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Header Layout */}
        <div className="flex gap-3">
          {/* Left: Season Name (60%) */}
          <div className={clsx(
            "w-[60%] p-4 flex items-center justify-center",
            glassStyle
          )}>
            <input
              type="text"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder="시즌명"
              className="w-full bg-transparent border-none text-white text-xl font-bold placeholder-white/50 focus:outline-none text-center"
            />
          </div>

          {/* Right: Season Dish + Ingredients (40%) */}
          <div className="w-[40%] flex flex-col gap-2">
            {/* Season Dish */}
            <div className={clsx(
              "p-3",
              glassStyle
            )}>
              {!isExporting && <p className="text-white text-xs font-semibold mb-2 text-center">시즌 요리</p>}
              <div
                onClick={openDishModal}
                className={clsx(
                  "w-full aspect-square rounded-lg cursor-pointer transition-all flex items-center justify-center overflow-hidden",
                  {
                    "bg-white/10 border border-white/20 hover:bg-white/20": !isExporting && !seasonDish,
                    "bg-transparent border-none": isExporting || seasonDish
                  }
                )}
              >
                {seasonDish ? (
                  <img src={seasonDish} alt="시즌 요리" className="w-full h-full object-contain" />
                ) : (
                  !isExporting && <span className="text-white/60 text-2xl">+</span>
                )}
              </div>
            </div>

            {/* Ingredients (3 columns) */}
            <div className={clsx(
              "grid grid-cols-3 gap-2 p-2",
              glassStyle
            )}>
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col items-center">
                  {!isExporting && <p className="text-white text-[10px] font-semibold mb-1">재료{index + 1}</p>}
                  <div
                    onClick={() => openIngredientModal(index)}
                    className={clsx(
                      "w-full aspect-square rounded-md cursor-pointer transition-all flex items-center justify-center overflow-hidden",
                      {
                        "bg-white/10 border border-white/20 hover:bg-white/20": !isExporting && !seasonIngredients[index],
                        "bg-transparent border-none": isExporting || seasonIngredients[index]
                      }
                    )}
                  >
                    {seasonIngredients[index] ? (
                      <img src={seasonIngredients[index]} alt={`재료${index+1}`} className="w-full h-full object-contain" />
                    ) : (
                      !isExporting && <span className="text-white/60 text-sm">+</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBgModal && <BackgroundModal onClose={() => setShowBgModal(false)} />}
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
