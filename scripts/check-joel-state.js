/**
 * Check Joel's state to see what he has
 * Run: node scripts/check-joel-state.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJoelState() {
  try {
    // Find Joel by email
    const contact = await prisma.contact.findFirst({
      where: {
        email: {
          contains: 'joel.gulick',
          mode: 'insensitive',
        },
      },
      include: {
        contactCompany: true,
      },
    });

    if (!contact) {
      console.log('❌ Joel not found');
      return;
    }

    console.log('✅ Found Joel:', {
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      firebaseUid: contact.firebaseUid,
      contactCompanyId: contact.contactCompanyId,
      companyName: contact.contactCompany?.companyName,
    });

    // Check proposals
    const proposals = contact.contactCompanyId
      ? await prisma.proposal.findMany({
          where: {
            companyId: contact.contactCompanyId,
          },
          select: {
            id: true,
            clientCompany: true,
            status: true,
            purpose: true,
          },
        })
      : [];

    console.log('\n📋 Proposals:', proposals.length);
    proposals.forEach((p) => {
      console.log(`  - ${p.clientCompany} (${p.status}): ${p.id}`);
    });

    // Check deliverables
    const deliverables = await prisma.consultantDeliverable.findMany({
      where: { contactId: contact.id },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
      },
    });

    console.log('\n📦 Deliverables:', deliverables.length);
    deliverables.forEach((d) => {
      console.log(`  - ${d.title} (${d.status}, ${d.type || 'no type'}): ${d.id}`);
    });

    // Determine what Joel needs
    const hasApprovedProposals = proposals.some((p) => p.status === 'approved');
    const hasDeliverables = deliverables.length > 0;
    const workHasBegun = hasApprovedProposals || hasDeliverables;

    console.log('\n🎯 State:');
    console.log(`  - Has approved proposals: ${hasApprovedProposals}`);
    console.log(`  - Has deliverables: ${hasDeliverables}`);
    console.log(`  - Work has begun: ${workHasBegun}`);
    console.log(`  - Would route to: ${workHasBegun ? '/dashboard' : '/onboarding'}`);

    if (!workHasBegun) {
      console.log('\n💡 To see dashboard, Joel needs:');
      if (proposals.length > 0) {
        console.log(`  - Approve a proposal (or create deliverables)`);
      } else {
        console.log(`  - Create a proposal and approve it (or create deliverables)`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJoelState();

