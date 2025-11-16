/**
 * Create test deliverables for Joel so he can see the dashboard
 * Run: node scripts/create-joel-deliverables.js
 * 
 * This creates some sample deliverables so Joel sees /dashboard instead of /onboarding
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createJoelDeliverables() {
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
      companyHQId: contact.crmId,
      contactCompanyId: contact.contactCompanyId,
      companyName: contact.contactCompany?.companyName,
    });

    // Create test deliverables for Joel
    const deliverables = [
      {
        contactId: contact.id,
        title: '3 Target Personas',
        description: 'Define and document 3 target personas for outreach',
        category: 'foundation',
        type: 'persona',
        companyHQId: contact.crmId,
        contactCompanyId: contact.contactCompanyId || null,
        status: 'in-progress',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      {
        contactId: contact.id,
        title: 'Blog Content: Lead Generation',
        description: 'Create blog content focused on lead generation strategies',
        category: 'content',
        type: 'blog',
        companyHQId: contact.crmId,
        contactCompanyId: contact.contactCompanyId || null,
        status: 'pending',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      },
      {
        contactId: contact.id,
        title: 'Microsoft Graph OAuth Setup',
        description: 'Set up Microsoft Graph OAuth integration',
        category: 'integration',
        type: 'upload',
        companyHQId: contact.crmId,
        contactCompanyId: contact.contactCompanyId || null,
        status: 'pending',
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      },
    ];

    console.log('\n📦 Creating deliverables...');
    for (const deliverable of deliverables) {
      const created = await prisma.consultantDeliverable.create({
        data: deliverable,
      });
      console.log(`  ✅ Created: ${created.title} (${created.id})`);
    }

    console.log('\n✅ Done! Joel should now see /dashboard instead of /onboarding');
    console.log('   Work has begun = true (has deliverables)');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createJoelDeliverables();


