import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/workpackages/bulk-upload
 * Bulk upload work package with phases and items
 * Supports CSV upload or multi-row form data
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
    const { contactId, rows } = body;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'rows array is required' },
        { status: 400 },
      );
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
    const phaseMap = new Map(); // phaseName -> { name, position, timeline }
    const itemsByPhase = new Map(); // phaseName -> [items]

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
        // Update position if higher
        const existing = phaseMap.get(phaseName);
        if (position > existing.position) {
          existing.position = position;
        }
        if (timeline && !existing.timeline) {
          existing.timeline = timeline;
        }
      }

      // Add item to phase
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
    console.error('❌ BulkUploadWorkPackage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create work package',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

