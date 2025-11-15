'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

/**
 * WorkPackages List Page
 * Shows all work packages for the current companyHQ
 */
export default function WorkPackagesPage() {
  const router = useRouter();
  const [workPackages, setWorkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load from localStorage first (dashboard pattern - no auto-fetch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      setLoading(false);
      return;
    }

    // Load from localStorage first
    const cached = window.localStorage.getItem('workPackages');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          // Filter by companyHQId if needed
          const filtered = parsed.filter(wp => wp.companyHQId === companyHQId);
          setWorkPackages(filtered);
        }
      } catch (error) {
        console.warn('Failed to parse cached work packages', error);
      }
    }
    setLoading(false);
  }, []);

  // Optional: Manual refresh function (for sync button if needed)
  const refreshWorkPackages = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        setError('CompanyHQ ID not found');
        return;
      }

      const response = await api.get(`/api/workpackages?companyHQId=${companyHQId}`);
      if (response.data?.success) {
        const fetched = response.data.workPackages || [];
        setWorkPackages(fetched);
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('workPackages', JSON.stringify(fetched));
        }
      }
    } catch (err) {
      console.error('Error loading work packages:', err);
      setError('Failed to load work packages');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-gray-600">Loading work packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <PageHeader
          title="Work Packages"
          subtitle="Manage client work packages - the actual work being done"
        />

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Work Packages ({workPackages.length})
          </h2>
          <button
            onClick={() => router.push('/workpackages/new')}
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            New Work Package
          </button>
        </div>

        {workPackages.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-semibold text-gray-800">No work packages yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Create your first work package to start tracking client deliverables
            </p>
            <button
              onClick={() => router.push('/workpackages/new')}
              className="mt-6 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700"
            >
              Create Work Package
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workPackages.map((wp) => {
              const statusColor = wp.status === 'COMPLETED' ? 'green' : 'red';
              const StatusIcon = wp.status === 'COMPLETED' ? CheckCircle2 : Circle;
              
              return (
                <Link
                  key={wp.id}
                  href={`/workpackages/${wp.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{wp.title}</h3>
                    <StatusIcon
                      className={`h-5 w-5 ${
                        statusColor === 'green' ? 'text-green-600' : 'text-red-600'
                      }`}
                    />
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
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

