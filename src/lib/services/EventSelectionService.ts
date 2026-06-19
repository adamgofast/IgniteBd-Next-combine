/**
 * EventSelectionService
 * 
 * Main service that combines:
 * 1. BD Intelligence signals (persona-based)
 * 2. EventTuner constraints (hard gates)
 * 3. Ranking by persona fit (if personas exist)
 * 
 * Implements the priority overlay: BD events that pass constraints get marked as prioritySource = "BD_INTEL"
 */

import { prisma } from '@/lib/prisma';
import { generatePersonaBDIntelligence, PersonaBDSignal } from './PersonaBDIntelligenceService';
import { filterEventsByTuner, checkEventTunerConstraints } from './EventTunerFilterService';

export interface SelectableEvent {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  startDate?: Date | null;
  endDate?: Date | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  costMin?: number | null;
  costMax?: number | null;
  personaFitScore?: number; // 0-100 if personas exist on tuner
  prioritySource?: 'BD_INTEL' | null; // "BD_INTEL" if from BD intelligence
  bdRationale?: string; // If from BD intelligence
}

/**
 * Generate selectable events from EventTuner
 * 
 * Flow:
 * 1. Get BD Intelligence signals (if personas on tuner)
 * 2. Get all EventMeta candidates
 * 3. Filter by EventTuner constraints (hard gates)
 * 4. Mark BD events that pass constraints as prioritySource = "BD_INTEL"
 * 5. Rank by persona fit (if personas exist)
 */
export async function generateSelectableEvents(
  eventTunerId: string
): Promise<SelectableEvent[]> {
  const tuner = await prisma.event_tuners.findUnique({
    where: { id: eventTunerId },
    include: {
      event_tuner_states: true,
      event_tuner_personas: {
        include: {
          personas: true,
        },
      },
    },
  });

  if (!tuner) {
    throw new Error('EventTuner not found');
  }

  // Step 1: Get BD Intelligence signals (if personas exist)
  let bdSignals: PersonaBDSignal[] = [];
  if (tuner.event_tuner_personas.length > 0) {
    // Use first persona for BD intelligence (could be extended to multiple)
    const personaId = tuner.event_tuner_personas[0].personaId;
    bdSignals = await generatePersonaBDIntelligence(personaId, 10);
  }

  // Step 2: Get EventMeta candidates
  const candidateEvents = await prisma.event_metas.findMany({
    take: 100, // Get a good pool to filter from
    orderBy: { createdAt: 'desc' },
  });

  // Step 3: Filter by EventTuner constraints (hard gates)
  const filteredEvents = await filterEventsByTuner(eventTunerId, candidateEvents);

  // Step 4: Map to SelectableEvent format and mark BD Intelligence priority
  const selectableEvents: SelectableEvent[] = filteredEvents.map((event) => {
    // Check if this event is in BD Intelligence signals
    const bdSignal = bdSignals.find(
      (signal) => signal.eventMetaId === event.id || signal.eventName === event.name
    );

    return {
      id: event.id,
      title: event.name,
      description: null, // EventMeta doesn't have description
      eventType: event.eventType,
      startDate: event.startDate,
      endDate: event.endDate,
      city: event.city,
      state: event.state,
      country: event.country,
      costMin: event.costMin,
      costMax: event.costMax,
      prioritySource: bdSignal ? 'BD_INTEL' : null,
      bdRationale: bdSignal?.bdRationale,
      personaFitScore: bdSignal ? bdSignal.bdScore : undefined,
    };
  });

  // Step 5: Rank by persona fit (if personas exist)
  if (tuner.event_tuner_personas.length > 0 && selectableEvents.length > 0) {
    // Sort by: BD_INTEL first, then by personaFitScore
    selectableEvents.sort((a, b) => {
      // BD_INTEL events first
      if (a.prioritySource === 'BD_INTEL' && b.prioritySource !== 'BD_INTEL') return -1;
      if (b.prioritySource === 'BD_INTEL' && a.prioritySource !== 'BD_INTEL') return 1;
      
      // Then by persona fit score
      const scoreA = a.personaFitScore || 0;
      const scoreB = b.personaFitScore || 0;
      return scoreB - scoreA;
    });
  } else {
    // No personas - sort chronologically
    selectableEvents.sort((a, b) => {
      const dateA = a.startDate?.getTime() || 0;
      const dateB = b.startDate?.getTime() || 0;
      return dateA - dateB;
    });
  }

  return selectableEvents;
}

/**
 * Create bd_event_ops from selectable events
 * User selects events to add to their program
 * 
 * Flow:
 * 1. Regenerate selectable events to get prioritySource and BD intelligence info
 * 2. Filter to only the selected event IDs
 * 3. Create bd_event_ops with prioritySource preserved
 * 4. eventPlanId is NOT set here - it gets hydrated later
 */
export async function createEventOpsFromSelection(
  eventTunerId: string,
  selectedEventIds: string[],
  companyHQId: string,
  ownerId: string
): Promise<void> {
  const tuner = await prisma.event_tuners.findUnique({
    where: { id: eventTunerId },
  });

  if (!tuner) {
    throw new Error('EventTuner not found');
  }

  // Regenerate selectable events to get prioritySource and BD intelligence info
  const allSelectableEvents = await generateSelectableEvents(eventTunerId);
  
  // Filter to only selected events
  const selectedSelectableEvents = allSelectableEvents.filter(
    event => selectedEventIds.includes(event.id)
  );

  // Create bd_event_ops for each selected event
  for (const selectableEvent of selectedSelectableEvents) {
    // Get EventMeta for additional details
    const eventMeta = await prisma.event_metas.findUnique({
      where: { id: selectableEvent.id },
    });

    if (!eventMeta) {
      console.warn(`EventMeta not found for id: ${selectableEvent.id}`);
      continue;
    }

    await prisma.bdEventOps.create({
      data: {
        companyHQId,
        ownerId,
        eventTunerId,
        title: selectableEvent.title,
        eventType: selectableEvent.eventType,
        startDate: selectableEvent.startDate,
        endDate: selectableEvent.endDate,
        city: selectableEvent.city,
        state: selectableEvent.state,
        country: selectableEvent.country,
        costBand: selectableEvent.costMin && selectableEvent.costMax
          ? determineCostBand(selectableEvent.costMin, selectableEvent.costMax)
          : null,
        source: selectableEvent.prioritySource === 'BD_INTEL' ? 'BD_INTEL' : 'USER_PREF',
        prioritySource: selectableEvent.prioritySource || null,
        status: 'CONSIDERING',
        // eventPlanId is NOT set here - it gets hydrated later
      },
    });
  }
}

function determineCostBand(costMin: number, costMax: number): string {
  const avg = (costMin + costMax) / 2;
  if (avg === 0) return 'FREE';
  if (avg < 500) return 'LOW';
  if (avg < 2000) return 'MEDIUM';
  if (avg < 5000) return 'HIGH';
  return 'PREMIUM';
}

