export function getAllowedCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowedOrigins = getAllowedCorsOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
    return true;
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
