import type { PrismaClient } from '@prisma/client';
import { NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING } from '@/lib/constants/nextEngagementPurpose';

let purposeEnumLabelsCache: Set<string> | null = null;

/**
 * Labels present in Postgres for NextEngagementPurpose (cached per process).
 */
export async function loadNextEngagementPurposeEnumLabels(
  prisma: PrismaClient,
): Promise<Set<string>> {
  if (purposeEnumLabelsCache) return purposeEnumLabelsCache;
  const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT e.enumlabel::text AS enumlabel
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NextEngagementPurpose'
      AND n.nspname = current_schema()
  `;
  purposeEnumLabelsCache = new Set(rows.map((r) => r.enumlabel));
  return purposeEnumLabelsCache;
}

/** For tests or long-running workers after a migration. */
export function clearNextEngagementPurposeEnumLabelsCache() {
  purposeEnumLabelsCache = null;
}

/**
 * Map app/AI enum value to a label Postgres will accept. Prefer running Prisma
 * migrations; this avoids hard failures when the DB enum lags schema.
 */
export async function coerceNextEngagementPurposeForPostgres(
  prisma: PrismaClient,
  purpose: string | null | undefined,
): Promise<string | null> {
  if (purpose == null || purpose === '') return null;
  const labels = await loadNextEngagementPurposeEnumLabels(prisma);
  if (labels.has(purpose)) return purpose;

  const chain: string[] = [];
  if (purpose === NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING) {
    chain.push('POST_WARM_MEETING_NUDGE', 'MEETING_FOLLOW_UP');
  } else if (purpose === 'MEETING_FOLLOW_UP') {
    chain.push('POST_WARM_MEETING_NUDGE');
  }
  chain.push('GENERAL_CHECK_IN');

  for (const candidate of chain) {
    if (labels.has(candidate)) {
      console.warn(
        `[nextEngagementPurpose] DB enum missing "${purpose}"; persisted as "${candidate}". Run \`npx prisma migrate deploy\` (repair migration adds SCHEDULED_MEETING).`,
      );
      return candidate;
    }
  }

  console.warn(
    `[nextEngagementPurpose] DB enum missing "${purpose}" and no safe fallback; skipping purpose.`,
  );
  return null;
}
