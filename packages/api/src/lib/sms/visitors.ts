import { and, eq, isNull, sql, visitorVisits, visitors, type Database } from '@unstpbl/db';
import { sendSms, type SmsDeps, type SendFailureReason, type LogStatus } from './service.js';
import { getTemplateBody } from './templateStore.js';
import { visitorWelcomeMessage } from './templates.js';

export type Visitor = typeof visitors.$inferSelect;

export interface VisitorInput {
  fullName: string;
  /** Already normalised to E.164. */
  phone: string;
  email?: string | null;
  invitedBy?: string | null;
  notes?: string | null;
  /** The visitor agreed (on the visitor card) to receive texts from the church. */
  smsConsent: boolean;
}

export type WelcomeOutcome =
  | { status: 'skipped'; reason: 'no_consent' | 'already_sent' | 'not_found' }
  | { status: LogStatus; reason?: SendFailureReason; detail?: string };

/**
 * Records that a visitor attended on `today`. Idempotent per day (the unique index
 * decides), and a new day bumps the visit count and moves a "new" visitor to "returning".
 * Returns true only when a new visit was actually recorded.
 */
export async function recordVisit(database: Database, visitorId: string, today: string): Promise<boolean> {
  const inserted = await database
    .insert(visitorVisits)
    .values({ visitorId, visitDate: today })
    .onConflictDoNothing()
    .returning({ id: visitorVisits.id });
  if (inserted.length === 0) return false;

  await database
    .update(visitors)
    .set({
      visitCount: sql`${visitors.visitCount} + 1`,
      lastVisitDate: today,
      followupStatus: sql`case when ${visitors.followupStatus} = 'new' then 'returning' else ${visitors.followupStatus} end`,
    })
    .where(eq(visitors.id, visitorId));
  return true;
}

/**
 * Sends the thank-you text at most once per visitor, and only with their consent.
 *
 * The send is *claimed* first with a single conditional UPDATE, so two ushers (or a
 * double-tap) racing each other cannot both send. If the message was not actually
 * delivered to a carrier (dry-run, blocked, failed) the claim is released, so it can
 * be retried, or sent for real once a live provider is configured.
 */
export async function sendVisitorWelcome(
  database: Database,
  deps: SmsDeps,
  visitorId: string,
  actorId: string | null,
): Promise<WelcomeOutcome> {
  const [claimed] = await database
    .update(visitors)
    .set({ welcomeSentAt: new Date() })
    .where(and(eq(visitors.id, visitorId), isNull(visitors.welcomeSentAt), eq(visitors.smsConsent, true)))
    .returning();

  if (!claimed) {
    const [current] = await database.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
    if (!current) return { status: 'skipped', reason: 'not_found' };
    return { status: 'skipped', reason: current.smsConsent ? 'already_sent' : 'no_consent' };
  }

  let result;
  try {
    result = await sendSms(deps, {
      to: claimed.phone,
      body: visitorWelcomeMessage(claimed.fullName, await getTemplateBody(database, 'visitor_welcome')),
      purpose: 'visitor_welcome',
      recipientVisitorId: claimed.id,
      createdBy: actorId,
    });
  } catch (err) {
    await database.update(visitors).set({ welcomeSentAt: null }).where(eq(visitors.id, visitorId));
    throw err;
  }

  if (result.status !== 'sent') {
    await database.update(visitors).set({ welcomeSentAt: null }).where(eq(visitors.id, visitorId));
  }
  return { status: result.status, reason: result.reason, detail: result.detail };
}

export interface RegisterResult {
  visitor: Visitor;
  /** False when this phone number was already on file (the person came again). */
  created: boolean;
  visitRecorded: boolean;
  welcome: WelcomeOutcome;
}

/**
 * The usher's one action: "this person is here today". A new number creates the
 * visitor; a known number records a return visit instead of a duplicate. Either way
 * the welcome text goes out once, if (and only if) they consented.
 */
export async function registerVisitor(
  database: Database,
  deps: SmsDeps,
  input: VisitorInput,
  context: { today: string; actorId: string | null },
): Promise<RegisterResult> {
  const findByPhone = async () =>
    (await database.select().from(visitors).where(eq(visitors.phone, input.phone)).limit(1))[0];

  let visitor = await findByPhone();
  let created = false;
  let visitRecorded = false;

  if (!visitor) {
    const [row] = await database
      .insert(visitors)
      .values({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email ?? null,
        invitedBy: input.invitedBy ?? null,
        notes: input.notes ?? null,
        firstVisitDate: context.today,
        lastVisitDate: context.today,
        smsConsent: input.smsConsent,
        smsConsentAt: input.smsConsent ? new Date() : null,
        createdBy: context.actorId,
      })
      .onConflictDoNothing({ target: visitors.phone })
      .returning();

    if (row) {
      visitor = row;
      created = true;
      visitRecorded = true;
      await database.insert(visitorVisits).values({ visitorId: row.id, visitDate: context.today }).onConflictDoNothing();
    } else {
      // Another usher registered the same number a moment ago; treat as a return visit.
      visitor = (await findByPhone())!;
    }
  }

  if (!created) {
    visitRecorded = await recordVisit(database, visitor.id, context.today);

    // Consent can be given on a later visit, but only the visitor can withdraw it (by replying STOP).
    if (input.smsConsent && !visitor.smsConsent) {
      [visitor] = await database
        .update(visitors)
        .set({ smsConsent: true, smsConsentAt: new Date() })
        .where(eq(visitors.id, visitor.id))
        .returning();
    }
  }

  const welcome = await sendVisitorWelcome(database, deps, visitor.id, context.actorId);

  const [fresh] = await database.select().from(visitors).where(eq(visitors.id, visitor.id)).limit(1);
  return { visitor: fresh ?? visitor, created, visitRecorded, welcome };
}
