import { count, desc, eq, savedAnnouncements, type Database } from '@unstpbl/db';

export const MAX_SAVED_ANNOUNCEMENTS = 50;

export interface SavedAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}

const columns = {
  id: savedAnnouncements.id,
  title: savedAnnouncements.title,
  body: savedAnnouncements.body,
  createdAt: savedAnnouncements.createdAt,
};

export async function listSavedAnnouncements(database: Database): Promise<SavedAnnouncement[]> {
  return database.select(columns).from(savedAnnouncements).orderBy(desc(savedAnnouncements.createdAt)).limit(MAX_SAVED_ANNOUNCEMENTS);
}

/** Returns null when the list is already full. */
export async function createSavedAnnouncement(
  database: Database,
  input: { title: string; body: string },
  userId: string | null,
): Promise<SavedAnnouncement | null> {
  const [{ total }] = await database.select({ total: count() }).from(savedAnnouncements);
  if (Number(total) >= MAX_SAVED_ANNOUNCEMENTS) return null;

  const [row] = await database.insert(savedAnnouncements).values({ ...input, createdBy: userId }).returning(columns);
  return row;
}

export async function deleteSavedAnnouncement(database: Database, id: string): Promise<boolean> {
  const deleted = await database.delete(savedAnnouncements).where(eq(savedAnnouncements.id, id)).returning({ id: savedAnnouncements.id });
  return deleted.length > 0;
}
