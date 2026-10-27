const SUPABASE_URL = 'https://ekaxwuciwzxpjvqjvrsq.supabase.co';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Next App Router의 인라인 스크립트
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      `connect-src 'self' data: ${SUPABASE_URL}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://github.com",
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
