'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Copy, X, Package } from 'lucide-react';
import api from '@/lib/api';

/**
 * Clone Work Package Page
 * Select an existing work package to copy
 */
function CloneWorkPackageContent() {
  const router = useRouter();
  const [workPackages, setWorkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hqId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(hqId);
    
    // Load from localStorage first
    const cached = localStorage.getItem('workPackages');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setWorkPackages(parsed);
        }
      } catch (err) {
        console.warn('Failed to parse cached work packages', err);
      }
    }
    setLoading(false);
  }, []);

  const handleClone = async (workPackageId) => {
    try {
      setLoading(true);
      // TODO: Implement clone API endpoint
      // For now, just redirect to the work package detail page
      router.push(`/workpackages/${workPackageId}`);
    } catch (err) {
      console.error('Error cloning work package:', err);
      setError('Failed to clone work package');
    } finally {
      setLoading(false);
    }
  };

  if (loading && workPackages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading work packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Clone Previous Work Package"
          subtitle="Select a work package to copy as your starting point"
          backTo="/workpackages/create"
          backLabel="Back to Options"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {workPackages.length === 0 ? (
          <div className="mt-8 rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-semibold text-gray-800">No work packages found</p>
            <p className="mt-2 text-sm text-gray-500">
              Create a work package first to use this feature
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {workPackages.map((wp) => (
              <div
                key={wp.id}
                onClick={() => handleClone(wp.id)}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{wp.title}</h3>
                  <Copy className="h-5 w-5 text-gray-400" />
                </div>
                
                {wp.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{wp.description}</p>
                )}

                {wp.contact && (
                  <p className="text-xs text-gray-500 mb-3">
                    Client: {wp.contact.firstName} {wp.contact.lastName}
                  </p>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {wp.items?.length || 0} items
                  </span>
                  <button className="text-sm text-red-600 hover:text-red-700 font-semibold">
                    Clone
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloneWorkPackagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CloneWorkPackageContent />
    </Suspense>
  );
}

