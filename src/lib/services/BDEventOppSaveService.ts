import { prisma } from "@/lib/prisma";
import { BDEventOppSchema } from "@/lib/schemas/BDEventOppSchema";

export async function saveBDEventOpp(eventOpp: any) {
  const parsed = BDEventOppSchema.parse(eventOpp);

  const saved = await prisma.bdEventopIntel.create({
    data: {
      companyHQId: parsed.companyHQId,
      ownerId: parsed.ownerId,

      name: parsed.name,
      eventSeriesName: parsed.eventSeriesName,
      organizerName: parsed.organizerName,
      producerType: parsed.producerType,

      location: parsed.location,
      city: parsed.city,
      stateOrRegion: parsed.stateOrRegion,

      dateRange: parsed.dateRange,
      startDate: parsed.startDate,
      endDate: parsed.endDate,

      costMin: parsed.costMin,
      costMax: parsed.costMax,
      currency: parsed.currency,

      personaAlignment: parsed.personaAlignment,
      matchSignals: parsed.matchSignals,

      relevanceReason: parsed.relevanceReason,
      url: parsed.url,

      rawJson: parsed.rawJson,
    },
  });

  return saved;
}

