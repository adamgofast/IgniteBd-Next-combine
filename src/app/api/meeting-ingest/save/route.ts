import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { generateMeetingSummaryService } from '@/lib/services/generateMeetingSummaryService';

/**
 * POST /api/meeting-ingest/save
 *
 * Save raw meeting notes to Meeting model with contactId resolution.
 * Body: { rawMeetingNotesId, contactId, meetingDate?, summary?, nextAction?, nextEngagementDate? }
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
    const contactId = body?.contactId;
    const meetingDateOverride = body?.meetingDate; // ISO string
    const summaryOverride = body?.summary;
    const nextActionOverride = body?.nextAction;
    const nextEngagementDateOverride = body?.nextEngagementDate;

    if (!rawMeetingNotesId || typeof rawMeetingNotesId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing rawMeetingNotesId' },
        { status: 400 }
      );
    }
    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing contactId (required to create Meeting)' },
        { status: 400 }
      );
    }

    const raw = await prisma.inboundEmail.findFirst({
      where: { id: rawMeetingNotesId, inboundType: 'MEETING' },
      include: {
        company_hqs: {
          select: {
            id: true,
            ownerId: true,
            contactOwnerId: true,
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

    const companyHQId = raw.companyHQId;
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'Inbound record has no company' },
        { status: 400 }
      );
    }

    const company = raw.company_hqs;
    const ownerId = company?.ownerId ?? company?.contactOwnerId ?? null;
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Company has no owner' },
        { status: 400 }
      );
    }

    // Verify contact belongs to same CRM
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, crmId: companyHQId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found or does not belong to company' },
        { status: 400 }
      );
    }

    const meetingDate = meetingDateOverride
      ? new Date(meetingDateOverride)
      : raw.createdAt;

    const noteText =
      (raw.text || '').trim() ||
      (raw.html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() ||
      null;

    const meeting = await prisma.meeting.create({
      data: {
        contactId,
        ownerId,
        crmId: companyHQId,
        meetingDate,
        meetingType: 'FOLLOW_UP',
        notes: noteText,
        summary: summaryOverride && summaryOverride.trim() ? summaryOverride.trim() : null,
        nextAction: nextActionOverride && nextActionOverride.trim() ? nextActionOverride.trim() : null,
        nextEngagementDate:
          nextEngagementDateOverride && nextEngagementDateOverride.trim()
            ? nextEngagementDateOverride.trim()
            : null,
      },
    });

    if (noteText && noteText.length >= 20 && !summaryOverride?.trim()) {
      try {
        const summary = await generateMeetingSummaryService(noteText);
        if (summary) {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { summary },
          });
        }
      } catch (err) {
        console.warn('⚠️ Meeting summary generation failed:', (err as Error)?.message);
      }
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        lastEngagementDate: meetingDate,
        lastEngagementType: 'MEETING',
        ...(nextEngagementDateOverride?.trim()
          ? {
              nextEngagementDate: nextEngagementDateOverride.trim(),
              nextEngagementPurpose: 'MEETING_FOLLOW_UP',
            }
          : {}),
      },
    });

    await prisma.inboundEmail.update({
      where: { id: rawMeetingNotesId },
      data: { ingestionStatus: 'RECORDED' },
    });

    return NextResponse.json({
      success: true,
      recordId: meeting.id,
      recordType: 'Meeting',
      contactId,
    });
  } catch (error) {
    console.error('❌ Meeting ingest save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save meeting',
      },
      { status: 500 }
    );
  }
}
