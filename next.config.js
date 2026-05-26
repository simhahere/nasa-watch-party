/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    domains: [
      'lh3.googleusercontent.com',
      'firebasestorage.googleapis.com',
      'res.cloudinary.com',
    ],
  },
  typescript: {
    // Allow production builds to successfully complete even if type errors exist
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow production builds to successfully complete even if ESLint warnings/errors exist
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
