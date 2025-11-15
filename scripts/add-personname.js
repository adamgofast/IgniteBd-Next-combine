const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPersonName() {
  try {
    // Add personName column if it doesn't exist, populate from name
    await prisma.$executeRaw`
      ALTER TABLE personas 
      ADD COLUMN IF NOT EXISTS "personName" TEXT;
    `;
    console.log('✅ Added personName column');

    // Populate personName from name
    const updated = await prisma.$executeRaw`
      UPDATE personas 
      SET "personName" = COALESCE(name, 'Unknown Person')
      WHERE "personName" IS NULL;
    `;
    console.log(`✅ Updated ${updated} personas with personName`);

    console.log('✅ personName column setup complete');
  } catch (error) {
    console.error('❌ Error adding personName:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addPersonName();
