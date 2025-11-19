/**
 * WorkPackage Label Router Service
 * Maps WorkPackageItem labels to UX routes for navigation
 */

/**
 * Label to route mapping
 * Maps each WorkPackageItem.label (or deliverableLabel) to a corresponding UX route
 */
export const labelRouter = {
  blog_post: '/owner/work/edit/blog',
  blog: '/owner/work/edit/blog',
  research: '/owner/work/edit/research',
  deliverable: '/owner/work/edit/artifact',
  artifact: '/owner/work/edit/artifact',
  summary: '/owner/work/edit/summary',
  client_review: '/owner/work/review',
  review: '/owner/work/review',
  // Add more mappings as needed
};

/**
 * Get route for a WorkPackageItem based on its label
 * @param {Object} item - WorkPackageItem object
 * @returns {string|null} - Route path or null if no mapping found
 */
export function getRouteForItem(item) {
  if (!item) return null;

  // Try deliverableLabel first (primary field), then itemLabel (legacy)
  const label = (item.deliverableLabel || item.itemLabel || '').toLowerCase().trim();
  
  if (!label) return null;

  // Direct match
  if (labelRouter[label]) {
    return labelRouter[label];
  }

  // Try partial matches (e.g., "blog post" contains "blog")
  for (const [key, route] of Object.entries(labelRouter)) {
    if (label.includes(key) || key.includes(label)) {
      return route;
    }
  }

  return null;
}

/**
 * Build full route with item ID
 * @param {Object} item - WorkPackageItem object
 * @returns {string|null} - Full route path with item ID, or null if no route found
 */
export function buildItemRoute(item) {
  const baseRoute = getRouteForItem(item);
  if (!baseRoute || !item.id) return null;
  
  return `${baseRoute}/${item.id}`;
}

