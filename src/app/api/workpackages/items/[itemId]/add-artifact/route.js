import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * PATCH /api/workpackages/items/:itemId/add-artifact
 * Add an artifact ID to the appropriate array field
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

    // Verify type matches
    if (item.type !== type) {
      return NextResponse.json(
        {
          success: false,
          error: `Type mismatch: item type is ${item.type}, but ${type} was provided`,
        },
        { status: 400 },
      );
    }

    // Verify artifact exists (based on type)
    let artifactExists = false;
    switch (type) {
      case 'BLOG':
        artifactExists = !!(await prisma.blog.findUnique({
          where: { id: artifactId },
        }));
        break;
      case 'PERSONA':
        artifactExists = !!(await prisma.persona.findUnique({
          where: { id: artifactId },
        }));
        break;
      case 'OUTREACH_TEMPLATE':
        artifactExists = !!(await prisma.template.findUnique({
          where: { id: artifactId },
        }));
        break;
      case 'EVENT_CLE_PLAN':
        artifactExists = !!(await prisma.eventPlan.findUnique({
          where: { id: artifactId },
        }));
        break;
      case 'CLE_DECK':
        artifactExists = !!(await prisma.cleDeck.findUnique({
          where: { id: artifactId },
        }));
        break;
      case 'LANDING_PAGE':
        artifactExists = !!(await prisma.landingPage.findUnique({
          where: { id: artifactId },
        }));
        break;
    }

    if (!artifactExists) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 },
      );
    }

    // Update the appropriate array field
    const updateData = {};
    switch (type) {
      case 'BLOG':
        updateData.blogIds = { push: artifactId };
        break;
      case 'PERSONA':
        updateData.personaIds = { push: artifactId };
        break;
      case 'OUTREACH_TEMPLATE':
        updateData.templateIds = { push: artifactId };
        break;
      case 'EVENT_CLE_PLAN':
        updateData.eventPlanIds = { push: artifactId };
        break;
      case 'CLE_DECK':
        updateData.cleDeckIds = { push: artifactId };
        break;
      case 'LANDING_PAGE':
        updateData.landingPageIds = { push: artifactId };
        break;
    }

    // Prisma doesn't support push directly, so we need to get current array and update
    const currentArray = getCurrentArray(item, type);
    if (currentArray.includes(artifactId)) {
      return NextResponse.json(
        { success: false, error: 'Artifact already in item' },
        { status: 400 },
      );
    }

    const newArray = [...currentArray, artifactId];
    updateData[getArrayFieldName(type)] = newArray;

    const updatedItem = await prisma.workPackageItem.update({
      where: { id: itemId },
      data: updateData,
    });

    console.log('✅ Artifact added to WorkPackageItem:', itemId);

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error('❌ AddArtifact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add artifact',
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

