import { createDb, type Database } from '@unstpbl/db';

export const db: Database = createDb(process.env.DATABASE_URL);
