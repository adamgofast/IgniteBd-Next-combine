import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/inbound-emails
 * 
 * Get inbound emails for a company (filtered by tenant_id).
 * Returns emails with emailRawText (inbound ingestion).
 */
export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Get recent inbound emails (last 30 days, has emailRawText and platform = sendgrid_inbound)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inboundEmails = await prisma.email_activities.findMany({
      where: {
        tenant_id: tenantId,
        platform: 'sendgrid_inbound',
        emailRawText: { not: null },
        createdAt: { gte: thirtyDaysAgo }, // Last 30 days
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        subject: true,
        body: true,
        email: true,
        contact_id: true,
        emailRawText: true,
        responseFromEmail: true,
        event: true,
        contacts: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      take: 50, // Limit to recent 50
    });

    return NextResponse.json({
      success: true,
      emails: inboundEmails,
      count: inboundEmails.length,
    });
  } catch (error) {
    console.error('❌ Get inbound emails error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch inbound emails',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
