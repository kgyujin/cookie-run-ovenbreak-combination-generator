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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
