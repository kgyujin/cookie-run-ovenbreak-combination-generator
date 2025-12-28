'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import Header from '@/components/Header';
import ComboBlock from '@/components/ComboBlock';
import ActionButtons from '@/components/ActionButtons';
import ImageSelectModal from '@/components/ImageSelectModal';
import { decompressFromEncodedURIComponent } from 'lz-string';

function PageContent() {
  const { 
    background, 
    isExporting, 
    arenas, 
    modalOpen,
    modalArenaIndex,
    modalType,
    setGameData, 
    loadStateFromUrl,
    setModalOpen,
    setArenaMainCombo,
    setArenaMagicCandy,
    setArenaDish,
    setArenaSubCombo
  } = useAppStore();
  const searchParams = useSearchParams();

  // Load game data from generated JSON
  useEffect(() => {
    fetch('/data/gameData.json')
      .then((res) => res.json())
      .then((data) => setGameData(data))
      .catch((err) => console.error('Failed to load game data:', err));
  }, [setGameData]);

  // Load state from URL
  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const decompressed = decompressFromEncodedURIComponent(dataParam);
        if (decompressed) {
          const state = JSON.parse(decompressed);
          loadStateFromUrl(state);
        }
      } catch (err) {
        console.error('Failed to load state from URL:', err);
      }
    }
  }, [searchParams, loadStateFromUrl]);

  // Apply background to body
  useEffect(() => {
    const body = document.body;
    if (background.type === 'color' && background.color) {
      body.style.background = background.color;
    } else if (background.type === 'gradient' && background.gradient) {
      body.style.background = `linear-gradient(135deg, ${background.gradient[0]}, ${background.gradient[1]})`;
    } else if (background.type === 'image' && background.imageUrl) {
      body.style.background = `url(${background.imageUrl}) center/cover fixed`;
    }
  }, [background]);

  return (
    <>
      {/* 가로 모바일 프레임 - 글라스모피즘 적용 */}
      <main 
        id="capture-area" 
        className={`
          w-full max-w-7xl h-[90vh] 
          overflow-y-auto overflow-x-hidden
          rounded-2xl
          p-6
          ${!isExporting ? 'bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl' : ''}
        `}
        style={{
          background: isExporting ? 'transparent' : undefined,
          border: isExporting ? 'none' : undefined,
          backdropFilter: isExporting ? 'none' : undefined,
        }}
      >
        {/* Header */}
        <Header />

        {/* 12개 Arena Blocks - 2열 그리드 */}
        <div className="grid grid-cols-2 gap-6">
          {arenas.map((_, index) => (
            <ComboBlock key={index} arenaIndex={index} />
          ))}
        </div>

        {/* Action Buttons - 하단 배치 */}
        {!isExporting && (
          <div className="mt-8 mb-4">
            <ActionButtons />
          </div>
        )}
      </main>

      {/* Image Select Modal */}
      {modalOpen && modalArenaIndex !== null && modalType && (
        <ImageSelectModal
          category={getModalCategory(modalType)}
          onClose={() => setModalOpen(false)}
          onSelect={(imageId) => {
            handleModalSelect(modalArenaIndex, modalType, imageId);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );

  function getModalCategory(type: string): 'cookies' | 'pets' | 'treasures' | 'dishes' | 'ingredients' | 'magicCandies' | 'blessings' {
    if (type.includes('Cookie')) return 'cookies';
    if (type.includes('Pet') || type === 'mainPet' || type === 'subPet') return 'pets';
    if (type.includes('Treasure')) return 'treasures';
    if (type === 'dish') return 'dishes';
    if (type.includes('candy')) return 'magicCandies';
    if (type.includes('blessing')) return 'blessings';
    return 'cookies';
  }

  function handleModalSelect(arenaIdx: number, type: string, imageId: string) {
    // Main Combo
    if (type === 'mainPet') setArenaMainCombo(arenaIdx, 'pet', imageId);
    else if (type === 'mainCookie1') setArenaMainCombo(arenaIdx, 'cookie1', imageId);
    else if (type === 'mainCookie2') setArenaMainCombo(arenaIdx, 'cookie2', imageId);
    else if (type.startsWith('mainTreasure')) {
      const idx = parseInt(type.replace('mainTreasure', ''));
      setArenaMainCombo(arenaIdx, `treasure${idx}`, imageId);
    }
    // Magic Candy
    else if (type === 'candy1') setArenaMagicCandy(arenaIdx, 'cookie1Candy', imageId);
    else if (type === 'candy2') setArenaMagicCandy(arenaIdx, 'cookie2Candy', imageId);
    else if (type === 'blessing1') setArenaMagicCandy(arenaIdx, 'cookie1Blessing', imageId);
    else if (type === 'blessing2') setArenaMagicCandy(arenaIdx, 'cookie2Blessing', imageId);
    // Dish
    else if (type === 'dish') setArenaDish(arenaIdx, imageId);
    // Sub Combo
    else if (type === 'subPet') setArenaSubCombo(arenaIdx, 'pet', imageId);
    else if (type === 'subCookie1') setArenaSubCombo(arenaIdx, 'cookie1', imageId);
    else if (type === 'subCookie2') setArenaSubCombo(arenaIdx, 'cookie2', imageId);
    else if (type.startsWith('subTreasure')) {
      const idx = parseInt(type.replace('subTreasure', ''));
      setArenaSubCombo(arenaIdx, `treasure${idx}`, imageId);
    }
  }
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="w-full max-w-md h-screen flex items-center justify-center bg-transparent">
        <div className="text-white text-lg">Loading...</div>
      </main>
    }>
      <PageContent />
    </Suspense>
  );
}
