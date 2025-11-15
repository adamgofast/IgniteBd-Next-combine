import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAlignmentScore } from '@/lib/alignmentScore';
import { verifyFirebaseToken, optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  // Use optionalAuth for GET requests (read operations)
  // Data is scoped by companyHQId, so auth is optional
  await optionallyVerifyFirebaseToken(request);

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;
    const productId = searchParams.get('productId');

    if (!companyHQId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const personas = await prisma.persona.findMany({
      where: {
        companyHQId,
        ...(productId ? { 
          productFit: {
            productId: productId
          }
        } : {}),
      },
      include: {
        productFit: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                valueProp: true,
              },
            },
          },
        },
        bdIntel: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(personas);
  } catch (error) {
    console.error('❌ Personas GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personas' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      id = null,
      personName,
      name, // Backward compatibility - map to personName
      title,
      headline = null,
      seniority = null,
      industry = null,
      subIndustries = null,
      company = null,
      companySize = null,
      annualRevenue = null,
      location = null,
      description = null,
      whatTheyWant = null,
      painPoints = null,
      risks = null,
      decisionDrivers = null,
      buyerTriggers = null,
      companyHQId,
    } = body ?? {};

    const tenantId = companyHQId || DEFAULT_COMPANY_HQ_ID;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    const finalPersonName = personName || name;
    if (!finalPersonName) {
      return NextResponse.json(
        { error: 'personName is required' },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 },
      );
    }

    // Normalize array fields - convert string/JSON to array if needed
    const normalizeArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return [value];
        }
      }
      return [];
    };
    
    const personaData = {
      companyHQId: tenantId,
      personName: finalPersonName,
      title,
      headline,
      seniority,
      industry,
      subIndustries: normalizeArray(subIndustries),
      company,
      companySize,
      annualRevenue,
      location,
      description,
      whatTheyWant,
      painPoints: normalizeArray(painPoints),
      risks: normalizeArray(risks),
      decisionDrivers: normalizeArray(decisionDrivers),
      buyerTriggers: normalizeArray(buyerTriggers),
    };

    let persona;
    if (id) {
      const existing = await prisma.persona.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 },
        );
      }

      persona = await prisma.persona.update({
        where: { id },
        data: personaData,
        include: {
          productFit: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  valueProp: true,
                },
              },
            },
          },
          bdIntel: true,
        },
      });
    } else {
      persona = await prisma.persona.create({
        data: personaData,
        include: {
          productFit: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  valueProp: true,
                },
              },
            },
          },
          bdIntel: true,
        },
      });
    }

    return NextResponse.json(
      {
        personaId: persona.id,
        persona,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ Persona POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 },
    );
  }
}

