/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds for now
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development' 
              ? "default-src 'self' https: wss:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://* https://*.livekit.cloud https://*.tldraw.com https://* localhost:*; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data: https:; frame-src 'self';"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://* https://*.livekit.cloud https://*.tldraw.com; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:;"
          }
        ]
      }
    ]
  },
  reactStrictMode: true,
};

module.exports = nextConfig; 