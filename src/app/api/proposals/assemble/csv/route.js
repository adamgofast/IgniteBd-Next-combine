import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * Parse CSV text into array of objects
 * Expected format: phaseName, position, deliverableType, itemLabel, quantity, duration?, unitOfMeasure?, itemDescription?
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  
  // Find column indices
  const phaseNameIdx = headers.findIndex((h) => h.includes('phase') && h.includes('name'));
  const positionIdx = headers.findIndex((h) => h.includes('position'));
  const deliverableTypeIdx = headers.findIndex((h) => h.includes('deliverable') && h.includes('type'));
  const itemLabelIdx = headers.findIndex((h) => h.includes('item') && h.includes('label'));
  const quantityIdx = headers.findIndex((h) => h.includes('quantity'));
  const durationIdx = headers.findIndex((h) => h.includes('duration'));
  const unitOfMeasureIdx = headers.findIndex((h) => h.includes('unit') || h.includes('measure'));
  const itemDescriptionIdx = headers.findIndex((h) => h.includes('item') && h.includes('description') || h.includes('description'));

  if (phaseNameIdx === -1 || positionIdx === -1 || deliverableTypeIdx === -1 || itemLabelIdx === -1 || quantityIdx === -1) {
    throw new Error('CSV must contain phaseName, position, deliverableType, itemLabel, and quantity columns');
  }

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length >= Math.max(phaseNameIdx, positionIdx, deliverableTypeIdx, itemLabelIdx, quantityIdx) + 1) {
      rows.push({
        phaseName: values[phaseNameIdx] || 'Unnamed Phase',
        position: parseInt(values[positionIdx]) || i,
        deliverableType: values[deliverableTypeIdx] || '',
        itemLabel: values[itemLabelIdx] || 'Untitled Deliverable',
        quantity: parseInt(values[quantityIdx]) || 1,
        duration: durationIdx !== -1 ? (parseInt(values[durationIdx]) || null) : null,
        unitOfMeasure: unitOfMeasureIdx !== -1 ? (values[unitOfMeasureIdx] || null) : null,
        itemDescription: itemDescriptionIdx !== -1 ? (values[itemDescriptionIdx] || null) : null,
      });
    }
  }

  return rows;
}

/**
 * POST /api/proposals/assemble/csv
 * Upload CSV and create proposal
 * Creates Proposal with ProposalPhase and ProposalDeliverable instances from CSV
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
    const contactId = formData.get('contactId');
    const companyHQId = formData.get('companyHQId');
    const companyId = formData.get('companyId');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!contactId || !companyHQId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'contactId, companyHQId, and companyId are required' },
        { status: 400 },
      );
    }

    // Read file content
    const text = await file.text();
    
    // Parse CSV
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

    // Verify contact and company exist
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Call assemble with CSV data
    // Import assemble logic or reuse it
    // For now, we'll create the proposal directly here using the same logic as assemble route
    const deliverableTemplates = await prisma.deliverableTemplate.findMany({
      where: { companyHQId },
    });

    const phaseMap = new Map();
    const deliverablesByPhase = new Map();

    rows.forEach((row) => {
      const phaseName = row.phaseName?.trim() || 'Unnamed Phase';
      const position = parseInt(row.position) || 1;

      if (!phaseMap.has(phaseName)) {
        phaseMap.set(phaseName, {
          name: phaseName,
          position: position,
        });
        deliverablesByPhase.set(phaseName, []);
      }

      const deliverableTemplate = deliverableTemplates.find(
        dt => dt.deliverableType === row.deliverableType
      );

      const duration = parseInt(row.duration) || deliverableTemplate?.defaultDuration || 1;
      const unitOfMeasure = row.unitOfMeasure || deliverableTemplate?.defaultUnitOfMeasure || 'week';
      let durationWeeks = duration;
      if (unitOfMeasure === 'day') {
        durationWeeks = Math.ceil(duration / 5);
      } else if (unitOfMeasure === 'month') {
        durationWeeks = duration * 4;
      }

      deliverablesByPhase.get(phaseName).push({
        durationWeeks,
        deliverableTemplate,
        row,
      });
    });

    const proposalPhases = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position).map((phase) => {
      const phaseDeliverables = deliverablesByPhase.get(phase.name);
      const maxDurationWeeks = phaseDeliverables.length > 0 
        ? Math.max(...phaseDeliverables.map(d => d.durationWeeks || 3), 3) 
        : 3;
      
      return {
        phaseTemplateId: null,
        name: phase.name,
        description: null,
        durationWeeks: maxDurationWeeks,
        order: phase.position,
      };
    });

    const proposalDeliverables = rows.map((row) => {
      const deliverableTemplate = deliverableTemplates.find(
        dt => dt.deliverableType === row.deliverableType
      );
      const quantity = parseInt(row.quantity) || 1;
      const unitPrice = parseFloat(row.unitPrice) || null;
      const totalPrice = unitPrice ? unitPrice * quantity : null;
      
      return {
        name: row.itemLabel || deliverableTemplate?.deliverableLabel || 'Untitled Deliverable',
        description: row.itemDescription || null,
        quantity,
        unitPrice,
        totalPrice,
        notes: null,
      };
    });

    // Calculate totalPrice from deliverables
    const calculatedTotalPrice = proposalDeliverables.reduce((sum, d) => {
      return sum + (d.totalPrice || (d.unitPrice ? d.unitPrice * d.quantity : 0));
    }, 0);

    // Create Proposal
    const proposal = await prisma.proposal.create({
      data: {
        companyHQId,
        title: `Proposal for ${contact.firstName} ${contact.lastName}`,
        contactId,
        companyId,
        estimatedStart: new Date(),
        purpose: null,
        status: 'draft',
        totalPrice: calculatedTotalPrice > 0 ? calculatedTotalPrice : null,
        dateIssued: new Date(),
        proposalPhases: {
          create: proposalPhases.map((phase) => ({
            phaseTemplateId: phase.phaseTemplateId || null,
            name: phase.name,
            description: phase.description || null,
            durationWeeks: phase.durationWeeks || 3,
            order: phase.order,
          })),
        },
        proposalDeliverables: {
          create: proposalDeliverables.map((deliverable) => ({
            name: deliverable.name,
            description: deliverable.description || null,
            quantity: deliverable.quantity,
            unitPrice: deliverable.unitPrice,
            totalPrice: deliverable.totalPrice || (deliverable.unitPrice ? deliverable.unitPrice * deliverable.quantity : null),
            notes: deliverable.notes || null,
          })),
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
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        proposalPhases: {
          include: {
            phaseTemplate: true,
          },
          orderBy: { order: 'asc' },
        },
        proposalDeliverables: true,
      },
    });

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error('❌ Assemble CSV error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process CSV file',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
