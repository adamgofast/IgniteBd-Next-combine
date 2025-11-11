/**
 * Error Handler
 * 
 * Handles and filters console errors gracefully
 * Specifically filters out known third-party errors (GoDaddy, etc.)
 */

if (typeof window !== 'undefined') {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // List of error patterns to filter (known third-party errors)
  const FILTERED_ERROR_PATTERNS = [
    // GoDaddy SSO heartbeat errors
    /sso\.godaddy\.com.*heartbeat/i,
    /godaddy.*heartbeat/i,
    /POST.*sso\.godaddy\.com.*400/i,
    
    // GoDaddy image preload warnings
    /wsimg\.com.*preload/i,
    /was preloaded using link preload but not used/i,
    /img1\.wsimg\.com/i,
    
    // Other common third-party errors we want to ignore
    /chrome-extension:/i,
    /moz-extension:/i,
    /safari-extension:/i,
    /edge-extension:/i,
  ];

  // Filter function to check if error should be suppressed
  const shouldFilterError = (...args) => {
    const errorString = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ');
    
    return FILTERED_ERROR_PATTERNS.some(pattern => pattern.test(errorString));
  };

  // Override console.error to filter known errors
  console.error = function(...args) {
    if (!shouldFilterError(...args)) {
      originalError.apply(console, args);
    } else {
      // Optionally log filtered errors in development with a prefix
      if (process.env.NODE_ENV === 'development') {
        originalWarn.apply(console, [
          '[Filtered]',
          ...args,
          '(This error is from a third-party script and can be safely ignored)'
        ]);
      }
    }
  };

  // Override console.warn to filter known warnings
  console.warn = function(...args) {
    if (!shouldFilterError(...args)) {
      originalWarn.apply(console, args);
    } else {
      // Optionally log filtered warnings in development
      if (process.env.NODE_ENV === 'development') {
        originalWarn.apply(console, [
          '[Filtered]',
          ...args,
          '(This warning is from a third-party script and can be safely ignored)'
        ]);
      }
    }
  };

  // Handle unhandled promise rejections from third-party scripts
  window.addEventListener('unhandledrejection', (event) => {
    const errorString = event.reason?.toString() || '';
    
    // Filter GoDaddy-related promise rejections
    if (FILTERED_ERROR_PATTERNS.some(pattern => pattern.test(errorString))) {
      event.preventDefault(); // Prevent error from showing in console
      
      if (process.env.NODE_ENV === 'development') {
        originalWarn('[Filtered] Unhandled promise rejection:', event.reason);
      }
    }
  });

  // Handle general errors from third-party scripts
  window.addEventListener('error', (event) => {
    const errorString = event.message || event.filename || '';
    
    // Filter GoDaddy-related errors
    if (FILTERED_ERROR_PATTERNS.some(pattern => pattern.test(errorString))) {
      event.preventDefault(); // Prevent error from showing in console
      
      if (process.env.NODE_ENV === 'development') {
        originalWarn('[Filtered] Error:', event.message, event.filename);
      }
      
      return false; // Suppress the error
    }
  }, true); // Use capture phase to catch errors early
}

/**
 * Manually filter an error message
 * Useful for API errors that might contain third-party URLs
 */
export function filterThirdPartyErrors(error) {
  if (!error) return error;
  
  const errorString = typeof error === 'string' 
    ? error 
    : error.message || JSON.stringify(error);
  
  const FILTERED_PATTERNS = [
    /sso\.godaddy\.com/i,
    /godaddy.*heartbeat/i,
    /wsimg\.com/i,
  ];
  
  if (FILTERED_PATTERNS.some(pattern => pattern.test(errorString))) {
    return null; // Filter out the error
  }
  
  return error;
}

