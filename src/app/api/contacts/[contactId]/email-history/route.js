import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/contacts/[contactId]/email-history
 * Get combined email history (platform + off-platform sends)
 * Returns sorted timeline of all email sends
 */
export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Single table: all sends (platform + off-platform) in email_activities
    const allSends = await prisma.email_activities.findMany({
      where: { contact_id: contactId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        sentAt: true,
        subject: true,
        email: true,
        body: true,
        emailRawText: true,
        summary: true,
        event: true,
        campaign_id: true,
        source: true,
        platform: true,
        responseFromEmail: true,
        emailSequenceOrder: true,
      },
    });

    const respIds = allSends.map(s => s.responseFromEmail).filter(Boolean);
    const respRows = respIds.length
      ? await prisma.email_activities.findMany({
          where: { id: { in: respIds } },
          select: { id: true, body: true, subject: true, sentAt: true },
        })
      : [];
    const respMap = new Map(respRows.map(r => [r.id, r]));

    const drafts = allSends.filter(s => s.source === 'OFF_PLATFORM' && !s.sentAt);
    const sent = allSends.filter(s => s.event === 'sent' || (s.source === 'OFF_PLATFORM' && s.sentAt));

    const activities = allSends.map(send => {
      const resp = send.responseFromEmail ? respMap.get(send.responseFromEmail) : null;
      const isDraft = send.source === 'OFF_PLATFORM' && !send.sentAt;
      const date = (send.sentAt ?? send.createdAt).toISOString();
      return {
        id: send.id,
        type: send.source === 'OFF_PLATFORM' ? (isDraft ? 'draft' : 'off-platform') : 'platform',
        isDraft,
        date,
        subject: send.subject,
        email: send.email,
        event: send.event,
        campaignId: send.campaign_id,
        platform: send.platform,
        notes: send.body,
        body: send.body,
        emailRawText: send.emailRawText ?? null,
        summary: send.summary,
        sequenceOrder: send.emailSequenceOrder,
        hasResponded: !!send.responseFromEmail,
        contactResponse: resp?.body ?? null,
        respondedAt: resp?.sentAt?.toISOString() ?? null,
        responseSubject: resp?.subject ?? null,
      };
    }).sort((a, b) => {
      if (a.isDraft && !b.isDraft) return -1;
      if (!a.isDraft && b.isDraft) return 1;
      return new Date(b.date) - new Date(a.date);
    });

    return NextResponse.json({
      success: true,
      activities,
      totalCount: activities.length,
      platformCount: sent.filter(a => a.type === 'platform').length,
      offPlatformCount: sent.filter(a => a.type === 'off-platform').length,
      draftCount: drafts.length,
    });
  } catch (error) {
    console.error('❌ Get email history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch email history',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
