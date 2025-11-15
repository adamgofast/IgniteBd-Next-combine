/**
 * PROPOSAL TO DELIVERABLES SERVICE
 * Converts approved proposals into ConsultantDeliverable records
 * 
 * Trigger: When proposal status changes to "approved"
 * Action: Extract deliverables from proposal phases/milestones and create ConsultantDeliverable records
 */

import { prisma } from '../prisma.js';

/**
 * Convert approved proposal to deliverables
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object>} - Result with created deliverables
 */
export async function convertProposalToDeliverables(proposalId) {
  try {
    // Fetch proposal with related data
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: {
          include: {
            contacts: {
              take: 1, // Primary contact (client)
            },
          },
        },
      },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'approved') {
      throw new Error(
        `Proposal ${proposalId} is not approved (status: ${proposal.status}). Only approved proposals can be converted to deliverables.`,
      );
    }

    // Get primary contact (client)
    const primaryContact = proposal.company?.contacts?.[0];
    if (!primaryContact) {
      throw new Error(
        `No contact found for proposal ${proposalId}. Proposal must be linked to a Company with at least one Contact.`,
      );
    }

    const contactId = primaryContact.id;

    // Check if deliverables already exist for this proposal
    const existingDeliverables = await prisma.consultantDeliverable.findMany({
      where: { proposalId },
    });

    if (existingDeliverables.length > 0) {
      console.log(
        `⚠️ Deliverables already exist for proposal ${proposalId}. Skipping conversion.`,
      );
      return {
        converted: false,
        reason: 'deliverables_already_exist',
        existingCount: existingDeliverables.length,
        deliverables: existingDeliverables,
      };
    }

    // Extract deliverables from proposal structure
    const deliverables = extractDeliverablesFromProposal(proposal);

    if (deliverables.length === 0) {
      console.log(
        `⚠️ No deliverables found in proposal ${proposalId}. Proposal may not have phases or milestones defined.`,
      );
      return {
        converted: false,
        reason: 'no_deliverables_found',
        deliverables: [],
      };
    }

    // Create deliverables
    const createdDeliverables = await Promise.all(
      deliverables.map((deliverable) =>
        prisma.consultantDeliverable.create({
          data: {
            contactId,
            proposalId,
            title: deliverable.title,
            description: deliverable.description,
            category: deliverable.category,
            milestoneId: deliverable.milestoneId,
            dueDate: deliverable.dueDate,
            status: 'pending',
          },
        }),
      ),
    );

    console.log(
      `✅ Converted proposal ${proposalId} to ${createdDeliverables.length} deliverables for contact ${contactId}`,
    );

    return {
      converted: true,
      proposalId,
      contactId,
      deliverablesCreated: createdDeliverables.length,
      deliverables: createdDeliverables,
    };
  } catch (error) {
    console.error('❌ ProposalToDeliverables conversion error:', error);
    throw error;
  }
}

/**
 * Extract deliverables from proposal structure
 * Looks at phases.deliverables and milestones to create deliverable records
 * @param {Object} proposal - Proposal object with phases and milestones
 * @returns {Array} - Array of deliverable objects ready to create
 */
function extractDeliverablesFromProposal(proposal) {
  const deliverables = [];

  // Extract from phases (if phases have deliverables array)
  // New structure: phases have phaseId, deliverables are objects with deliverableId
  if (proposal.phases && Array.isArray(proposal.phases)) {
    proposal.phases.forEach((phase) => {
      const phaseId = phase.phaseId || phase.id; // Support both old and new format
      const category = phase.category || phase.name?.toLowerCase() || 'general';

      // If phase has deliverables array
      if (phase.deliverables && Array.isArray(phase.deliverables)) {
        phase.deliverables.forEach((deliverable) => {
          // Handle both old format (string) and new format (object with deliverableId)
          const isString = typeof deliverable === 'string';
          const deliverableId = isString ? null : deliverable.deliverableId;
          
          deliverables.push({
            title: isString
              ? deliverable
              : deliverable.title || 'Untitled Deliverable',
            description: isString
              ? null
              : deliverable.description || null,
            category: isString
              ? category
              : deliverable.category || category,
            type: isString ? null : deliverable.type || null,
            milestoneId: deliverableId ? `deliverable-${deliverableId}` : null,
            dueDate: calculateDueDateFromPhase(phase, proposal.milestones),
          });
        });
      }
    });
  }

  // Extract from milestones (if milestones reference deliverables by deliverableId)
  if (proposal.milestones && Array.isArray(proposal.milestones)) {
    proposal.milestones.forEach((milestone) => {
      const week = milestone.week;
      
      // New structure: milestone has deliverableId reference
      if (milestone.deliverableId) {
        // Find the deliverable in phases by deliverableId
        let foundDeliverable = null;
        if (proposal.phases && Array.isArray(proposal.phases)) {
          for (const phase of proposal.phases) {
            if (phase.deliverables && Array.isArray(phase.deliverables)) {
              foundDeliverable = phase.deliverables.find(
                d => d.deliverableId === milestone.deliverableId
              );
              if (foundDeliverable) break;
            }
          }
        }
        
        if (foundDeliverable) {
          deliverables.push({
            title: foundDeliverable.title || milestone.milestone || `Week ${week}`,
            description: foundDeliverable.description || null,
            category: foundDeliverable.category || milestone.phaseColor || 'general',
            type: foundDeliverable.type || null,
            milestoneId: `week-${week}`,
            dueDate: calculateDueDateFromMilestone(milestone, proposal.dateIssued),
          });
        }
      } else if (milestone.deliverable) {
        // Old format: milestone has deliverable field (string)
        deliverables.push({
          title: typeof milestone.deliverable === 'string'
            ? milestone.deliverable
            : milestone.milestone || `Week ${week}`,
          description: milestone.description || null,
          category: milestone.phaseColor || milestone.phase?.toLowerCase() || 'general',
          milestoneId: `week-${week}`,
          dueDate: calculateDueDateFromMilestone(milestone, proposal.dateIssued),
        });
      } else if (milestone.milestone) {
        // Fallback: use milestone title
        deliverables.push({
          title: milestone.milestone,
          description: null,
          category: milestone.phaseColor || milestone.phase?.toLowerCase() || 'general',
          milestoneId: `week-${week}`,
          dueDate: calculateDueDateFromMilestone(milestone, proposal.dateIssued),
        });
      }
    });
  }

  return deliverables;
}

/**
 * Calculate due date from phase information
 * @param {Object} phase - Phase object
 * @param {Array} milestones - Milestones array
 * @returns {Date|null} - Due date or null
 */
function calculateDueDateFromPhase(phase, milestones) {
  if (!milestones || !Array.isArray(milestones)) {
    return null;
  }

  // Try to find milestone in this phase
  const phaseMilestone = milestones.find(
    (m) => m.phaseId === phase.id || m.phase === phase.name,
  );

  if (phaseMilestone && phaseMilestone.week) {
    return calculateDueDateFromWeek(phaseMilestone.week);
  }

  return null;
}

/**
 * Calculate due date from milestone
 * @param {Object} milestone - Milestone object
 * @param {Date|string} dateIssued - Proposal issue date
 * @returns {Date|null} - Due date or null
 */
function calculateDueDateFromMilestone(milestone, dateIssued) {
  if (milestone.week) {
    return calculateDueDateFromWeek(milestone.week, dateIssued);
  }

  if (milestone.targetDate) {
    return new Date(milestone.targetDate);
  }

  return null;
}

/**
 * Calculate due date from week number
 * @param {number} week - Week number (1-based)
 * @param {Date|string} startDate - Start date (defaults to now)
 * @returns {Date} - Due date
 */
function calculateDueDateFromWeek(week, startDate = null) {
  const start = startDate ? new Date(startDate) : new Date();
  const dueDate = new Date(start);
  dueDate.setDate(start.getDate() + week * 7); // Add weeks
  return dueDate;
}

