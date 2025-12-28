'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface ImageSelectModalProps {
  category: 'cookies' | 'pets' | 'treasures' | 'dishes' | 'ingredients' | 'magicCandies' | 'blessings';
  onClose: () => void;
  onSelect: (id: string) => void;
}

type RarityFilter = 'all' | 'legendary' | 'epic' | 'rare' | 'common';

export default function ImageSelectModal({ category, onClose, onSelect }: ImageSelectModalProps) {
  const gameData = useAppStore((state) => state.gameData);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');

  // 모달 오픈 시 body 스크롤 방지
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const items = useMemo(() => {
    if (!gameData) return [];
    return gameData[category] || [];
  }, [gameData, category]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // 등급 필터 적용
    if (rarityFilter !== 'all') {
      filtered = filtered.filter((item: any) => item.rarity === rarityFilter);
    }
    
    // 검색 필터 적용
    if (searchQuery) {
      filtered = filtered.filter((item: any) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [items, searchQuery, rarityFilter]);

  const handleSelect = (item: any) => {
    onSelect(item.image);
  };

  const getCategoryTitle = () => {
    const titles: Record<string, string> = {
      cookies: '쿠키',
      pets: '펫',
      treasures: '보물',
      dishes: '요리',
      ingredients: '재료',
      magicCandies: '마법사탕',
      blessings: '축복',
    };
    return titles[category] || '선택';
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={(e) => e.stopPropagation()} className="macos-card-high w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col modal-content">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 bg-white/95 backdrop-blur-xl shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-800 text-xl font-bold">{getCategoryTitle()} 선택</h2>
            <div className="flex items-center gap-2">
              {/* 선택 해제 버튼 */}
              <button
                onClick={() => onSelect('')}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
              >
                선택 해제
              </button>
              {/* 닫기 버튼 */}
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Rarity Filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {(['all', 'legendary', 'epic', 'rare', 'common'] as const).map((rarity) => {
              const labels = {
                all: '전체',
                legendary: '레전더리',
                epic: '에픽',
                rare: '레어',
                common: '커먼'
              };
              
              const colors = {
                all: rarityFilter === rarity ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                legendary: rarityFilter === rarity ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                epic: rarityFilter === rarity ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                rare: rarityFilter === rarity ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                common: rarityFilter === rarity ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              };

              return (
                <button
                  key={rarity}
                  onClick={() => setRarityFilter(rarity)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${colors[rarity]} shadow-sm`}
                >
                  {labels[rarity]}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름으로 검색..."
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredItems.map((item: any) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="bg-white hover:bg-gray-50 rounded-xl p-3 cursor-pointer transition-all shadow-sm hover:shadow-lg border border-gray-100"
              >
                <div className="w-full aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-gray-800 text-xs text-center truncate font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-gray-500 text-[10px] text-center mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
