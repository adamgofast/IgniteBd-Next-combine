import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV, mapPhaseCsvToPhaseTemplates } from '@/lib/services/csvMappers';

/**
 * POST /api/csv/phases/upload
 * Upload Phase CSV and create PhaseTemplate records
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const companyHQId = formData.get('companyHQId');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Verify companyHQ exists
    const companyHQ = await prisma.companyHQ.findUnique({
      where: { id: companyHQId },
    });

    if (!companyHQ) {
      return NextResponse.json(
        { success: false, error: 'CompanyHQ not found' },
        { status: 404 },
      );
    }

    // Read and parse CSV
    const text = await file.text();
    let rows;
    try {
      rows = parseCSV(text);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: `CSV parsing error: ${parseError.message}` },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid rows found in CSV' },
        { status: 400 },
      );
    }

    // Map to PhaseTemplate objects
    let phaseTemplates;
    try {
      phaseTemplates = mapPhaseCsvToPhaseTemplates(rows, companyHQId);
    } catch (mapError) {
      return NextResponse.json(
        { success: false, error: `Mapping error: ${mapError.message}` },
        { status: 400 },
      );
    }

    // Upsert PhaseTemplate records (unique by companyHQId + name)
    const results = [];
    for (const template of phaseTemplates) {
      const { _order, ...templateData } = template;
      
      const phaseTemplate = await prisma.phaseTemplate.upsert({
        where: {
          companyHQId_name: {
            companyHQId: template.companyHQId,
            name: template.name,
          },
        },
        update: {
          description: templateData.description,
        },
        create: templateData,
      });
      
      results.push(phaseTemplate);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      phaseTemplates: results,
    });
  } catch (error) {
    console.error('❌ Upload Phase CSV error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload phase CSV',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
