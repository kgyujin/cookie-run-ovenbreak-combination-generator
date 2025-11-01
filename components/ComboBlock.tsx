'use client';

import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import Image from 'next/image';

export default function ComboBlock({ arenaIndex }: { arenaIndex: number }) {
  const arena = useAppStore((state) => state.arenas[arenaIndex]);
  const isExporting = useAppStore((state) => state.isExporting);
  const gameData = useAppStore((state) => state.gameData);
  const setModalOpen = useAppStore((state) => state.setModalOpen);
  const setArenaMainCombo = useAppStore((state) => state.setArenaMainCombo);
  const setArenaMagicCandy = useAppStore((state) => state.setArenaMagicCandy);
  const setArenaScore = useAppStore((state) => state.setArenaScore);
  const setArenaDish = useAppStore((state) => state.setArenaDish);
  const setArenaSubCombo = useAppStore((state) => state.setArenaSubCombo);
  const setArenaSubScore = useAppStore((state) => state.setArenaSubScore);
  const setArenaYoutubeUrl = useAppStore((state) => state.setArenaYoutubeUrl);

  const handleImageClick = (type: string) => {
    setModalOpen(true, arenaIndex, type);
  };

  // 글라스모피즘 스타일 - isExporting에 따라 변경
  const glassStyle = isExporting 
    ? 'bg-transparent border-none backdrop-filter-none' 
    : 'bg-white/10 backdrop-blur-md border border-white/20 rounded-lg';

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
      style={{ height: '700px' }}
    >
      {/* ===== BASE LAYER (z-10) ===== */}
      
      {/* A. 선달 쿠키 - Base Layer */}
      <div 
        onClick={() => handleImageClick('mainCookie1')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 10, 
          width: '40%', 
          height: '60%', 
          top: '20%', 
          left: '2%' 
        }}
      >
        {arena.mainCombo.cookie1 ? (
          <Image src={arena.mainCombo.cookie1} alt="선달 쿠키" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-lg font-bold">선달 쿠키</span>
        )}
      </div>

      {/* B. 이달 쿠키 - Base Layer */}
      <div 
        onClick={() => handleImageClick('mainCookie2')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 10, 
          width: '20%', 
          height: '60%', 
          top: '20%', 
          left: '44%' 
        }}
      >
        {arena.mainCombo.cookie2 ? (
          <Image src={arena.mainCombo.cookie2} alt="이달 쿠키" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-base font-bold">이달 쿠키</span>
        )}
      </div>

      {/* C. 대체 조합 Base - Base Layer */}
      <div 
        className={clsx(
          'absolute',
          glassStyle
        )}
        style={{ 
          zIndex: 10, 
          width: '32%', 
          height: '60%', 
          top: '20%', 
          right: '2%' 
        }}
      >
        {!isExporting && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
            대체 조합
          </div>
        )}
      </div>

      {/* ===== MID LAYER (z-20) ===== */}
      
      {/* D. 펫 - Mid Layer */}
      <div 
        onClick={() => handleImageClick('mainPet')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          width: '15%', 
          height: '12%', 
          top: '8%', 
          left: '4%' 
        }}
      >
        {arena.mainCombo.pet ? (
          <Image src={arena.mainCombo.pet} alt="펫" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs font-semibold">펫</span>
        )}
      </div>

      {/* E. 보물 1/2/3 Container - Mid Layer */}
      <div 
        className={clsx(
          'absolute grid grid-cols-3 gap-2 p-2',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          width: '40%', 
          bottom: '5%', 
          left: '2%',
          overflow: 'visible'
        }}
      >
        {[0, 1, 2].map((idx) => (
          <div 
            key={idx}
            onClick={() => handleImageClick(`mainTreasure${idx}`)}
            className={clsx(
              'relative aspect-square cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
              glassStyle
            )}
          >
            {arena.mainCombo.treasures[idx] ? (
              <Image src={arena.mainCombo.treasures[idx]} alt={`보물${idx+1}`} fill className="object-contain" />
            ) : (
              !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">보물{idx+1}</span>
            )}
          </div>
        ))}
      </div>

      {/* F. 최고점 - Mid Layer */}
      <div 
        className={clsx(
          'absolute flex items-center gap-2 px-3 py-2',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          width: '15%', 
          height: '8%', 
          top: '8%', 
          left: '66%' 
        }}
      >
        {!isExporting && <span className="text-white text-xs font-bold whitespace-nowrap">최고점:</span>}
        <select
          value={arena.score.unit}
          onChange={(e) => setArenaScore(arenaIndex, 'unit', e.target.value)}
          className="bg-white/20 text-white text-xs px-1 py-0.5 rounded focus:outline-none"
        >
          <option value="-">-</option>
          <option value="점">점</option>
          <option value="M">M</option>
          <option value="K">K</option>
          <option value="억">억</option>
          <option value="만">만</option>
        </select>
      </div>

      {/* G. 선달 마법사탕 + 축복 (겹침) - Mid Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          width: '8%', 
          height: '8%', 
          top: '8%', 
          left: '44%',
          position: 'absolute'
        }}
        onClick={() => handleImageClick('candy1')}
      >
        {arena.magicCandy.cookie1Candy ? (
          <Image src={arena.magicCandy.cookie1Candy} alt="선달 마법사탕" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-[10px] text-center leading-tight">선달<br/>사탕</span>
        )}
        
        {/* 선달 축복 - Child (우측 하단 1/4 영역) */}
        <div 
          onClick={(e) => { e.stopPropagation(); handleImageClick('blessing1'); }}
          className={clsx(
            'absolute cursor-pointer overflow-hidden',
            glassStyle
          )}
          style={{ 
            zIndex: 30, 
            bottom: 0, 
            right: 0, 
            width: '50%', 
            height: '50%' 
          }}
          title={getBlessing1Desc()}
        >
          {arena.magicCandy.cookie1Blessing ? (
            <Image src={arena.magicCandy.cookie1Blessing} alt="선달 축복" fill className="object-contain" />
          ) : (
            !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-[8px]">축복</span>
          )}
        </div>
      </div>

      {/* H. 이달 마법사탕 + 축복 (겹침) - Mid Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          width: '8%', 
          height: '8%', 
          top: '8%', 
          left: '54%',
          position: 'absolute'
        }}
        onClick={() => handleImageClick('candy2')}
      >
        {arena.magicCandy.cookie2Candy ? (
          <Image src={arena.magicCandy.cookie2Candy} alt="이달 마법사탕" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-[10px] text-center leading-tight">이달<br/>사탕</span>
        )}
        
        {/* 이달 축복 - Child (우측 하단 1/4 영역) */}
        <div 
          onClick={(e) => { e.stopPropagation(); handleImageClick('blessing2'); }}
          className={clsx(
            'absolute cursor-pointer overflow-hidden',
            glassStyle
          )}
          style={{ 
            zIndex: 30, 
            bottom: 0, 
            right: 0, 
            width: '50%', 
            height: '50%' 
          }}
          title={getBlessing2Desc()}
        >
          {arena.magicCandy.cookie2Blessing ? (
            <Image src={arena.magicCandy.cookie2Blessing} alt="이달 축복" fill className="object-contain" />
          ) : (
            !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-[8px]">축복</span>
          )}
        </div>
      </div>

      {/* I. 대체 조합 Contents - Mid Layer (대체 조합 Base 위에 겹침) */}
      <div 
        className="absolute flex flex-col gap-2 p-3"
        style={{ 
          zIndex: 20, 
          top: '22%', 
          right: '3%', 
          width: '30%' 
        }}
      >
        {/* 대체 펫 */}
        <div 
          onClick={() => handleImageClick('subPet')}
          className={clsx(
            'relative cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
            glassStyle
          )}
          style={{ width: '100%', aspectRatio: '1' }}
        >
          {arena.subCombo.pet ? (
            <Image src={arena.subCombo.pet} alt="대체 펫" fill className="object-contain" />
          ) : (
            !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">대체 펫</span>
          )}
        </div>

        {/* 대체 최고점 */}
        <div 
          className={clsx(
            'flex items-center gap-2 px-2 py-1',
            glassStyle
          )}
        >
          {!isExporting && <span className="text-white text-[10px] font-bold">점수:</span>}
          <input
            type="text"
            value={arena.subScore.value}
            onChange={(e) => setArenaSubScore(arenaIndex, 'value', e.target.value)}
            className="flex-1 bg-white/20 text-white text-xs px-1 py-0.5 rounded focus:outline-none"
            placeholder={isExporting ? '' : '점수'}
          />
          <select
            value={arena.subScore.unit}
            onChange={(e) => setArenaSubScore(arenaIndex, 'unit', e.target.value)}
            className="bg-white/20 text-white text-xs px-1 py-0.5 rounded focus:outline-none"
          >
            <option value="-">-</option>
            <option value="점">점</option>
            <option value="M">M</option>
            <option value="K">K</option>
            <option value="억">억</option>
            <option value="만">만</option>
          </select>
        </div>

        {/* 대체 쿠키 1, 2 */}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((idx) => (
            <div 
              key={idx}
              onClick={() => handleImageClick(`subCookie${idx+1}`)}
              className={clsx(
                'relative aspect-square cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
                glassStyle
              )}
            >
              {arena.subCombo[`cookie${idx+1}` as 'cookie1' | 'cookie2'] ? (
                <Image src={arena.subCombo[`cookie${idx+1}` as 'cookie1' | 'cookie2']} alt={`대체쿠키${idx+1}`} fill className="object-contain" />
              ) : (
                !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-[10px]">대체<br/>쿠키{idx+1}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* J. 대체 보물 1/2/3 Container - Mid Layer */}
      <div 
        className={clsx(
          'absolute grid grid-cols-3 gap-2 p-2',
          glassStyle
        )}
        style={{ 
          zIndex: 20, 
          bottom: '5%', 
          right: '2%', 
          width: '32%',
          overflow: 'visible'
        }}
      >
        {[0, 1, 2].map((idx) => (
          <div 
            key={idx}
            onClick={() => handleImageClick(`subTreasure${idx}`)}
            className={clsx(
              'relative aspect-square cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
              glassStyle
            )}
          >
            {arena.subCombo.treasures[idx] ? (
              <Image src={arena.subCombo.treasures[idx]} alt={`대체보물${idx+1}`} fill className="object-contain" />
            ) : (
              !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">보물{idx+1}</span>
            )}
          </div>
        ))}
      </div>

      {/* ===== TOP LAYER (z-30) ===== */}
      
      {/* K. 아레나 숫자 (유튜브 링크) - Top Layer */}
      <div 
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center group',
          glassStyle
        )}
        style={{ 
          zIndex: 30, 
          width: '12%', 
          height: '8%', 
          top: '2%', 
          left: '2%' 
        }}
        onClick={() => {
          const url = prompt('유튜브 링크를 입력하세요:', arena.youtubeUrl || '');
          if (url !== null) setArenaYoutubeUrl(arenaIndex, url || null);
        }}
      >
        <span className={clsx(
          'font-bold text-sm',
          arena.youtubeUrl ? 'text-red-400' : 'text-white'
        )}>
          {arenaIndex + 1}
          {arena.youtubeUrl && ' ▶'}
        </span>
        {!isExporting && (
          <div className="opacity-0 group-hover:opacity-100 absolute top-full left-0 mt-1 text-white text-[9px] whitespace-nowrap bg-black/70 px-2 py-0.5 rounded z-50">
            유튜브 링크 {arena.youtubeUrl ? '수정' : '추가'}
          </div>
        )}
      </div>

      {/* L. 요리 - Top Layer */}
      <div 
        onClick={() => handleImageClick('dish')}
        className={clsx(
          'absolute cursor-pointer hover:opacity-90 transition-opacity overflow-hidden',
          glassStyle
        )}
        style={{ 
          zIndex: 30, 
          width: '10%', 
          height: '8%', 
          top: '2%', 
          right: '3%' 
        }}
      >
        {arena.dish ? (
          <Image src={arena.dish} alt="요리" fill className="object-contain" />
        ) : (
          !isExporting && <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">요리</span>
        )}
      </div>

    </div>
  );
}
