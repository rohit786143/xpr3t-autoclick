/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["playwright", "playwright-core", "bcryptjs"],
  },
};

export default nextConfig;

