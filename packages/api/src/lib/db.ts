import { createDb, type Database } from '@unstpbl/db';
import { getDatabaseUrl } from './env.js';

export const db: Database = createDb(getDatabaseUrl());
