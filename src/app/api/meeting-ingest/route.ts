import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/meeting-ingest
 *
 * List raw meeting notes (from slug.meeting@crm.domain).
 * Default: RECEIVED only (to process). Optional tab=recorded | all, days=7|30|90.
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
    const tab = searchParams.get('tab') || 'inbox';
    const daysParam = searchParams.get('days');
    const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const statusFilter =
      tab === 'inbox'
        ? { ingestionStatus: 'RECEIVED' }
        : tab === 'recorded'
          ? { ingestionStatus: 'RECORDED' }
          : {};

    const notes = await prisma.inboundEmail.findMany({
      where: {
        inboundType: 'MEETING',
        createdAt: { gte: since },
        ...(companyHQId && { companyHQId }),
        ...statusFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      notes,
      count: notes.length,
    });
  } catch (error) {
    console.error('❌ Get meeting ingest notes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch meeting notes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
