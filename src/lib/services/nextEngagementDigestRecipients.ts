/**
 * Owners tied to a company for Next Engagement digest / manual send.
 * Used by POST /api/outreach/send-next-engagement-email and weekly cron.
 */

import { prisma } from '@/lib/prisma';

export type DigestOwnerRow = {
  id: string;
  email: string | null;
  sendgridVerifiedEmail: string | null;
  sendgridVerifiedName: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
};

const digestOwnerSelect = {
  id: true,
  email: true,
  sendgridVerifiedEmail: true,
  sendgridVerifiedName: true,
  name: true,
  firstName: true,
  lastName: true,
} as const;

export function ownerDisplayName(o: DigestOwnerRow): string {
  if (o.name?.trim()) return o.name.trim();
  const parts = [o.firstName, o.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (o.firstName?.trim()) return o.firstName.trim();
  return '';
}

/** Case-insensitive match on owners.email or owners.sendgridVerifiedEmail */
export function recipientMatchesOwner(o: DigestOwnerRow, recipientEmail: string): boolean {
  const want = recipientEmail.trim().toLowerCase();
  if (!want) return false;
  const set = new Set(
    [o.email, o.sendgridVerifiedEmail]
      .map((x) => (x || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(want);
}

/**
 * Primary owner, manager (if set), and all company_memberships owners (deduped).
 */
export async function loadOwnersTiedToCompany(companyHQId: string): Promise<DigestOwnerRow[]> {
  const hq = await prisma.company_hqs.findUnique({
    where: { id: companyHQId },
    select: {
      owners_company_hqs_ownerIdToowners: { select: digestOwnerSelect },
      owners_company_hqs_managerIdToowners: { select: digestOwnerSelect },
      company_memberships: {
        select: {
          owners: { select: digestOwnerSelect },
        },
      },
    },
  });

  if (!hq) return [];

  const map = new Map<string, DigestOwnerRow>();
  const add = (o: DigestOwnerRow | null | undefined) => {
    if (o?.id) map.set(o.id, o);
  };

  add(hq.owners_company_hqs_ownerIdToowners);
  add(hq.owners_company_hqs_managerIdToowners);
  for (const m of hq.company_memberships || []) {
    add(m.owners);
  }

  return [...map.values()];
}

/**
 * When recipient is an owner on this tenant, use CRM name instead of making them type it.
 */
export async function resolveRecipientToName(
  companyHQId: string,
  recipientEmail: string,
  explicitName?: string | null,
): Promise<string> {
  if (explicitName != null && String(explicitName).trim()) {
    return String(explicitName).trim();
  }
  const owners = await loadOwnersTiedToCompany(companyHQId);
  const match = owners.find((o) => recipientMatchesOwner(o, recipientEmail));
  const display = match ? ownerDisplayName(match) : '';
  if (display) return display;
  return recipientEmail.split('@')[0] || recipientEmail;
}
