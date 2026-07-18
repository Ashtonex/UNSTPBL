import { db } from './db.js';
import { adminAuditLogs } from '@unstpbl/db';
import type { AuthUser } from '../middleware/auth.js';

interface AuditInput {
  actor: AuthUser;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(input: AuditInput) {
  try {
    await db.insert(adminAuditLogs).values({
      actorUserId: input.actor.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error('Failed to record admin audit log:', err);
  }
}
