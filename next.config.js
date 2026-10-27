const SUPABASE_URL = 'https://ekaxwuciwzxpjvqjvrsq.supabase.co';

// 관리자 페이지 주소는 저장소에 적지 않고 Vercel 환경변수로만 정한다 (lib/studio/config.ts 와 같은 규칙)
const STUDIO_PATH = /^[A-Za-z0-9_-]{8,64}$/.test(process.env.STUDIO_PATH ?? '') ? process.env.STUDIO_PATH : '';

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
      // 아이템 이미지는 자주 바뀌지 않으므로 하루 동안 캐시 (gameData.json은 매번 확인)
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      { source: '/thumbs/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
      { source: '/api/studio/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
  async redirects() {
    // 관리자 페이지는 정해 둔 주소로만 연다
    return [{ source: '/studio', destination: '/', permanent: false }];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // 짧은 링크는 정적 페이지로 처리 (아이디는 화면에서 주소를 읽어 불러옴 → 서버 함수 실행 없음)
        { source: '/s/:id', destination: '/' },
        ...(STUDIO_PATH ? [{ source: `/${STUDIO_PATH}`, destination: '/studio' }] : []),
      ],
    };
  },
};

module.exports = nextConfig;
