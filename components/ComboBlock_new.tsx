'use client';

import { useAppStore } from '@/store/useAppStore';
import Image from 'next/image';
import { formatScore } from '@/utils/scoreFormatter';

export default function ComboBlock({ arenaIndex }: { arenaIndex: number }) {
  const arena = useAppStore((state) => state.arenas[arenaIndex]);
  const gameData = useAppStore((state) => state.gameData);
  const displaySettings = useAppStore((state) => state.displaySettings);
  const fontSettings = useAppStore((state) => state.fontSettings);
  const setModalOpen = useAppStore((state) => state.setModalOpen);
  const setArenaScore = useAppStore((state) => state.setArenaScore);
  const setArenaSubScore = useAppStore((state) => state.setArenaSubScore);

  const handleImageClick = (type: string) => {
    setModalOpen(true, arenaIndex, type);
  };

  // 폰트 패밀리 가져오기
  const getFontFamily = () => {
    if (fontSettings.fontFamily === 'CookieRun') return 'CookieRun';
    if (fontSettings.fontFamily === 'Custom') return 'CustomFont';
    return 'Pretendard Variable';
  };

  return (
    <div className="relative w-full bg-white/95 backdrop-blur-lg rounded-lg p-4" style={{ height: '425px' }}>
      {/* Arena Number */}
      <div 
        className="absolute top-2 left-2 font-bold"
        style={{
          fontSize: `${fontSettings.scoreFontSize || 14}px`,
          color: fontSettings.scoreColor || '#111827',
          fontFamily: getFontFamily(),
        }}
      >
        {arenaIndex + 1}
      </div>

      {/* Left Side */}
      <div className="absolute" style={{ left: '20px', top: '50px', width: '45%', height: '350px' }}>
        {/* Pet */}
        <div 
          onClick={() => handleImageClick('pet')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '0', top: '0', width: '100px', height: '100px' }}
        >
          {arena.mainCombo.pet ? (
            <Image src={arena.mainCombo.pet} alt="펫" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm font-bold">펫</span>
          )}
        </div>

        {/* Candy 1 */}
        <div 
          onClick={() => handleImageClick('candy1')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '110px', top: '0', width: '60px', height: '60px' }}
        >
          {arena.magicCandy.cookie1Candy ? (
            <Image src={arena.magicCandy.cookie1Candy} alt="캔디1" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">캔디1</span>
          )}
        </div>

        {/* Blessing 1 */}
        <div 
          onClick={() => handleImageClick('blessing1')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '180px', top: '0', width: '60px', height: '60px' }}
        >
          {arena.magicCandy.cookie1Blessing ? (
            <Image src={arena.magicCandy.cookie1Blessing} alt="축복1" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">축복1</span>
          )}
        </div>

        {/* Candy 2 */}
        <div 
          onClick={() => handleImageClick('candy2')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '110px', top: '70px', width: '60px', height: '60px' }}
        >
          {arena.magicCandy.cookie2Candy ? (
            <Image src={arena.magicCandy.cookie2Candy} alt="캔디2" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">캔디2</span>
          )}
        </div>

        {/* Blessing 2 */}
        <div 
          onClick={() => handleImageClick('blessing2')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '180px', top: '70px', width: '60px', height: '60px' }}
        >
          {arena.magicCandy.cookie2Blessing ? (
            <Image src={arena.magicCandy.cookie2Blessing} alt="축복2" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">축복2</span>
          )}
        </div>

        {/* Cookie 1 */}
        <div 
          onClick={() => handleImageClick('mainCookie1')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '0', top: '140px', width: '110px', height: '110px' }}
        >
          {arena.mainCombo.cookie1 ? (
            <Image src={arena.mainCombo.cookie1} alt="쿠키1" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm font-bold">쿠키1</span>
          )}
        </div>

        {/* Cookie 2 */}
        <div 
          onClick={() => handleImageClick('mainCookie2')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '130px', top: '140px', width: '110px', height: '110px' }}
        >
          {arena.mainCombo.cookie2 ? (
            <Image src={arena.mainCombo.cookie2} alt="쿠키2" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm font-bold">쿠키2</span>
          )}
        </div>

        {/* Treasure 1 */}
        <div 
          onClick={() => handleImageClick('treasure1')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '0', top: '260px', width: '75px', height: '75px' }}
        >
          {arena.mainCombo.treasures[0] ? (
            <Image src={arena.mainCombo.treasures[0]} alt="보물1" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">보물1</span>
          )}
        </div>

        {/* Treasure 2 */}
        <div 
          onClick={() => handleImageClick('treasure2')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '85px', top: '260px', width: '75px', height: '75px' }}
        >
          {arena.mainCombo.treasures[1] ? (
            <Image src={arena.mainCombo.treasures[1]} alt="보물2" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">보물2</span>
          )}
        </div>

        {/* Treasure 3 */}
        <div 
          onClick={() => handleImageClick('treasure3')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '170px', top: '260px', width: '75px', height: '75px' }}
        >
          {arena.mainCombo.treasures[2] ? (
            <Image src={arena.mainCombo.treasures[2]} alt="보물3" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">보물3</span>
          )}
        </div>
      </div>

      {/* Right Side */}
      <div className="absolute" style={{ right: '20px', top: '50px', width: '45%', height: '350px' }}>
        {/* Dish */}
        <div 
          onClick={() => handleImageClick('dish')}
          className="absolute cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
          style={{ left: '0', top: '0', width: '120px', height: '120px' }}
        >
          {arena.dish ? (
            <Image src={arena.dish} alt="요리" fill className="object-contain" crossOrigin="anonymous" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm font-bold">요리</span>
          )}
        </div>

        {/* Main Score */}
        <div className="absolute" style={{ left: '0', top: '135px', width: '100%' }}>
          <label className="block text-gray-700 text-xs font-bold mb-1">최고점</label>
          <input
            type="text"
            value={formatScore(arena.score.value, displaySettings.scoreDisplayType)}
            onChange={(e) => {
              const numericValue = e.target.value.replace(/[^0-9]/g, '');
              setArenaScore(arenaIndex, 'value', numericValue);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              fontFamily: getFontFamily(),
              color: fontSettings.scoreColor || '#111827',
              fontSize: `${fontSettings.scoreFontSize || 14}px`,
            }}
            placeholder="점수 입력"
          />
        </div>

        {/* Sub Combo */}
        <div className="absolute" style={{ left: '0', top: '210px', width: '100%' }}>
          <label className="block text-gray-700 text-xs font-bold mb-1">대체 조합</label>
          <div className="flex gap-2">
            <div 
              onClick={() => handleImageClick('subCookie1')}
              className="cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
              style={{ width: '50px', height: '50px' }}
            >
              {arena.subCombo.cookie1 ? (
                <Image src={arena.subCombo.cookie1} alt="대체쿠키1" fill className="object-contain" crossOrigin="anonymous" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">쿠키</span>
              )}
            </div>
            <div 
              onClick={() => handleImageClick('subCookie2')}
              className="cursor-pointer hover:opacity-90 transition-all bg-white/70 rounded-lg shadow-md"
              style={{ width: '50px', height: '50px' }}
            >
              {arena.subCombo.cookie2 ? (
                <Image src={arena.subCombo.cookie2} alt="대체쿠키2" fill className="object-contain" crossOrigin="anonymous" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-bold">쿠키</span>
              )}
            </div>
          </div>
        </div>

        {/* Sub Score */}
        <div className="absolute" style={{ left: '0', top: '280px', width: '100%' }}>
          <label className="block text-gray-700 text-xs font-bold mb-1">대체 최고점</label>
          <input
            type="text"
            value={formatScore(arena.subScore.value, displaySettings.scoreDisplayType)}
            onChange={(e) => {
              const numericValue = e.target.value.replace(/[^0-9]/g, '');
              setArenaSubScore(arenaIndex, 'value', numericValue);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              fontFamily: getFontFamily(),
              color: fontSettings.scoreColor || '#111827',
              fontSize: `${fontSettings.scoreFontSize || 14}px`,
            }}
            placeholder="점수 입력"
          />
        </div>
      </div>
    </div>
  );
}
