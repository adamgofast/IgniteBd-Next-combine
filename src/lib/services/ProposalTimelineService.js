/**
 * Proposal Timeline Calculation Service
 * Calculates start and end dates for proposal phases based on estimated start date
 */

/**
 * Calculate timeline for proposal phases
 * @param {Date} estimatedStart - Estimated start date for the proposal
 * @param {Array} phases - Array of phase objects with durationWeeks
 * @returns {Array} Array of phase objects with calculated start and end dates
 */
export function calculateProposalTimeline(estimatedStart, phases) {
  if (!estimatedStart || !phases || !Array.isArray(phases) || phases.length === 0) {
    return [];
  }

  const startDate = new Date(estimatedStart);
  let cursor = new Date(startDate);

  return phases.map((phase) => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    
    // Add duration weeks (7 days per week)
    end.setDate(end.getDate() + (phase.durationWeeks || 0) * 7);
    
    // Move cursor to end of this phase for next phase
    cursor = new Date(end);

    return {
      ...phase,
      startDate: start,
      endDate: end,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatPhaseDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

