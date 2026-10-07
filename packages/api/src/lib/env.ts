// The deployed web app (Vercel). Always allowed so a missing or mistyped
// CORS_ORIGINS on the host can't silently block every browser request.
// CORS_ORIGINS adds to this list (custom domains, staging, etc.).
const PRODUCTION_WEB_ORIGINS = ['https://unstpbl-seven.vercel.app'];

export function getAllowedCorsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return [...new Set([...PRODUCTION_WEB_ORIGINS, ...configured])];
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowedOrigins = getAllowedCorsOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(origin)
    ) {
      return true;
    }
  }

  return false;
}

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }

  return 'postgresql://unstpbl:unstpbl_dev@localhost:5432/unstpbl';
}
