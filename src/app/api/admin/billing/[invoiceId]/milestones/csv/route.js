import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/billing/:invoiceId/milestones/csv
 * Import CSV milestones for an existing invoice
 * 
 * CSV Format (ONLY milestone data, no parent fields):
 * - label (required)
 * - expectedAmount (required)
 * - expectedDate (optional)
 * - description (optional)
 * 
 * Parent context (invoiceId) comes from URL parameter, not CSV
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { invoiceId } = await params;
    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { csvText, columnMapping } = body;

    if (!csvText) {
      return NextResponse.json(
        { success: false, error: 'csvText is required' },
        { status: 400 },
      );
    }

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
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

    // Validate required columns
    if (labelIdx === -1) {
      return NextResponse.json(
        { success: false, error: 'CSV must have a "label" column' },
        { status: 400 },
      );
    }

    if (amountIdx === -1) {
      return NextResponse.json(
        { success: false, error: 'CSV must have an "expectedAmount" column' },
        { status: 400 },
      );
    }

    // Parse data rows
    const milestones = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map((v) => v.trim());

      const label = values[labelIdx];
      const expectedAmountStr = values[amountIdx];
      const expectedDateStr = dateIdx !== -1 && values[dateIdx] ? values[dateIdx] : null;
      const description = descIdx !== -1 && values[descIdx] ? values[descIdx] : null;

      // Validate label
      if (!label || label.length === 0) {
        errors.push(`Row ${i + 1}: label is required`);
        continue;
      }

      // Validate and parse expectedAmount (must be numeric)
      const expectedAmount = parseInt(expectedAmountStr, 10);
      if (isNaN(expectedAmount) || expectedAmount <= 0) {
        errors.push(`Row ${i + 1}: expectedAmount must be a positive number, got "${expectedAmountStr}"`);
        continue;
      }

      // Validate and parse expectedDate (if provided)
      let expectedDate = null;
      if (expectedDateStr) {
        expectedDate = new Date(expectedDateStr);
        if (isNaN(expectedDate.getTime())) {
          errors.push(`Row ${i + 1}: expectedDate is invalid, got "${expectedDateStr}"`);
          continue;
        }
      }

      milestones.push({
        invoiceId,
        label,
        expectedAmount,
        expectedDate,
        description: description || null,
        status: 'pending',
      });
    }

    // Return errors if any
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSV validation errors',
          errors,
        },
        { status: 400 },
      );
    }

    if (milestones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid milestones found in CSV' },
        { status: 400 },
      );
    }

    // Import milestones and recalculate invoice totals in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create milestones
      await tx.invoiceMilestone.createMany({
        data: milestones,
      });

      // Get all milestones for this invoice (including newly created ones)
      const allMilestones = await tx.invoiceMilestone.findMany({
        where: { invoiceId },
      });

      // Calculate totalExpected
      const totalExpected = allMilestones.reduce(
        (sum, m) => sum + m.expectedAmount,
        0,
      );

      // Get all payments for this invoice
      const payments = await tx.payment.findMany({
        where: { invoiceId },
      });

      // Calculate totalReceived
      const totalReceived = payments.reduce(
        (sum, p) => sum + p.amountReceived,
        0,
      );

      // Determine status
      let status = 'pending';
      if (totalReceived === 0) {
        status = 'pending';
      } else if (totalReceived < totalExpected) {
        status = 'partial';
      } else if (totalReceived >= totalExpected) {
        status = 'paid';
      }

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          totalExpected,
          totalReceived,
          status,
        },
        include: {
          milestones: {
            orderBy: { expectedDate: 'asc' },
          },
        },
      });

      return {
        invoice: updatedInvoice,
        milestonesImported: milestones.length,
        totalExpected,
        totalReceived,
        status,
      };
    });

    console.log(`✅ Imported ${result.milestonesImported} milestones for invoice ${invoiceId}`);

    return NextResponse.json({
      success: true,
      ...result,
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

