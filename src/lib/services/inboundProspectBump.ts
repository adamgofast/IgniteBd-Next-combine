/**
 * Wave-1 deterministic prospect bump for inbound / off-platform email.
 * need-to-engage → engaged-awaiting-response without interpretEngagement.
 */

import { prisma } from '@/lib/prisma';
import { snapPipelineOnContact } from '@/lib/services/pipelineService';

/** Move prospect/need-to-engage → engaged-awaiting-response. No-op if wrong stage/pipeline. */
export async function bumpProspectNeedToEngageToEngaged(
  contactId: string,
): Promise<boolean> {
  const pipe = await prisma.pipelines.findUnique({ where: { contactId } });
  if (!pipe || pipe.pipeline !== 'prospect' || pipe.stage !== 'need-to-engage') {
    return false;
  }
  await prisma.pipelines.update({
    where: { contactId },
    data: { stage: 'engaged-awaiting-response', updatedAt: new Date() },
  });
  await snapPipelineOnContact(contactId, pipe.pipeline, 'engaged-awaiting-response');
  return true;
}

/**
 * Resolve CRM contact id from webhook From/To using same "non-owner is contact" rule as interpret.
 */
export async function resolveOutreachContactIdForWave1(params: {
  companyHQId: string;
  ownerEmailLower: string | null;
  fromEmail: string | null;
  toEmail: string | null;
}): Promise<string | null> {
  const { companyHQId, ownerEmailLower, fromEmail, toEmail } = params;

  let contactEmail = '';
  if (ownerEmailLower) {
    const fe = (fromEmail || '').toLowerCase().trim();
    const te = (toEmail || '').toLowerCase().trim();
    if (fe && fe !== ownerEmailLower) contactEmail = fe;
    else if (te && te !== ownerEmailLower) contactEmail = te;
  }
  if (!contactEmail && fromEmail?.includes('@')) {
    contactEmail = fromEmail.trim().toLowerCase();
  }
  if (!contactEmail) return null;

  const existing = await prisma.contact.findFirst({
    where: {
      crmId: companyHQId,
      email: { equals: contactEmail, mode: 'insensitive' },
    },
    select: { id: true },
  });
  return existing?.id ?? null;
}
