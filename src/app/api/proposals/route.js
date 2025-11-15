import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/proposals
 * Creates a new proposal with phases and deliverables
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
      companyHQId,
      title,
      contactId,
      companyId,
      estimatedStart,
      purpose,
      status = 'draft',
      phases, // Array of phase objects with deliverables
      totalPrice,
    } = body ?? {};

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!title || !contactId || !companyId || !estimatedStart) {
      return NextResponse.json(
        { success: false, error: 'title, contactId, companyId, and estimatedStart are required' },
        { status: 400 },
      );
    }

    // Verify contact and company exist
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Create proposal with phases and deliverables
    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        title,
        contactId,
        companyId,
        estimatedStart: new Date(estimatedStart),
        purpose: purpose || null,
        status,
        totalPrice: totalPrice || null,
        dateIssued: new Date(),
        proposalPhases: {
          create: phases?.map((phase, index) => ({
            phaseTemplateId: phase.phaseTemplateId || null,
            name: phase.name,
            description: phase.description || null,
            durationWeeks: phase.durationWeeks || 3,
            order: phase.order !== undefined ? phase.order : index + 1,
            deliverables: {
              create: phase.deliverables?.map((deliverable, delIndex) => ({
                deliverableTemplateId: deliverable.deliverableTemplateId || null,
                name: deliverable.name,
                description: deliverable.description || null,
                quantity: deliverable.quantity || 1,
                order: deliverable.order !== undefined ? deliverable.order : delIndex,
              })) || [],
            },
          })) || [],
        },
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
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalPhases: {
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
            },
            phaseTemplate: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log('✅ Proposal created:', proposal.id);

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ CreateProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/proposals
 * List proposals for a companyHQ
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
    const companyHQId = searchParams.get('companyHQId');
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const where = {
      companyHQId,
    };

    if (status) {
      where.status = status;
    }

    if (contactId) {
      where.contactId = contactId;
    }

    const proposals = await prisma.proposal.findMany({
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
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalPhases: {
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      proposals,
    });
  } catch (error) {
    console.error('❌ ListProposals error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list proposals',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
