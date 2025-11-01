'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { background, setBackground, fontSettings, setFontSettings, displaySettings, setDisplaySettings } = useAppStore();
  const [activeSection, setActiveSection] = useState<'background' | 'font' | 'display'>('background');
  
  // Background states
  const [activeTab, setActiveTab] = useState<'color' | 'gradient' | 'image'>(background.type);
  const [colorValue, setColorValue] = useState(background.color || '#667eea');
  const [gradient1, setGradient1] = useState(background.gradient?.[0] || '#667eea');
  const [gradient2, setGradient2] = useState(background.gradient?.[1] || '#764ba2');
  const [imageUrl, setImageUrl] = useState(background.imageUrl || '');

  // Font states
  const [fontSize, setFontSize] = useState(fontSettings.fontSize);
  const [fontFamily, setFontFamily] = useState(fontSettings.fontFamily);
  const [textAlign, setTextAlign] = useState(fontSettings.textAlign);
  const [customFontUrl, setCustomFontUrl] = useState(fontSettings.customFontUrl || '');
  const [customFontName, setCustomFontName] = useState(fontSettings.customFontName || '');

  // Display states
  const [scoreDisplayType, setScoreDisplayType] = useState(displaySettings.scoreDisplayType);

  const randomGradient = () => {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe',
      '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#30cfd0', '#330867',
    ];
    const color1 = colors[Math.floor(Math.random() * colors.length)];
    const color2 = colors[Math.floor(Math.random() * colors.length)];
    setGradient1(color1);
    setGradient2(color2);
  };

  const handleSave = () => {
    // Save background settings
    if (activeTab === 'color') {
      setBackground({ type: 'color', color: colorValue });
    } else if (activeTab === 'gradient') {
      setBackground({ type: 'gradient', gradient: [gradient1, gradient2] });
    } else if (activeTab === 'image') {
      setBackground({ type: 'image', imageUrl });
    }

    // Save font settings
    setFontSettings({
      fontSize,
      fontFamily,
      textAlign,
      customFontUrl,
      customFontName,
    });

    // Save display settings
    setDisplaySettings({
      scoreDisplayType,
    });

    // Apply custom font if selected
    if (fontFamily === 'Custom' && customFontUrl) {
      const styleId = 'custom-font-style';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      const fontFormat = customFontUrl.includes('.woff2') ? 'woff2' :
                        customFontUrl.includes('.woff') ? 'woff' :
                        customFontUrl.includes('.ttf') ? 'truetype' :
                        customFontUrl.includes('.otf') ? 'opentype' : 'truetype';

      styleElement.textContent = `
        @font-face {
          font-family: 'CustomFont';
          src: url('${customFontUrl}') format('${fontFormat}');
          font-display: swap;
        }
      `;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-white/30 flex items-center justify-between sticky top-0 glass">
          <h2 className="text-white text-xl font-bold">설정</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-white/70 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-white/30">
          <button
            onClick={() => setActiveSection('background')}
            className={`flex-1 py-3 text-white text-sm font-semibold transition-colors ${
              activeSection === 'background' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            🎨 배경
          </button>
          <button
            onClick={() => setActiveSection('font')}
            className={`flex-1 py-3 text-white text-sm font-semibold transition-colors ${
              activeSection === 'font' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            ✍️ 폰트
          </button>
          <button
            onClick={() => setActiveSection('display')}
            className={`flex-1 py-3 text-white text-sm font-semibold transition-colors ${
              activeSection === 'display' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            📊 표기
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeSection === 'background' && (
            <div className="space-y-4">
              {/* Background Type Tabs */}
              <div className="flex border border-white/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setActiveTab('color')}
                  className={`flex-1 py-2 text-white text-sm font-semibold transition-colors ${
                    activeTab === 'color' ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                >
                  단색
                </button>
                <button
                  onClick={() => setActiveTab('gradient')}
                  className={`flex-1 py-2 text-white text-sm font-semibold transition-colors ${
                    activeTab === 'gradient' ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                >
                  그라데이션
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 py-2 text-white text-sm font-semibold transition-colors ${
                    activeTab === 'image' ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                >
                  이미지
                </button>
              </div>

              {activeTab === 'color' && (
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">배경 색상</label>
                  <input
                    type="color"
                    value={colorValue}
                    onChange={(e) => setColorValue(e.target.value)}
                    className="w-full h-20 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {activeTab === 'gradient' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2">색상 1</label>
                    <input
                      type="color"
                      value={gradient1}
                      onChange={(e) => setGradient1(e.target.value)}
                      className="w-full h-16 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2">색상 2</label>
                    <input
                      type="color"
                      value={gradient2}
                      onChange={(e) => setGradient2(e.target.value)}
                      className="w-full h-16 rounded-lg cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={randomGradient}
                    className="w-full glass-dark rounded-lg px-4 py-2 text-white font-semibold hover:bg-white/20 transition-colors"
                  >
                    🎲 랜덤 조합
                  </button>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2">이미지 URL</label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-white/30 border border-white/40 rounded-lg px-4 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                  
                  <div className="relative">
                    <label className="block text-white text-sm font-semibold mb-2">또는 파일 업로드</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setImageUrl(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="bg-image-upload"
                    />
                    <label
                      htmlFor="bg-image-upload"
                      className="w-full glass-dark rounded-lg px-4 py-3 text-white font-semibold hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      이미지 파일 선택
                    </label>
                  </div>

                  {imageUrl && imageUrl.startsWith('data:image') && (
                    <div className="relative">
                      <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => setImageUrl('')}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600/80 rounded-full p-1 transition-colors"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === 'font' && (
            <div className="space-y-4">
              {/* Font Size */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2">
                  시즌명 폰트 크기: {fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="52"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-white/60 text-xs mt-1">
                  <span>12px</span>
                  <span>52px</span>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2">폰트 종류</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFontFamily('Pretendard')}
                    className={`py-3 rounded-lg font-semibold transition-colors ${
                      fontFamily === 'Pretendard'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                    style={{ fontFamily: 'Pretendard Variable' }}
                  >
                    Pretendard
                  </button>
                  <button
                    onClick={() => setFontFamily('CookieRun')}
                    className={`py-3 rounded-lg font-semibold transition-colors ${
                      fontFamily === 'CookieRun'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                    style={{ fontFamily: 'CookieRun' }}
                  >
                    쿠키런
                  </button>
                  <button
                    onClick={() => setFontFamily('Custom')}
                    className={`py-3 rounded-lg font-semibold transition-colors ${
                      fontFamily === 'Custom'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    커스텀
                  </button>
                </div>
              </div>

              {/* Custom Font Upload */}
              {fontFamily === 'Custom' && (
                <div className="space-y-3 glass-dark rounded-lg p-4">
                  <div>
                    <label className="block text-white text-sm font-semibold mb-2">폰트 파일 업로드</label>
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setCustomFontUrl(result);
                            setCustomFontName(file.name.replace(/\.[^/.]+$/, ''));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="custom-font-upload"
                    />
                    <label
                      htmlFor="custom-font-upload"
                      className="w-full glass rounded-lg px-4 py-3 text-white font-semibold hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {customFontName || '폰트 파일 선택 (TTF, OTF, WOFF, WOFF2)'}
                    </label>
                  </div>
                  {customFontUrl && (
                    <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                      <span className="text-white text-sm truncate">{customFontName}</span>
                      <button
                        onClick={() => {
                          setCustomFontUrl('');
                          setCustomFontName('');
                        }}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Text Align */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2">텍스트 정렬</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTextAlign('left')}
                    className={`py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                      textAlign === 'left'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                    </svg>
                    좌측
                  </button>
                  <button
                    onClick={() => setTextAlign('center')}
                    className={`py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                      textAlign === 'center'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                    </svg>
                    중앙
                  </button>
                  <button
                    onClick={() => setTextAlign('right')}
                    className={`py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                      textAlign === 'right'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                    </svg>
                    우측
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="glass-dark rounded-lg p-4">
                <label className="block text-white text-xs font-semibold mb-2">미리보기</label>
                <div
                  className="text-white"
                  style={{
                    fontSize: `${fontSize}px`,
                    fontFamily: fontFamily === 'CookieRun' ? 'CookieRun' : fontFamily === 'Custom' ? 'CustomFont' : 'Pretendard Variable',
                    textAlign: textAlign as any,
                  }}
                >
                  시즌명 예시
                </div>
              </div>
            </div>
          )}

          {activeSection === 'display' && (
            <div className="space-y-4">
              {/* Score Display Type */}
              <div>
                <label className="block text-white text-sm font-semibold mb-2">점수 표기 방식</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setScoreDisplayType('abbreviated')}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors text-left ${
                      scoreDisplayType === 'abbreviated'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-bold mb-1">숫자 간략화 (M/B 단위)</div>
                    <div className="text-xs opacity-70">예시: 331M (3억 3100만), 1.5B (15억)</div>
                  </button>
                  <button
                    onClick={() => setScoreDisplayType('comma')}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors text-left ${
                      scoreDisplayType === 'comma'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-bold mb-1">기본 숫자 (콤마 자동 추가)</div>
                    <div className="text-xs opacity-70">예시: 331,000,000</div>
                  </button>
                  <button
                    onClick={() => setScoreDisplayType('korean')}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors text-left ${
                      scoreDisplayType === 'korean'
                        ? 'bg-white/30 text-white border-2 border-white/50'
                        : 'glass-dark text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-bold mb-1">한글 단위 표기</div>
                    <div className="text-xs opacity-70">예시: 3억 3100만</div>
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="glass-dark rounded-lg p-4">
                <label className="block text-white text-xs font-semibold mb-3">점수 미리보기</label>
                <div className="space-y-2 text-white text-sm">
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">입력:</span>
                    <span className="font-mono">331000000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">표시:</span>
                    <span className="font-bold">
                      {scoreDisplayType === 'abbreviated' && '331M'}
                      {scoreDisplayType === 'comma' && '331,000,000'}
                      {scoreDisplayType === 'korean' && '3억 3100만'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/30 flex gap-2 sticky bottom-0 glass">
          <button
            onClick={onClose}
            className="flex-1 glass-dark rounded-lg px-4 py-2 text-white font-semibold hover:bg-white/20 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-white/30 border border-white/40 rounded-lg px-4 py-2 text-white font-semibold hover:bg-white/40 transition-colors"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
