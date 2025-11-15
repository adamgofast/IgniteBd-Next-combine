import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateProposalTimeline } from '@/lib/services/ProposalTimelineService';

/**
 * POST /api/proposals/new/preview
 * Calculates timeline preview for a proposal before saving
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { estimatedStart, phases } = body ?? {};

    if (!estimatedStart) {
      return NextResponse.json(
        { success: false, error: 'estimatedStart is required' },
        { status: 400 },
      );
    }

    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      return NextResponse.json(
        { success: false, error: 'phases array is required' },
        { status: 400 },
      );
    }

    const timeline = calculateProposalTimeline(new Date(estimatedStart), phases);

    return NextResponse.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error('❌ PreviewProposalTimeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate timeline',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

