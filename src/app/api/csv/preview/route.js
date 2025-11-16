import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { parseCSV } from '@/lib/services/csvMappers';
import { mapCsvHeadersToFields, getFieldMappingSuggestions } from '@/lib/services/universalCsvFieldMapper';

/**
 * POST /api/csv/preview
 * Preview CSV file and show field mappings
 * Returns: headers, mappings, sampleData, warnings
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
    const uploadType = formData.get('uploadType'); // 'phase' or 'deliverable'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'CSV file is required' },
        { status: 400 },
      );
    }

    if (!uploadType || !['phase', 'deliverable'].includes(uploadType)) {
      return NextResponse.json(
        { success: false, error: 'uploadType must be "phase" or "deliverable"' },
        { status: 400 },
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

    // Get headers from first row
    const headers = Object.keys(rows[0]);
    
    // Map headers to fields
    const fieldMappings = mapCsvHeadersToFields(headers, uploadType);
    const suggestions = getFieldMappingSuggestions(headers, uploadType);
    
    // Get sample data (first 5 rows)
    const sampleData = rows.slice(0, 5);
    
    // Check for unmapped fields
    const unmappedFields = fieldMappings.filter(m => m.mappedField === 'unmapped');
    const warnings = [];
    
    if (unmappedFields.length > 0) {
      warnings.push(`${unmappedFields.length} column(s) could not be automatically mapped`);
    }
    
    // Check for missing recommended fields
    const requiredMappings = fieldMappings.filter(m => m.isRequired);
    const missingRequired = requiredMappings.filter(m => {
      // Check if any sample row has this field
      return !sampleData.some(row => row[m.csvHeader] && row[m.csvHeader].trim());
    });
    
    if (missingRequired.length > 0) {
      warnings.push(`Missing recommended fields: ${missingRequired.map(m => m.csvHeader).join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      headers,
      fieldMappings,
      suggestions,
      sampleData,
      totalRows: rows.length,
      warnings,
      unmappedFields: unmappedFields.map(f => f.csvHeader),
    });
  } catch (error) {
    console.error('❌ CSV Preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to preview CSV',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
