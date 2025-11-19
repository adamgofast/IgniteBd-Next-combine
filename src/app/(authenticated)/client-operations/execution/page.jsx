'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import {
  Package,
  Loader,
  Eye,
} from 'lucide-react';

/**
 * Execution Hub
 * Owner execution hub for viewing and managing work package execution
 * 
 * Workflow:
 * 1. View all work packages (or filter by contact/company)
 * 2. Click "View Execution Dashboard" to open the full execution view
 * 3. In the dashboard, you can:
 *    - See timeline status for each phase
 *    - Click items to navigate to their edit pages (via label routing)
 *    - Track progress and build deliverables
 */

export default function ExecutionPage() {
  const router = useRouter();
  const [workPackages, setWorkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');

  // Load companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedHQId);
  }, []);

  // Load all work packages
  useEffect(() => {
    if (companyHQId) {
      loadWorkPackages();
    } else {
      setLoading(false);
    }
  }, [companyHQId]);

  const loadWorkPackages = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (companyHQId) params.append('companyHQId', companyHQId);
      
      const response = await api.get(`/api/workpackages?${params.toString()}`);
      
      if (response.data?.success && response.data.workPackages) {
        setWorkPackages(response.data.workPackages);
      } else {
        setWorkPackages([]);
      }
    } catch (err) {
      console.error('Error loading work packages:', err);
      setError('Failed to load work packages');
      setWorkPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewExecution = (workPackageId) => {
    router.push(`/workpackages/${workPackageId}`);
  };

  const getTotalItems = (workPackage) => {
    const phaseItems = workPackage.phases?.reduce((sum, phase) => sum + (phase.items?.length || 0), 0) || 0;
    const directItems = workPackage.items?.length || 0;
    return phaseItems + directItems;
  };

  const getTotalHours = (workPackage) => {
    const phaseHours = workPackage.phases?.reduce((sum, phase) => {
      return sum + (phase.items?.reduce((itemSum, item) => {
        return itemSum + ((item.estimatedHoursEach || 0) * (item.quantity || 0));
      }, 0) || 0);
    }, 0) || 0;
    
    const directHours = workPackage.items?.reduce((sum, item) => {
      return sum + ((item.estimatedHoursEach || 0) * (item.quantity || 0));
    }, 0) || 0;
    
    return phaseHours + directHours;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Execution Hub"
          subtitle="View and manage work package execution. Once a work package is built, view it here and build deliverables from it."
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl bg-white p-12 shadow">
            <Loader className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading work packages...</span>
          </div>
        ) : workPackages.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-12 text-center shadow">
            <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-lg font-semibold text-gray-800">No work packages yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Create a work package first, then come back here to view and execute on it.
            </p>
            <button
              type="button"
              onClick={() => router.push('/workpackages/create')}
              className="mt-6 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Create Work Package →
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {workPackages.map((workPackage) => (
              <div
                key={workPackage.id}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {workPackage.title || 'Untitled Work Package'}
                      </h3>
                      {workPackage.contact && (
                        <p className="mt-1 text-sm text-gray-600">
                          Client: {workPackage.contact.firstName} {workPackage.contact.lastName}
                        </p>
                      )}
                      {workPackage.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {workPackage.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>
                      Phases: <span className="font-semibold text-gray-900">{workPackage.phases?.length || 0}</span>
                    </span>
                    <span>
                      Items: <span className="font-semibold text-gray-900">{getTotalItems(workPackage)}</span>
                    </span>
                    <span>
                      Hours: <span className="font-semibold text-gray-900">{getTotalHours(workPackage)}</span>
                    </span>
                    {workPackage.totalCost && (
                      <span>
                        Cost: <span className="font-semibold text-gray-900">${workPackage.totalCost.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400">
                    Created: {new Date(workPackage.createdAt).toLocaleDateString()}
                    {workPackage.updatedAt && (
                      <> • Updated: {new Date(workPackage.updatedAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:flex-col md:items-end">
                  <button
                    type="button"
                    onClick={() => handleViewExecution(workPackage.id)}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <Eye className="h-4 w-4" />
                    View Execution Dashboard
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

