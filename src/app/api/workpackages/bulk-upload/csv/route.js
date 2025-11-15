import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/workpackages/bulk-upload/csv
 * Parse CSV and create work package with phases and items
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

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV must have at least a header and one data row' },
        { status: 400 },
      );
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredColumns = ['phasename', 'phaseposition', 'itemtype', 'itemlabel', 'quantity'];
    
    // Validate columns
    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 },
      );
    }

    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });
      
      rows.push({
        phaseName: row.phasename || '',
        phasePosition: row.phaseposition || '1',
        phaseTimeline: row.phasetimeline || null,
        itemType: row.itemtype || 'blog',
        itemLabel: row.itemlabel || 'Untitled Item',
        itemDescription: row.itemdescription || null,
        quantity: row.quantity || '1',
      });
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    // Phase deduplication and ordering
    const phaseMap = new Map();
    const itemsByPhase = new Map();

    rows.forEach((row) => {
      const phaseName = row.phaseName?.trim() || 'Unnamed Phase';
      const position = parseInt(row.phasePosition) || 1;
      const timeline = row.phaseTimeline?.trim() || null;

      if (!phaseMap.has(phaseName)) {
        phaseMap.set(phaseName, {
          name: phaseName,
          position: position,
          timeline: timeline,
        });
        itemsByPhase.set(phaseName, []);
      } else {
        const existing = phaseMap.get(phaseName);
        if (position > existing.position) {
          existing.position = position;
        }
        if (timeline && !existing.timeline) {
          existing.timeline = timeline;
        }
      }

      itemsByPhase.get(phaseName).push({
        itemType: row.itemType?.trim() || 'blog',
        itemLabel: row.itemLabel?.trim() || 'Untitled Item',
        itemDescription: row.itemDescription?.trim() || null,
        quantity: parseInt(row.quantity) || 1,
      });
    });

    // Sort phases by position
    const phases = Array.from(phaseMap.values()).sort((a, b) => a.position - b.position);

    // Create WorkPackage
    const workPackage = await prisma.workPackage.create({
      data: {
        contactId,
        phases: {
          create: phases.map((phase, index) => ({
            name: phase.name,
            position: phase.position || index + 1,
            timeline: phase.timeline,
            items: {
              create: itemsByPhase.get(phase.name).map((item) => ({
                itemType: item.itemType,
                itemLabel: item.itemLabel,
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                status: 'todo',
              })),
            },
          })),
        },
      },
      include: {
        phases: {
          include: {
            items: true,
          },
          orderBy: { position: 'asc' },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workPackage,
    });
  } catch (error) {
    console.error('❌ CSVUploadWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse CSV and create work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

