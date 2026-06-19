/**
 * CSV Parser Utility
 * Safe CSV parsing with type guards and validation
 */

export interface CSVRow {
  [key: string]: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: CSVRow[];
  errors: string[];
}

/**
 * Parse CSV text into structured data
 */
export function parseCSV(csvText: string): ParsedCSV {
  const errors: string[] = [];
  const normalized = (csvText ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['CSV file is empty'] };
  }

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  
  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['CSV headers are missing'] };
  }

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.every(v => !v.trim())) {
      continue;
    }

    // Ensure row has same number of columns as headers
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    rows.push(row);
  }

  return { headers, rows, errors };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current);
  
  return values;
}

/**
 * Type guard: Check if row has required fields for WorkPackage CSV
 */
export function isValidWorkPackageCSVRow(row: CSVRow): boolean {
  const required = [
    'phasename',
    'phaseposition',
    'deliverablelabel',
    'deliverabletype',
    'quantity',
    'estimatedhourseach',
    'status'
  ];
  
  return required.every(field => {
    const value = row[field];
    return value !== undefined && value !== null && value.trim() !== '';
  });
}

/**
 * Validate and normalize CSV row for WorkPackage import
 */
export interface WorkPackageCSVRow {
  // Proposal metadata (from first row)
  proposalDescription?: string;
  proposalTotalCost?: number;
  proposalNotes?: string;
  
  // Phase data
  phaseName: string;
  phasePosition: number;
  phaseDescription?: string;
  
  // Deliverable data
  deliverableLabel: string;
  deliverableType: string;
  deliverableDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedHoursEach: number;
  status: string;
}

export function normalizeWorkPackageCSVRow(row: CSVRow): WorkPackageCSVRow | null {
  try {
    // Extract phase data
    const phaseName = row['phasename']?.trim();
    const phasePosition = parseInt(row['phaseposition']?.trim() || '0', 10);
    
    if (!phaseName || isNaN(phasePosition) || phasePosition < 1) {
      return null;
    }

    // Extract deliverable data
    const deliverableLabel = row['deliverablelabel']?.trim();
    const deliverableType = row['deliverabletype']?.trim().toUpperCase();
    const quantity = parseInt(row['quantity']?.trim() || '1', 10);
    const estimatedHoursEach = parseInt(row['estimatedhourseach']?.trim() || '0', 10);
    
    if (!deliverableLabel || !deliverableType || isNaN(quantity) || quantity < 1 || isNaN(estimatedHoursEach) || estimatedHoursEach < 0) {
      return null;
    }

    // Extract optional fields
    const proposalDescription = row['proposaldescription']?.trim();
    const proposalTotalCost = row['proposaltotalcost'] ? parseFloat(row['proposaltotalcost'].trim()) : undefined;
    const proposalNotes = row['proposalnotes']?.trim();
    const phaseDescription = row['phasedescription']?.trim();
    const deliverableDescription = row['deliverabledescription']?.trim();
    const unitOfMeasure = row['unitofmeasure']?.trim() || 'item';
    const status = row['status']?.trim().toLowerCase() || 'not_started';

    return {
      proposalDescription,
      proposalTotalCost: isNaN(proposalTotalCost as number) ? undefined : proposalTotalCost,
      proposalNotes,
      phaseName,
      phasePosition,
      phaseDescription,
      deliverableLabel,
      deliverableType,
      deliverableDescription,
      quantity,
      unitOfMeasure,
      estimatedHoursEach,
      status,
    };
  } catch (error) {
    console.error('Error normalizing CSV row:', error);
    return null;
  }
}

/**
 * Extract proposal metadata from first row
 */
export function extractProposalMetadata(rows: WorkPackageCSVRow[]): {
  description?: string;
  totalCost?: number;
  notes?: string;
} {
  if (rows.length === 0) {
    return {};
  }

  const firstRow = rows[0];
  return {
    description: firstRow.proposalDescription,
    totalCost: firstRow.proposalTotalCost,
    notes: firstRow.proposalNotes,
  };
}

