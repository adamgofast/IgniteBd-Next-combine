import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/billing/template/csv
 * Upload CSV → parse → preview → save template
 * 
 * Expected CSV columns:
 * - label (required)
 * - expectedAmount (required)
 * - expectedDate (optional)
 * - description (optional)
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
    const body = await request.json();
    const {
      csvText,
      templateName,
      columnMapping, // Optional: { label: 'Label', expectedAmount: 'Amount', ... }
    } = body;

    if (!csvText || !templateName) {
      return NextResponse.json(
        { success: false, error: 'csvText and templateName are required' },
        { status: 400 },
      );
    }

    // Parse CSV
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV must have at least a header row and one data row' },
        { status: 400 },
      );
    }

    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

    // Default column mapping
    const defaultMapping = {
      label: 'label',
      expectedAmount: 'expectedamount',
      expectedDate: 'expecteddate',
      description: 'description',
    };

    const mapping = columnMapping || defaultMapping;

    // Find column indices
    const labelIdx = headers.findIndex((h) =>
      h.includes(mapping.label.toLowerCase()),
    );
    const amountIdx = headers.findIndex((h) =>
      h.includes(mapping.expectedAmount.toLowerCase()),
    );
    const dateIdx = headers.findIndex((h) =>
      h.includes(mapping.expectedDate.toLowerCase()),
    );
    const descIdx = headers.findIndex((h) =>
      h.includes(mapping.description.toLowerCase()),
    );

    if (labelIdx === -1 || amountIdx === -1) {
      return NextResponse.json(
        { success: false, error: 'CSV must have label and expectedAmount columns' },
        { status: 400 },
      );
    }

    // Parse data rows
    const milestones = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map((v) => v.trim());

      const label = values[labelIdx];
      const expectedAmount = parseFloat(values[amountIdx]);
      const expectedDate = dateIdx !== -1 && values[dateIdx] ? values[dateIdx] : null;
      const description = descIdx !== -1 && values[descIdx] ? values[descIdx] : null;

      if (!label || isNaN(expectedAmount)) {
        console.warn(`⚠️ Skipping invalid row ${i + 1}:`, { label, expectedAmount });
        continue;
      }

      milestones.push({
        label,
        expectedAmount,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        description,
      });
    }

    if (milestones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid milestones found in CSV' },
        { status: 400 },
      );
    }

    // Create template with milestones in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create template
      const newTemplate = await tx.invoiceTemplate.create({
        data: {
          name: templateName,
          notes: `Created from CSV import with ${milestones.length} milestones`,
        },
      });

      // Create template milestones
      await tx.invoiceTemplateMilestone.createMany({
        data: milestones.map((m) => ({
          templateId: newTemplate.id,
          label: m.label,
          expectedAmount: m.expectedAmount,
          expectedDate: m.expectedDate,
          description: m.description || null,
        })),
      });

      // Return template with milestones
      return tx.invoiceTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          milestones: {
            orderBy: { expectedDate: 'asc' },
          },
        },
      });
    });

    console.log('✅ Template created from CSV:', template.id);

    return NextResponse.json({
      success: true,
      template,
      milestonesImported: milestones.length,
    });
  } catch (error) {
    console.error('❌ CSV import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import CSV',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

