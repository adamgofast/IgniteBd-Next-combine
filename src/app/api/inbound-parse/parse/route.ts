import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';

/**
 * POST /api/inbound-parse/parse
 *
 * Parse only (dumb extraction) — no AI. Uses universal parser.
 * Returns: parsed structure, contact lookup, email history, next engage context.
 *
 * For AI interpretation (summary, isResponse, nextEngagementDate), use
 * POST /api/inbound-parse/interpret or run it at record time.
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const inboundEmailId = body?.inboundEmailId;
    if (!inboundEmailId || typeof inboundEmailId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing inboundEmailId' },
        { status: 400 }
      );
    }

    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: inboundEmailId },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
            ownerId: true,
            contactOwnerId: true,
            owners_company_hqs_ownerIdToowners: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!inbound) {
      return NextResponse.json({ success: false, error: 'InboundEmail not found' }, { status: 404 });
    }

    const company = inbound.company_hqs;
    const companyHQId = inbound.companyHQId;
    const owner = company?.owners_company_hqs_ownerIdToowners;
    const ownerEmail = (owner?.email || '').toLowerCase().trim();

    // ── 1. Universal parse (dumb, no AI) ──
    const parsed = universalEmailParser({
      from: inbound.from,
      to: inbound.to,
      subject: inbound.subject,
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
      headers: inbound.headers,
    });

    // Infer contact: owner forwarded this; contact is the OTHER participant
    let contactEmail = parsed.fromEmail || parsed.toEmail || '';
    if (ownerEmail) {
      if (parsed.fromEmail?.toLowerCase() === ownerEmail) {
        contactEmail = parsed.toEmail || parsed.fromEmail || '';
      } else {
        contactEmail = parsed.fromEmail || parsed.toEmail || '';
      }
    }
    const contactName = parsed.fromName || parsed.toName || null;

    // ── 2. Contact lookup ──
    let contact: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      companyName: string | null;
      title: string | null;
      pipelineSnap: string | null;
      nextEngagementDate: string | null;
      nextEngagementPurpose: string | null;
      lastEngagementDate: Date | null;
      lastEngagementType: string | null;
      contactDisposition: string | null;
    } | null = null;

    if (contactEmail && companyHQId) {
      const found = await prisma.contact.findFirst({
        where: {
          crmId: companyHQId,
          email: { equals: contactEmail, mode: 'insensitive' as const },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
          title: true,
          pipeline: true,
          nextEngagementDate: true,
          nextEngagementPurpose: true,
          lastEngagementDate: true,
          lastEngagementType: true,
          contactDisposition: true,
        },
      });
      if (found) contact = found;
    }

    // ── 3. Email history (if contact found) ──
    let emailHistory: Array<{
      id: string;
      date: string;
      subject: string | null;
      body: string | null;
      type: string;
      platform: string | null;
      event: string | null;
      hasResponse: boolean;
    }> = [];
    let alreadyIngested = false;

    if (contact) {
      const activities = await prisma.email_activities.findMany({
        where: { contact_id: contact.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          sentAt: true,
          subject: true,
          body: true,
          source: true,
          platform: true,
          event: true,
          emailSequenceOrder: true,
          responseFromEmail: true,
        },
      });

      emailHistory = activities.map((a) => ({
        id: a.id,
        date: (a.sentAt ?? a.createdAt).toISOString(),
        subject: a.subject,
        body: a.body ? (a.body.length > 150 ? a.body.slice(0, 150) + '…' : a.body) : null,
        type: a.source === 'OFF_PLATFORM' ? 'off-platform' : 'platform',
        platform: a.platform,
        event: a.event,
        direction: a.emailSequenceOrder === 'CONTACT_SEND' ? 'inbound' : 'outbound',
        hasResponse: !!a.responseFromEmail,
      }));

      const parsedSubject = (parsed.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim();
      if (parsedSubject) {
        alreadyIngested = activities.some((a) => {
          const existingSubject = (a.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim();
          return existingSubject === parsedSubject && a.platform === 'sendgrid_inbound';
        });
      }
    }

    // ── 4. Next engage context (parse does not run AI — no aiSuggested) ──
    const currentNextEngage = contact?.nextEngagementDate || null;

    return NextResponse.json({
      success: true,
      parsed: {
        contactEmail,
        contactName,
        subject: parsed.subject || null,
        body: parsed.body || null,
        isResponse: null, // Parse does not interpret; use /interpret or record
        summary: null,
      },
      contact: contact
        ? {
            id: contact.id,
            name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
            email: contact.email,
            company: contact.companyName,
            title: contact.title,
            pipeline: contact.pipelineSnap,
            optedOut: contact.contactDisposition === 'OPTED_OUT',
          }
        : null,
      emailHistory,
      alreadyIngested,
      nextEngage: {
        aiSuggested: null,
        responseDefault: null,
        currentOnContact: currentNextEngage,
        currentPurpose: contact?.nextEngagementPurpose || null,
        recommended: currentNextEngage,
      },
    });
  } catch (error) {
    console.error('❌ Parse pipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse email',
      },
      { status: 500 }
    );
  }
}
