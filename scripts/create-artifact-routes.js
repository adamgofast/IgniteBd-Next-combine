/**
 * Script to generate artifact route files
 * Run: node scripts/create-artifact-routes.js
 */

const fs = require('fs');
const path = require('path');

const artifacts = [
  { name: 'templates', model: 'Template', fields: ['name', 'subject', 'body', 'type'] },
  { name: 'eventplans', model: 'EventPlan', fields: ['eventName', 'date', 'location', 'agenda', 'description'] },
  { name: 'cledecks', model: 'CleDeck', fields: ['title', 'slides', 'presenter', 'description'] },
  { name: 'landingpages', model: 'LandingPage', fields: ['title', 'url', 'content', 'description'] },
];

const routeTemplate = (artifactName, Model, fields) => `import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/${artifactName}
 * Create a new ${artifactName.slice(0, -1)}
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
      companyHQId,
      ${fields.map(f => f.toLowerCase()).join(',\n      ')},
      published = false,
    } = body ?? {};

    if (!companyHQId || !${fields[0].toLowerCase()}) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and ${fields[0].toLowerCase()} are required' },
        { status: 400 },
      );
    }

    const ${artifactName.slice(0, -1)} = await prisma.${Model.toLowerCase()}.create({
      data: {
        companyHQId,
        ${fields.map(f => `${f.toLowerCase()}: ${f.toLowerCase()} || null`).join(',\n        ')},
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ ${Model} created:', ${artifactName.slice(0, -1)}.id);

    return NextResponse.json({
      success: true,
      ${artifactName.slice(0, -1)},
    });
  } catch (error) {
    console.error('❌ Create${Model} error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ${artifactName.slice(0, -1)}',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/${artifactName}
 * List ${artifactName}
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const published = searchParams.get('published');

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;
    if (published !== null) where.published = published === 'true';

    const ${artifactName} = await prisma.${Model.toLowerCase()}.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      ${artifactName},
    });
  } catch (error) {
    console.error('❌ List${Model}s error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list ${artifactName}',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
`;

const detailRouteTemplate = (artifactName, Model, fields) => `import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

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
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: '${Model} ID is required' },
        { status: 400 },
      );
    }

    const ${artifactName.slice(0, -1)} = await prisma.${Model.toLowerCase()}.findUnique({
      where: { id },
    });

    if (!${artifactName.slice(0, -1)}) {
      return NextResponse.json(
        { success: false, error: '${Model} not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ${artifactName.slice(0, -1)},
    });
  } catch (error) {
    console.error('❌ Get${Model} error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get ${artifactName.slice(0, -1)}',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: '${Model} ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      ${fields.map(f => f.toLowerCase()).join(',\n      ')},
      published,
    } = body ?? {};

    const updateData = {};
    ${fields.map(f => `if (${f.toLowerCase()} !== undefined) updateData.${f.toLowerCase()} = ${f.toLowerCase()};`).join('\n    ')}
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const ${artifactName.slice(0, -1)} = await prisma.${Model.toLowerCase()}.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ ${Model} updated:', ${artifactName.slice(0, -1)}.id);

    return NextResponse.json({
      success: true,
      ${artifactName.slice(0, -1)},
    });
  } catch (error) {
    console.error('❌ Update${Model} error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update ${artifactName.slice(0, -1)}',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: '${Model} ID is required' },
        { status: 400 },
      );
    }

    await prisma.${Model.toLowerCase()}.delete({
      where: { id },
    });

    console.log('✅ ${Model} deleted:', id);

    return NextResponse.json({
      success: true,
      message: '${Model} deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete${Model} error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete ${artifactName.slice(0, -1)}',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
`;

artifacts.forEach(({ name, model, fields }) => {
  const baseDir = path.join(__dirname, '..', 'src', 'app', 'api', 'artifacts', name);
  const routeFile = path.join(baseDir, 'route.js');
  const detailDir = path.join(baseDir, '[id]');
  const detailFile = path.join(detailDir, 'route.js');

  // Create directories
  if (!fs.existsSync(detailDir)) {
    fs.mkdirSync(detailDir, { recursive: true });
  }

  // Write route files
  fs.writeFileSync(routeFile, routeTemplate(name, model, fields));
  fs.writeFileSync(detailFile, detailRouteTemplate(name, model, fields));

  console.log(`✅ Created routes for ${name}`);
});

console.log('✅ All artifact routes created!');

