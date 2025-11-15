import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * WorkPackageItem Route
 * Items attach artifact IDs (blogIds, personaIds, etc.)
 * Artifacts are created via their own builders/routes
 */

/**
 * POST /api/workpackages/items
 * Create WorkPackageItem
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
      workPackageId,
      deliverableName,
      type,
      quantity = 1,
    } = body ?? {};

    if (!workPackageId || !deliverableName || !type) {
      return NextResponse.json(
        { success: false, error: 'workPackageId, deliverableName, and type are required' },
        { status: 400 },
      );
    }

    const item = await prisma.workPackageItem.create({
      data: {
        workPackageId,
        deliverableName,
        type,
        quantity,
        blogIds: [],
        personaIds: [],
        templateIds: [],
        eventPlanIds: [],
        cleDeckIds: [],
        landingPageIds: [],
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('❌ CreateWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
