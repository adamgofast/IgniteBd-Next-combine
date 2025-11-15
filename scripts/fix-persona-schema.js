const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPersonas() {
  try {
    // Check current structure - use 'name' if it exists, otherwise set defaults
    const personas = await prisma.$queryRaw`
      SELECT * FROM personas LIMIT 1;
    `;
    console.log('Current persona structure:', personas);

    // Fix personas with NULL title - use existing 'name' or set default
    const updated = await prisma.$executeRaw`
      UPDATE personas 
      SET title = COALESCE(title, name, 'Untitled Persona')
      WHERE title IS NULL;
    `;
    console.log(`✅ Updated ${updated} personas with title`);

    console.log('✅ Persona schema fixes complete');
  } catch (error) {
    console.error('❌ Error fixing personas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPersonas();
