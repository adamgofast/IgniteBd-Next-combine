import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * WorkPackage Route - Simple container for name/strings
 * Artifacts attach via their own models (clientBlogId, etc.)
 */

/**
 * POST /api/workpackages
 * Create or update WorkPackage (upsert)
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
      id, // If provided, update existing
      contactId,
      contactCompanyId,
      companyHQId,
      title,
      description,
      status = 'ACTIVE',
    } = body ?? {};

    if (!contactId || !title) {
      return NextResponse.json(
        { success: false, error: 'contactId and title are required' },
        { status: 400 },
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Upsert WorkPackage (simple container)
    const workPackage = id
      ? await prisma.workPackage.update({
          where: { id },
          data: {
            title,
            description: description || null,
            status,
          },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            items: true,
          },
        })
      : await prisma.workPackage.create({
          data: {
            contactId,
            contactCompanyId: contactCompanyId || null,
            companyHQId: companyHQId || contact.crmId || null,
            title,
            description: description || null,
            status,
          },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            items: true,
          },
        });

    console.log('✅ WorkPackage saved:', workPackage.id);

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ SaveWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workpackages?id=xxx OR ?contactId=xxx
 * Get WorkPackage(s) - simple container data
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
    const id = searchParams.get('id');
    const contactId = searchParams.get('contactId');
    const companyHQId = searchParams.get('companyHQId');

    if (id) {
      // Get single WorkPackage
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
          contactCompany: {
            select: {
              id: true,
              companyName: true,
            },
          },
          items: true,
        },
      });

      if (!workPackage) {
        return NextResponse.json(
          { success: false, error: 'WorkPackage not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        workPackage,
      });
    }

    // List WorkPackages
    const where = {};
    if (contactId) where.contactId = contactId;
    if (companyHQId) where.companyHQId = companyHQId;

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
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      workPackages,
    });
  } catch (error) {
    console.error('❌ GetWorkPackages error:', error);
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
