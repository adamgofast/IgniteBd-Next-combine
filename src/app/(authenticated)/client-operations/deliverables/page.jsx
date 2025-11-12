'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { FileText, CheckCircle, Clock, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';
import api from '@/lib/api';

export default function DeliverablesPage() {
  const router = useRouter();
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedId);

    // Load from localStorage first
    const cached = window.localStorage.getItem('deliverables');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setDeliverables(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse cached deliverables', error);
      }
    }
    setLoading(false);
  }, []);

  const fetchDeliverables = async (isRefresh = false) => {
    if (!companyHQId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      // Fetch all deliverables - API will filter by companyHQId via auth
      const response = await api.get('/api/deliverables');
      if (response.data?.success && response.data.deliverables) {
        const fetched = response.data.deliverables;
        setDeliverables(fetched);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('deliverables', JSON.stringify(fetched));
        }
      }
    } catch (err) {
      console.error('Error fetching deliverables:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Deliverables"
          subtitle="Track and manage all deliverables for your active client engagements"
          backTo="/client-operations"
          backLabel="Back to Client Operations"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchDeliverables(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/client-operations/proposals')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <FileCheck className="h-4 w-4" />
                View Proposals
              </button>
              <button
                type="button"
                onClick={() => router.push('/client-operations/deliverables/create')}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Create Deliverable
              </button>
            </div>
          }
        />

        <div className="mt-8">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading deliverables...</p>
            </div>
          ) : deliverables.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Deliverables Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Deliverables will appear here once proposals are approved and converted.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => fetchDeliverables(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => router.push('/client-operations/proposals')}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <FileCheck className="h-4 w-4" />
                  View Proposals
                </button>
                <button
                  onClick={() => router.push('/client-operations/deliverables/create')}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Deliverable
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(deliverable.status)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {deliverable.title}
                        </h3>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700">
                          {deliverable.status}
                        </span>
                      </div>
                      {deliverable.description && (
                        <p className="text-gray-600 mb-2">{deliverable.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {deliverable.contact && (
                          <span>
                            Contact: {deliverable.contact.firstName} {deliverable.contact.lastName}
                          </span>
                        )}
                        {deliverable.proposal && (
                          <span>
                            Proposal: {deliverable.proposal.clientName}
                          </span>
                        )}
                        {deliverable.dueDate && (
                          <span>
                            Due: {new Date(deliverable.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

