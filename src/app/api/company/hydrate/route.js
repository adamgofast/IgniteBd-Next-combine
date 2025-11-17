import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/company/hydrate
 * Comprehensive hydration endpoint for companyHQ
 * Fetches all related data: personas, contacts, products, pipelines, templates, etc.
 * 
 * Query params:
 * - companyHQId (required)
 * 
 * Returns:
 * - companyHQ: Full company data
 * - personas: Array of personas (or empty array)
 * - contacts: Array of contacts (or empty array)
 * - products: Array of products (or empty array)
 * - pipelines: Array of pipelines (or empty array)
 * - proposals: Array of proposals (or empty array)
 * - phaseTemplates: Array of phase templates (or empty array)
 * - deliverableTemplates: Array of deliverable templates (or empty array)
 * - stats: Counts and metrics
 */
export async function GET(request) {
  // Use optionalAuth for GET (read operation, scoped by companyHQId)
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    console.log(`🚀 COMPANY HYDRATE: Fetching all data for companyHQId: ${companyHQId}`);

    // Fetch all data in parallel
    const [companyHQ, personas, contacts, products, pipelines, proposals, phaseTemplates, deliverableTemplates, workPackages] = await Promise.all([
      // CompanyHQ
      prisma.companyHQ.findUnique({
        where: { id: companyHQId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      // Personas
      prisma.persona.findMany({
        where: { companyHQId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              valueProp: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }).catch(() => []), // Return empty array on error

      // Contacts (limit to 100 for performance)
      prisma.contact.findMany({
        where: { crmId: companyHQId },
        include: {
          contactCompany: {
            select: {
              id: true,
              companyName: true,
              industry: true,
            },
          },
          pipeline: {
            select: {
              id: true,
              pipeline: true,
              stage: true,
            },
          },
        },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      }).catch(() => []), // Return empty array on error

      // Products
      prisma.product.findMany({
        where: { companyHQId },
        orderBy: { updatedAt: 'desc' },
      }).catch(() => []), // Return empty array on error

      // Pipelines (from contacts)
      prisma.pipeline.findMany({
        where: {
          contact: {
            crmId: companyHQId,
          },
        },
        select: {
          id: true,
          contactId: true,
          pipeline: true,
          stage: true,
        },
        take: 100,
      }).catch(() => []), // Return empty array on error

      // Proposals
      prisma.proposal.findMany({
        where: { companyHQId },
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []), // Return empty array on error

      // Phase Templates
      prisma.phaseTemplate.findMany({
        where: { companyHQId },
        orderBy: { createdAt: 'desc' },
      }).then((templates) => {
        console.log(`📦 Company hydrate: Found ${templates.length} phase templates for ${companyHQId}`);
        return templates;
      }).catch((err) => {
        console.error('❌ Error fetching phase templates in company hydrate:', err);
        return [];
      }),

      // Deliverable Templates
      prisma.deliverableTemplate.findMany({
        where: { companyHQId },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []), // Return empty array on error

      // Work Packages (get all work packages for contacts in this company)
      prisma.workPackage.findMany({
        where: {
          contact: {
            crmId: companyHQId,
          },
        },
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
        orderBy: { createdAt: 'desc' },
      }).catch(() => []), // Return empty array on error
    ]);

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Calculate stats
    const stats = {
      personaCount: personas.length,
      contactCount: contacts.length,
      productCount: products.length,
      pipelineCount: pipelines.length,
      proposalCount: proposals.length,
      prospectCount: contacts.filter(
        (c) => c.pipeline?.pipeline === 'prospect',
      ).length,
      clientCount: contacts.filter(
        (c) => c.pipeline?.pipeline === 'client',
      ).length,
    };

    const hydratedData = {
      success: true,
      companyHQ,
      personas: personas || [],
      contacts: contacts || [],
      products: products || [],
      pipelines: pipelines || [],
      proposals: proposals || [],
      phaseTemplates: phaseTemplates || [],
      deliverableTemplates: deliverableTemplates || [],
      workPackages: workPackages || [],
      stats,
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ COMPANY HYDRATE: Successfully hydrated ${companyHQId}`, stats);

    return NextResponse.json(hydratedData);
  } catch (error) {
    console.error('❌ COMPANY HYDRATE: Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to hydrate company data',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

