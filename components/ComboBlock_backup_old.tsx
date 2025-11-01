'use client';

import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';

export default function ComboBlock({ arenaIndex }: { arenaIndex: number }) {
  const arena = useAppStore((state) => state.arenas[arenaIndex]);
  const isExporting = useAppStore((state) => state.isExporting);

  const openImageSelect = (category: string, field: string) => {
    console.log('Opening image select for:', category, field);
  };

  const handleYoutubeClick = () => {
    if (arena.youtubeUrl) {
      window.open(arena.youtubeUrl, '_blank');
    } else {
      const url = prompt('YouTube URL을 입력하세요:');
      if (url) {
        useAppStore.getState().setArenaYoutubeUrl(arenaIndex, url);
      }
    }
  };

  const handleYoutubeDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    useAppStore.getState().setArenaYoutubeUrl(arenaIndex, '');
  };

  return (
    <div className="relative w-full h-[240px] rounded-lg p-3" style={{
      background: isExporting ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
      backdropFilter: isExporting ? 'none' : 'blur(10px)',
      border: isExporting ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      {/* Arena Number - Top Left (z-20) */}
      <div
        onClick={handleYoutubeClick}
        className={clsx(
          "absolute top-2 left-2 z-20 rounded px-2 py-1 cursor-pointer transition-colors flex items-center gap-1",
          {
            "glass-dark hover:bg-white/20": !isExporting,
            "bg-transparent": isExporting
          }
        )}
      >
        <span className="text-white text-xs font-bold">아레나 {arenaIndex + 1}</span>
        {arena.youtubeUrl && !isExporting && (
          <button
            onClick={handleYoutubeDelete}
            className="text-red-400 hover:text-red-300"
            title="YouTube URL 삭제"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm5 13.59L13.59 15 10 11.41 6.41 15 5 13.59 8.59 10 5 6.41 6.41 5 10 8.59 13.59 5 15 6.41 11.41 10 15 13.59z" />
            </svg>
          </button>
        )}
      </div>

      {/* Pet - Top Left, overlapping arena number (z-10) */}
      <div
        className={clsx(
          "absolute top-8 left-2 w-16 h-16 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 10 }}
      >
        <div
          onClick={() => openImageSelect('pets', 'mainPet')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.mainCombo.pet ? (
            <img src={arena.mainCombo.pet} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && <span className="text-white/90 text-[10px] font-medium">펫</span>
          )}
        </div>
      </div>

      {/* 선달 마법사탕 + 축복 (마법사탕 우측하단에 축복 겹침) */}
      <div className="absolute top-10 left-20 z-10">
        {/* 선달 마법사탕 */}
        <div
          className={clsx(
            "relative w-14 h-14 rounded-lg",
            {
              "glass-dark": !isExporting,
              "bg-transparent": isExporting
            }
          )}
        >
          <div
            onClick={() => openImageSelect('magicCandies', 'candy1')}
            className={clsx(
              "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
              {
                "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                "bg-transparent border-none": isExporting
              }
            )}
          >
            {arena.magicCandy.cookie1Candy ? (
              <img src={arena.magicCandy.cookie1Candy} alt="" className="w-full h-full object-contain" />
            ) : (
              !isExporting && (
                <div className="text-center">
                  <div className="text-white/90 text-[8px] font-medium leading-tight">선달</div>
                  <div className="text-white/90 text-[8px] font-medium leading-tight">마탕</div>
                </div>
              )
            )}
          </div>
        </div>
        {/* 선달 축복 (마법사탕 우측하단 50% 겹침, 50% 크기) */}
        <div
          className={clsx(
            "absolute -bottom-2 -right-2 w-7 h-7 rounded",
            {
              "glass-dark": !isExporting,
              "bg-transparent": isExporting
            }
          )}
          style={{ zIndex: 11 }}
        >
          <div
            onClick={() => openImageSelect('blessings', 'blessing1')}
            className={clsx(
              "w-full h-full rounded cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
              {
                "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                "bg-transparent border-none": isExporting
              }
            )}
          >
            {arena.magicCandy.cookie1Blessing ? (
              <img src={arena.magicCandy.cookie1Blessing} alt="" className="w-full h-full object-contain" />
            ) : (
              !isExporting && (
                <div className="text-center">
                  <div className="text-white/90 text-[6px] font-medium leading-tight">축복</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 이달 마법사탕 + 축복 */}
      <div className="absolute top-10 left-36 z-10">
        {/* 이달 마법사탕 */}
        <div
          className={clsx(
            "relative w-14 h-14 rounded-lg",
            {
              "glass-dark": !isExporting,
              "bg-transparent": isExporting
            }
          )}
        >
          <div
            onClick={() => openImageSelect('magicCandies', 'candy2')}
            className={clsx(
              "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
              {
                "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                "bg-transparent border-none": isExporting
              }
            )}
          >
            {arena.magicCandy.cookie2Candy ? (
              <img src={arena.magicCandy.cookie2Candy} alt="" className="w-full h-full object-contain" />
            ) : (
              !isExporting && (
                <div className="text-center">
                  <div className="text-white/90 text-[8px] font-medium leading-tight">이달</div>
                  <div className="text-white/90 text-[8px] font-medium leading-tight">마탕</div>
                </div>
              )
            )}
          </div>
        </div>
        {/* 이달 축복 (마법사탕 우측하단 50% 겹침, 50% 크기) */}
        <div
          className={clsx(
            "absolute -bottom-2 -right-2 w-7 h-7 rounded",
            {
              "glass-dark": !isExporting,
              "bg-transparent": isExporting
            }
          )}
          style={{ zIndex: 11 }}
        >
          <div
            onClick={() => openImageSelect('blessings', 'blessing2')}
            className={clsx(
              "w-full h-full rounded cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
              {
                "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                "bg-transparent border-none": isExporting
              }
            )}
          >
            {arena.magicCandy.cookie2Blessing ? (
              <img src={arena.magicCandy.cookie2Blessing} alt="" className="w-full h-full object-contain" />
            ) : (
              !isExporting && (
                <div className="text-center">
                  <div className="text-white/90 text-[6px] font-medium leading-tight">축복</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 선달 쿠키 (왼쪽, 더 큼) */}
      <div
        className={clsx(
          "absolute top-28 left-2 w-[26%] h-36 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
      >
        <div
          onClick={() => openImageSelect('cookies', 'mainCookie1')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.mainCombo.cookie1 ? (
            <img src={arena.mainCombo.cookie1} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && <span className="text-white/90 text-xs font-medium">선달 쿠키</span>
          )}
        </div>
      </div>

      {/* 이달 쿠키 (중앙, 더 작음) */}
      <div
        className={clsx(
          "absolute top-28 left-[28%] w-[22%] h-36 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
      >
        <div
          onClick={() => openImageSelect('cookies', 'mainCookie2')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.mainCombo.cookie2 ? (
            <img src={arena.mainCombo.cookie2} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && <span className="text-white/90 text-xs font-medium">이달 쿠키</span>
          )}
        </div>
      </div>

      {/* Treasures 1-3 (하단 왼쪽) */}
      <div className="absolute bottom-2 left-2 flex gap-1">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className={clsx(
              "w-20 h-14 rounded-lg",
              {
                "glass-dark": !isExporting,
                "bg-transparent": isExporting
              }
            )}
          >
            <div
              onClick={() => openImageSelect('treasures', `mainTreasure${idx}`)}
              className={clsx(
                "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
                {
                  "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                  "bg-transparent border-none": isExporting
                }
              )}
            >
              {arena.mainCombo.treasures[idx] ? (
                <img src={arena.mainCombo.treasures[idx]} alt="" className="w-full h-full object-contain" />
              ) : (
                !isExporting && <span className="text-white/90 text-[10px] font-medium">보물{idx + 1}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 요리 - Top Right (z-30) */}
      <div
        className={clsx(
          "absolute top-2 right-2 w-20 h-14 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 30 }}
      >
        <div
          onClick={() => openImageSelect('dishes', 'dish')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.dish ? (
            <img src={arena.dish} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && <span className="text-white/90 text-[10px] font-medium">요리</span>
          )}
        </div>
      </div>

      {/* 최고점 - Right, below 요리 (z-20) */}
      <div
        className={clsx(
          "absolute top-18 right-2 w-28 h-20 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 20 }}
      >
        <div className="w-full h-full rounded-lg p-2 flex flex-col items-center justify-center">
          {!isExporting && <span className="text-white/90 text-[10px] font-medium mb-1">최고점</span>}
          <div className="flex gap-1 w-full">
            <input
              type="text"
              value={arena.score.value}
              onChange={(e) => useAppStore.getState().setArenaScore(arenaIndex, 'value', e.target.value)}
              placeholder="점수"
              className={clsx(
                "flex-1 rounded px-1 py-0.5 text-white text-[10px] placeholder-white/60 focus:outline-none",
                {
                  "bg-white/30 border border-white/40 focus:ring-1 focus:ring-white/50": !isExporting,
                  "bg-transparent border-none": isExporting
                }
              )}
            />
            <select
              value={arena.score.unit}
              onChange={(e) => useAppStore.getState().setArenaScore(arenaIndex, 'unit', e.target.value)}
              className={clsx(
                "rounded px-1 py-0.5 text-white text-[10px] focus:outline-none",
                {
                  "bg-white/30 border border-white/40 focus:ring-1 focus:ring-white/50": !isExporting,
                  "bg-transparent border-none": isExporting
                }
              )}
            >
              <option value="-">-</option>
              <option value="점">점</option>
              <option value="M">M</option>
              <option value="K">K</option>
              <option value="억">억</option>
              <option value="만">만</option>
            </select>
          </div>
        </div>
      </div>

      {/* 대체 조합 펫 (z-10) */}
      <div
        className={clsx(
          "absolute top-40 right-[88px] w-12 h-12 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 10 }}
      >
        <div
          onClick={() => openImageSelect('pets', 'subPet')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.subCombo.pet ? (
            <img src={arena.subCombo.pet} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && (
              <div className="text-center">
                <div className="text-white/90 text-[7px] font-medium leading-tight">대체</div>
                <div className="text-white/90 text-[7px] font-medium leading-tight">펫</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 대체 조합 최고점 라벨 (z-10) */}
      <div
        className={clsx(
          "absolute top-40 right-2 w-20 h-12 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 10 }}
      >
        <div className="w-full h-full rounded-lg p-1 flex flex-col items-center justify-center">
          {!isExporting && (
            <>
              <span className="text-white/90 text-[8px] font-medium leading-tight">대체조합</span>
              <span className="text-white/90 text-[8px] font-medium leading-tight">최고점</span>
            </>
          )}
        </div>
      </div>

      {/* 대체 조합 선달 쿠키 */}
      <div
        className={clsx(
          "absolute top-54 right-[88px] w-16 h-24 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 10 }}
      >
        <div
          onClick={() => openImageSelect('cookies', 'subCookie1')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.subCombo.cookie1 ? (
            <img src={arena.subCombo.cookie1} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && (
              <div className="text-center">
                <div className="text-white/90 text-[8px] font-medium leading-tight">대체</div>
                <div className="text-white/90 text-[8px] font-medium leading-tight">선달</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 대체 조합 이달 쿠키 */}
      <div
        className={clsx(
          "absolute top-54 right-2 w-16 h-24 rounded-lg",
          {
            "glass-dark": !isExporting,
            "bg-transparent": isExporting
          }
        )}
        style={{ zIndex: 10 }}
      >
        <div
          onClick={() => openImageSelect('cookies', 'subCookie2')}
          className={clsx(
            "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
            {
              "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
              "bg-transparent border-none": isExporting
            }
          )}
        >
          {arena.subCombo.cookie2 ? (
            <img src={arena.subCombo.cookie2} alt="" className="w-full h-full object-contain" />
          ) : (
            !isExporting && (
              <div className="text-center">
                <div className="text-white/90 text-[8px] font-medium leading-tight">대체</div>
                <div className="text-white/90 text-[8px] font-medium leading-tight">이달</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 대체 조합 보물 (3개) - Bottom Right */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className={clsx(
              "w-14 h-14 rounded-lg",
              {
                "glass-dark": !isExporting,
                "bg-transparent": isExporting
              }
            )}
          >
            <div
              onClick={() => openImageSelect('treasures', `subTreasure${idx}`)}
              className={clsx(
                "w-full h-full rounded-lg cursor-pointer transition-colors flex items-center justify-center overflow-hidden",
                {
                  "bg-white/20 border border-white/30 hover:bg-white/30": !isExporting,
                  "bg-transparent border-none": isExporting
                }
              )}
            >
              {arena.subCombo.treasures[idx] ? (
                <img src={arena.subCombo.treasures[idx]} alt="" className="w-full h-full object-contain" />
              ) : (
                !isExporting && (
                  <div className="text-center">
                    <div className="text-white/90 text-[7px] font-medium leading-tight">보물</div>
                    <div className="text-white/90 text-[7px] font-medium leading-tight">{idx + 1}</div>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
