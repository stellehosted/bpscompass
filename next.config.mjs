/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*'],
  // Ensure proper bundling for serverless functions
  serverExternalPackages: ['pg', 'pg-native'],
}

export default nextConfig
