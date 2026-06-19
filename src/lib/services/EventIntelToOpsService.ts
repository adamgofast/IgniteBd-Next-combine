import { prisma } from '@/lib/prisma';

/**
 * Summarize bd_eventop_intel results into bd_event_ops for user selection
 * This service converts AI intelligence into user-facing events
 */
export async function summarizeIntelToOps(
  intelIds: string[],
  companyHQId: string,
  ownerId: string
) {
  // Fetch the intelligence records with their eventMeta
  const intelRecords = await prisma.bdEventopIntel.findMany({
    where: {
      id: { in: intelIds },
      companyHQId,
      ownerId,
    },
    include: {
      event_metas: true,
    },
  });

  // Create bd_event_ops records from intelligence
  const eventOps = await Promise.all(
    intelRecords.map(async (intel) => {
      const eventMeta = intel.event_metas;
      
      // Check if event_op already exists
      const existing = await prisma.bdEventOps.findFirst({
        where: {
          companyHQId,
          ownerId,
          title: eventMeta.name,
          startDate: eventMeta.startDate,
        },
      });

      if (existing) {
        return existing;
      }

      // Create new event_op from intelligence
      return await prisma.bdEventOps.create({
        data: {
          companyHQId,
          ownerId,
          title: eventMeta.name,
          description: (eventMeta.rawJson as any)?.description || null,
          whyGo: intel.notes || `AI Score: ${intel.bdOpportunity || 0}/100`,
          eventType: eventMeta.eventType,
          startDate: eventMeta.startDate,
          endDate: eventMeta.endDate,
          city: eventMeta.city || null,
          state: eventMeta.state || null,
          country: eventMeta.country || null,
          costBand: eventMeta.costMin && eventMeta.costMax
            ? determineCostBand(eventMeta.costMin, eventMeta.costMax)
            : null,
          source: 'PERSONA',
          status: 'CONSIDERING',
        },
      });
    })
  );

  return eventOps;
}

function determineCostBand(costMin: number, costMax: number): string {
  const avg = (costMin + costMax) / 2;
  if (avg === 0) return 'FREE';
  if (avg < 500) return 'LOW';
  if (avg < 2000) return 'MEDIUM';
  if (avg < 5000) return 'HIGH';
  return 'PREMIUM';
}

