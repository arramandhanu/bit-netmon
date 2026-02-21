/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@netmon/shared'],
    output: 'standalone',
};

export default nextConfig;
