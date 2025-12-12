/**
 * Script to create or find owner for a Firebase ID
 * Usage: node scripts/create-owner-for-firebase.js <firebaseId> [email] [name]
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const firebaseId = process.argv[2];
  const email = process.argv[3] || null;
  const name = process.argv[4] || null;

  if (!firebaseId) {
    console.error('❌ Error: Firebase ID is required');
    console.log('Usage: node scripts/create-owner-for-firebase.js <firebaseId> [email] [name]');
    process.exit(1);
  }

  console.log(`🔍 Checking for owner with Firebase ID: ${firebaseId}`);

  try {
    // Check if owner exists
    let owner = await prisma.owner.findUnique({
      where: { firebaseId },
      include: {
        ownedCompanies: true,
      },
    });

    if (owner) {
      console.log('✅ Owner found!');
      console.log(`   ID: ${owner.id}`);
      console.log(`   Name: ${owner.name || 'N/A'}`);
      console.log(`   Email: ${owner.email || 'N/A'}`);
      console.log(`   Companies: ${owner.ownedCompanies.length}`);
      
      if (owner.ownedCompanies.length > 0) {
        console.log(`   Company IDs: ${owner.ownedCompanies.map(c => c.id).join(', ')}`);
      }
    } else {
      console.log('⚠️  Owner not found. Creating new owner...');
      
      // Create owner
      owner = await prisma.owner.create({
        data: {
          firebaseId,
          email: email || null,
          name: name || null,
        },
        include: {
          ownedCompanies: true,
        },
      });

      console.log('✅ Owner created successfully!');
      console.log(`   ID: ${owner.id}`);
      console.log(`   Name: ${owner.name || 'N/A'}`);
      console.log(`   Email: ${owner.email || 'N/A'}`);
    }

    return owner;
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
