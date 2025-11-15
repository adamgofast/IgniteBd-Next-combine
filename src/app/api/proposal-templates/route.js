import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/proposal-templates
 * Returns all reusable phase & deliverable templates for the authenticated user's CompanyHQ
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
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Fetch all phase templates with their deliverables
    const phaseTemplates = await prisma.phaseTemplate.findMany({
      where: { companyHQId },
      include: {
        phaseDeliverables: {
          include: {
            deliverableTemplate: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch all deliverable templates
    const deliverableTemplates = await prisma.deliverableTemplate.findMany({
      where: { companyHQId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      phases: phaseTemplates,
      deliverables: deliverableTemplates,
    });
  } catch (error) {
    console.error('❌ GetProposalTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch proposal templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/proposal-templates/phases
 * Create a new phase template
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
    const { companyHQId, name, description, defaultDurationWeeks, deliverableIds } = body ?? {};

    if (!companyHQId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and name are required' },
        { status: 400 },
      );
    }

    // Create phase template
    const phaseTemplate = await prisma.phaseTemplate.create({
      data: {
        companyHQId,
        name,
        description: description || null,
        defaultDurationWeeks: defaultDurationWeeks || 3,
        phaseDeliverables: {
          create: deliverableIds?.map((deliverableId, index) => ({
            deliverableTemplateId: deliverableId,
            order: index,
            defaultQuantity: 1,
          })) || [],
        },
      },
      include: {
        phaseDeliverables: {
          include: {
            deliverableTemplate: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      phase: phaseTemplate,
    });
  } catch (error) {
    console.error('❌ CreatePhaseTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create phase template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

