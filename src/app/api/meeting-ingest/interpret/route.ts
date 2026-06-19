import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';

/**
 * POST /api/meeting-ingest/interpret
 *
 * Parse + AI interpretation of raw meeting notes.
 * Returns: interpretation (contactEmail, contactName, activityDate, summary), contact match, nameMatches.
 * Body: { rawMeetingNotesId } (inboundEmailId for MEETING-type InboundEmail)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawMeetingNotesId = body?.rawMeetingNotesId;
    if (!rawMeetingNotesId || typeof rawMeetingNotesId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing rawMeetingNotesId' },
        { status: 400 }
      );
    }

    const raw = await prisma.inboundEmail.findFirst({
      where: { id: rawMeetingNotesId, inboundType: 'MEETING' },
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

    if (!raw) {
      return NextResponse.json(
        { success: false, error: 'Meeting ingest record not found' },
        { status: 404 }
      );
    }

    const company = raw.company_hqs;
    const companyHQId = raw.companyHQId;
    const owner = company?.owners_company_hqs_ownerIdToowners;
    const ownerContext = {
      name: owner?.name || null,
      email: owner?.email || null,
      companyName: company?.companyName || null,
    };

    const bodyText =
      (raw.text || '').trim() ||
      (raw.html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const parsed = {
      from: raw.from,
      fromEmail: null as string | null,
      fromName: null as string | null,
      to: raw.to,
      toEmail: null as string | null,
      toName: null as string | null,
      subject: raw.subject,
      body: bodyText,
      headers: null as string | null,
      raw: bodyText.slice(0, 8000),
    };

    const interpreted = await interpretEngagement(parsed, ownerContext);

    let contactEmail = (interpreted.contactEmail || '').trim();
    if (!contactEmail && parsed.from) {
      const m = parsed.from.match(/<([^>]+)>/) || parsed.from.match(/([^\s<>]+@[^\s<>]+)/);
      if (m) contactEmail = m[1].trim();
    }

    type ContactRow = {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      companyName: string | null;
      title: string | null;
      pipelineSnap: string | null;
    };

    let contact: ContactRow | null = null;
    if (contactEmail && companyHQId) {
      const found = await prisma.contact.findFirst({
        where: {
          crmId: companyHQId,
          email: { equals: contactEmail, mode: 'insensitive' },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
          title: true,
          pipelineSnap: true,
        },
      });
      if (found) contact = found;
    }

    type NameMatch = {
      id: string;
      name: string;
      email: string | null;
      company: string | null;
      pipeline: string | null;
    };
    let nameMatches: NameMatch[] = [];

    if (!contact && companyHQId) {
      const candidateName = (interpreted.contactName || '').trim();
      if (candidateName) {
        const parts = candidateName.trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        const orClauses: Array<{ firstName?: { contains: string; mode: 'insensitive' }; lastName?: { contains: string; mode: 'insensitive' } }> = [];
        if (firstName) {
          orClauses.push({ firstName: { contains: firstName, mode: 'insensitive' } });
        }
        if (lastName) {
          orClauses.push({ lastName: { contains: lastName, mode: 'insensitive' } });
        }
        if (candidateName.includes(' ')) {
          orClauses.push({ firstName: { contains: candidateName, mode: 'insensitive' } });
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
            pipeline: c.pipelineSnap,
          }));
        }
      }
    }

    return NextResponse.json({
      success: true,
      parsed: {
        contactEmail,
        contactName: interpreted.contactName,
        subject: interpreted.subject || raw.subject || null,
        summary: interpreted.summary,
        activityDate: interpreted.activityDate,
        nextEngagementDate: interpreted.nextEngagementDate,
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
          }
        : null,
      nameMatches,
    });
  } catch (error) {
    console.error('❌ Meeting ingest interpret error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to interpret meeting notes',
      },
      { status: 500 }
    );
  }
}
