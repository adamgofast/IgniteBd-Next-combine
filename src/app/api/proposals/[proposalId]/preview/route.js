import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { calculateProposalTimeline } from '@/lib/services/ProposalTimelineService';

/**
 * POST /api/proposals/:proposalId/preview
 * Calculates timeline preview (phase start/end dates) for a proposal
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params;
    const body = await request.json();
    const { estimatedStart, phases } = body ?? {};

    // If proposalId provided, fetch from database
    let proposal = null;
    if (proposalId && proposalId !== 'new') {
      proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          proposalPhases: {
            include: {
              deliverables: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!proposal) {
        return NextResponse.json(
          { success: false, error: 'Proposal not found' },
          { status: 404 },
        );
      }

      // Convert database phases to calculation format
      const dbPhases = proposal.proposalPhases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        durationWeeks: phase.durationWeeks,
      }));

      const startDate = estimatedStart ? new Date(estimatedStart) : proposal.estimatedStart;
      const timeline = calculateProposalTimeline(startDate, dbPhases);

      return NextResponse.json({
        success: true,
        timeline,
        proposal: {
          id: proposal.id,
          estimatedStart: proposal.estimatedStart,
        },
      });
    }

    // If phases provided in body, use those (for preview before save)
    if (phases && Array.isArray(phases) && estimatedStart) {
      const timeline = calculateProposalTimeline(new Date(estimatedStart), phases);
      return NextResponse.json({
        success: true,
        timeline,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Either proposalId or phases array required' },
      { status: 400 },
    );
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

