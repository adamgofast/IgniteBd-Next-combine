import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/billing/template
 * Create invoice template from scratch or from existing invoice
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
    const {
      name,
      notes,
      milestones = [], // Array of milestone objects
      fromInvoiceId, // Optional: clone from existing invoice
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Template name is required' },
        { status: 400 },
      );
    }

    // If cloning from invoice, fetch milestones
    let templateMilestones = milestones;
    if (fromInvoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: fromInvoiceId },
        include: {
          milestones: {
            orderBy: { expectedDate: 'asc' },
          },
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { success: false, error: 'Invoice not found' },
          { status: 404 },
        );
      }

      // Convert invoice milestones to template milestones
      templateMilestones = invoice.milestones.map((m) => ({
        label: m.label,
        expectedAmount: m.expectedAmount,
        expectedDate: m.expectedDate,
        description: m.internalNote || null,
      }));
    }

    // Create template with milestones in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create template
      const newTemplate = await tx.invoiceTemplate.create({
        data: {
          name,
          notes: notes || null,
        },
      });

      // Create template milestones
      if (templateMilestones.length > 0) {
        await tx.invoiceTemplateMilestone.createMany({
          data: templateMilestones.map((m) => ({
            templateId: newTemplate.id,
            label: m.label,
            expectedAmount: m.expectedAmount,
            expectedDate: m.expectedDate ? new Date(m.expectedDate) : null,
            description: m.description || null,
          })),
        });
      }

      // Return template with milestones
      return tx.invoiceTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          milestones: {
            orderBy: { expectedDate: 'asc' },
          },
        },
      });
    });

    console.log('✅ Template created:', template.id);

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ Create template error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/billing/template
 * List all templates
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const templates = await prisma.invoiceTemplate.findMany({
      include: {
        milestones: {
          orderBy: { expectedDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        ...t,
        milestoneCount: t.milestones.length,
      })),
    });
  } catch (error) {
    console.error('❌ Get templates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

