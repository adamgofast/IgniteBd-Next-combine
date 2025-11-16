/**
 * UNIVERSAL CSV FIELD MAPPER SERVICE
 * Detects plain-English CSV headers and maps them to database schema fields
 * Supports multiple field name variations and provides mapping suggestions
 */

/**
 * UNIVERSAL FIELD MAP - All possible field mappings for Phase and Deliverable CSVs
 * Each field supports multiple variations (case-insensitive)
 */
export const UNIVERSAL_FIELD_MAP = {
  // === PHASE FIELDS ===
  'phase name': { field: 'name', types: ['phase'], required: true },
  'phasename': { field: 'name', types: ['phase'], required: true },
  'phase_name': { field: 'name', types: ['phase'], required: true },
  'phase': { field: 'name', types: ['phase'], required: true },
  'name': { field: 'name', types: ['phase'], required: true },
  
  'description': { field: 'description', types: ['phase', 'deliverable'], required: false },
  'desc': { field: 'description', types: ['phase', 'deliverable'], required: false },
  'notes': { field: 'description', types: ['phase', 'deliverable'], required: false },
  
  'duration (days)': { field: '_durationDays', types: ['phase'], required: false },
  'duration': { field: '_durationDays', types: ['phase'], required: false },
  'days': { field: '_durationDays', types: ['phase'], required: false },
  'duration_days': { field: '_durationDays', types: ['phase'], required: false },
  
  'order': { field: '_order', types: ['phase'], required: false },
  'position': { field: '_order', types: ['phase'], required: false },
  'sequence': { field: '_order', types: ['phase'], required: false },
  'sort': { field: '_order', types: ['phase'], required: false },
  
  // === DELIVERABLE FIELDS ===
  'deliverable name': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  'deliverablename': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  'deliverable_name': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  'item name': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  'item': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  'itemlabel': { field: 'deliverableLabel', types: ['deliverable'], required: true },
  
  'quantity': { field: '_quantity', types: ['deliverable'], required: false },
  'qty': { field: '_quantity', types: ['deliverable'], required: false },
  'amount': { field: '_quantity', types: ['deliverable'], required: false },
  'count': { field: '_quantity', types: ['deliverable'], required: false },
  
  'unit': { field: 'defaultUnitOfMeasure', types: ['deliverable'], required: false },
  'measure': { field: 'defaultUnitOfMeasure', types: ['deliverable'], required: false },
  'time unit': { field: 'defaultUnitOfMeasure', types: ['deliverable'], required: false },
  'unitofmeasure': { field: 'defaultUnitOfMeasure', types: ['deliverable'], required: false },
  
  'duration': { field: 'defaultDuration', types: ['deliverable'], required: false },
  'time': { field: 'defaultDuration', types: ['deliverable'], required: false },
  'weeks': { field: 'defaultDuration', types: ['deliverable'], required: false },
  'defaultduration': { field: 'defaultDuration', types: ['deliverable'], required: false },
};

/**
 * Map CSV headers to database fields
 * @param {Array} csvHeaders - Array of CSV header strings
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Array of mapping objects
 */
export function mapCsvHeadersToFields(csvHeaders, uploadType) {
  return csvHeaders.map(header => {
    const normalizedHeader = header.toLowerCase().trim();
    const fieldMapping = UNIVERSAL_FIELD_MAP[normalizedHeader];
    
    return {
      csvHeader: header,
      normalizedHeader,
      mappedField: fieldMapping && fieldMapping.types.includes(uploadType)
        ? fieldMapping.field
        : 'unmapped',
      isSupported: fieldMapping && fieldMapping.types.includes(uploadType),
      isRequired: fieldMapping && fieldMapping.required && fieldMapping.types.includes(uploadType),
    };
  });
}

/**
 * Get field mapping suggestions for headers
 * @param {Array} headers - CSV headers
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Mapping suggestions with confidence scores
 */
export function getFieldMappingSuggestions(headers, uploadType) {
  const mappings = mapCsvHeadersToFields(headers, uploadType);
  
  return mappings.map(mapping => {
    // If unmapped, try to find similar fields
    if (mapping.mappedField === 'unmapped') {
      const suggestions = findSimilarFields(mapping.normalizedHeader, uploadType);
      return {
        ...mapping,
        suggestions,
      };
    }
    return mapping;
  });
}

/**
 * Find similar fields for unmapped headers
 * @param {string} header - Normalized header
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Array of suggested field names
 */
function findSimilarFields(header, uploadType) {
  const suggestions = [];
  
  // Simple similarity matching
  Object.keys(UNIVERSAL_FIELD_MAP).forEach(key => {
    const mapping = UNIVERSAL_FIELD_MAP[key];
    if (mapping.types.includes(uploadType)) {
      // Check if header contains key or vice versa
      if (header.includes(key) || key.includes(header)) {
        suggestions.push({
          field: mapping.field,
          confidence: 'medium',
        });
      }
    }
  });
  
  return suggestions;
}

/**
 * Validate mapped data
 * @param {Object} mappedData - Mapped record
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Object} { isValid, errors, warnings }
 */
export function validateMappedData(mappedData, uploadType) {
  const errors = [];
  const warnings = [];
  
  if (uploadType === 'phase') {
    if (!mappedData.name || !mappedData.name.trim()) {
      errors.push('Phase Name is required');
    }
  }
  
  if (uploadType === 'deliverable') {
    if (!mappedData.deliverableLabel || !mappedData.deliverableLabel.trim()) {
      errors.push('Deliverable Name is required');
    }
    
    // Warnings for missing recommended fields
    if (!mappedData.defaultUnitOfMeasure) {
      warnings.push('Unit not specified - defaulting to "week"');
    }
    if (!mappedData.defaultDuration) {
      warnings.push('Duration not specified - defaulting to 1');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Map a CSV record to database format
 * @param {Object} csvRecord - Raw CSV record with original headers
 * @param {Array} fieldMappings - Array of mapping objects from mapCsvHeadersToFields
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Object} Mapped record ready for database
 */
export function mapCsvRecordToDatabase(csvRecord, fieldMappings, uploadType) {
  const mappedRecord = {};
  
  fieldMappings.forEach(mapping => {
    if (mapping.mappedField !== 'unmapped' && csvRecord[mapping.csvHeader] !== undefined) {
      const value = csvRecord[mapping.csvHeader];
      
      // Handle special field transformations
      if (mapping.mappedField === 'defaultUnitOfMeasure') {
        // Map unit to internal format
        mappedRecord[mapping.mappedField] = normalizeUnit(value);
      } else if (mapping.mappedField === 'defaultDuration' || mapping.mappedField === '_durationDays') {
        // Parse numeric values
        mappedRecord[mapping.mappedField] = parseInt(value) || null;
      } else if (mapping.mappedField === '_order' || mapping.mappedField === '_quantity') {
        // Parse integer values
        mappedRecord[mapping.mappedField] = parseInt(value) || null;
      } else {
        // String values
        mappedRecord[mapping.mappedField] = value ? value.trim() : null;
      }
    }
  });
  
  return mappedRecord;
}

/**
 * Normalize unit values to internal format
 * @param {string} unit - Unit value from CSV
 * @returns {string} Normalized unit (day/week/month)
 */
function normalizeUnit(unit) {
  if (!unit) return 'week'; // default
  
  const normalized = unit.toLowerCase().trim();
  
  if (normalized === 'day' || normalized === 'days') return 'day';
  if (normalized === 'week' || normalized === 'weeks') return 'week';
  if (normalized === 'month' || normalized === 'months') return 'month';
  if (normalized === 'item' || normalized === 'items') return 'week'; // items default to week
  
  return 'week'; // default
}

/**
 * Get available fields for a specific upload type
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Array of available field objects
 */
export function getAvailableFieldsForType(uploadType) {
  const fields = new Set();
  
  Object.values(UNIVERSAL_FIELD_MAP).forEach(mapping => {
    if (mapping.types.includes(uploadType)) {
      fields.add(mapping.field);
    }
  });
  
  return Array.from(fields).map(field => ({
    value: field,
    label: formatFieldLabel(field),
    required: UNIVERSAL_FIELD_MAP[Object.keys(UNIVERSAL_FIELD_MAP).find(
      key => UNIVERSAL_FIELD_MAP[key].field === field && UNIVERSAL_FIELD_MAP[key].types.includes(uploadType)
    )]?.required || false,
  }));
}

/**
 * Format field name for display
 * @param {string} field - Field name
 * @returns {string} Formatted label
 */
function formatFieldLabel(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
