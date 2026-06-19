/**
 * EventTunerFilterService
 * 
 * Filters events based on EventTuner constraints (hard gates)
 * No scoring for constraints - pass/fail only
 */

import { prisma } from '@/lib/prisma';
import { EventCostRange, TravelDistance } from '@prisma/client';

export interface EventFilterResult {
  passed: boolean;
  reason?: string; // Why it failed (for debugging, not shown to user)
}

/**
 * Check if an event passes EventTuner constraints
 * Returns pass/fail only - no scoring
 */
export async function checkEventTunerConstraints(
  eventTunerId: string,
  event: {
    costMin?: number | null;
    costMax?: number | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    eventType?: string;
    title?: string;
    description?: string | null;
  }
): Promise<EventFilterResult> {
  const tuner = await prisma.event_tuners.findUnique({
    where: { id: eventTunerId },
    include: {
      event_tuner_states: true,
    },
  });

  if (!tuner) {
    return { passed: false, reason: 'EventTuner not found' };
  }

  // Cost constraint check
  if (tuner.costRange && tuner.costRange !== 'NO_LIMIT') {
    const eventCost = event.costMin || event.costMax || 0;
    const maxCost = getMaxCostForRange(tuner.costRange);
    
    if (maxCost !== null && eventCost > maxCost) {
      return { passed: false, reason: `Cost ${eventCost} exceeds range ${tuner.costRange}` };
    }
  }

  // Geography constraint check (preferred states)
  if (tuner.event_tuner_states.length > 0 && event.state) {
    const allowedStates = tuner.event_tuner_states.map(ps => ps.state);
    if (!allowedStates.includes(event.state)) {
      return { passed: false, reason: `State ${event.state} not in preferred states` };
    }
  }

  // Travel distance constraint check
  if (tuner.travelDistance && tuner.travelDistance !== 'NO_LIMIT') {
    // TODO: Implement travel distance calculation based on user location
    // For now, this is a placeholder
  }

  // Search text constraint check
  if (tuner.eventSearchRawText) {
    const searchLower = tuner.eventSearchRawText.toLowerCase();
    const titleMatch = event.title?.toLowerCase().includes(searchLower);
    const descMatch = event.description?.toLowerCase().includes(searchLower);
    
    if (!titleMatch && !descMatch) {
      return { passed: false, reason: `Event does not match search text: ${tuner.eventSearchRawText}` };
    }
  }

  // All constraints passed
  return { passed: true };
}

/**
 * Get max cost for a cost range enum
 */
function getMaxCostForRange(range: EventCostRange): number | null {
  switch (range) {
    case 'FREE':
      return 0;
    case 'LOW_0_500':
      return 500;
    case 'MEDIUM_500_2000':
      return 2000;
    case 'HIGH_2000_5000':
      return 5000;
    case 'PREMIUM_5000_PLUS':
      return null; // No upper limit
    case 'NO_LIMIT':
      return null;
    default:
      return null;
  }
}

/**
 * Filter events from EventMeta by EventTuner constraints
 */
export async function filterEventsByTuner(
  eventTunerId: string,
  events: Array<{
    id: string;
    name: string;
    costMin?: number | null;
    costMax?: number | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    dateRange?: string | null;
    eventType?: string;
  }>
): Promise<Array<typeof events[0]>> {
  const filtered: typeof events = [];

  for (const event of events) {
    const result = await checkEventTunerConstraints(eventTunerId, {
      costMin: event.costMin,
      costMax: event.costMax,
      city: event.city,
      state: event.state,
      country: event.country,
      startDate: event.startDate,
      endDate: event.endDate,
      eventType: event.eventType,
      title: event.name,
    });

    if (result.passed) {
      filtered.push(event);
    }
  }

  return filtered;
}

