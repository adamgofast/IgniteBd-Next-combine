import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { resolveMembership } from '@/lib/membership';

/**
 * POST /api/contacts/create
 * Create or update contact by email (if provided) - name required, email optional
 * 
 * Body:
 * - crmId (required) - CompanyHQId
 * - firstName (required)
 * - lastName (required)
 * - email (optional) - if provided, used for upsert; if not, creates new contact
 * 
 * Returns:
 * - contact: Created or updated contact
 * 
 * Note: Email is optional to support workflows where contact is created from name only
 * (e.g., LinkedIn scrape, Apollo enrichment) and email is added later via enrichment.
 */
export async function POST(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    
    // Get companyHQId from request body (frontend should send this from localStorage)
    const crmId = body.crmId;
    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId (companyHQId) is required in request body' },
        { status: 400 },
      );
    }

    // Validate crmId format - should not be a company name
    if (crmId.includes(' ') || crmId.toLowerCase() === crmId && crmId.includes('-') && !crmId.match(/^[a-f0-9-]{36}$/i) && !crmId.match(/^[a-z0-9-]+$/)) {
      console.warn(`⚠️ Suspicious crmId format: ${crmId}. This might be a company name instead of an ID.`);
    }

    // Get owner from Firebase user
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      select: { id: true },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 },
      );
    }

    // CRITICAL: Membership guard - verify owner has access to this CompanyHQ
    // This prevents creating contacts in companyHQs the user doesn't belong to
    const { membership } = await resolveMembership(owner.id, crmId);
    if (!membership) {
      console.error(`❌ ACCESS DENIED: Owner ${owner.id} attempted to create contact in CompanyHQ ${crmId} without membership`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: No membership in this CompanyHQ. Please switch to a CompanyHQ you have access to.',
          details: {
            requestedCompanyHQId: crmId,
            ownerId: owner.id,
          },
        },
        { status: 403 },
      );
    }

    // Verify the CompanyHQ actually exists
    const companyHQ = await prisma.company_hqs.findUnique({
      where: { id: crmId },
      select: { id: true, companyName: true },
    });

    if (!companyHQ) {
      console.error(`❌ CompanyHQ not found: ${crmId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'CompanyHQ not found. The companyHQId may be incorrect.',
          details: { requestedCompanyHQId: crmId },
        },
        { status: 404 },
      );
    }

    console.log(`✅ Membership verified: Owner ${owner.id} has ${membership.role} role in CompanyHQ ${crmId} (${companyHQ.companyName})`);
    const { firstName, lastName, email } = body;

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: 'firstName and lastName are required' },
        { status: 400 },
      );
    }

    const now = new Date();
    let contact;

    // If email is provided, use it for upsert; otherwise create new contact
    if (email && email.trim()) {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // CANON: Contacts are CompanyHQ-scoped
      // Query by email + crmId only (not globally)
      const existingContact = await prisma.contact.findUnique({
        where: {
          email_crmId: {
            email: normalizedEmail,
            crmId: crmId,
          },
        },
      });

      if (existingContact) {
        // Contact already exists in this CompanyHQ - update name fields
        contact = await prisma.contact.update({
          where: {
            id: existingContact.id,
          },
          data: {
            firstName,
            lastName,
            updatedAt: now,
          },
        });
        console.log(`✅ Updated existing contact ${normalizedEmail} in CompanyHQ ${crmId}`);
      } else {
        // Create new contact in this CompanyHQ with email
        // CANON: Same email can exist in different CompanyHQs - each CompanyHQ has its own record
        contact = await prisma.contact.create({
          data: {
            crmId,
            firstName,
            lastName,
            email: normalizedEmail,
            ownerId: owner.id,
            createdAt: now,
            updatedAt: now,
          },
        });
        console.log(`✅ Created new contact ${normalizedEmail} in CompanyHQ ${crmId}`);
      }
    } else {
      // No email provided - create new contact without email (can be enriched later)
      contact = await prisma.contact.create({
        data: {
          crmId,
          firstName,
          lastName,
          email: null,
          ownerId: owner.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      console.log(`✅ Created new contact ${firstName} ${lastName} (no email) in CompanyHQ ${crmId}`);
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('❌ CreateContact error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create contact',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
