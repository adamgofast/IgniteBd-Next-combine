/**
 * Script to upsert a company for an owner
 * Usage: node scripts/upsert-company-for-owner.js <firebaseId> <companyName> [whatYouDo] [website]
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const firebaseId = process.argv[2];
  const companyName = process.argv[3];
  const whatYouDo = process.argv[4] || 'Business development and growth services';
  const website = process.argv[5] || null;

  if (!firebaseId || !companyName) {
    console.error('❌ Error: Firebase ID and company name are required');
    console.log('Usage: node scripts/upsert-company-for-owner.js <firebaseId> <companyName> [whatYouDo] [website]');
    process.exit(1);
  }

  console.log(`🔍 Finding owner with Firebase ID: ${firebaseId}`);

  try {
    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        ownedCompanies: true,
      },
    });

    if (!owner) {
      console.error(`❌ Owner not found for Firebase ID: ${firebaseId}`);
      process.exit(1);
    }

    console.log(`✅ Found owner: ${owner.name || owner.email} (${owner.id})`);
    console.log(`   Current companies: ${owner.ownedCompanies.length}`);

    // Check if owner already has a company (any company)
    const existingCompany = await prisma.companyHQ.findFirst({
      where: {
        ownerId: owner.id,
      },
    });

    if (existingCompany) {
      console.log(`⚠️  Company "${companyName}" already exists (ID: ${existingCompany.id})`);
      console.log('   Updating company...');
      
      const updated = await prisma.companyHQ.update({
        where: { id: existingCompany.id },
        data: {
          companyName,
          whatYouDo: whatYouDo || null,
          companyWebsite: website || null,
        },
      });

      console.log(`✅ Company updated!`);
      console.log(`   ID: ${updated.id}`);
      console.log(`   Name: ${updated.companyName}`);
      console.log(`   Website: ${updated.companyWebsite || 'N/A'}`);
    } else {
      console.log(`📝 Creating new company: "${companyName}"`);
      
      const company = await prisma.companyHQ.create({
        data: {
          companyName,
          whatYouDo: whatYouDo || null,
          companyWebsite: website || null,
          teamSize: 'just-me',
          ownerId: owner.id,
        },
      });

      console.log(`✅ Company created!`);
      console.log(`   ID: ${company.id}`);
      console.log(`   Name: ${company.companyName}`);
      console.log(`   Website: ${company.companyWebsite || 'N/A'}`);
      console.log(`   Owner ID: ${company.ownerId}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
