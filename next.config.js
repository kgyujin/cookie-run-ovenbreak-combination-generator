// 짧은 링크 서버 (lib/share.ts와 같은 환경변수)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekaxwuciwzxpjvqjvrsq.supabase.co';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next App Router의 인라인 스크립트 (개발 서버는 새로고침 없이 반영하는 기능 때문에 eval도 필요)
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      `connect-src 'self' data: ${SUPABASE_URL}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // 아이템 이미지는 1시간 캐시 (관리 페이지에서 같은 이름으로 이미지를 바꿔도 늦어도 1시간 안에 새 그림). gameData.json은 매번 확인
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
      { source: '/thumbs/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
      { source: '/api/studio/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // 짧은 링크는 정적 페이지로 처리 (아이디는 화면에서 주소를 읽어 불러옴 → 서버 함수 실행 없음)
        { source: '/s/:id', destination: '/' },
      ],
    };
  },
};

module.exports = nextConfig;
