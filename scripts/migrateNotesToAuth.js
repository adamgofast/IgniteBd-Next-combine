/**
 * Script: migrateNotesToAuth.js
 * Purpose: Move firebaseUid + portalUrl data out of notes JSON into proper Prisma fields
 * 
 * Run: node scripts/migrateNotesToAuth.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding contacts with notes...');
  
  const contacts = await prisma.contact.findMany({
    where: {
      notes: { not: null },
    },
  });

  console.log(`Found ${contacts.length} contacts with notes.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const c of contacts) {
    try {
      const data = JSON.parse(c.notes || '{}');
      const auth = data.clientPortalAuth;
      
      if (auth?.firebaseUid) {
        // Extract other notes data (keep everything except clientPortalAuth)
        const { clientPortalAuth, ...otherNotes } = data;
        
        // Clean notes - remove clientPortalAuth, keep rest
        const cleanedNotes = Object.keys(otherNotes).length > 0 ? JSON.stringify(otherNotes) : null;
        
        await prisma.contact.update({
          where: { id: c.id },
          data: {
            firebaseUid: auth.firebaseUid,
            clientPortalUrl: auth.portalUrl || 'https://clientportal.ignitegrowth.biz',
            notes: cleanedNotes, // Clean notes - remove clientPortalAuth JSON
            updatedAt: new Date(),
          },
        });
        console.log(`✅ Migrated ${c.email || c.id} - firebaseUid: ${auth.firebaseUid.substring(0, 8)}... (cleaned notes)`);
        migrated++;
      }
    } catch (err) {
      console.warn(`⚠️  Skipped bad JSON for ${c.id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n🎯 Migration complete.`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

