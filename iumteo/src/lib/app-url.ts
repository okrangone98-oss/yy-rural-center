const DEFAULT_SITE_ORIGIN = 'https://yycenter.kr';
const DEFAULT_APP_BASE_PATH = process.env.NODE_ENV === 'production' ? '/iumteo' : '';

function normalizeBasePath(value?: string | null) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function resolvePathnameBase(rawUrl?: string | null) {
  if (!rawUrl) return '';

  try {
    const pathname = normalizeBasePath(new URL(rawUrl).pathname);
    if (pathname.endsWith('/api/auth')) {
      return pathname.slice(0, -'/api/auth'.length) || '';
    }
    return pathname;
  } catch {
    const pathname = normalizeBasePath(rawUrl);
    if (pathname.endsWith('/api/auth')) {
      return pathname.slice(0, -'/api/auth'.length) || '';
    }
    return pathname;
  }
}

export function getAppBasePath() {
  if (process.env.NODE_ENV !== 'production') {
    return '';
  }

  return (
    normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH) ||
    resolvePathnameBase(process.env.NEXT_PUBLIC_SITE_URL) ||
    resolvePathnameBase(process.env.NEXTAUTH_URL) ||
    DEFAULT_APP_BASE_PATH
  );
}

export function getAppPath(path = '/') {
  const basePath = getAppBasePath();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!basePath) return normalizedPath;
  if (normalizedPath === '/') return basePath;
  return `${basePath}${normalizedPath}`;
}

export function getRoutePath(path = '/') {
  const basePath = getAppBasePath();
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!basePath) return normalizedPath;

  while (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    normalizedPath = normalizedPath.slice(basePath.length) || '/';
  }

  return normalizedPath;
}

export function getSiteOrigin() {
  for (const candidate of [
    process.env.NEXT_PUBLIC_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }

  return DEFAULT_SITE_ORIGIN;
}

export function getSiteUrl() {
  return `${getSiteOrigin()}${getAppBasePath()}`;
}

export function getAppUrl(path = '/') {
  return new URL(getAppPath(path), `${getSiteOrigin()}/`).toString();
}
