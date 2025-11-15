import { prisma } from '../prisma';

/**
 * Hydrate WorkPackage with artifacts and calculate progress
 * @param {Object} workPackage - WorkPackage from Prisma
 * @param {Object} options - Options for hydration
 * @param {boolean} options.clientView - If true, only return published artifacts
 * @returns {Promise<Object>} - Hydrated work package with progress
 */
export async function hydrateWorkPackage(workPackage, options = {}) {
  const { clientView = false } = options;

  // Hydrate each item with its artifacts
  const hydratedItems = await Promise.all(
    workPackage.items.map(async (item) => {
      let artifacts = [];
      let completedCount = 0;

      // Load artifacts based on type
      switch (item.type) {
        case 'BLOG':
          if (item.blogIds.length > 0) {
            artifacts = await prisma.blog.findMany({
              where: {
                id: { in: item.blogIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.blogIds.length;
          break;

        case 'PERSONA':
          if (item.personaIds.length > 0) {
            artifacts = await prisma.persona.findMany({
              where: {
                id: { in: item.personaIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.personaIds.length;
          break;

        case 'OUTREACH_TEMPLATE':
          if (item.templateIds.length > 0) {
            artifacts = await prisma.template.findMany({
              where: {
                id: { in: item.templateIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.templateIds.length;
          break;

        case 'EVENT_CLE_PLAN':
          if (item.eventPlanIds.length > 0) {
            artifacts = await prisma.eventPlan.findMany({
              where: {
                id: { in: item.eventPlanIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.eventPlanIds.length;
          break;

        case 'CLE_DECK':
          if (item.cleDeckIds.length > 0) {
            artifacts = await prisma.cleDeck.findMany({
              where: {
                id: { in: item.cleDeckIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.cleDeckIds.length;
          break;

        case 'LANDING_PAGE':
          if (item.landingPageIds.length > 0) {
            artifacts = await prisma.landingPage.findMany({
              where: {
                id: { in: item.landingPageIds },
                ...(clientView ? { published: true } : {}),
              },
            });
          }
          completedCount = clientView
            ? artifacts.length
            : item.landingPageIds.length;
          break;

        default:
          completedCount = 0;
      }

      // Calculate progress
      const progress = item.quantity > 0 ? completedCount / item.quantity : 0;

      return {
        id: item.id,
        deliverableName: item.deliverableName,
        type: item.type,
        quantity: item.quantity,
        completedCount,
        progress: Math.min(progress, 1), // Cap at 100%
        progressPercentage: Math.round(Math.min(progress, 1) * 100),
        artifacts,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }),
  );

  return {
    id: workPackage.id,
    title: workPackage.title,
    description: workPackage.description,
    status: workPackage.status,
    contact: workPackage.contact,
    contactCompany: workPackage.contactCompany,
    items: hydratedItems,
    createdAt: workPackage.createdAt,
    updatedAt: workPackage.updatedAt,
  };
}

