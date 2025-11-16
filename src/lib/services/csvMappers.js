/**
 * CSV Mapper Services
 * Convert plain-English CSV fields to internal schema fields
 */

/**
 * Map Phase CSV rows to PhaseTemplate objects
 * @param {Array} rows - Parsed CSV rows with plain-English fields
 * @param {string} companyHQId - CompanyHQ ID for scoping
 * @returns {Array} Array of PhaseTemplate objects ready for upsert
 */
export function mapPhaseCsvToPhaseTemplates(rows, companyHQId) {
  return rows.map((row, index) => {
    // Map plain-English fields to schema fields
    const phaseName = row['Phase Name'] || row['phase name'] || row.phaseName || `Phase ${index + 1}`;
    const description = row['Description'] || row.description || null;
    const durationDays = row['Duration (Days)'] || row['duration (days)'] || row.durationDays || null;
    const order = parseInt(row['Order'] || row.order || index + 1);

    // Validate required fields
    if (!phaseName || !phaseName.trim()) {
      throw new Error(`Row ${index + 1}: Phase Name is required`);
    }

    return {
      companyHQId,
      name: phaseName.trim(),
      description: description ? description.trim() : null,
      // Note: PhaseTemplate doesn't have duration field, but we can store it in description if needed
      // Or we can add it to the schema later
      _order: order, // Store order for sorting
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
  return rows.map((row, index) => {
    // Map plain-English fields to schema fields
    const phaseName = row['Phase Name'] || row['phase name'] || row.phaseName || null;
    const deliverableName = row['Deliverable Name'] || row['deliverable name'] || row.deliverableName || null;
    const description = row['Description'] || row.description || null;
    const quantity = parseInt(row['Quantity'] || row.quantity || '1');
    const unit = (row['Unit'] || row.unit || 'week').toLowerCase();
    const duration = parseInt(row['Duration'] || row.duration || '1');

    // Validate required fields
    if (!deliverableName || !deliverableName.trim()) {
      throw new Error(`Row ${index + 1}: Deliverable Name is required`);
    }

    // Map unit to internal unitOfMeasure
    // Plain English: item/day/week -> Internal: day/week/month
    let unitOfMeasure = 'week'; // default
    if (unit === 'day' || unit === 'days') {
      unitOfMeasure = 'day';
    } else if (unit === 'week' || unit === 'weeks') {
      unitOfMeasure = 'week';
    } else if (unit === 'month' || unit === 'months') {
      unitOfMeasure = 'month';
    } else if (unit === 'item' || unit === 'items') {
      // Items are typically per-unit, use week as default
      unitOfMeasure = 'week';
    }

    // Map deliverable name to deliverableType
    // This is a simple mapping - in production you might want a lookup table
    // For now, we'll use a normalized version of the name
    const deliverableType = deliverableName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    return {
      companyHQId,
      deliverableType,
      deliverableLabel: deliverableName.trim(),
      defaultUnitOfMeasure: unitOfMeasure,
      defaultDuration: duration || 1,
      _phaseName: phaseName ? phaseName.trim() : null, // Store for reference, not in schema
      _description: description ? description.trim() : null, // Store for reference
      _quantity: quantity, // Store for reference
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
