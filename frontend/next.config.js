/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // API routes
      {
        source: '/api/:path*',
        destination: 'http://backend:4000/api/:path*'
      },
      // Handle RSC routes with _rsc parameter - direct to backend
      {
        source: '/:path*',
        has: [
          {
            type: 'query',
            key: '_rsc'
          }
        ],
        destination: 'http://backend:4000/api/:path*'
      },
      // Regular page routes
      {
        source: '/:path*',
        destination: '/:path*'
      }
    ]
  },
  // Ensure pages are properly handled
  async redirects() {
    return []
  }
}

module.exports = nextConfig 