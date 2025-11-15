import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/workpackages/items/:itemId/remove-artifact
 * Remove an artifact ID from the appropriate array field
 * Body: { type: "BLOG", artifactId: "xxxx" }
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
    const { itemId } = params || {};
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { type, artifactId } = body ?? {};

    if (!type || !artifactId) {
      return NextResponse.json(
        { success: false, error: 'type and artifactId are required' },
        { status: 400 },
      );
    }

    // Get current item
    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    // Get current array and remove artifact
    const currentArray = getCurrentArray(item, type);
    const newArray = currentArray.filter((id) => id !== artifactId);

    if (currentArray.length === newArray.length) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found in item' },
        { status: 404 },
      );
    }

    // Update the appropriate array field
    const updateData = {};
    updateData[getArrayFieldName(type)] = newArray;

    const updatedItem = await prisma.workPackageItem.update({
      where: { id: itemId },
      data: updateData,
    });

    console.log('✅ Artifact removed from WorkPackageItem:', itemId);

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error('❌ RemoveArtifact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove artifact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

function getCurrentArray(item, type) {
  switch (type) {
    case 'BLOG':
      return item.blogIds || [];
    case 'PERSONA':
      return item.personaIds || [];
    case 'OUTREACH_TEMPLATE':
      return item.templateIds || [];
    case 'EVENT_CLE_PLAN':
      return item.eventPlanIds || [];
    case 'CLE_DECK':
      return item.cleDeckIds || [];
    case 'LANDING_PAGE':
      return item.landingPageIds || [];
    default:
      return [];
  }
}

function getArrayFieldName(type) {
  switch (type) {
    case 'BLOG':
      return 'blogIds';
    case 'PERSONA':
      return 'personaIds';
    case 'OUTREACH_TEMPLATE':
      return 'templateIds';
    case 'EVENT_CLE_PLAN':
      return 'eventPlanIds';
    case 'CLE_DECK':
      return 'cleDeckIds';
    case 'LANDING_PAGE':
      return 'landingPageIds';
    default:
      return null;
  }
}

