import { prisma } from '../prisma';
import { computeExpectedEndDate, computePhaseTimelineStatus } from '../utils/workPackageTimeline';

/**
 * Calculate effectiveDate for a phase based on WorkPackage start date and previous phases
 * @param {Date|null} workPackageStartDate - WorkPackage effectiveStartDate
 * @param {Array} allPhases - All phases sorted by position
 * @param {number} currentPhasePosition - Position of current phase
 * @returns {Date|null} - Effective date for the phase
 */
function calculatePhaseEffectiveDate(workPackageStartDate, allPhases, currentPhasePosition) {
  if (!workPackageStartDate) return null;

  const startDate = new Date(workPackageStartDate);
  let currentDate = new Date(startDate);

  // Sort phases by position
  const sortedPhases = [...allPhases].sort((a, b) => a.position - b.position);

  // Find all phases before current phase
  const previousPhases = sortedPhases.filter((p) => p.position < currentPhasePosition);

  // Calculate cumulative days from previous phases
  previousPhases.forEach((phase) => {
    if (phase.totalEstimatedHours) {
      const days = Math.ceil(phase.totalEstimatedHours / 8);
      currentDate.setDate(currentDate.getDate() + days);
    }
  });

  return currentDate;
}

/**
 * Hydrate WorkPackage with artifacts and calculate progress
 * Uses Collateral model to link artifacts to items
 * @param {Object} workPackage - WorkPackage from Prisma (with collateral already included)
 * @param {Object} options - Options for hydration
 * @param {boolean} options.clientView - If true, only return published artifacts
 * @param {boolean} options.includeTimeline - If true, include timeline calculations (default: true for owner view)
 * @returns {Promise<Object>} - Hydrated work package with progress
 */
export async function hydrateWorkPackage(workPackage, options = {}) {
  const { clientView = false, includeTimeline = !clientView } = options;

  // Hydrate each item with its artifacts from collateral
  const hydratedItems = await Promise.all(
    workPackage.items.map(async (item) => {
      const collateral = item.collateral || [];
      const artifacts = [];
      let completedCount = 0;

      // Load artifacts based on collateral type
      for (const coll of collateral) {
        try {
          let artifact = null;

          switch (coll.collateralType) {
            case 'blog':
              artifact = await prisma.blog.findUnique({
                where: { id: coll.collateralRefId },
              });
              if (artifact && (!clientView || artifact.published)) {
                artifacts.push({ ...artifact, collateralType: 'blog' });
                completedCount++;
              }
              break;

            case 'persona':
              artifact = await prisma.persona.findUnique({
                where: { id: coll.collateralRefId },
              });
              if (artifact && (!clientView || artifact.published)) {
                artifacts.push({ ...artifact, collateralType: 'persona' });
                completedCount++;
              }
              break;

            case 'template':
              artifact = await prisma.template.findUnique({
                where: { id: coll.collateralRefId },
              });
              if (artifact && (!clientView || artifact.published)) {
                artifacts.push({ ...artifact, collateralType: 'template' });
                completedCount++;
              }
              break;

            case 'deck':
            case 'event_targets':
              artifact = await prisma.cleDeck.findUnique({
                where: { id: coll.collateralRefId },
              });
              if (artifact && (!clientView || artifact.published)) {
                artifacts.push({ ...artifact, collateralType: coll.collateralType });
                completedCount++;
              }
              break;

            case 'page':
            case 'lead_form':
              artifact = await prisma.landingPage.findUnique({
                where: { id: coll.collateralRefId },
              });
              if (artifact && (!clientView || artifact.published)) {
                artifacts.push({ ...artifact, collateralType: coll.collateralType });
                completedCount++;
              }
              break;
          }
        } catch (error) {
          console.warn(`Failed to load artifact ${coll.collateralRefId} of type ${coll.collateralType}:`, error);
        }
      }

      const progress = {
        completed: completedCount,
        total: item.quantity,
        percentage: item.quantity > 0 ? Math.round((completedCount / item.quantity) * 100) : 0,
      };

      return {
        ...item,
        artifacts,
        progress,
      };
    })
  );

  // Calculate overall progress
  const totalItems = hydratedItems.length;
  const completedItems = hydratedItems.filter(
    (item) => item.progress.completed >= item.progress.total
  ).length;
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Hydrate phases with aggregated hours and timeline calculations
  let hydratedPhases = [];
  if (workPackage.phases && Array.isArray(workPackage.phases)) {
    hydratedPhases = workPackage.phases.map((phase) => {
      // Calculate aggregated hours from items in this phase
      const phaseItems = hydratedItems.filter((item) => item.workPackagePhaseId === phase.id);
      const aggregatedHours = phaseItems.reduce((sum, item) => {
        return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
      }, 0);

      // Calculate effectiveDate for phase (derive from WorkPackage effectiveStartDate)
      const effectiveDate = includeTimeline
        ? calculatePhaseEffectiveDate(
            workPackage.effectiveStartDate,
            workPackage.phases,
            phase.position
          )
        : null;

      // Calculate expectedEndDate
      const expectedEndDate = includeTimeline
        ? computeExpectedEndDate(effectiveDate, aggregatedHours || phase.totalEstimatedHours || 0)
        : null;

      // Calculate phase status from items (derive from item statuses)
      // Phase is completed if all items are completed
      const allItemsCompleted = phaseItems.length > 0 && phaseItems.every(
        (item) => item.status === 'completed' || (item.progress?.completed >= item.progress?.total)
      );
      const hasInProgressItems = phaseItems.some((item) => item.status === 'in_progress');
      const phaseStatus = allItemsCompleted ? 'completed' : (hasInProgressItems ? 'in_progress' : 'active');

      // Calculate timeline status
      const timelineStatus = includeTimeline
        ? computePhaseTimelineStatus(phaseStatus, expectedEndDate)
        : null;

      return {
        ...phase,
        totalEstimatedHours: aggregatedHours || phase.totalEstimatedHours || 0,
        effectiveDate: effectiveDate ? effectiveDate.toISOString() : null,
        expectedEndDate: expectedEndDate ? expectedEndDate.toISOString() : null,
        timelineStatus,
        items: phaseItems,
      };
    });

    // Sort phases by position
    hydratedPhases.sort((a, b) => a.position - b.position);
  }

  return {
    ...workPackage,
    items: hydratedItems,
    phases: hydratedPhases,
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: overallProgress,
    },
  };
}
