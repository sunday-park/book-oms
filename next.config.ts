import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev 표시기가 사이드바 하단 버전 표기를 가려서 끈다
  devIndicators: false,
  // e2e 서버는 별도 캐시 폴더를 써서 켜져 있는 개발 서버(.next)를 덮어쓰지 않게 한다
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // 첫 화면은 도서 관리 (모든 화면은 src/app/[[...slug]] 한 라우트가 주소에 맞춰 그린다)
  redirects: async () => [{ source: "/", destination: "/books", permanent: false }],
};

export default nextConfig;
