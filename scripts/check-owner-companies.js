/**
 * Script to check all companies for an owner
 * Usage: node scripts/check-owner-companies.js <firebaseId>
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const firebaseId = process.argv[2];

  if (!firebaseId) {
    console.error('❌ Error: Firebase ID is required');
    console.log('Usage: node scripts/check-owner-companies.js <firebaseId>');
    process.exit(1);
  }

  console.log(`🔍 Finding owner with Firebase ID: ${firebaseId}`);

  try {
    const owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        ownedCompanies: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!owner) {
      console.error(`❌ Owner not found for Firebase ID: ${firebaseId}`);
      process.exit(1);
    }

    console.log(`✅ Found owner: ${owner.name || owner.email} (${owner.id})`);
    console.log(`\n📊 Companies (${owner.ownedCompanies.length}):`);
    console.log('─'.repeat(80));

    owner.ownedCompanies.forEach((company, index) => {
      console.log(`\n${index + 1}. Company ID: ${company.id}`);
      console.log(`   Name: ${company.companyName}`);
      console.log(`   What You Do: ${company.whatYouDo || 'N/A'}`);
      console.log(`   Website: ${company.companyWebsite || 'N/A'}`);
      console.log(`   Created: ${company.createdAt.toISOString()}`);
      console.log(`   Updated: ${company.updatedAt.toISOString()}`);
    });

    if (owner.ownedCompanies.length > 1) {
      console.log(`\n⚠️  WARNING: Owner has ${owner.ownedCompanies.length} companies!`);
      console.log('   Consider consolidating or deleting duplicates.');
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
