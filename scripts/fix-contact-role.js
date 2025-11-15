const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing NULL role values...');
  const result = await prisma.$executeRaw`
    UPDATE contacts SET role = 'contact' WHERE role IS NULL;
  `;
  console.log(`Updated ${result} contacts`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

