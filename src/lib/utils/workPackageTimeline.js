/**
 * WorkPackage Timeline Utilities
 * Phase-level timeline calculations for WorkPackage execution
 */

/**
 * Convert hours to days (1 day = 8 hours)
 * @param {number} estimatedHours - Total estimated hours
 * @returns {number} - Number of days (rounded up)
 */
export function convertHoursToDays(estimatedHours) {
  if (!estimatedHours || estimatedHours <= 0) return 0;
  return Math.ceil(estimatedHours / 8);
}

/**
 * Calculate expected end date for a phase
 * @param {Date|string} effectiveDate - Phase start date
 * @param {number} totalEstimatedHours - Total estimated hours for the phase
 * @returns {Date|null} - Expected end date, or null if inputs are invalid
 */
export function computeExpectedEndDate(effectiveDate, totalEstimatedHours) {
  if (!effectiveDate || !totalEstimatedHours || totalEstimatedHours <= 0) {
    return null;
  }

  const startDate = new Date(effectiveDate);
  const days = convertHoursToDays(totalEstimatedHours);
  
  // Add days to start date
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  
  return endDate;
}

/**
 * Compute timeline status for a phase
 * @param {string} phaseStatus - Phase status (e.g., "completed")
 * @param {Date|string|null} expectedEndDate - Expected end date
 * @returns {string} - Timeline status: "complete" | "overdue" | "warning" | "on_track"
 */
export function computePhaseTimelineStatus(phaseStatus, expectedEndDate) {
  // If phase is completed, return "complete"
  if (phaseStatus === 'completed') {
    return 'complete';
  }

  // If no expected end date, return "on_track" (can't determine status)
  if (!expectedEndDate) {
    return 'on_track';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for comparison

  const endDate = new Date(expectedEndDate);
  endDate.setHours(0, 0, 0, 0);

  // Calculate days until/since end date
  const daysDiff = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

  // Overdue: today > expectedEndDate
  if (daysDiff < 0) {
    return 'overdue';
  }

  // Warning: within 3 days of expected end date
  if (daysDiff <= 3) {
    return 'warning';
  }

  // On track: more than 3 days remaining
  return 'on_track';
}

/**
 * Get color classes for timeline status
 * @param {string} timelineStatus - Timeline status
 * @returns {string} - Tailwind CSS classes
 */
export function getTimelineStatusColor(timelineStatus) {
  switch (timelineStatus) {
    case 'complete':
      return 'bg-gray-100 text-gray-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'on_track':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

