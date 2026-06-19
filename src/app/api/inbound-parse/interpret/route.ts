import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { universalEmailParser } from '@/lib/services/universalEmailParser';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import { suggestInboundPipelineMatch } from '@/lib/services/inboundPipelineMatchService';

/**
 * POST /api/inbound-parse/interpret
 *
 * Parse (universal) + AI interpretation — the single preview step before Record Activity.
 * Replaces the old two-step Parse → Interpret flow.
 *
 * Returns:
 *   - parsed + interpretation (AI summary, isResponse, nextEngagementDate, contactEmail, contactName)
 *   - contact: exact email match from DB (or null)
 *   - nameMatches: name-based fallback candidates when no email match
 *   - emailHistory: last 20 activities for matched contact
 *   - alreadyIngested: duplicate check
 *   - nextEngage: AI-suggested + current-on-contact context
 *
 * Body: { inboundEmailId, generatePipelineMatch? }
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
    const generatePipelineMatch = body?.generatePipelineMatch === true;
    const forceReparse = body?.forceReparse === true;
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
    const ownerContext = {
      name: owner?.name || null,
      email: owner?.email || null,
      companyName: company?.companyName || null,
    };

    // ── 1. Universal parse (dumb structural extraction) ──
    const parsed = universalEmailParser({
      from: inbound.from,
      to: inbound.to,
      subject: inbound.subject,
      text: inbound.text,
      html: inbound.html,
      email: inbound.email,
      headers: inbound.headers,
    });

    // ── 2. AI interpretation ──
    const interpreted = await interpretEngagement(
      {
        from: parsed.from,
        fromEmail: parsed.fromEmail,
        fromName: parsed.fromName,
        to: parsed.to,
        toEmail: parsed.toEmail,
        toName: parsed.toName,
        subject: parsed.subject,
        body: parsed.body,
        headers: parsed.headers,
        raw: parsed.raw,
      },
      ownerContext,
    );

    // ── 3. Resolve contact email (same heuristic as parse route) ──
    let contactEmail = interpreted.contactEmail || '';
    if (!contactEmail && ownerEmail) {
      if (parsed.fromEmail?.toLowerCase() !== ownerEmail) {
        contactEmail = parsed.fromEmail || '';
      } else {
        contactEmail = parsed.toEmail || '';
      }
    }
    contactEmail = contactEmail.trim().toLowerCase();

    // ── 4. Contact lookup — exact email match ──
    type ContactRow = {
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
    };

    let contact: ContactRow | null = null;

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
          pipelineSnap: true,
          nextEngagementDate: true,
          nextEngagementPurpose: true,
          lastEngagementDate: true,
          lastEngagementType: true,
          contactDisposition: true,
        },
      });
      if (found) contact = found;
    }

    // ── 5. Name-based fallback search (when no email match) ──
    type NameMatch = {
      id: string;
      name: string;
      email: string | null;
      company: string | null;
      pipelineSnap: string | null;
      pipeline: string | null; // same as pipelineSnap, for API/UI
    };

    let nameMatches: NameMatch[] = [];

    if (!contact && companyHQId) {
      // Candidate name: AI's contactName (may have been extracted from subject)
      const candidateName = (interpreted.contactName || '').trim();

      // Also check subject-as-name heuristic: ≤4 words, no colon, not Re:/Fwd:
      const subject = (inbound.subject || '').trim();
      const subjectLooksLikeName =
        subject &&
        subject.split(/\s+/).length <= 4 &&
        !subject.includes(':') &&
        !/^(re|fwd|fw)\b/i.test(subject);

      const nameToSearch = candidateName || (subjectLooksLikeName ? subject : '');

      if (nameToSearch) {
        const parts = nameToSearch.trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        const orClauses: Array<Record<string, unknown>> = [];
        if (firstName) {
          orClauses.push({ firstName: { contains: firstName, mode: 'insensitive' as const } });
        }
        if (lastName) {
          orClauses.push({ lastName: { contains: lastName, mode: 'insensitive' as const } });
        }
        // Also try full name as firstName search (e.g. if only one word)
        if (nameToSearch.includes(' ')) {
          orClauses.push({ firstName: { contains: nameToSearch, mode: 'insensitive' as const } });
        }

        if (orClauses.length > 0) {
          const candidates = await prisma.contact.findMany({
            where: { crmId: companyHQId, OR: orClauses },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
              pipelineSnap: true,
            },
            take: 5,
          });

          nameMatches = candidates.map((c) => ({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown',
            email: c.email,
            company: c.companyName,
            pipelineSnap: c.pipelineSnap,
            pipeline: c.pipelineSnap, // API shape for UI
          }));
        }
      }
    }

    // ── 6. Email history (for matched contact) ──
    type HistoryRow = {
      id: string;
      date: string;
      subject: string | null;
      body: string | null;
      type: string;
      platform: string | null;
      event: string | null;
      direction: string;
      hasResponse: boolean;
    };

    let emailHistory: HistoryRow[] = [];
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
      if (parsedSubject && !forceReparse) {
        alreadyIngested = activities.some((a) => {
          const existingSubject = (a.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim();
          return existingSubject === parsedSubject && a.platform === 'sendgrid_inbound';
        });
      }
    }

    // ── 7. Next engage context ──
    const currentNextEngage = contact?.nextEngagementDate || null;

    let pipelineMatch = null;
    if (contact && generatePipelineMatch) {
      try {
        const hasSched =
          interpreted.nextEngagementPurpose === 'SCHEDULED_MEETING' &&
          !!interpreted.nextEngagementDate;
        pipelineMatch = await suggestInboundPipelineMatch({
          contactId: contact.id,
          engagement: {
            activityType: interpreted.activityType,
            summary: interpreted.summary || '',
            hasScheduledMeeting: hasSched,
            nextEngagementDate: interpreted.nextEngagementDate || null,
            subject: interpreted.subject || parsed.subject,
            bodySnippet: interpreted.body || parsed.body || null,
          },
        });
      } catch (e) {
        console.warn('interpret pipelineMatch:', (e as Error)?.message);
      }
    }

    return NextResponse.json({
      success: true,
      parsed: {
        contactEmail,
        contactName: interpreted.contactName,
        contactCompany: interpreted.contactCompany ?? null,
        subject: interpreted.subject || parsed.subject || null,
        body: interpreted.body || parsed.body || null,
        isResponse: interpreted.isResponse,
        summary: interpreted.summary,
        nextEngagementDate: interpreted.nextEngagementDate,
        nextEngagementPurpose: interpreted.nextEngagementPurpose ?? null,
        activityType: interpreted.activityType,
        activityDate: interpreted.activityDate,
        priorMeetingDetected: interpreted.priorMeetingDetected,
        priorMeetingDate: interpreted.priorMeetingDate,
      },
      interpretation: interpreted,
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
      nameMatches,
      emailHistory,
      alreadyIngested,
      nextEngage: {
        aiSuggested: interpreted.nextEngagementDate || null,
        aiSuggestedPurpose: interpreted.nextEngagementPurpose ?? null,
        responseDefault: null,
        currentOnContact: currentNextEngage,
        currentPurpose: contact?.nextEngagementPurpose || null,
        recommended: interpreted.nextEngagementDate || currentNextEngage,
      },
      pipelineMatch,
    });
  } catch (error) {
    console.error('❌ Interpret error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to interpret email',
      },
      { status: 500 }
    );
  }
}
