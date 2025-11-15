import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/workpackages/items/:itemId/add-artifact
 * Adds artifact ID to the appropriate array
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
    const { itemId } = params;
    const body = await request.json();
    const { type, artifactId, action = 'add' } = body ?? {}; // action: 'add' or 'remove'

    if (!type || !artifactId) {
      return NextResponse.json(
        { success: false, error: 'type and artifactId are required' },
        { status: 400 },
      );
    }

    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    // Map type to array field
    const arrayFieldMap = {
      BLOG: 'blogIds',
      PERSONA: 'personaIds',
      OUTREACH_TEMPLATE: 'templateIds',
      EVENT_CLE_PLAN: 'eventPlanIds',
      CLE_DECK: 'cleDeckIds',
      LANDING_PAGE: 'landingPageIds',
    };

    const arrayField = arrayFieldMap[type];
    if (!arrayField) {
      return NextResponse.json(
        { success: false, error: `Invalid type: ${type}` },
        { status: 400 },
      );
    }

    // Get current array
    const currentArray = item[arrayField] || [];

    // Add or remove artifact ID
    let updatedArray;
    if (action === 'add') {
      updatedArray = currentArray.includes(artifactId)
        ? currentArray
        : [...currentArray, artifactId];
    } else {
      updatedArray = currentArray.filter((id) => id !== artifactId);
    }

    // Update item
    const updated = await prisma.workPackageItem.update({
      where: { id: itemId },
      data: {
        [arrayField]: updatedArray,
      },
    });

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (error) {
    console.error('❌ UpdateWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workpackages/items/:itemId
 * Delete WorkPackageItem
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
    const { itemId } = params;

    await prisma.workPackageItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: 'WorkPackageItem deleted',
    });
  } catch (error) {
    console.error('❌ DeleteWorkPackageItem error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete work package item',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
