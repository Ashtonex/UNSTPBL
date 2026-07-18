import { readdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4173';
const distDir = new URL('./dist/', import.meta.url);

const appRoutes = [
  '/login',
  '/',
  '/prayers',
  '/family',
  '/birthdays',
  '/profile',
  '/search',
  '/bishop',
  '/admin',
  '/definitely-not-real',
];

async function listBuiltFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    const fullPath = new URL(relativePath, distDir);

    if (entry.isDirectory()) {
      files.push(...await listBuiltFiles(fullPath, `${relativePath}/`));
    } else if (entry.isFile()) {
      files.push(`/${relativePath}`);
    }
  }

  return files;
}

async function checkPath(pathname) {
  const response = await fetch(new URL(pathname, baseUrl), { redirect: 'manual' });
  return {
    pathname,
    status: response.status,
    ok: response.status === 200,
  };
}

const builtFiles = await listBuiltFiles(distDir);
const checks = [...appRoutes, ...builtFiles];
const results = await Promise.all(checks.map(checkPath));
const failures = results.filter((result) => !result.ok);

console.table(results);

if (failures.length > 0) {
  console.error(`Route smoke test failed: ${failures.length} non-200 response(s).`);
  process.exit(1);
}

console.log(`Route smoke test passed: ${results.length} paths returned 200 from ${baseUrl}.`);
