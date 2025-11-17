'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, RefreshCw, Trash2, Eye, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function WorkPackagesViewPage() {
  const router = useRouter();
  const [workPackages, setWorkPackages] = useState([]);
  const [companyHQId, setCompanyHQId] = useState('');
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Load from localStorage first (check company hydration cache too)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedHQId);

    const storedContactId = window.localStorage.getItem('selectedContactId') || '';
    setContactId(storedContactId);

    // First try direct workPackages key
    let cached = window.localStorage.getItem('workPackages');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkPackages(parsed);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse cached work packages', error);
      }
    }

    // Fallback to company hydration cache
    if (storedHQId) {
      const hydrationKey = `companyHydration_${storedHQId}`;
      const hydrationData = window.localStorage.getItem(hydrationKey);
      if (hydrationData) {
        try {
          const parsed = JSON.parse(hydrationData);
          if (parsed.data?.workPackages && Array.isArray(parsed.data.workPackages)) {
            console.log(`📦 Found ${parsed.data.workPackages.length} work packages in company hydration cache`);
            setWorkPackages(parsed.data.workPackages);
            // Also store in direct key for consistency
            window.localStorage.setItem('workPackages', JSON.stringify(parsed.data.workPackages));
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('⚠️ Failed to parse company hydration data:', err);
        }
      }
    }

    setLoading(false);
  }, []);

  const fetchWorkPackages = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query params
      const params = new URLSearchParams();
      if (contactId) params.append('contactId', contactId);
      if (companyHQId) params.append('companyHQId', companyHQId);
      
      const response = await api.get(`/api/workpackages?${params.toString()}`);
      const packagesData = response.data?.workPackages ?? [];
      setWorkPackages(packagesData);
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('workPackages', JSON.stringify(packagesData));
      }
    } catch (err) {
      console.error('Error fetching work packages:', err);
      setError('Unable to load work packages.');
      setWorkPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (workPackageId) => {
    if (!confirm('Are you sure you want to delete this work package? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(workPackageId);
      const response = await api.delete(`/api/workpackages/${workPackageId}`);
      
      if (response.data?.success) {
        // Remove from local state
        setWorkPackages(prev => prev.filter(wp => wp.id !== workPackageId));
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          const updated = workPackages.filter(wp => wp.id !== workPackageId);
          window.localStorage.setItem('workPackages', JSON.stringify(updated));
        }
      } else {
        setError(response.data?.error || 'Failed to delete work package');
      }
    } catch (err) {
      console.error('Error deleting work package:', err);
      setError(err.response?.data?.error || 'Failed to delete work package');
    } finally {
      setDeleting(null);
    }
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Work Packages"
          subtitle="View and manage your work packages"
          backTo="/workpackages"
          backLabel="Back to Work Packages"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchWorkPackages}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-100"
              >
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/workpackages/create')}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                New Work Package
              </button>
            </div>
          }
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading work packages…</p>
          </div>
        ) : workPackages.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-lg font-semibold text-gray-800">No work packages yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Create your first work package to start tracking deliverables and progress.
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
          <div className="space-y-4">
            {workPackages.map((workPackage) => (
              <div
                key={workPackage.id}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md md:flex-row md:items-center md:justify-between"
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
                    onClick={() => router.push(`/workpackages/${workPackage.id}`)}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(workPackage.id)}
                    disabled={deleting === workPackage.id}
                    className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className={`h-4 w-4 ${deleting === workPackage.id ? 'animate-spin' : ''}`} />
                    {deleting === workPackage.id ? 'Deleting...' : 'Delete'}
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

