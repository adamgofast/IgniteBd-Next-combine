/**
 * Work Package Hydration Service
 * Handles CSV import, upsert logic, and calculations
 */

import { prisma } from '@/lib/prisma';
import type { WorkPackageCSVRow } from '@/lib/utils/csv';
import { computePhaseTimelineStatus } from '@/lib/utils/workPackageTimeline';

export interface HydrationResult {
  workPackageId: string;
  phasesCreated: number;
  phasesUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  totalEstimatedHours: number;
}

/**
 * Create or update WorkPackage from CSV data
 * Note: For CSV imports, we always create new work packages (no upsert)
 * Use createWorkPackage instead for CSV imports
 */
export async function upsertWorkPackage(params: {
  workPackageId: string;
  title?: string;
  description?: string;
  totalCost?: number;
  effectiveStartDate?: Date;
}): Promise<string> {
  const { workPackageId, title, description, totalCost, effectiveStartDate } = params;

  const workPackage = await prisma.work_packages.update({
    where: { id: workPackageId },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(totalCost !== undefined && { totalCost }),
      ...(effectiveStartDate && { effectiveStartDate }),
      updatedAt: new Date(),
    },
  });

  return workPackage.id;
}

/**
 * Create WorkPackage (no upsert - always create new)
 * Company-first: requires companyId, workPackageClientId, workPackageOwnerId
 */
export async function createWorkPackage(params: {
  workPackageClientId: string;  // Required - client contact
  companyId: string;            // Required - client company
  workPackageOwnerId: string;   // Required - IgniteBD owner (CompanyHQ.id)
  workPackageMemberId?: string; // Optional - member contact
  title: string;
  description?: string;
  totalCost?: number;
  effectiveStartDate?: Date;
  status?: string;
  metadata?: any;
  tags?: string[];
}): Promise<string> {
  const { 
    workPackageClientId, 
    companyId, 
    workPackageOwnerId,
    workPackageMemberId,
    title, 
    description, 
    totalCost, 
    effectiveStartDate,
    status,
    metadata,
    tags,
  } = params;

  const workPackage = await prisma.work_packages.create({
    data: {
      workPackageClientId,
      companyId,
      workPackageOwnerId,
      ...(workPackageMemberId && { workPackageMemberId }),
      title,
      ...(description !== undefined && { description }),
      ...(totalCost !== undefined && { totalCost }),
      ...(effectiveStartDate && { effectiveStartDate }),
      ...(status && { status }),
      ...(metadata && { metadata }),
      ...(tags && { tags }),
    },
  });

  return workPackage.id;
}

/**
 * Upsert WorkPackagePhase (idempotent by workPackageId + name + position)
 */
export async function upsertPhase(params: {
  workPackageId: string;
  name: string;
  position: number;
  description?: string;
}): Promise<string> {
  const { workPackageId, name, position, description } = params;

  // Check if phase exists
  const existing = await prisma.work_package_phases.findFirst({
    where: {
      workPackageId,
      name,
      position,
    },
  });

  if (existing) {
    // Update existing
    const updated = await prisma.work_package_phases.update({
      where: { id: existing.id },
      data: {
        description,
        updatedAt: new Date(),
      },
    });
    return updated.id;
  }

  // Create new
  const created = await prisma.work_package_phases.create({
    data: {
      workPackageId,
      name,
      position,
      description,
    },
  });

  return created.id;
}

/**
 * Upsert WorkPackageItem (idempotent by workPackageId + phaseId + deliverableLabel)
 */
export async function upsertItem(params: {
  workPackageId: string;
  workPackagePhaseId: string;
  deliverableType: string;
  deliverableLabel: string;
  deliverableDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedHoursEach: number;
  status: string;
}): Promise<string> {
  const {
    workPackageId,
    workPackagePhaseId,
    deliverableType,
    deliverableLabel,
    deliverableDescription,
    quantity,
    unitOfMeasure,
    estimatedHoursEach,
    status,
  } = params;

  // Check if item exists
  const existing = await prisma.work_package_items.findFirst({
    where: {
      workPackageId,
      workPackagePhaseId,
      deliverableLabel,
    },
  });

  // Sync legacy fields
  const itemType = deliverableType;
  const itemLabel = deliverableLabel;
  const itemDescription = deliverableDescription;

  const data = {
    workPackageId,
    workPackagePhaseId,
    deliverableType,
    deliverableLabel,
    deliverableDescription,
    itemType, // Sync to legacy field
    itemLabel, // Sync to legacy field
    itemDescription, // Sync to legacy field
    quantity,
    unitOfMeasure,
    estimatedHoursEach,
    status,
  };

  if (existing) {
    // Update existing
    const updated = await prisma.work_package_items.update({
      where: { id: existing.id },
      data,
    });
    return updated.id;
  }

  // Create new
  const created = await prisma.work_package_items.create({
    data,
  });

  return created.id;
}

/**
 * Calculate total estimated hours for a phase
 */
export async function calculatePhaseHours(phaseId: string): Promise<number> {
  const items = await prisma.work_package_items.findMany({
    where: { workPackagePhaseId: phaseId },
  });

  return items.reduce((total, item) => {
    return total + (item.quantity * item.estimatedHoursEach);
  }, 0);
}

/**
 * Calculate total estimated hours for a work package
 */
export async function calculatePackageHours(workPackageId: string): Promise<number> {
  const items = await prisma.work_package_items.findMany({
    where: { workPackageId },
  });

  return items.reduce((total, item) => {
    return total + (item.quantity * item.estimatedHoursEach);
  }, 0);
}

/**
 * Update phase totalEstimatedHours
 */
export async function updatePhaseTotalHours(phaseId: string): Promise<void> {
  const totalHours = await calculatePhaseHours(phaseId);
  
  await prisma.work_package_phases.update({
    where: { id: phaseId },
    data: { totalEstimatedHours: totalHours },
  });
}

/**
 * Full hydration from CSV rows
 */
export async function hydrateWorkPackageFromCSV(params: {
  workPackageClientId: string;  // Required - client contact
  companyId: string;            // Required - client company
  workPackageOwnerId: string;   // Required - IgniteBD owner (CompanyHQ.id)
  workPackageMemberId?: string; // Optional - member contact
  title: string;
  rows: WorkPackageCSVRow[];
}): Promise<HydrationResult> {
  const { workPackageClientId, companyId, workPackageOwnerId, workPackageMemberId, title, rows } = params;

  if (rows.length === 0) {
    throw new Error('No rows provided for hydration');
  }

  // Extract proposal metadata from first row
  const proposalMetadata = rows[0];
  const description = proposalMetadata.proposalDescription;
  const totalCost = proposalMetadata.proposalTotalCost;

  // Create WorkPackage
  const workPackageId = await createWorkPackage({
    workPackageClientId,
    companyId,
    workPackageOwnerId,
    ...(workPackageMemberId && { workPackageMemberId }),
    title,
    description,
    totalCost,
  });

  // Track created/updated counts
  let phasesCreated = 0;
  let phasesUpdated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const phaseMap = new Map<string, string>(); // phaseKey -> phaseId

  // Process each row
  for (const row of rows) {
    // Upsert phase
    const phaseKey = `${row.phaseName}-${row.phasePosition}`;
    let phaseId = phaseMap.get(phaseKey);

    if (!phaseId) {
      const existingPhase = await prisma.work_package_phases.findFirst({
        where: {
          workPackageId,
          name: row.phaseName,
          position: row.phasePosition,
        },
      });

      if (existingPhase) {
        phaseId = existingPhase.id;
        phasesUpdated++;
      } else {
        phaseId = await upsertPhase({
          workPackageId,
          name: row.phaseName,
          position: row.phasePosition,
          description: row.phaseDescription,
        });
        phasesCreated++;
      }
      phaseMap.set(phaseKey, phaseId);
    }

    // Upsert item
    const existingItem = await prisma.work_package_items.findFirst({
      where: {
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableLabel: row.deliverableLabel,
      },
    });

    if (existingItem) {
      await upsertItem({
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableType: row.deliverableType,
        deliverableLabel: row.deliverableLabel,
        deliverableDescription: row.deliverableDescription,
        quantity: row.quantity,
        unitOfMeasure: row.unitOfMeasure,
        estimatedHoursEach: row.estimatedHoursEach,
        status: row.status,
      });
      itemsUpdated++;
    } else {
      await upsertItem({
        workPackageId,
        workPackagePhaseId: phaseId,
        deliverableType: row.deliverableType,
        deliverableLabel: row.deliverableLabel,
        deliverableDescription: row.deliverableDescription,
        quantity: row.quantity,
        unitOfMeasure: row.unitOfMeasure,
        estimatedHoursEach: row.estimatedHoursEach,
        status: row.status,
      });
      itemsCreated++;
    }

    // Update phase total hours
    await updatePhaseTotalHours(phaseId);
  }

  // Calculate total hours
  const totalEstimatedHours = await calculatePackageHours(workPackageId);

  return {
    workPackageId,
    phasesCreated,
    phasesUpdated,
    itemsCreated,
    itemsUpdated,
    totalEstimatedHours,
  };
}

/**
 * Hydrate WorkPackage with WorkCollateral and calculate progress
 * Uses WorkCollateral model as source of truth
 */
export async function hydrateWorkPackage(
  workPackage: any,
  options: { clientView?: boolean; includeTimeline?: boolean } = {}
): Promise<any> {
  const { clientView = false, includeTimeline = !clientView } = options;

  // Hydrate each item with its WorkCollateral
  const hydratedItems = await Promise.all(
    workPackage.items.map(async (item: any) => {
      // Get WorkCollateral for this item
      const workCollateral = await prisma.workCollateral.findMany({
        where: { workPackageItemId: item.id },
      });

      const completedCount = workCollateral.filter(
        (wc) => wc.status === 'APPROVED'
      ).length;

      const progress = {
        completed: completedCount,
        total: item.quantity,
        percentage: item.quantity > 0 ? Math.round((completedCount / item.quantity) * 100) : 0,
      };

      return {
        ...item,
        workCollateral,
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

  // Hydrate phases - READ-ONLY (no database mutations)
  let hydratedPhases: any[] = [];
  if (workPackage.phases && Array.isArray(workPackage.phases)) {
    hydratedPhases = workPackage.phases.map((phase: any) => {
      // Calculate aggregated hours from items in this phase
      const phaseItems = hydratedItems.filter((item: any) => item.workPackagePhaseId === phase.id);
      const aggregatedHours = phaseItems.reduce((sum, item) => {
        return sum + (item.estimatedHoursEach || 0) * (item.quantity || 0);
      }, 0);

      // Use stored dates as-is
      const effectiveDate = phase.estimatedStartDate 
        ? new Date(phase.estimatedStartDate)
        : (phase.position === 1 && workPackage.effectiveStartDate)
          ? new Date(workPackage.effectiveStartDate)
          : null;

      // Calculate end date
      let expectedEndDate = null;
      if (includeTimeline) {
        if (phase.actualEndDate) {
          expectedEndDate = new Date(phase.actualEndDate);
        } else if (phase.estimatedEndDate) {
          expectedEndDate = new Date(phase.estimatedEndDate);
        } else if (effectiveDate && phase.phaseTotalDuration) {
          expectedEndDate = new Date(effectiveDate);
          expectedEndDate.setDate(expectedEndDate.getDate() + phase.phaseTotalDuration);
        }
      }

      // Calculate phase status
      const allItemsCompleted = phaseItems.length > 0 && phaseItems.every(
        (item: any) => item.status === 'completed' || (item.progress?.completed >= item.progress?.total)
      );
      const hasInProgressItems = phaseItems.some((item: any) => item.status === 'in_progress');
      const phaseStatus = phase.status || (allItemsCompleted ? 'completed' : (hasInProgressItems ? 'in_progress' : 'not_started'));

      // Calculate timeline status
      const timelineStatus = includeTimeline
        ? computePhaseTimelineStatus(phaseStatus, expectedEndDate || phase.estimatedEndDate)
        : null;

      return {
        ...phase,
        totalEstimatedHours: phase.totalEstimatedHours || aggregatedHours || 0,
        estimatedStartDate: phase.estimatedStartDate ? new Date(phase.estimatedStartDate).toISOString() : null,
        estimatedEndDate: phase.estimatedEndDate ? new Date(phase.estimatedEndDate).toISOString() : null,
        actualStartDate: phase.actualStartDate ? new Date(phase.actualStartDate).toISOString() : null,
        actualEndDate: phase.actualEndDate ? new Date(phase.actualEndDate).toISOString() : null,
        status: phase.status || null,
        phaseTotalDuration: phase.phaseTotalDuration || null,
        effectiveDate: effectiveDate ? effectiveDate.toISOString() : null,
        expectedEndDate: expectedEndDate ? expectedEndDate.toISOString() : null,
        timelineStatus,
        items: phaseItems,
      };
    });

    // Sort phases by position
    const sortedPhases = hydratedPhases.sort((a, b) => a.position - b.position);
    
    // Current phase = first phase not completed
    const currentPhase = sortedPhases.find(
      (phase) => phase.status !== 'completed'
    ) || null;
    
    // Calculate phase progress
    const totalPhases = sortedPhases.length;
    const completedPhases = sortedPhases.filter((p) => p.status === 'completed').length;
    const phaseProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
    
    return {
      ...workPackage,
      items: hydratedItems,
      phases: sortedPhases,
      currentPhase,
      progress: {
        completed: completedItems,
        total: totalItems,
        percentage: overallProgress,
      },
      phaseProgress: {
        completed: completedPhases,
        total: totalPhases,
        percentage: phaseProgress,
      },
    };
  }

  return {
    ...workPackage,
    items: hydratedItems,
    phases: hydratedPhases,
    currentPhase: null,
    progress: {
      completed: completedItems,
      total: totalItems,
      percentage: overallProgress,
    },
    phaseProgress: {
      completed: 0,
      total: 0,
      percentage: 0,
    },
  };
}

