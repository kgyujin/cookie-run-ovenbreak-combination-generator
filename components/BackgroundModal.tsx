'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function BackgroundModal({ onClose }: { onClose: () => void }) {
  const { background, setBackground } = useAppStore();
  const [activeTab, setActiveTab] = useState<'color' | 'gradient' | 'image'>(background.type);
  const [colorValue, setColorValue] = useState(background.color || '#667eea');
  const [gradient1, setGradient1] = useState(background.gradient?.[0] || '#667eea');
  const [gradient2, setGradient2] = useState(background.gradient?.[1] || '#764ba2');
  const [imageUrl, setImageUrl] = useState(background.imageUrl || '');

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
    if (activeTab === 'color') {
      setBackground({ type: 'color', color: colorValue });
    } else if (activeTab === 'gradient') {
      setBackground({ type: 'gradient', gradient: [gradient1, gradient2] });
    } else if (activeTab === 'image') {
      setBackground({ type: 'image', imageUrl });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-white/30 flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">배경 설정</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-white/70 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/30">
          <button
            onClick={() => setActiveTab('color')}
            className={`flex-1 py-3 text-white font-semibold transition-colors ${
              activeTab === 'color' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            단색
          </button>
          <button
            onClick={() => setActiveTab('gradient')}
            className={`flex-1 py-3 text-white font-semibold transition-colors ${
              activeTab === 'gradient' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            그라데이션
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-3 text-white font-semibold transition-colors ${
              activeTab === 'image' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            이미지
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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

        {/* Footer */}
        <div className="p-4 border-t border-white/30 flex gap-2">
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
