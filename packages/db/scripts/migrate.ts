import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(currentDir, '..', 'migrations', '0001_create_tables.sql');
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://unstpbl:unstpbl@localhost:5432/unstpbl';

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false
});

try {
  const migration = await readFile(migrationPath, 'utf8');
  await sql.unsafe(migration);
  console.log('Applied migration: 0001_create_tables.sql');
} finally {
  await sql.end();
}
