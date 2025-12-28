'use client';

import { useState, useMemo } from 'react';
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
    <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white text-xl font-bold">{getCategoryTitle()} 선택</h2>
            <div className="flex items-center gap-2">
              {/* 선택 해제 버튼 */}
              <button
                onClick={() => onSelect('')}
                className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors"
              >
                선택 해제
              </button>
              {/* 닫기 버튼 */}
              <button
                onClick={onClose}
                className="text-white hover:text-white/70 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Rarity Filter */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {(['all', 'legendary', 'epic', 'rare', 'common'] as const).map((rarity) => {
              const labels = {
                all: '전체',
                legendary: '레전더리',
                epic: '에픽',
                rare: '레어',
                common: '커먼'
              };
              
              const colors = {
                all: 'bg-white/20 hover:bg-white/30',
                legendary: 'bg-orange-500/60 hover:bg-orange-500/70',
                epic: 'bg-purple-500/60 hover:bg-purple-500/70',
                rare: 'bg-blue-500/60 hover:bg-blue-500/70',
                common: 'bg-gray-500/60 hover:bg-gray-500/70'
              };

              return (
                <button
                  key={rarity}
                  onClick={() => setRarityFilter(rarity)}
                  className={`px-4 py-1.5 rounded-lg text-white text-sm font-bold transition-all whitespace-nowrap ${
                    rarityFilter === rarity 
                      ? `${colors[rarity]} ring-2 ring-white/50 scale-105` 
                      : colors[rarity]
                  }`}
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
            className="w-full bg-white/30 border border-white/40 rounded-lg px-4 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>

        {/* Items Grid */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
          <div className="grid grid-cols-4 gap-3">
            {filteredItems.map((item: any) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="glass-dark rounded-lg p-2 cursor-pointer hover:bg-white/30 transition-colors"
              >
                <div className="w-full aspect-square bg-white/20 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-white text-xs text-center truncate">{item.name}</p>
                {item.description && (
                  <p className="text-white/60 text-[10px] text-center mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center text-white/60 py-8">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
