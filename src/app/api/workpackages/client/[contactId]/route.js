import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { hydrateWorkPackage } from '@/lib/services/WorkPackageHydrationService';

/**
 * GET /api/workpackages/client/:contactId
 * Client portal view - only shows published artifacts
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
    const { contactId } = params || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 },
      );
    }

    const { searchParams } = request.nextUrl;
    const workPackageId = searchParams.get('workPackageId');

    const where = { contactId };
    if (workPackageId) where.id = workPackageId;

    const workPackages = await prisma.workPackage.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contactCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Hydrate with artifacts (only published ones for client view)
    const hydrated = await Promise.all(
      workPackages.map((wp) => hydrateWorkPackage(wp, { clientView: true })),
    );

    return NextResponse.json({
      success: true,
      workPackages: hydrated,
    });
  } catch (error) {
    console.error('❌ GetClientWorkPackages error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get work packages',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

