import { prisma } from '../prisma';

/**
 * Hydrate WorkPackage with artifacts and calculate progress
 * Uses Collateral model to link artifacts to items
 * @param {Object} workPackage - WorkPackage from Prisma (with collateral already included)
 * @param {Object} options - Options for hydration
 * @param {boolean} options.clientView - If true, only return published artifacts
 * @returns {Promise<Object>} - Hydrated work package with progress
 */
export async function hydrateWorkPackage(workPackage, options = {}) {
  const { clientView = false } = options;

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

  return {
    ...workPackage,
    items: hydratedItems,
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: overallProgress,
    },
  };
}
