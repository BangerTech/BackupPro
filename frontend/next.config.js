/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Determine the backend URL dynamically
    // In production, use the internal Docker network name 'backend'
    // In development, use localhost with the specified port
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? 'http://backend:4000' 
      : `http://localhost:${process.env.BACKEND_PORT || 4000}`;
    
    return [
      // API routes
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
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
        destination: `${backendUrl}/api/:path*`
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