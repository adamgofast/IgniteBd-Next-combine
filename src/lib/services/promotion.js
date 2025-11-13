/**
 * Contact Elevation Service
 * Promotes a Contact to Owner of their own CompanyHQ
 */

import { prisma } from '@/lib/prisma';

/**
 * Promote a Contact to Owner
 * Creates a new CompanyHQ for the contact and sets up memberships
 * 
 * @param {string} contactId - The Contact ID to promote
 * @returns {Promise<Object>} The newly created CompanyHQ
 */
export async function promoteToOwner(contactId) {
  // Step 1: Get contact with their current HQ
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      companyHQ: true,
    },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  if (!contact.firebaseUid) {
    throw new Error('Contact must have a Firebase UID (must be activated)');
  }

  if (contact.role === 'owner') {
    throw new Error('Contact is already an owner');
  }

  const originalHqId = contact.crmId; // IgniteBD's HQ

  // Step 2: Create their new HQ container
  const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'New';
  const newHq = await prisma.companyHQ.create({
    data: {
      companyName: `${contactName}'s CompanyHQ`,
      contactOwnerId: contact.id, // Contact owns this HQ
      memberships: {
        create: {
          userId: contact.firebaseUid,
          role: 'owner',
          isPrimary: true, // This is their primary HQ
        },
      },
    },
  });

  // Step 3: Update contact to reflect ownership
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      role: 'owner',
      ownerId: contact.id, // Self-reference
    },
  });

  // Step 4: Preserve their original link to Ignite HQ via membership
  await prisma.companyMembership.create({
    data: {
      userId: contact.firebaseUid,
      companyHqId: originalHqId, // Ignite's HQ
      role: 'client',
      isPrimary: false, // Not primary - their new HQ is primary
    },
  });

  return newHq;
}

