const normalizeBasePath = (value) => {
  if (!value || value === '/') return '';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

const basePath =
  process.env.NODE_ENV === 'production'
    ? normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH || '')
    : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  experimental: {
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@google-cloud/firestore',
      'nodemailer',
    ],
  },
};

export default nextConfig;
