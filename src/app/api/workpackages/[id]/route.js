import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/WorkPackageHydrationService';

/**
 * GET /api/workpackages/:id
 * Load WorkPackage with items + artifacts (hydrated)
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
    // Handle Next.js 15 async params
    const resolvedParams = params && typeof params.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        phases: {
          include: {
            items: {
              include: {
                collateral: true,
          },
            },
          },
          orderBy: { position: 'asc' },
        },
        items: {
          include: {
            collateral: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    // Hydrate with artifacts and progress
    const hydrated = await hydrateWorkPackage(workPackage);

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ GetWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workpackages/:id
 * Update WorkPackage status or metadata
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
    // Handle Next.js 15 async params
    const resolvedParams = params && typeof params.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    // WorkPackage is now just a container - no fields to update
    // Use phases/items routes for updates
    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        phases: {
          include: {
            items: {
              include: {
                collateral: true,
          },
            },
          },
          orderBy: { position: 'asc' },
        },
        items: {
          include: {
            collateral: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Hydrate with artifacts and progress
    const hydrated = await hydrateWorkPackage(workPackage);

    console.log('✅ WorkPackage updated:', workPackage.id);

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ UpdateWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workpackages/:id
 * Delete a WorkPackage and all related phases/items
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
    // Handle Next.js 15 async params
    const resolvedParams = params && typeof params.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage ID is required' },
        { status: 400 },
      );
    }

    // Delete WorkPackage (cascade will delete phases and items)
    await prisma.workPackage.delete({
      where: { id },
    });

    console.log('✅ WorkPackage deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'WorkPackage deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

