import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '@unstpbl/db';
import { authMiddleware } from '../middleware/auth.js';

export const profileRoutes = new Hono();

// Apply auth middleware to all profile routes
profileRoutes.use('*', authMiddleware);

/**
 * GET /profile — Returns the current user's profile details.
 * Auto-creates profile row in our database if it doesn't exist yet.
 */
profileRoutes.get('/profile', async (c) => {
  try {
    const authUser = c.get('user');

    // 1. Fetch user from DB
    const dbUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (dbUsers.length > 0) {
      return c.json({ profile: dbUsers[0] });
    }

    // 2. If user doesn't exist in our custom users table, auto-create it
    console.log(`Auto-creating profile for authenticated user: ${authUser.email} (${authUser.id})`);
    
    const [newProfile] = await db
      .insert(users)
      .values({
        id: authUser.id,
        email: authUser.email,
        role: authUser.role, // from Supabase public.users mapping or default 'member'
        translation: 'KJV',
      })
      .returning();

    return c.json({ profile: newProfile });
  } catch (err: any) {
    console.error('Error fetching/syncing user profile:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * PUT /profile — Updates the user's profile details.
 */
profileRoutes.put('/profile', async (c) => {
  try {
    const authUser = c.get('user');
    const { displayName, congregation, translation } = await c.req.json();

    // Validate translation preference if provided
    if (translation && !['KJV', 'ESV'].includes(translation)) {
      return c.json({ error: 'Invalid translation. Supported: KJV, ESV.' }, 400);
    }

    // Update DB
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (congregation !== undefined) updateData.congregation = congregation;
    if (translation !== undefined) updateData.translation = translation;

    const [updatedProfile] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, authUser.id))
      .returning();

    if (!updatedProfile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ profile: updatedProfile });
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
