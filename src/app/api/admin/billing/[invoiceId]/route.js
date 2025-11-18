import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getInvoiceStatus, getOutstandingAmount, getLastPaymentDate } from '@/lib/utils/invoiceStatus';

/**
 * GET /api/admin/billing/:invoiceId
 * Get invoice details with milestones and payments
 */
export async function GET(request, { params }) {
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

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            goesBy: true,
          },
        },
        contactCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
          },
        },
        workPackage: {
          select: {
            id: true,
            title: true,
          },
        },
        milestones: {
          orderBy: { expectedDate: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: {
            milestone: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    // Derive status
    const status = getInvoiceStatus(invoice, invoice.payments);
    const outstandingAmount = getOutstandingAmount(invoice, invoice.payments);
    const lastPaymentDate = getLastPaymentDate(invoice.payments);

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        status,
        outstandingAmount,
        lastPaymentDate,
      },
    });
  } catch (error) {
    console.error('❌ Get invoice error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoice',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/billing/:invoiceId
 * Update invoice container (not milestones)
 */
export async function PUT(request, { params }) {
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
    const {
      invoiceNumber,
      totalAmount,
      description,
      dueDate,
    } = body;

    // Verify invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      );
    }

    // Build update data
    const updateData = {};
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contactCompany: {
          select: {
            id: true,
            companyName: true,
          },
        },
        milestones: true,
        payments: true,
      },
    });

    // Derive status
    const status = getInvoiceStatus(invoice, invoice.payments);
    const outstandingAmount = getOutstandingAmount(invoice, invoice.payments);

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        status,
        outstandingAmount,
      },
    });
  } catch (error) {
    console.error('❌ Update invoice error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update invoice',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

