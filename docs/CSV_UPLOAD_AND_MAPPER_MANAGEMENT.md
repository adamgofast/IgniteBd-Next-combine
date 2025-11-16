# CSV Upload and Mapper Management

## Overview

This document describes the CSV upload system for proposal templates (Phase and Deliverable templates). The system uses a **universal mapper service** that detects plain-English field names and maps them to internal database schema fields.

## Architecture

### 1. Two CSV Upload Types

- **Phase CSV** - Uploads `PhaseTemplate` records
- **Deliverable CSV** - Uploads `DeliverableTemplate` records

### 2. Universal Mapper Service

The `UniversalCsvFieldMapperService` detects CSV headers and maps them to database fields using a comprehensive field map. It supports:
- Multiple field name variations (e.g., "Phase Name", "phase name", "PhaseName")
- Case-insensitive matching
- Field suggestions for unmapped columns
- Preview of mappings before upload

### 3. Upload Flow

1. **Upload CSV** - User selects CSV file
2. **Parse & Detect** - System parses CSV and detects headers
3. **Preview & Map** - Shows detected fields and how they map to database fields
4. **Validate** - Validates data (non-blocking for optional fields)
5. **Upload** - Creates/updates template records

## Field Mappings

### Phase CSV Fields

| CSV Header (Plain English) | Database Field | Required | Notes |
|---------------------------|----------------|----------|-------|
| Phase Name | `name` | ✅ | Unique per companyHQId |
| Description | `description` | ❌ | Optional description |
| Duration (Days) | `_durationDays` | ❌ | Stored for reference (not in schema yet) |
| Order | `_order` | ❌ | Used for sorting |

**Accepted Variations:**
- Phase Name: "Phase Name", "phase name", "PhaseName", "phase_name", "Phase"
- Description: "Description", "description", "Desc", "Notes"
- Duration: "Duration (Days)", "Duration", "Days", "duration_days"
- Order: "Order", "order", "Position", "position", "Sequence"

### Deliverable CSV Fields

| CSV Header (Plain English) | Database Field | Required | Notes |
|---------------------------|----------------|----------|-------|
| Phase Name | `_phaseName` | ❌ | Reference only (not stored) |
| Deliverable Name | `deliverableLabel` | ✅ | Human-readable label |
| Description | `_description` | ❌ | Reference only |
| Quantity | `_quantity` | ❌ | Reference only |
| Unit | `defaultUnitOfMeasure` | ❌ | Maps to: day/week/month |
| Duration | `defaultDuration` | ❌ | Numeric value |

**Accepted Variations:**
- Deliverable Name: "Deliverable Name", "deliverable name", "DeliverableName", "Item", "Item Name"
- Unit: "Unit", "unit", "Measure", "Time Unit" → Maps to day/week/month
- Duration: "Duration", "duration", "Time", "Weeks", "Days"

**Unit Mapping:**
- `item`, `items` → `week` (default)
- `day`, `days` → `day`
- `week`, `weeks` → `week`
- `month`, `months` → `month`

## Universal Mapper Service

### Location
`src/lib/services/universalCsvFieldMapper.js`

### Key Functions

```javascript
/**
 * Map CSV headers to database fields
 * @param {Array} csvHeaders - Array of CSV header strings
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Array of mapping objects with csvHeader, mappedField, isSupported
 */
export function mapCsvHeadersToFields(csvHeaders, uploadType)

/**
 * Get field mapping suggestions for headers
 * @param {Array} headers - CSV headers
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Array} Mapping suggestions
 */
export function getFieldMappingSuggestions(headers, uploadType)

/**
 * Validate mapped data
 * @param {Object} mappedData - Mapped record
 * @param {string} uploadType - 'phase' or 'deliverable'
 * @returns {Object} { isValid, errors, warnings }
 */
export function validateMappedData(mappedData, uploadType)
```

## Excel Templates

### Phase Template
Downloadable template with columns:
- Phase Name
- Description
- Duration (Days)
- Order

### Deliverable Template
Downloadable template with columns:
- Phase Name
- Deliverable Name
- Description
- Quantity
- Unit
- Duration

## Preview System

### What to Show

1. **Detected CSV Headers** - List all headers found in CSV
2. **Field Mapping** - Show how each header maps to database field
3. **Sample Data** - Show first 3-5 rows of parsed data
4. **Validation Warnings** - Show missing recommended fields (non-blocking)
5. **Unmapped Fields** - Highlight columns that couldn't be mapped

### Preview UI Flow

```
Upload CSV → Parse → Show Preview → User Reviews → Confirm → Upload
```

## Implementation Notes

### 1. Non-Blocking Validation

- Don't require all fields upfront
- Show warnings for missing recommended fields
- Allow upload with partial data
- User can fill in missing fields later in the UI

### 2. Field Detection

- Case-insensitive matching
- Handle variations (spaces, underscores, camelCase)
- Support common abbreviations
- Provide suggestions for unmapped fields

### 3. Template Downloads

- Provide Excel/CSV templates for both Phase and Deliverable
- Include example data
- Show all supported field variations in comments

## API Routes

### Phase CSV Upload
`POST /api/csv/phases/upload`
- Accepts: FormData with `file` and `companyHQId`
- Returns: `{ success, count, phaseTemplates }`

### Deliverable CSV Upload
`POST /api/csv/deliverables/upload`
- Accepts: FormData with `file` and `companyHQId`
- Returns: `{ success, count, deliverableTemplates }`

### Preview Endpoint (Future)
`POST /api/csv/preview`
- Accepts: FormData with `file` and `uploadType`
- Returns: `{ headers, mappings, sampleData, warnings }`

## UI Pages

### Selection Page
`/client-operations/proposals/create/csv`
- Choose between Phase or Deliverable upload

### Phase Upload Page
`/client-operations/proposals/create/csv/phases`
- Upload Phase CSV
- Download template
- Preview mappings
- Upload

### Deliverable Upload Page
`/client-operations/proposals/create/csv/deliverables`
- Upload Deliverable CSV
- Download template
- Preview mappings
- Upload

## Future Enhancements

1. **Interactive Field Mapping** - Let users manually map unmapped fields
2. **Bulk Edit** - Edit multiple rows before upload
3. **Validation Rules** - Custom validation per company
4. **Import History** - Track what was imported and when
5. **Rollback** - Ability to undo imports
