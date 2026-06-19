import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/inbound-parse
 * 
 * Get all InboundEmail records (raw ingestion bucket).
 * Returns emails received via SendGrid Inbound Parse.
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
    const companyHQId = searchParams.get('companyHQId');
    const tabRaw = (searchParams.get('tab') || 'inbox').trim().toLowerCase();
    const tab = ['inbox', 'recorded', 'failed', 'all'].includes(tabRaw) ? tabRaw : 'inbox';
    const daysParam = searchParams.get('days');
    const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Inbox = RECEIVED. Saved = RECORDED. Failed = FAILED (bulk/errors). All = no status filter.
    const statusFilter =
      tab === 'inbox'
        ? { ingestionStatus: 'RECEIVED' }
        : tab === 'recorded'
          ? { ingestionStatus: 'RECORDED' }
          : tab === 'failed'
            ? { ingestionStatus: 'FAILED' }
            : {};

    const inboundEmails = await prisma.inboundEmail.findMany({
      where: {
        OR: [{ inboundType: 'OUTREACH' }, { inboundType: null }],
        createdAt: { gte: since },
        ...(companyHQId && { companyHQId }),
        ...statusFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      emails: inboundEmails,
      count: inboundEmails.length,
    });
  } catch (error) {
    console.error('❌ Get inbound parse emails error:', error);
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
