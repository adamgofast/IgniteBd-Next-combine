'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Standardized Page Header Component
 * 
 * Usage:
 * <PageHeader
 *   title="Page Title"
 *   subtitle="Optional subtitle text"
 *   backTo="/previous-page"
 *   backLabel="Back to Previous"
 * />
 */
export default function PageHeader({ 
  title, 
  subtitle, 
  backTo, 
  backLabel = 'Back',
  actions
}) {
  return (
    <div className="mb-8">
      {/* Back Link */}
      {backTo && (
        <Link
          href={backTo}
          className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{title}</h1>
          {subtitle && (
            <p className="text-gray-600 text-lg">{subtitle}</p>
          )}
        </div>
        
        {/* Action Buttons (optional) */}
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

