/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds for now
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Add module aliases to prevent duplicate TLDraw packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tldraw/tldraw': require.resolve('@tldraw/tldraw'),
      '@tldraw/editor': require.resolve('@tldraw/editor'),
      '@tldraw/primitives': require.resolve('@tldraw/primitives'),
      '@tldraw/utils': require.resolve('@tldraw/utils'),
      '@tldraw/state': require.resolve('@tldraw/state'),
      '@tldraw/tlschema': require.resolve('@tldraw/tlschema'),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development' 
              ? "default-src 'self' https: wss:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://* https://*.livekit.cloud https://*.tldraw.com https://* localhost:*; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data: https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://* https://*.livekit.cloud https://*.tldraw.com; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;"
          }
        ]
      }
    ]
  },
  reactStrictMode: true,
};

module.exports = nextConfig;