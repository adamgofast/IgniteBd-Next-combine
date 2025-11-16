import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV, mapDeliverableCsvToDeliverableTemplates } from '@/lib/services/csvMappers';

/**
 * POST /api/csv/deliverables/upload
 * Upload Deliverable CSV and create DeliverableTemplate records
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

    // Map to DeliverableTemplate objects
    let deliverableTemplates;
    try {
      deliverableTemplates = mapDeliverableCsvToDeliverableTemplates(rows, companyHQId);
    } catch (mapError) {
      return NextResponse.json(
        { success: false, error: `Mapping error: ${mapError.message}` },
        { status: 400 },
      );
    }

    // Upsert DeliverableTemplate records (unique by companyHQId + deliverableType)
    const results = [];
    for (const template of deliverableTemplates) {
      const { _phaseName, _description, _quantity, ...templateData } = template;
      
      const deliverableTemplate = await prisma.deliverableTemplate.upsert({
        where: {
          companyHQId_deliverableType: {
            companyHQId: template.companyHQId,
            deliverableType: template.deliverableType,
          },
        },
        update: {
          deliverableLabel: templateData.deliverableLabel,
          defaultUnitOfMeasure: templateData.defaultUnitOfMeasure,
          defaultDuration: templateData.defaultDuration,
        },
        create: templateData,
      });
      
      results.push(deliverableTemplate);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      deliverableTemplates: results,
    });
  } catch (error) {
    console.error('❌ Upload Deliverable CSV error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload deliverable CSV',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
