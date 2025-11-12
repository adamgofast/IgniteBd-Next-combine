import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { convertProposalToDeliverables } from '@/lib/services/ProposalToDeliverablesService';

/**
 * Approve a proposal
 * POST /api/proposals/:proposalId/approve
 * 
 * This endpoint:
 * 1. Updates proposal status to "approved"
 * 2. Triggers conversion to deliverables via ProposalToDeliverablesService
 * 3. Returns proposal with created deliverables
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
    const { proposalId } = params || {};
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 },
      );
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: {
          include: {
            contacts: {
              take: 1,
            },
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 },
      );
    }

    if (proposal.status === 'approved') {
      return NextResponse.json(
        { success: false, error: 'Proposal is already approved' },
        { status: 400 },
      );
    }

    // Update proposal status to approved
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'approved' },
      include: {
        companyHQ: true,
        company: true,
      },
    });

    // Convert proposal to deliverables
    let conversionResult = null;
    try {
      conversionResult = await convertProposalToDeliverables(proposalId);
      console.log('✅ Proposal approved and converted to deliverables:', conversionResult);
    } catch (conversionError) {
      console.error('❌ Failed to convert proposal to deliverables:', conversionError);
      // Return proposal even if conversion fails
      // Deliverables can be created manually later
      return NextResponse.json({
        success: true,
        proposal: updatedProposal,
        conversionError: conversionError.message,
        message: 'Proposal approved but deliverables conversion failed. You can create deliverables manually.',
      });
    }

    // Fetch deliverables that were created
    const deliverables = await prisma.consultantDeliverable.findMany({
      where: { proposalId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Automatically generate portal access for the primary contact
    let portalAccessResult = null;
    try {
      if (proposal.company?.contacts && proposal.company.contacts.length > 0) {
        const primaryContact = proposal.company.contacts[0];
        
        if (primaryContact.email) {
          // Generate portal access using Firebase
          const admin = getFirebaseAdmin();
          if (admin) {
            const auth = admin.auth();
            let firebaseUser;
            
            try {
              // Try to get existing user by email
              try {
                firebaseUser = await auth.getUserByEmail(primaryContact.email);
              } catch (error) {
                // User doesn't exist - create new
                firebaseUser = await auth.createUser({
                  email: primaryContact.email,
                  displayName: `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || primaryContact.email,
                  emailVerified: false,
                  disabled: false,
                });
              }

              // Generate password reset link
              const resetLink = await auth.generatePasswordResetLink(primaryContact.email);
              
              // Store Firebase UID in Contact notes
              const existingNotes = primaryContact.notes ? JSON.parse(primaryContact.notes) : {};
              await prisma.contact.update({
                where: { id: primaryContact.id },
                data: {
                  notes: JSON.stringify({
                    ...existingNotes,
                    clientPortalAuth: {
                      firebaseUid: firebaseUser.uid,
                      generatedAt: new Date().toISOString(),
                      portalUrl: process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'http://localhost:3001',
                      generatedFromProposal: proposalId,
                    },
                  }),
                },
              });

              portalAccessResult = {
                success: true,
                contactId: primaryContact.id,
                contactEmail: primaryContact.email,
                passwordResetLink: resetLink,
                loginUrl: `${process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'http://localhost:3001'}/login`,
              };
              
              console.log('✅ Portal access generated for contact:', primaryContact.email);
            } catch (firebaseError) {
              console.error('❌ Failed to generate portal access:', firebaseError);
              portalAccessResult = {
                success: false,
                error: firebaseError.message,
              };
            }
          }
        }
      }
    } catch (portalError) {
      console.error('❌ Portal access generation error (non-blocking):', portalError);
      // Don't fail the approval if portal generation fails
      portalAccessResult = {
        success: false,
        error: portalError.message,
      };
    }

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      conversion: conversionResult,
      deliverables,
      portalAccess: portalAccessResult,
      message: `Proposal approved. Created ${deliverables.length} deliverables.${portalAccessResult?.success ? ' Portal access generated for client.' : ''}`,
    });
  } catch (error) {
    console.error('❌ ApproveProposal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to approve proposal',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

