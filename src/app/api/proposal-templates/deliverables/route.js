import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposal-templates/deliverables
 * Create a new deliverable template
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
    const { companyHQId, name, description, defaultQuantity } = body ?? {};

    if (!companyHQId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and name are required' },
        { status: 400 },
      );
    }

    const deliverableTemplate = await prisma.deliverableTemplate.create({
      data: {
        companyHQId,
        name,
        description: description || null,
        defaultQuantity: defaultQuantity || 1,
      },
    });

    return NextResponse.json({
      success: true,
      deliverable: deliverableTemplate,
    });
  } catch (error) {
    console.error('❌ CreateDeliverableTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create deliverable template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

