'use client';

import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import Image from 'next/image';
import { formatScore } from '@/utils/scoreFormatter';

export default function ComboBlock({ arenaIndex }: { arenaIndex: number }) {
  const arena = useAppStore((state) => state.arenas[arenaIndex]);
  const isExporting = useAppStore((state) => state.isExporting);
  const gameData = useAppStore((state) => state.gameData);
  const displaySettings = useAppStore((state) => state.displaySettings);
  const fontSettings = useAppStore((state) => state.fontSettings);
  const setModalOpen = useAppStore((state) => state.setModalOpen);
  const setArenaMainCombo = useAppStore((state) => state.setArenaMainCombo);
  const setArenaMagicCandy = useAppStore((state) => state.setArenaMagicCandy);
  const setArenaScore = useAppStore((state) => state.setArenaScore);
  const setArenaDish = useAppStore((state) => state.setArenaDish);
  const setArenaSubCombo = useAppStore((state) => state.setArenaSubCombo);
  const setArenaSubScore = useAppStore((state) => state.setArenaSubScore);
  const setArenaYoutubeUrl = useAppStore((state) => state.setArenaYoutubeUrl);
  const setMainCookieRatio = useAppStore((state) => state.setMainCookieRatio);
  const setSubCookieRatio = useAppStore((state) => state.setSubCookieRatio);

  const handleImageClick = (type: string) => {
    if (isExporting) return; // 저장 중에는 이미지 변경 불가
    setModalOpen(true, arenaIndex, type);
  };

  // 통일된 그림자 스타일 (모든 요소에 동일한 깊이감)
  const unifiedShadow = isExporting
    ? ''
    : 'shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.08)]';
  
  const macosBase = isExporting 
    ? 'bg-transparent' 
    : 'bg-white/95 backdrop-blur-lg rounded-lg';
  
  const badgeStyle = isExporting
    ? ''
    : 'badge';

  // 메인 조합 쿠키 크기 계산 (총 56% 공간을 비율에 따라 분배)
  const mainCookie1Width = (arena.mainCookieRatio / 100) * 56;
  const mainCookie2Width = ((100 - arena.mainCookieRatio) / 100) * 56;
  const mainCookie2Left = 2 + mainCookie1Width + 2; // 선달쿠키 left(2%) + width + 간격(2%)

  // 대체 조합 쿠키 크기 계산 (총 96% 공간을 비율에 따라 분배, gap 2% 제외)
  const subCookie1Width = (arena.subCookieRatio / 100) * 96;
  const subCookie2Width = ((100 - arena.subCookieRatio) / 100) * 96;

  // 축복 description 가져오기
  const getBlessing1Desc = () => {
    if (!gameData || !arena.magicCandy.cookie1Blessing) return '';
    const blessing = gameData.blessings?.find((b: any) => b.image === arena.magicCandy.cookie1Blessing);
    return blessing?.description || '';
  };

  const getBlessing2Desc = () => {
    if (!gameData || !arena.magicCandy.cookie2Blessing) return '';
    const blessing = gameData.blessings?.find((b: any) => b.image === arena.magicCandy.cookie2Blessing);
    return blessing?.description || '';
  };

  return (
    <div 
      className="relative w-full"
      style={{ height: '425px' }}
    >
      {/* ===== BASE LAYER (z-10) ===== */}
      
      {/* A. 선달 쿠키 - Base Layer */}
      <div 
        onClick={() => handleImageClick('mainCookie1')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden',
          arena.mainCombo.cookie1 && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 10, 
          width: `${mainCookie1Width}%`, 
          height: '44.3%', 
          top: '22%', 
          left: '2%' 
        }}
      >
        {arena.mainCombo.cookie1 ? (
          <Image src={arena.mainCombo.cookie1} alt="선달 쿠키" fill className="object-contain object-bottom" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-lg font-bold">선달 쿠키</span>
        )}
      </div>

      {/* 메인 조합 크기 조절 슬라이더 - 선달/이달 쿠키 사이 */}
      {!isExporting && (
        <div 
          className="absolute cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ 
            zIndex: 25, 
            width: '2%', 
            height: '44.3%', 
            top: '22%', 
            left: `${2 + mainCookie1Width}%`,
            background: 'rgba(0, 0, 0, 0.08)',
            borderLeft: '2px solid rgba(0, 0, 0, 0.15)',
            borderRight: '2px solid rgba(0, 0, 0, 0.15)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startRatio = arena.mainCookieRatio;
            const container = e.currentTarget.parentElement;
            
            if (!container) return;
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const containerWidth = container.offsetWidth;
              const deltaRatio = (deltaX / containerWidth) * 100 * (100 / 56); // 56%가 전체 공간
              let newRatio = startRatio + deltaRatio;
              newRatio = Math.max(30, Math.min(70, newRatio)); // 30-70% 범위 제한
              setMainCookieRatio(arenaIndex, newRatio);
            };
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div className="text-gray-600 text-xs opacity-70">⋮</div>
        </div>
      )}

      {/* B. 이달 쿠키 - Base Layer */}
      <div 
        onClick={() => handleImageClick('mainCookie2')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden',
          arena.mainCombo.cookie2 && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 10, 
          width: `${mainCookie2Width}%`, 
          height: '44.3%', 
          top: '22%', 
          left: `${mainCookie2Left}%` 
        }}
      >
        {arena.mainCombo.cookie2 ? (
          <Image src={arena.mainCombo.cookie2} alt="이달 쿠키" fill className="object-contain object-bottom" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-base font-bold">이달 쿠키</span>
        )}
      </div>

      {/* ===== MID LAYER (z-20) ===== */}
      
      {/* D. 펫 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('mainPet')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.mainCombo.pet && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '75px',
          height: '75px',
          aspectRatio: '1/1',
          top: '8%', 
          left: '4%' 
        }}
      >
        {arena.mainCombo.pet ? (
          <Image src={arena.mainCombo.pet} alt="펫" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs font-semibold">펫</span>
        )}
      </div>

      {/* E. 보물 1 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('mainTreasure0')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.mainCombo.treasures[0] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '50px',
          height: '50px',
          aspectRatio: '1/1',
          bottom: '80px', 
          left: '2%'
        }}
      >
        {arena.mainCombo.treasures[0] ? (
          <Image src={arena.mainCombo.treasures[0]} alt="보물1" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물1</span>
        )}
      </div>

      {/* 보물 2 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('mainTreasure1')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.mainCombo.treasures[1] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '50px',
          height: '50px',
          aspectRatio: '1/1',
          bottom: '80px', 
          left: 'calc(2% + 60px)'
        }}
      >
        {arena.mainCombo.treasures[1] ? (
          <Image src={arena.mainCombo.treasures[1]} alt="보물2" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물2</span>
        )}
      </div>

      {/* 보물 3 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('mainTreasure2')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.mainCombo.treasures[2] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '50px',
          height: '50px',
          aspectRatio: '1/1',
          bottom: '80px', 
          left: 'calc(2% + 120px)'
        }}
      >
        {arena.mainCombo.treasures[2] ? (
          <Image src={arena.mainCombo.treasures[2]} alt="보물3" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물3</span>
        )}
      </div>

      {/* F. 최고점 - Mid Layer */}
      <input
        type="text"
        value={isExporting && arena.score.value ? formatScore(arena.score.value, displaySettings.scoreDisplayType) : arena.score.value}
        onChange={(e) => setArenaScore(arenaIndex, 'value', e.target.value)}
        disabled={isExporting}
        placeholder={isExporting ? '' : '최고점 (숫자만 입력)'}
        className={clsx(
          'absolute px-2 py-1 text-xs text-center focus:outline-none placeholder-gray-400 disabled:cursor-not-allowed transition-all text-gray-800',
          `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '35%', 
          height: '10%', 
          top: '9%', 
          right: '3%'
        }}
      />

      {/* G. 선달 마법사탕 + 축복 (겹침) - Mid Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer overflow-hidden flex items-center justify-center',
          arena.magicCandy.cookie1Candy && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '72px',
          height: '72px',
          aspectRatio: '1/1',
          top: '9%', 
          left: '38%',
          position: 'absolute'
        }}
        onClick={() => handleImageClick('candy1')}
      >
        {arena.magicCandy.cookie1Candy ? (
          <Image src={arena.magicCandy.cookie1Candy} alt="선달 마법사탕" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-[10px] text-center leading-tight">선달<br/>사탕</span>
        )}
        
        {/* 선달 축복 - Child (우측 하단 1/4 영역) */}
        <div 
          onClick={(e) => { e.stopPropagation(); handleImageClick('blessing1'); }}
          className={clsx(
            'absolute cursor-pointer overflow-hidden hover:scale-105 transition-all',
            arena.magicCandy.cookie1Blessing && !isExporting ? 'bg-transparent' : !isExporting && badgeStyle
          )}
          style={{ 
            zIndex: 30, 
            bottom: -2, 
            right: -2, 
            width: '50%', 
            height: '50%' 
          }}
          title={getBlessing1Desc()}
        >
          {arena.magicCandy.cookie1Blessing ? (
            <Image src={arena.magicCandy.cookie1Blessing} alt="선달 축복" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-[8px]">축복</span>
          )}
        </div>
      </div>

      {/* H. 이달 마법사탕 + 축복 (겹침) - Mid Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer overflow-hidden flex items-center justify-center',
          arena.magicCandy.cookie2Candy && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '72px',
          height: '72px',
          aspectRatio: '1/1',
          top: '9%', 
          left: '49%',
          position: 'absolute'
        }}
        onClick={() => handleImageClick('candy2')}
      >
        {arena.magicCandy.cookie2Candy ? (
          <Image src={arena.magicCandy.cookie2Candy} alt="이달 마법사탕" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-[10px] text-center leading-tight">이달<br/>사탕</span>
        )}
        
        {/* 이달 축복 - Child (우측 하단 1/4 영역) */}
        <div 
          onClick={(e) => { e.stopPropagation(); handleImageClick('blessing2'); }}
          className={clsx(
            'absolute cursor-pointer overflow-hidden hover:scale-105 transition-all',
            arena.magicCandy.cookie2Blessing && !isExporting ? 'bg-transparent' : !isExporting && badgeStyle
          )}
          style={{ 
            zIndex: 30, 
            bottom: -2, 
            right: -2, 
            width: '50%', 
            height: '50%' 
          }}
          title={getBlessing2Desc()}
        >
          {arena.magicCandy.cookie2Blessing ? (
            <Image src={arena.magicCandy.cookie2Blessing} alt="이달 축복" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-[8px]">축복</span>
          )}
        </div>
      </div>

      {/* I. 대체 조합 Contents - Mid Layer (대체 조합 Base 위에 겹침, width 35%) */}
      <div 
        className="absolute"
        style={{ 
          zIndex: 20, 
          top: '22%', 
          right: '3%', 
          width: '35%',
          height: '56%'
        }}
      >
        {/* 대체 펫 - 좌상단 */}
        <div 
          onClick={() => handleImageClick('subPet')}
          className={clsx(
            'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
            arena.subCombo.pet && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
          )}
          style={{ 
            top: '2%',
            left: '2%',
            width: '40px',
            height: '40px',
            aspectRatio: '1/1'
          }}
        >
          {arena.subCombo.pet ? (
            <Image src={arena.subCombo.pet} alt="대체 펫" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            !isExporting && <span className="text-gray-500 text-xs">대체 펫</span>
          )}
        </div>

        {/* 대체 최고점 - 대체 펫 옆 */}
        <input
          type="text"
          value={isExporting && arena.subScore.value ? formatScore(arena.subScore.value, displaySettings.scoreDisplayType) : arena.subScore.value}
          onChange={(e) => setArenaSubScore(arenaIndex, 'value', e.target.value)}
          disabled={isExporting}
          placeholder={isExporting ? '' : '대체 최고점 (숫자만 입력)'}
          className={clsx(
            'absolute px-2 py-1 text-xs text-center focus:outline-none placeholder-gray-400 disabled:cursor-not-allowed transition-all text-gray-800',
            `${macosBase} ${unifiedShadow}`
          )}
          style={{ 
            top: '2%',
            left: 'calc(2% + 50px)',
            right: '2%',
            height: '40px'
          }}
        />

        {/* 대체 쿠키 1, 2 - 나란히 배치 (동적 비율) */}
        <div className="absolute flex" style={{ top: '25%', left: '2%', right: '2%', height: '54%' }}>
          {/* 대체 선달 쿠키 (동적) */}
          <div 
            onClick={() => handleImageClick('subCookie1')}
            className={clsx(
              'relative cursor-pointer hover:opacity-90 transition-all overflow-hidden',
              arena.subCombo.cookie1 && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
            )}
            style={{ width: `${subCookie1Width}%` }}
          >
            {arena.subCombo.cookie1 ? (
              <Image src={arena.subCombo.cookie1} alt="대체선달쿠키" fill className="object-contain object-bottom" crossOrigin="anonymous" />
            ) : (
              !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-[10px]">대체<br/>선달<br/>쿠키</span>
            )}
          </div>
          
          {/* 대체 조합 크기 조절 슬라이더 */}
          {!isExporting && (
            <div 
              className="cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ 
                width: '2%',
                background: 'rgba(0, 0, 0, 0.08)',
                borderLeft: '2px solid rgba(0, 0, 0, 0.15)',
                borderRight: '2px solid rgba(0, 0, 0, 0.15)',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startRatio = arena.subCookieRatio;
                const container = e.currentTarget.parentElement;
                
                if (!container) return;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const containerWidth = container.offsetWidth;
                  const deltaRatio = (deltaX / containerWidth) * 100 * (100 / 96); // 96%가 전체 공간
                  let newRatio = startRatio + deltaRatio;
                  newRatio = Math.max(30, Math.min(70, newRatio)); // 30-70% 범위 제한
                  setSubCookieRatio(arenaIndex, newRatio);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="text-gray-600 text-xs opacity-70">⋮</div>
            </div>
          )}
          
          {/* 대체 이달 쿠키 (동적) */}
          <div 
            onClick={() => handleImageClick('subCookie2')}
            className={clsx(
              'relative cursor-pointer hover:opacity-90 transition-all overflow-hidden',
              arena.subCombo.cookie2 && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
            )}
            style={{ width: `${subCookie2Width}%` }}
          >
            {arena.subCombo.cookie2 ? (
              <Image src={arena.subCombo.cookie2} alt="대체이달쿠키" fill className="object-contain object-bottom" crossOrigin="anonymous" />
            ) : (
              !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-[10px]">대체<br/>이달<br/>쿠키</span>
            )}
          </div>
        </div>
      </div>

      {/* J. 대체 보물 1 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('subTreasure0')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.subCombo.treasures[0] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '40px',
          height: '40px',
          aspectRatio: '1/1',
          bottom: '80px', 
          right: 'calc(3% + 100px)'
        }}
      >
        {arena.subCombo.treasures[0] ? (
          <Image src={arena.subCombo.treasures[0]} alt="대체보물1" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물1</span>
        )}
      </div>

      {/* 대체 보물 2 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('subTreasure1')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.subCombo.treasures[1] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '40px',
          height: '40px',
          aspectRatio: '1/1',
          bottom: '80px', 
          right: 'calc(3% + 50px)'
        }}
      >
        {arena.subCombo.treasures[1] ? (
          <Image src={arena.subCombo.treasures[1]} alt="대체보물2" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물2</span>
        )}
      </div>

      {/* 대체 보물 3 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('subTreasure2')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-all overflow-hidden flex items-center justify-center',
          arena.subCombo.treasures[2] && !isExporting ? 'bg-transparent' : `${macosBase} ${unifiedShadow}`
        )}
        style={{ 
          zIndex: 20, 
          width: '40px',
          height: '40px',
          aspectRatio: '1/1',
          bottom: '80px', 
          right: '3%'
        }}
      >
        {arena.subCombo.treasures[2] ? (
          <Image src={arena.subCombo.treasures[2]} alt="대체보물3" fill className="object-contain" crossOrigin="anonymous" />
        ) : (
          !isExporting && <span className="text-gray-500 text-xs">보물3</span>
        )}
      </div>

      {/* ===== TOP LAYER (z-30) ===== */}
      
      {/* K. 아레나 숫자 (유튜브 링크) - Top Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer hover:scale-105 transition-all flex items-center justify-center group',
          badgeStyle
        )}
        style={{ 
          zIndex: 30, 
          width: '48px', 
          height: '48px', 
          top: '12px', 
          left: '12px' 
        }}
        onClick={() => {
          if (isExporting) return;
          const url = prompt('유튜브 링크를 입력하세요:', arena.youtubeUrl || '');
          if (url !== null) setArenaYoutubeUrl(arenaIndex, url || null);
        }}
      >
        <span 
          className={clsx(
            'font-bold text-lg',
            arena.youtubeUrl && 'text-red-500'
          )}
          style={{
            color: arena.youtubeUrl ? '#ef4444' : fontSettings.fontColor,
            textShadow: '0 0 3px white, 0 0 5px white, 0 0 8px white, 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white'
          }}
        >
          {arena.youtubeUrl && '▶ '}{arenaIndex + 1}
        </span>
        {!isExporting && (
          <div className="opacity-0 group-hover:opacity-100 absolute top-full left-1/2 -translate-x-1/2 mt-2 text-white text-xs whitespace-nowrap bg-gray-800 px-3 py-1 rounded-lg z-50 shadow-lg">
            유튜브 링크 {arena.youtubeUrl ? '수정' : '추가'}
          </div>
        )}
      </div>

      {/* L. 요리 - Top Layer */}
      <div 
        onClick={() => handleImageClick('dish')}
        className={clsx(
          'absolute cursor-pointer hover:scale-105 transition-all overflow-hidden flex items-center justify-center',
          arena.dish && !isExporting ? 'bg-transparent' : !isExporting && badgeStyle
        )}
        style={{ 
          zIndex: 30, 
          width: '60px', 
          height: '60px', 
          top: '12px', 
          right: '12px' 
        }}
      >
        {arena.dish ? (
          <Image src={arena.dish} alt="요리" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">요리</span>
        )}
      </div>

    </div>
  );
}

