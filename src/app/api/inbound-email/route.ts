import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseInboundRecipient, extractCompanySlugFromAddress } from '@/lib/utils/parseEmailAddress';
import { simpleParser } from 'mailparser';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import type { EngagementInterpretation } from '@/lib/services/aiEngagementInterpreter';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import {
  bumpProspectNeedToEngageToEngaged,
  resolveOutreachContactIdForWave1,
} from '@/lib/services/inboundProspectBump';
import { autoProcessInboundEmail } from '@/lib/services/inboundAutoProcessService';
import { shouldAutoProcessInboundEmail } from '@/lib/utils/inboundAutoProcessTrigger';

/**
 * POST /api/inbound-email
 *
 * SendGrid Inbound Parse webhook endpoint - MVP1 Ingestion
 *
 * Architecture:
 * SendGrid → InboundEmail (raw) → optional auto-record via inboundAutoProcessService
 * when AUTO_PROCESS_SENDERS / AUTO_PROCESS_COMPANY_IDS match → EmailActivity + CRM stamps
 *
 * This endpoint is public and does not require authentication (webhook-safe).
 *
 * - Stores all raw SendGrid fields as-is
 * - If 'email' MIME field is present, parses it with mailparser to extract
 *   readable text/html (handles forwarded Outlook emails that skip parsed fields)
 *
 * inboundType (MEETING vs OUTREACH):
 * - If To is slug.meeting@crm.domain → MEETING (separate meeting slug).
 * - Else (e.g. single slug slug@crm.domain): infer from content via AI; meeting_note/call_note → MEETING, else OUTREACH.
 * So one email address can be used for both; meeting notes are typed as MEETING and show in Meeting Updates.
 */
const MAX_SAFE_INBOUND_BYTES = 3.5 * 1024 * 1024; // below Vercel ~4.5MB hard limit

/** Inbound Parse posts multipart/form-data; Event Webhook posts JSON → /api/webhooks/sendgrid */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_SAFE_INBOUND_BYTES) {
      console.error('INBOUND_PAYLOAD_TOO_LARGE:', {
        contentLengthBytes: contentLength,
        contentLengthMB: (contentLength / 1024 / 1024).toFixed(2),
        note: 'Email likely has a large attachment. Strip attachments before forwarding.',
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Payload too large — strip attachments before forwarding to CRM',
        },
        { status: 200 },
      );
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    // SendGrid Event Webhook is JSON — must use POST /api/webhooks/sendgrid, not this route.
    if (contentType.includes('application/json')) {
      console.warn(
        '[inbound-email] JSON Content-Type: this URL is for Inbound Parse (multipart) only. Configure event POST URL as /api/webhooks/sendgrid'
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Expected multipart/form-data (SendGrid Inbound Parse). Event webhooks belong at /api/webhooks/sendgrid',
        },
        { status: 200 }
      );
    }

    // STEP 1: Extract formData (multipart/form-data from SendGrid)
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseErr) {
      console.error('[inbound-email] formData() failed (wrong Content-Type or malformed multipart?)', {
        contentType,
        message: (parseErr as Error)?.message,
      });
      throw parseErr;
    }

    // STEP 2: Extract SendGrid fields (exact match, case-sensitive)
    const from            = (formData.get('from')            as string | null) || null;
    const to              = (formData.get('to')              as string | null) || null;
    const subject         = (formData.get('subject')         as string | null) || null;
    let   text            = (formData.get('text')            as string | null) || null;
    let   html            = (formData.get('html')            as string | null) || null;
    const headers         = (formData.get('headers')         as string | null) || null;
    const sender_ip       = (formData.get('sender_ip')       as string | null) || null;
    const envelope        = (formData.get('envelope')        as string | null) || null;
    const dkim            = (formData.get('dkim')            as string | null) || null;
    const SPF             = (formData.get('SPF')             as string | null) || null; // case-sensitive
    const spam_score      = (formData.get('spam_score')      as string | null) || null;
    const spam_report     = (formData.get('spam_report')     as string | null) || null;
    const charsets        = (formData.get('charsets')        as string | null) || null;
    const attachments     = (formData.get('attachments')     as string | null) || null;
    const attachment_info = (formData.get('attachment-info') as string | null) || null;
    const email           = (formData.get('email')           as string | null) || null; // raw MIME

    console.log('Inbound POST received:', {
      from,
      to,
      subject,
      hasText: !!text,
      hasHtml: !!html,
      hasRawMime: !!email,
      envelope,
    });

    // STEP 3: Parse MIME if text/html are missing (forwarded emails from Outlook etc.)
    // The 'email' field contains the full RFC 2822 MIME message with base64-encoded body parts.
    if (email && !text && !html) {
      try {
        const parsed = await simpleParser(email);
        text = parsed.text || null;
        html = parsed.html || null;
        console.log('MIME parsed:', {
          hasText: !!text,
          textLength: text?.length || 0,
          hasHtml: !!html,
          htmlLength: html?.length || 0,
        });
      } catch (parseErr) {
        console.warn('MIME parse failed (non-fatal):', parseErr);
      }
    }

    // STEP 4: Parse recipient to get company slug and type (meeting vs email)
    const recipient = to ? parseInboundRecipient(to) : null;
    let companyHQId: string | null = null;
    const slug = recipient?.companySlug ?? (to ? extractCompanySlugFromAddress(to) : null);
    console.log('Inbound slug resolution:', {
      to,
      recipientParsed: recipient,
      slug,
    });
    if (slug) {
      const company = await prisma.company_hqs.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (company) {
        companyHQId = company.id;
      }
    }

    if (!companyHQId) {
      console.log('Inbound: no company matched for slug — discarding', { slug, to });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Type from slug (meeting@...) or infer from content when using single email slug
    let inboundType: 'MEETING' | 'OUTREACH' =
      recipient?.inboundType === 'meeting' ? 'MEETING' : 'OUTREACH';

    /** Reused for MEETING vs OUTREACH typing and optionally passed to auto-process (one OpenAI call). */
    let outreachInterpretation: EngagementInterpretation | null = null;

    if (inboundType === 'OUTREACH') {
      const bodyText =
        (text || '').trim() ||
        (html || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000);
      if (bodyText || (subject || '').trim()) {
        try {
          outreachInterpretation = await interpretEngagement(
            {
              from,
              to,
              subject: subject || null,
              body: bodyText || null,
              raw: bodyText || null,
            },
            null,
          );
          if (
            outreachInterpretation.activityType === 'meeting_note' ||
            outreachInterpretation.activityType === 'call_note'
          ) {
            inboundType = 'MEETING';
          }
        } catch (interpretErr) {
          console.warn('Inbound: type inference failed (non-fatal):', (interpretErr as Error)?.message);
        }
      }
    }

    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        from,
        to,
        subject,
        text: text ?? null,
        html: html ?? null,
        headers,
        sender_ip,
        envelope,
        dkim,
        SPF,
        spam_score,
        spam_report,
        charsets,
        attachments,
        attachment_info,
        email: email ?? null,
        companyHQId,
        inboundType,
        ingestionStatus: 'RECEIVED',
      },
    });

    console.log('InboundEmail stored:', inboundEmail.id, { inboundType, hasText: !!text, hasHtml: !!html, hasRawMime: !!email });

    // Wave 1 — prospect need-to-engage → engaged-awaiting-response (header/email match only, no interpret)
    if (inboundType === 'OUTREACH') {
      try {
        const companyRow = await prisma.company_hqs.findUnique({
          where: { id: companyHQId },
          select: {
            owners_company_hqs_ownerIdToowners: { select: { email: true } },
          },
        });
        const ownerEmailLower =
          (companyRow?.owners_company_hqs_ownerIdToowners?.email || '')
            .toLowerCase()
            .trim() || null;
        const parsed = universalEmailParser({
          from,
          to,
          subject,
          text: text ?? undefined,
          html: html ?? undefined,
          headers: headers ?? undefined,
          email: email ?? undefined,
        });
        const waveContactId = await resolveOutreachContactIdForWave1({
          companyHQId,
          ownerEmailLower,
          fromEmail: parsed.fromEmail,
          toEmail: parsed.toEmail,
        });
        if (waveContactId) {
          const bumped = await bumpProspectNeedToEngageToEngaged(waveContactId);
          if (bumped) {
            console.log('✅ Inbound wave1 pipeline bump for contact', waveContactId);
          }
        }
      } catch (waveErr) {
        console.warn('Inbound wave1 bump skipped:', (waveErr as Error)?.message);
      }
    }

    // Auto-record pipeline for allowlisted senders / companies (OUTREACH only)
    if (
      inboundType === 'OUTREACH' &&
      shouldAutoProcessInboundEmail({
        companyHQId,
        fromHeader: from,
        inboundType,
      })
    ) {
      void autoProcessInboundEmail(prisma, {
        inboundEmailId: inboundEmail.id,
        requireReceivedStatus: true,
        markAutoProcessed: true,
        preInterpreted: outreachInterpretation,
      }).then((autoResult) => {
        if (autoResult.success === false) {
          console.warn('Inbound auto-process failed:', {
            inboundEmailId: inboundEmail.id,
            error: autoResult.error,
          });
        } else {
          console.log('Inbound auto-process recorded:', {
            inboundEmailId: inboundEmail.id,
            recordId: autoResult.recordId,
            recordType: autoResult.recordType,
          });
        }
      });
    }

    return NextResponse.json(
      { success: true, inboundEmailId: inboundEmail.id, inboundType },
      { status: 200 }
    );

  } catch (err) {
    console.error('InboundEmail ingestion error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. This endpoint only accepts POST requests.' },
    { status: 405 }
  );
}
