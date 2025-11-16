/**
 * UNIVERSAL CSV FIELD MAPPER SERVICE
 * Single source of truth for all CSV field mappings
 * Handles plain-English field names and maps to internal schema fields
 * 
 * Based on Prisma Schema:
 * - PhaseTemplate: name, description, companyHQId
 * - DeliverableTemplate: deliverableType, deliverableLabel, defaultUnitOfMeasure, defaultDuration, companyHQId
 */

/**
 * UNIVERSAL FIELD MAP - All possible field mappings
 * Each field is explicitly tagged with supported upload types
 */
export const UNIVERSAL_FIELD_MAP = {
  // === PHASE FIELDS ===
  'phase name': { field: 'name', types: ['phase'] },
  'phase name': { field: 'name', types: ['phase'] },
  'phasename': { field: 'name', types: ['phase'] },
  'phase': { field: 'name', types: ['phase'] },
  
  'description': { field: 'description', types: ['phase', 'deliverable'] },
  'desc': { field: 'description', types: ['phase', 'deliverable'] },
  
  'duration (days)': { field: 'durationDays', types: ['phase'] },
  'duration days': { field: 'durationDays', types: ['phase'] },
  'duration': { field: 'durationDays', types: ['phase'] },
  'days': { field: 'durationDays', types: ['phase'] },
  
  'order': { field: 'order', types: ['phase'] },
  'position': { field: 'order', types: ['phase'] },
  'sequence': { field: 'order', types: ['phase'] },
  
  // === DELIVERABLE FIELDS ===
  'deliverable name': { field: 'deliverableLabel', types: ['deliverable'] },
  'deliverablename': { field: 'deliverableLabel', types: ['deliverable'] },
  'deliverable': { field: 'deliverableLabel', types: ['deliverable'] },
  'item name': { field: 'deliverableLabel', types: ['deliverable'] },
  'item': { field: 'deliverableLabel', types: ['deliverable'] },
  
  'quantity': { field: 'quantity', types: ['deliverable'] },
  'qty': { field: 'quantity', types: ['deliverable'] },
  'amount': { field: 'quantity', types: ['deliverable'] },
  'count': { field: 'quantity', types: ['deliverable'] },
  
  'unit': { field: 'defaultUnitOfMeasure', types: ['deliverable'] },
  'unit of measure': { field: 'defaultUnitOfMeasure', types: ['deliverable'] },
  'measure': { field: 'defaultUnitOfMeasure', types: ['deliverable'] },
  'time unit': { field: 'defaultUnitOfMeasure', types: ['deliverable'] },
  
  'duration': { field: 'defaultDuration', types: ['deliverable'] },
  'time': { field: 'defaultDuration', types: ['deliverable'] },
  'length': { field: 'defaultDuration', types: ['deliverable'] },
};

/**
 * Map fields for a specific upload type
 * Only includes fields that are explicitly supported for that type
 */
export function mapFieldsForType(csvRecord, uploadType) {
  const mappedRecord = {};
  
  Object.keys(csvRecord).forEach(csvHeader => {
    const normalizedHeader = csvHeader.toLowerCase().trim();
    const fieldMapping = UNIVERSAL_FIELD_MAP[normalizedHeader];
    
    // Only map if this field is supported for this upload type
    if (fieldMapping && fieldMapping.types.includes(uploadType)) {
      mappedRecord[fieldMapping.field] = csvRecord[csvHeader];
    }
  });
  
  return mappedRecord;
}

/**
 * Get available fields for a specific upload type
 */
export function getAvailableFieldsForType(uploadType) {
  const fields = new Set();
  
  Object.values(UNIVERSAL_FIELD_MAP).forEach(fieldMapping => {
    if (fieldMapping.types.includes(uploadType)) {
      fields.add(fieldMapping.field);
    }
  });
  
  return Array.from(fields).map(field => ({
    value: field,
    label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')
  }));
}

/**
 * Get field mapping suggestions for headers
 */
export function getFieldMappingSuggestions(headers, uploadType) {
  return headers.map(header => {
    const normalizedHeader = header.toLowerCase().trim();
    const fieldMapping = UNIVERSAL_FIELD_MAP[normalizedHeader];
    
    return {
      csvHeader: header,
      suggestedField: fieldMapping && fieldMapping.types.includes(uploadType) 
        ? fieldMapping.field 
        : 'unmapped',
      isSupported: fieldMapping && fieldMapping.types.includes(uploadType)
    };
  });
}

/**
 * Validate that required fields are present for a specific upload type
 */
export function validateRequiredFieldsForType(mappedRecord, uploadType) {
  const errors = [];
  
  if (uploadType === 'phase') {
    if (!mappedRecord.name) {
      errors.push('Phase Name is required');
    }
  }
  
  if (uploadType === 'deliverable') {
    if (!mappedRecord.deliverableLabel) {
      errors.push('Deliverable Name is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate a mapped record for required fields (flexible - warnings only)
 */
export function validateMappedRecord(mappedRecord, uploadType) {
  const errors = [];
  const warnings = [];
  
  if (uploadType === 'phase') {
    if (!mappedRecord.name) {
      errors.push('Phase Name is required');
    }
  }
  
  if (uploadType === 'deliverable') {
    if (!mappedRecord.deliverableLabel) {
      errors.push('Deliverable Name is required');
    }
    if (!mappedRecord.quantity) {
      warnings.push('Quantity not specified, will default to 1');
    }
    if (!mappedRecord.defaultUnitOfMeasure) {
      warnings.push('Unit not specified, will default to "week"');
    }
    if (!mappedRecord.defaultDuration) {
      warnings.push('Duration not specified, will default to 1');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
