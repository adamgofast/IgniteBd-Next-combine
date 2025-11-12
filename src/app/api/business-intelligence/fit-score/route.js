import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import {
  calculateFitScore,
  findMatchingPersona,
} from '@/lib/services/BusinessIntelligenceScoringService';

/**
 * POST /api/business-intelligence/fit-score
 * Calculate fit score between a contact and a product (offer)
 * 
 * Body:
 * - contactId (required) - Contact ID
 * - productId (required) - Product ID (the offer)
 * - personaId (optional) - Persona ID (if not provided, will try to find best match)
 * 
 * Returns:
 * - success: true
 * - scores: { pointOfNeed, painAlignment, willingnessToPay, impactPotential, contextFit, totalScore }
 * - summary: Text summary of the fit
 * - personaId: Persona ID used (if any)
 */
export async function POST(request) {
  try {
    // Verify Firebase token
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { contactId, productId, personaId } = body;

    // Validate required fields
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 },
      );
    }

    // Verify contact exists and belongs to user's tenant
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { crmId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Verify product exists and belongs to user's tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { companyHQId: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    // Ensure contact and product belong to same tenant
    if (contact.crmId !== product.companyHQId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact and Product must belong to the same tenant',
        },
        { status: 403 },
      );
    }

    // If personaId not provided, try to find best match
    let finalPersonaId = personaId;
    let personaMatchDetails = null;
    if (!finalPersonaId) {
      const matchResult = await findMatchingPersona(contactId, contact.crmId, { returnDetails: true });
      finalPersonaId = matchResult?.personaId || null;
      personaMatchDetails = matchResult;
      if (finalPersonaId) {
        console.log(
          `✅ Auto-matched persona ${finalPersonaId} for contact ${contactId} (confidence: ${matchResult?.confidence || 0}%)`,
        );
      }
    } else {
      // Verify persona exists and belongs to same tenant
      const persona = await prisma.persona.findUnique({
        where: { id: finalPersonaId },
        select: { companyHQId: true },
      });

      if (!persona) {
        return NextResponse.json(
          { success: false, error: 'Persona not found' },
          { status: 404 },
        );
      }

      if (persona.companyHQId !== contact.crmId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Persona must belong to the same tenant',
          },
          { status: 403 },
        );
      }
    }

    // Calculate fit score
    const result = await calculateFitScore(
      contactId,
      productId,
      finalPersonaId,
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to calculate fit score',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      contactId,
      productId,
      personaId: finalPersonaId,
      personaMatch: personaMatchDetails ? {
        confidence: personaMatchDetails.confidence,
        bestMatch: personaMatchDetails.bestMatch,
      } : null,
      scores: result.scores,
      summary: result.summary,
    });
  } catch (error) {
    console.error('❌ Fit score calculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate fit score',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/business-intelligence/fit-score
 * Calculate fit score for a contact-product pair
 * 
 * Query params:
 * - contactId (required)
 * - productId (required)
 * 
 * Note: This endpoint calculates on demand (calls OpenAI)
 * Uses verifyFirebaseToken since it performs computation (not just reading data)
 */
export async function GET(request) {
  try {
    // Verify Firebase token
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const productId = searchParams.get('productId');

    if (!contactId || !productId) {
      return NextResponse.json(
        {
          success: false,
          error: 'contactId and productId are required',
        },
        { status: 400 },
      );
    }

    // Find matching persona
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { crmId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const matchResult = await findMatchingPersona(contactId, contact.crmId, { returnDetails: true });
    const personaId = matchResult?.personaId || null;

    // Calculate fit score
    const result = await calculateFitScore(contactId, productId, personaId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to calculate fit score',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      contactId,
      productId,
      personaId,
      personaMatch: matchResult ? {
        confidence: matchResult.confidence,
        bestMatch: matchResult.bestMatch,
      } : null,
      scores: result.scores,
      summary: result.summary,
    });
  } catch (error) {
    console.error('❌ Fit score GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate fit score',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

