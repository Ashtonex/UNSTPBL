import { eq, messageTemplates, type Database } from '@unstpbl/db';
import { analyzeSms } from './encoding.js';
import {
  TEMPLATE_DEFINITIONS,
  TEMPLATE_KEYS,
  defaultTemplateBody,
  sampleMessage,
  type TemplateKey,
} from './templates.js';

export interface TemplateView {
  key: TemplateKey;
  label: string;
  when: string;
  placeholders: Array<{ token: string; meaning: string }>;
  required: string[];
  defaultBody: string;
  body: string;
  isCustom: boolean;
  updatedAt: string | null;
  preview: { text: string; segments: number; encoding: 'gsm7' | 'ucs2'; characters: number };
}

/**
 * The wording to use for a send. Never throws: a missing row, or a database that has not
 * had the templates migration yet, simply means the built-in wording. A text must never
 * fail to go out because its template could not be read.
 */
export async function getTemplateBody(database: Database, key: TemplateKey): Promise<string> {
  try {
    const [row] = await database.select({ body: messageTemplates.body }).from(messageTemplates).where(eq(messageTemplates.key, key)).limit(1);
    return row?.body?.trim() ? row.body : defaultTemplateBody(key);
  } catch (err) {
    console.error(`Could not read message template "${key}"; using the default.`, err);
    return defaultTemplateBody(key);
  }
}

export function buildTemplateView(key: TemplateKey, saved: { body: string; updatedAt: Date } | undefined): TemplateView {
  const definition = TEMPLATE_DEFINITIONS[key];
  const body = saved?.body ?? definition.defaultBody;
  const text = sampleMessage(key, body);
  const analysis = analyzeSms(text);
  return {
    key,
    label: definition.label,
    when: definition.when,
    placeholders: definition.placeholders,
    required: definition.required,
    defaultBody: definition.defaultBody,
    body,
    isCustom: Boolean(saved),
    updatedAt: saved ? saved.updatedAt.toISOString() : null,
    preview: { text, segments: analysis.segments, encoding: analysis.encoding, characters: analysis.length },
  };
}

export async function listTemplates(database: Database): Promise<TemplateView[]> {
  const rows = await database.select().from(messageTemplates);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return TEMPLATE_KEYS.map((key) => {
    const row = byKey.get(key);
    return buildTemplateView(key, row ? { body: row.body, updatedAt: row.updatedAt } : undefined);
  });
}

export async function saveTemplate(database: Database, key: TemplateKey, body: string, userId: string | null): Promise<TemplateView> {
  const [row] = await database
    .insert(messageTemplates)
    .values({ key, body, updatedBy: userId })
    .onConflictDoUpdate({ target: messageTemplates.key, set: { body, updatedBy: userId, updatedAt: new Date() } })
    .returning();
  return buildTemplateView(key, { body: row.body, updatedAt: row.updatedAt });
}

export async function resetTemplate(database: Database, key: TemplateKey): Promise<TemplateView> {
  await database.delete(messageTemplates).where(eq(messageTemplates.key, key));
  return buildTemplateView(key, undefined);
}
