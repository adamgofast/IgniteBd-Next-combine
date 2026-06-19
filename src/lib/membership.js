import { prisma } from './prisma';

/**
 * Get role priority for sorting (lower number = higher priority)
 * OWNER = 1, MANAGER = 2, others = 3
 */
function getRolePriority(role) {
  const upperRole = (role || '').toUpperCase();
  if (upperRole === 'OWNER') return 1;
  if (upperRole === 'MANAGER') return 2;
  return 3;
}

/**
 * Sort memberships by role priority (OWNER first, then MANAGER, then others, then by createdAt)
 */
export function sortMembershipsByRole(memberships) {
  return [...memberships].sort((a, b) => {
    const priorityA = getRolePriority(a.role);
    const priorityB = getRolePriority(b.role);
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Lower priority number = higher in list
    }
    // Same priority, sort by createdAt (oldest first)
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

/**
 * Resolves membership for an owner in a specific CompanyHQ
 * 
 * @param {string} ownerId - The owner.id (not firebaseId)
 * @param {string} companyHQId - The companyHQ.id
 * @returns {Promise<{membership: object|null, role: string|null}>}
 * 
 * @example
 * const { membership, role } = await resolveMembership(owner.id, companyHQId);
 * if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function resolveMembership(ownerId, companyHQId) {
  if (!ownerId || !companyHQId) {
    return { membership: null, role: null };
  }

  try {
    const membership = await prisma.company_memberships.findUnique({
      where: {
        userId_companyHqId: {
          userId: ownerId,
          companyHqId: companyHQId,
        }
      },
      include: {
        owners: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          }
        }
      }
    });

    if (!membership) {
      return { membership: null, role: null };
    }

    return {
      membership,
      role: membership.role,
    };
  } catch (error) {
    console.error('Error resolving membership:', error);
    return { membership: null, role: null };
  }
}

/**
 * Resolves ALL memberships for an owner (across all CompanyHQs)
 * 
 * @param {string} ownerId - The owner.id
 * @returns {Promise<Array>} Array of membership records
 * 
 * @example
 * const memberships = await resolveAllMemberships(owner.id);
 * // Returns: [{ companyHqId, role, company_hqs: { companyName } }, ...]
 */
export async function resolveAllMemberships(ownerId) {
  if (!ownerId) {
    return [];
  }

  try {
    const memberships = await prisma.company_memberships.findMany({
      where: {
        userId: ownerId,
      },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          }
        }
      },
      orderBy: [
        { createdAt: 'asc' },  // First by creation date (for consistent sorting)
      ]
    });

    // Sort by role priority: OWNER first, then MANAGER, then others
    return sortMembershipsByRole(memberships);
  } catch (error) {
    console.error('Error resolving all memberships:', error);
    return [];
  }
}

/**
 * Checks if owner has a specific role in a CompanyHQ
 * 
 * @param {string} ownerId - The owner.id
 * @param {string} companyHQId - The companyHQ.id
 * @param {string} requiredRole - The required role (e.g., 'OWNER', 'MANAGER')
 * @returns {Promise<boolean>}
 * 
 * @example
 * const isOwner = await hasRole(owner.id, companyHQId, 'OWNER');
 * if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function hasRole(ownerId, companyHQId, requiredRole) {
  const { role } = await resolveMembership(ownerId, companyHQId);
  return role === requiredRole;
}
