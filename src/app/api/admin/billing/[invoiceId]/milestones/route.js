import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PUT /api/admin/billing/:invoiceId/milestones
 * Update milestones for an invoice (replace all)
 */
export async function PUT(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { invoiceId } = await params;
    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { milestones } = body; // Array of milestone objects

    if (!Array.isArray(milestones)) {
      return NextResponse.json(
        { success: false, error: 'milestones must be an array' },
        { status: 400 },
      );
    }

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    // Replace all milestones in a transaction
    const updatedMilestones = await prisma.$transaction(async (tx) => {
      // Delete existing milestones
      await tx.invoiceMilestone.deleteMany({
        where: { invoiceId },
      });

      // Create new milestones
      if (milestones.length > 0) {
        await tx.invoiceMilestone.createMany({
          data: milestones.map((m) => ({
            invoiceId,
            label: m.label,
            expectedAmount: m.expectedAmount,
            expectedDate: m.expectedDate ? new Date(m.expectedDate) : null,
            internalNote: m.internalNote || null,
          })),
        });
      }

      // Return updated milestones
      return tx.invoiceMilestone.findMany({
        where: { invoiceId },
        orderBy: { expectedDate: 'asc' },
      });
    });

    return NextResponse.json({
      success: true,
      milestones: updatedMilestones,
    });
  } catch (error) {
    console.error('❌ Update milestones error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update milestones',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

