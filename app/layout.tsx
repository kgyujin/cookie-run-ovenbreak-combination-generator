import type { Metadata, Viewport } from 'next';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';

const title = '쿠키런: 오븐브레이크 조합표 생성기';
const description = '쿠키런: 오븐브레이크의 최적 조합표를 생성하고 공유하세요';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website', locale: 'ko_KR' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

const RESTORE_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('appState'));if(s&&/^\\/(s\\/[^/]+\\/?)?$/.test(location.pathname)){var d=document.documentElement,b=s.background||{},c=b.type==='color'?b.color:b.type==='gradient'&&b.gradient?b.gradient[0]:b.type==='image'&&b.imageUrl?'#1c1917':'#fffbf5';d.setAttribute('data-saved','');if(/^#[0-9a-f]{6}$/i.test(c))d.style.setProperty('--page-edge',c)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 아이템 목록을 화면 코드와 동시에 받기 시작 */}
        <link rel="preload" href="/data/gameData.json" as="fetch" crossOrigin="anonymous" />
        {/* 저장된 조합표가 있으면 불러올 때까지 잠깐 가리고, 바깥 바탕색은 미리 칠한다 (빈 화면이 먼저 보였다 바뀌는 깜빡임 방지) */}
        <script dangerouslySetInnerHTML={{ __html: RESTORE_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
