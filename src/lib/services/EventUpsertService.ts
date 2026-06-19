import { prisma } from "@/lib/prisma";
import { EventSuggestionSchema } from "@/lib/schemas/EventSuggestionSchema";

export async function saveEvent(eventSuggestion: any, userId: string) {
  // 1. Validate + parse + normalize AI result
  const parsed = EventSuggestionSchema.parse(eventSuggestion);

  const saved = await prisma.savedEvent.create({
    data: {
      userId,

      eventName: parsed.eventName,
      eventSeriesName: parsed.eventSeriesName,
      organizerName: parsed.organizerName,
      producerType: parsed.producerType,

      city: parsed.city,
      stateOrRegion: parsed.stateOrRegion,

      startDate: parsed.startDate,
      endDate: parsed.endDate,

      costMin: parsed.cost.min,
      costMax: parsed.cost.max,
      currency: parsed.cost.currency,

      personaAlignment: parsed.personaAlignment,

      url: parsed.url ?? null,

      rawJson: parsed,
    },
  });

  return saved;
}

