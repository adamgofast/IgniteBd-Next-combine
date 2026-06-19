import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { autoProcessInboundEmail } from '@/lib/services/inboundAutoProcessService';

/** Allow bulk processing + OpenAI TPM backoff without cutting the request short on Vercel. */
export const maxDuration = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses "Please try again in 3.036s" from OpenAI error messages. */
function retryAfterMsFromMessage(msg: string): number {
  const m = msg.match(/try again in ([\d.]+)\s*s\b/i);
  if (m) {
    const sec = Number.parseFloat(m[1]);
    if (Number.isFinite(sec) && sec >= 0) {
      return Math.min(Math.ceil(sec * 1000) + 750, 120_000);
    }
  }
  return 62_000;
}

/**
 * POST /api/inbound-parse/process-pending
 *
 * Bulk-process pending inbound OUTREACH rows (ingestionStatus RECEIVED).
 * Auth: Firebase (same as push-to-ai).
 *
 * Body (optional): { limit?: number, senderEmail?: string }
 * - senderEmail: only rows whose From resolves to this address (case-insensitive)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const limitRaw = body.limit;
  const limit =
    typeof limitRaw === 'number' && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 50;

  const senderFilter =
    typeof body.senderEmail === 'string' && body.senderEmail.trim()
      ? body.senderEmail.trim().toLowerCase()
      : null;

  const fetchCap = senderFilter ? Math.min(limit * 5, 500) : limit;

  const rows = await prisma.inboundEmail.findMany({
    where: {
      ingestionStatus: 'RECEIVED',
      OR: [{ inboundType: 'OUTREACH' }, { inboundType: null }],
    },
    orderBy: { createdAt: 'asc' },
    take: fetchCap,
    select: { id: true, from: true },
  });

  const idsToProcess: string[] = [];
  for (const row of rows) {
    if (idsToProcess.length >= limit) break;
    if (!senderFilter) {
      idsToProcess.push(row.id);
      continue;
    }
    try {
      const parsed = universalEmailParser({
        from: row.from || '',
        to: '',
        subject: '',
        text: '',
        html: '',
      });
      const fromLower = (parsed.fromEmail || '').toLowerCase();
      if (fromLower === senderFilter) {
        idsToProcess.push(row.id);
      }
    } catch {
      // skip rows we can't parse for sender filter
    }
  }

  const results: {
    id: string;
    ok: boolean;
    error?: string;
    recordId?: string;
    recordType?: string;
    contactId?: string | null;
    contactEmail?: string;
    contactName?: string | null;
    activityType?: string;
    summary?: string;
    subject?: string;
    fromPreview?: string;
  }[] = [];

  let processed = 0;
  let failed = 0;

  const delayBetweenMs = Math.max(
    0,
    Number.parseInt(process.env.INBOUND_PROCESS_PENDING_DELAY_MS ?? '8000', 10) || 8000,
  );
  const maxRateLimitRetries = Math.min(
    8,
    Math.max(0, Number.parseInt(process.env.INBOUND_PROCESS_PENDING_RATE_LIMIT_RETRIES ?? '6', 10) || 6),
  );

  for (let i = 0; i < idsToProcess.length; i++) {
    const id = idsToProcess[i];
    if (i > 0 && delayBetweenMs > 0) {
      await sleep(delayBetweenMs);
    }

    let result = await autoProcessInboundEmail(prisma, {
      inboundEmailId: id,
      requireReceivedStatus: true,
      markAutoProcessed: true,
    });

    let rateRetries = 0;
    while (
      result.success === false &&
      result.status === 429 &&
      rateRetries < maxRateLimitRetries
    ) {
      rateRetries += 1;
      await sleep(retryAfterMsFromMessage(result.error));
      result = await autoProcessInboundEmail(prisma, {
        inboundEmailId: id,
        requireReceivedStatus: true,
        markAutoProcessed: true,
      });
    }

    if (result.success === false) {
      failed += 1;
      const inboundRow = await prisma.inboundEmail.findUnique({
        where: { id },
        select: { subject: true, from: true },
      });
      results.push({
        id,
        ok: false,
        error: result.error,
        subject: inboundRow?.subject ?? undefined,
        fromPreview: inboundRow?.from ?? undefined,
      });
    } else {
      processed += 1;
      results.push({
        id,
        ok: true,
        recordId: result.recordId,
        recordType: result.recordType,
        contactId: result.contactId,
        contactEmail: result.parsed?.contactEmail,
        contactName: result.parsed?.contactName ?? undefined,
        activityType: result.parsed?.activityType,
        summary: result.parsed?.summary,
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      processed,
      failed,
      attempted: idsToProcess.length,
      fetched: rows.length,
      ...(senderFilter ? { senderEmailFilter: senderFilter } : {}),
    },
    results,
  });
}
