/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 해커톤 빌드에서 lint 경고로 막히지 않도록 (타입체크는 유지)
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
