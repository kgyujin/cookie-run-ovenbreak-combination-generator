import type { Metadata, Viewport } from 'next';
import './globals.css';
import OrientationGuard from '@/components/OrientationGuard';

export const metadata: Metadata = {
  title: '쿠키런: 오븐브레이크 조합표 생성기',
  description: '쿠키런: 오븐브레이크의 최적 조합표를 생성하고 공유하세요',
  openGraph: {
    title: '쿠키런: 오븐브레이크 조합표 생성기',
    description: '쿠키런: 오븐브레이크의 최적 조합표를 생성하고 공유하세요',
    type: 'website',
    locale: 'ko_KR',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="stylesheet" as="style" crossOrigin="" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
        {/* Google Analytics - 사용자가 직접 추가 가능 */}
        {/* <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script> */}
        {/* Google Search Console - 사용자가 직접 추가 가능 */}
        {/* <meta name="google-site-verification" content="VERIFICATION_CODE" /> */}
      </head>
      <body className="font-sans flex justify-center items-center h-screen overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <OrientationGuard />
        {children}
      </body>
    </html>
  );
}
