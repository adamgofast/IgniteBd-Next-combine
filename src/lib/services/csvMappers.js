/**
 * CSV Mapper Services
 * Convert plain-English CSV fields to internal schema fields
 * Uses Universal Field Mapper Service for field detection
 */

import { 
  mapCsvHeadersToFields, 
  mapCsvRecordToDatabase, 
  validateMappedData,
  getFieldMappingSuggestions 
} from './universalCsvFieldMapper.js';

/**
 * Map Phase CSV rows to PhaseTemplate objects
 * @param {Array} rows - Parsed CSV rows with plain-English fields
 * @param {string} companyHQId - CompanyHQ ID for scoping
 * @returns {Array} Array of PhaseTemplate objects ready for upsert
 */
export function mapPhaseCsvToPhaseTemplates(rows, companyHQId) {
  if (!rows || rows.length === 0) return [];
  
  // Get headers from first row
  const headers = Object.keys(rows[0]);
  const fieldMappings = mapCsvHeadersToFields(headers, 'phase');
  
  return rows.map((row, index) => {
    // Use universal mapper to map record
    const mapped = mapCsvRecordToDatabase(row, fieldMappings, 'phase');
    
    // Extract values with fallbacks
    const phaseName = mapped.name || `Phase ${index + 1}`;
    const description = mapped.description || null;
    const durationDays = mapped._durationDays || null;

    // Validate (non-blocking - show warning but allow)
    const validation = validateMappedData(mapped, 'phase');
    if (!validation.isValid) {
      console.warn(`Row ${index + 1} validation:`, validation.errors);
    }

    return {
      companyHQId,
      name: phaseName.trim(),
      description: description ? description.trim() : null,
      _durationDays: durationDays,
      _validation: validation, // Store validation for preview
    };
  });
}

/**
 * Map Deliverable CSV rows to DeliverableTemplate objects
 * @param {Array} rows - Parsed CSV rows with plain-English fields
 * @param {string} companyHQId - CompanyHQ ID for scoping
 * @returns {Array} Array of DeliverableTemplate objects ready for upsert
 */
export function mapDeliverableCsvToDeliverableTemplates(rows, companyHQId) {
  if (!rows || rows.length === 0) return [];
  
  // Get headers from first row
  const headers = Object.keys(rows[0]);
  const fieldMappings = mapCsvHeadersToFields(headers, 'deliverable');
  
  return rows.map((row, index) => {
    // Use universal mapper to map record
    const mapped = mapCsvRecordToDatabase(row, fieldMappings, 'deliverable');
    
    // Extract values with fallbacks
    const phaseName = row['Phase Name'] || row['phase name'] || row.phaseName || null;
    const deliverableName = mapped.deliverableLabel || null;
    const description = mapped.description || null;
    const quantity = mapped._quantity || 1;
    const unitOfMeasure = mapped.defaultUnitOfMeasure || 'week';
    const duration = mapped.defaultDuration || 1;

    // Validate (non-blocking - show warning but allow)
    const validation = validateMappedData(mapped, 'deliverable');
    if (!validation.isValid) {
      console.warn(`Row ${index + 1} validation:`, validation.errors);
    }

    // Map deliverable name to deliverableType (normalized)
    const deliverableType = deliverableName
      ? deliverableName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      : `deliverable_${index + 1}`;

    return {
      companyHQId,
      deliverableType,
      deliverableLabel: deliverableName ? deliverableName.trim() : `Deliverable ${index + 1}`,
      defaultUnitOfMeasure: unitOfMeasure,
      defaultDuration: duration,
      _phaseName: phaseName ? phaseName.trim() : null,
      _description: description ? description.trim() : null,
      _quantity: quantity,
      _validation: validation, // Store validation for preview
    };
  });
}

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array} Array of row objects with column names as keys
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // Parse header - handle quoted headers
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => {
    return h.trim().replace(/^"|"$/g, '');
  });

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Handle quoted values
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Push last value

    // Create row object
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}
