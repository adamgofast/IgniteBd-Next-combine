/**
 * Script to cleanup duplicate companies for an owner
 * Keeps the most recent company, deletes older duplicates
 * Usage: node scripts/cleanup-duplicate-companies.js <firebaseId>
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const firebaseId = process.argv[2];

  if (!firebaseId) {
    console.error('❌ Error: Firebase ID is required');
    console.log('Usage: node scripts/cleanup-duplicate-companies.js <firebaseId>');
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
    console.log(`   Companies found: ${owner.ownedCompanies.length}`);

    if (owner.ownedCompanies.length <= 1) {
      console.log('✅ No duplicates found. Nothing to clean up.');
      return;
    }

    // Keep the most recent one, delete the rest
    const [keepCompany, ...duplicates] = owner.ownedCompanies;

    console.log(`\n📌 Keeping company: ${keepCompany.id}`);
    console.log(`   Name: ${keepCompany.companyName}`);
    console.log(`   Created: ${keepCompany.createdAt.toISOString()}`);

    console.log(`\n🗑️  Deleting ${duplicates.length} duplicate(s):`);

    for (const duplicate of duplicates) {
      console.log(`   - ${duplicate.id} (${duplicate.companyName}, created: ${duplicate.createdAt.toISOString()})`);
      
      await prisma.companyHQ.delete({
        where: { id: duplicate.id },
      });
      
      console.log(`     ✅ Deleted`);
    }

    console.log(`\n✅ Cleanup complete! Owner now has 1 company.`);
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
