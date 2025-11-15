import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/workpackages/items/:itemId/collateral
 * Add collateral (artifact) to a work package item
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
    const { itemId } = params || {};
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { collateralType, collateralRefId } = body ?? {};

    if (!collateralType || !collateralRefId) {
      return NextResponse.json(
        { success: false, error: 'collateralType and collateralRefId are required' },
        { status: 400 },
      );
    }

    // Verify item exists
    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'WorkPackageItem not found' },
        { status: 404 },
      );
    }

    // Create collateral
    const collateral = await prisma.collateral.create({
      data: {
        workPackageItemId: itemId,
        collateralType,
        collateralRefId,
      },
    });

    // Update item status if needed
    const allCollateral = await prisma.collateral.findMany({
      where: { workPackageItemId: itemId },
    });

    let newStatus = item.status;
    if (allCollateral.length >= item.quantity) {
      newStatus = 'completed';
    } else if (allCollateral.length > 0 && item.status === 'todo') {
      newStatus = 'in_progress';
    }

    if (newStatus !== item.status) {
      await prisma.workPackageItem.update({
        where: { id: itemId },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({
      success: true,
      collateral,
    });
  } catch (error) {
    console.error('❌ AddCollateral error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add collateral',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workpackages/items/:itemId/collateral/:collateralId
 * Remove collateral from a work package item
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
    const { itemId, collateralId } = params || {};
    if (!itemId || !collateralId) {
      return NextResponse.json(
        { success: false, error: 'itemId and collateralId are required' },
        { status: 400 },
      );
    }

    // Verify collateral belongs to item
    const collateral = await prisma.collateral.findUnique({
      where: { id: collateralId },
    });

    if (!collateral || collateral.workPackageItemId !== itemId) {
      return NextResponse.json(
        { success: false, error: 'Collateral not found' },
        { status: 404 },
      );
    }

    // Delete collateral
    await prisma.collateral.delete({
      where: { id: collateralId },
    });

    // Update item status if needed
    const item = await prisma.workPackageItem.findUnique({
      where: { id: itemId },
    });

    const remainingCollateral = await prisma.collateral.findMany({
      where: { workPackageItemId: itemId },
    });

    let newStatus = item.status;
    if (remainingCollateral.length === 0) {
      newStatus = 'todo';
    } else if (remainingCollateral.length < item.quantity) {
      newStatus = 'in_progress';
    }

    if (newStatus !== item.status) {
      await prisma.workPackageItem.update({
        where: { id: itemId },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Collateral removed',
    });
  } catch (error) {
    console.error('❌ RemoveCollateral error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove collateral',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

