import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { convertProposalToDeliverables } from '@/lib/services/ProposalToDeliverablesService';

/**
 * GET /api/proposals/:proposalId
 * Get a single proposal with phases and deliverables
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
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        companyHQ: true,
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        proposalPhases: {
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
            },
            phaseTemplate: true,
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

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ GetProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/proposals/:proposalId
 * Update a proposal (supports partial updates)
 */
export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const existingProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        proposalPhases: {
          include: {
            deliverables: true,
          },
        },
      },
    });

    if (!existingProposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      title,
      contactId,
      companyId,
      estimatedStart,
      purpose,
      status,
      phases, // Full phases array (will replace existing)
      totalPrice,
    } = body ?? {};

    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (contactId !== undefined) updateData.contactId = contactId;
    if (companyId !== undefined) updateData.companyId = companyId;
    if (estimatedStart !== undefined) updateData.estimatedStart = new Date(estimatedStart);
    if (purpose !== undefined) updateData.purpose = purpose;
    if (status !== undefined) updateData.status = status;
    if (totalPrice !== undefined) updateData.totalPrice = totalPrice;

    // Handle phases update (replace all phases)
    if (phases !== undefined && Array.isArray(phases)) {
      // Delete existing phases (cascade will delete deliverables)
      await prisma.proposalPhase.deleteMany({
        where: { proposalId },
      });

      // Create new phases
      updateData.proposalPhases = {
        create: phases.map((phase, index) => ({
          phaseTemplateId: phase.phaseTemplateId || null,
          name: phase.name,
          description: phase.description || null,
          durationWeeks: phase.durationWeeks || 3,
          order: phase.order !== undefined ? phase.order : index + 1,
          deliverables: {
            create: phase.deliverables?.map((deliverable, delIndex) => ({
              deliverableTemplateId: deliverable.deliverableTemplateId || null,
              name: deliverable.name,
              description: deliverable.description || null,
              quantity: deliverable.quantity || 1,
              order: deliverable.order !== undefined ? deliverable.order : delIndex,
            })) || [],
          },
        })),
      };
    }

    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalPhases: {
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
            },
            phaseTemplate: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // If status changed to approved, convert to deliverables
    if (status === 'approved' && existingProposal.status !== 'approved') {
      try {
        await convertProposalToDeliverables(proposalId);
      } catch (conversionError) {
        console.error('⚠️ Failed to convert proposal to deliverables:', conversionError);
        // Don't fail the proposal update if conversion fails
      }
    }

    console.log('✅ Proposal updated:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ UpdateProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/proposals/:proposalId
 * Delete a proposal
 */
export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    await prisma.proposal.delete({
      where: { id: proposalId },
    });

    console.log('✅ Proposal deleted:', proposalId);

    return NextResponse.json({
      success: true,
      message: 'Proposal deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
