/**
 * WorkPackage CSV Hydration Service
 * Uses mapped fields to hydrate WorkPackage from CSV
 */

import { prisma } from '@/lib/prisma';
import { 
  createWorkPackage as createWP,
  upsertPhase as upsertP,
  upsertItem as upsertI 
} from './workpackageHydrationService';

// Map to expected names
const createWorkPackage = createWP;
const upsertPhase = upsertP;
const upsertItem = upsertI;

/**
 * Hydrate WorkPackage from mapped CSV data
 */
export async function hydrateFromMappedCSV(params) {
  const {
    contactId,
    companyId,
    workPackage,
    phases,
    transformedRows,
  } = params;

  // Create WorkPackage
  const workPackageId = await createWorkPackage({
    contactId,
    companyId,
    title: workPackage.title,
    description: workPackage.description,
    totalCost: workPackage.totalCost,
    effectiveStartDate: workPackage.effectiveStartDate 
      ? new Date(workPackage.effectiveStartDate) 
      : null,
  });

  // Track created/updated counts
  let phasesCreated = 0;
  let phasesUpdated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const phaseMap = new Map(); // phaseKey -> phaseId

  // Process each phase
  for (const phase of phases) {
    const phaseKey = `${phase.name}-${phase.position}`;
    
    // Check if phase exists
    const existingPhase = await prisma.workPackagePhase.findFirst({
      where: {
        workPackageId,
        name: phase.name,
        position: phase.position,
      },
    });

    let phaseId;
    if (existingPhase) {
      phaseId = existingPhase.id;
      phasesUpdated++;
      
      // Update phase
      await prisma.workPackagePhase.update({
        where: { id: phaseId },
        data: {
          description: phase.description,
          totalEstimatedHours: phase.totalEstimatedHours,
        },
      });
    } else {
      phaseId = await upsertPhase({
        workPackageId,
        name: phase.name,
        position: phase.position,
        description: phase.description,
      });
      phasesCreated++;
    }
    
    phaseMap.set(phaseKey, phaseId);

    // Process items in phase
    for (const item of phase.items) {
      // Check if item exists
      const existingItem = await prisma.workPackageItem.findFirst({
        where: {
          workPackageId,
          workPackagePhaseId: phaseId,
          deliverableLabel: item.deliverableLabel,
        },
      });

      if (existingItem) {
        // Update item
        await prisma.workPackageItem.update({
          where: { id: existingItem.id },
          data: {
            deliverableType: item.deliverableType,
            deliverableDescription: item.deliverableDescription,
            quantity: item.quantity,
            estimatedHoursEach: item.estimatedHoursEach,
            unitOfMeasure: item.unitOfMeasure,
            status: item.status,
            // Legacy fields
            itemType: item.deliverableType,
            itemLabel: item.deliverableLabel,
            itemDescription: item.deliverableDescription,
          },
        });
        itemsUpdated++;
      } else {
        // Create item
        await upsertItem({
          workPackageId,
          workPackagePhaseId: phaseId,
          deliverableType: item.deliverableType,
          deliverableLabel: item.deliverableLabel,
          deliverableDescription: item.deliverableDescription,
          quantity: item.quantity,
          estimatedHoursEach: item.estimatedHoursEach,
          unitOfMeasure: item.unitOfMeasure || 'item',
          status: item.status || 'not_started',
        });
        itemsCreated++;
      }
    }
  }

  // Update phase total hours
  for (const phaseId of phaseMap.values()) {
    const items = await prisma.workPackageItem.findMany({
      where: { workPackagePhaseId: phaseId },
    });
    
    const totalHours = items.reduce((sum, item) => {
      return sum + (item.quantity * item.estimatedHoursEach);
    }, 0);
    
    await prisma.workPackagePhase.update({
      where: { id: phaseId },
      data: { totalEstimatedHours: totalHours },
    });
  }

  // Get created work package
  const created = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      phases: {
        include: {
          items: true,
        },
        orderBy: { position: 'asc' },
      },
      items: true,
    },
  });

  return {
    success: true,
    workPackage: created,
    stats: {
      phasesCreated,
      phasesUpdated,
      itemsCreated,
      itemsUpdated,
    },
  };
}

