/**
 * Work Package Item Types Configuration
 * Powers the "Add Item" UX
 */
export const WORK_PACKAGE_ITEM_TYPES = [
  { type: "persona", label: "Target Persona" },
  { type: "template", label: "Outreach Template" },
  { type: "event_targets", label: "Industry Event / Conference Targets" },
  { type: "blog", label: "Blog Content" },
  { type: "deck", label: "Presentation Deck" },
  { type: "page", label: "Ecosystem Landing Page" },
  { type: "lead_form", label: "Lead Form + CRM Tie-In" }
];

// Legacy config for backward compatibility
export const WORK_PACKAGE_CONFIG = WORK_PACKAGE_ITEM_TYPES.map((item, idx) => ({
  id: item.type,
  label: item.label,
  type: item.type
}));

/**
 * Map config type to string (no enum needed now)
 */
export const mapConfigTypeToWorkItemType = (configType) => {
  // Return the type as-is since we're using strings now
  return configType || null;
};

/**
 * Get default quantity for a config item
 */
export const getDefaultQuantity = (configType) => {
  const defaults = {
    persona: 3,
    template: 10,
    event_targets: 2,
    blog: 5,
    deck: 1,
    page: 1,
    lead_form: 1,
  };
  return defaults[configType] || 1;
};

/**
 * Get item by id
 */
export const getConfigItemById = (id) => {
  return WORK_PACKAGE_ITEM_TYPES.find(item => item.type === id);
};

/**
 * Get item by type
 */
export const getConfigItemByType = (type) => {
  return WORK_PACKAGE_ITEM_TYPES.find(item => item.type === type);
};

/**
 * Get label for item type
 */
export const getItemTypeLabel = (type) => {
  if (!type) return 'Unknown';
  // Normalize to lowercase for matching
  const normalizedType = type.toLowerCase();
  const item = getConfigItemByType(normalizedType);
  return item ? item.label : type;
};
