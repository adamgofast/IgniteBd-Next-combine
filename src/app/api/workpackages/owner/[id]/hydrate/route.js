import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/WorkPackageHydrationService';

/**
 * GET /api/workpackages/owner/:id/hydrate
 * Owner App WorkPackage hydration - same data as Client Portal but with timeline calculations
 * Returns WorkPackage with phases (aggregated hours), items (status + estimatedHours + label), and artifacts
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
    const { id } = await params;
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
            contactCompany: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        phases: {
          include: {
            items: {
              include: {
                collateral: true,
              },
              orderBy: { createdAt: 'asc' },
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

    // Hydrate with artifacts, phases, and timeline calculations (owner view)
    const hydrated = await hydrateWorkPackage(workPackage, {
      clientView: false,
      includeTimeline: true,
    });

    return NextResponse.json({
      success: true,
      workPackage: hydrated,
    });
  } catch (error) {
    console.error('❌ OwnerWorkPackageHydrate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

