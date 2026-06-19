/**
 * Env-driven rules for webhook auto-record (SendGrid → push-to-ai pipeline).
 *
 * - AUTO_PROCESS_SENDERS: comma-separated sender emails (From header), case-insensitive
 * - AUTO_PROCESS_COMPANY_IDS: comma-separated company_hqs ids — auto-record all OUTREACH for those tenants
 */

import { universalEmailParser } from '@/lib/services/universalEmailParser';

function parseIdSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function parseSenderSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Whether this inbound row should run autoProcessInboundEmail after insert.
 * Only OUTREACH; MEETING slug/content stays manual-first.
 */
export function shouldAutoProcessInboundEmail(opts: {
  companyHQId: string;
  fromHeader: string | null;
  inboundType: 'MEETING' | 'OUTREACH';
}): boolean {
  if (opts.inboundType !== 'OUTREACH') return false;

  const companies = parseIdSet(process.env.AUTO_PROCESS_COMPANY_IDS);
  if (companies.has(opts.companyHQId)) return true;

  const senders = parseSenderSet(process.env.AUTO_PROCESS_SENDERS);
  if (senders.size === 0) return false;

  try {
    const p = universalEmailParser({
      from: opts.fromHeader || '',
      to: '',
      subject: '',
      text: '',
      html: '',
    });
    const email = (p.fromEmail || '').toLowerCase();
    return email.length > 0 && senders.has(email);
  } catch {
    return false;
  }
}
