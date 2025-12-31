/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Vercel SSR 배포를 위해 제거
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
