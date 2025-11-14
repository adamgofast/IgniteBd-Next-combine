'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContactSelector from '@/components/ContactSelector';
import { FileText, CheckCircle, Clock, AlertCircle, RefreshCw, FileCheck, Plus, User, Building2 } from 'lucide-react';
import api from '@/lib/api';

export default function DeliverablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [companyHQId, setCompanyHQId] = useState('');
  const [viewMode, setViewMode] = useState('fork'); // 'fork' | 'work-package'

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

  // Fetch deliverables when contact changes
  useEffect(() => {
    if (selectedContact?.id) {
      fetchDeliverables(selectedContact.id);
    } else {
      // If no contact selected, fetch all deliverables for companyHQId
      fetchDeliverables();
    }
  }, [selectedContact, companyHQId]);

  const fetchDeliverables = async (contactId = null) => {
    if (!companyHQId) return;
    
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (contactId) {
        params.append('contactId', contactId);
      }
      
      // Fetch deliverables - API will filter by contactId if provided
      const response = await api.get(`/api/deliverables?${params.toString()}`);
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

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedContact?.id) {
      fetchDeliverables(selectedContact.id);
    } else {
      fetchDeliverables();
    }
  };

  const handleContactChange = (contact) => {
    setSelectedContact(contact);
    // Fetch deliverables for this contact
    if (contact?.id) {
      fetchDeliverables(contact.id);
    } else {
      fetchDeliverables();
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
          title="Client Delivery"
          subtitle="Build and manage deliverables for your clients"
          backTo="/client-operations"
          backLabel="Back to Client Operations"
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
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
            </div>
          }
        />

        {/* Contact Selector */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <ContactSelector
            contactId={selectedContact?.id}
            onContactChange={handleContactChange}
            showLabel={true}
          />
          
          {/* Contact Banner */}
          {selectedContact && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Working for: {selectedContact.firstName} {selectedContact.lastName}
                  </div>
                  {selectedContact.contactCompany?.companyName && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="h-3 w-3" />
                      {selectedContact.contactCompany.companyName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fork: Create Work Page OR View Work Package */}
        {selectedContact && viewMode === 'fork' && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Create a Work Page */}
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm transition hover:border-red-300 hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-3">
                  <Plus className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Create a Work Page</h3>
                  <p className="text-sm text-gray-500">Set up deliverables for this contact</p>
                </div>
              </div>
              <p className="mb-6 text-sm text-gray-600">
                Pull from proposal or start fresh. Build your list of deliverables and then start working.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/client-operations/deliverables/create-work?contactId=${selectedContact.id}`)}
                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Create Work Page →
              </button>
            </div>

            {/* View Work Package */}
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm transition hover:border-red-300 hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">View Work Package</h3>
                  <p className="text-sm text-gray-500">
                    {deliverables.length > 0 
                      ? `${deliverables.length} deliverable${deliverables.length !== 1 ? 's' : ''} set up`
                      : 'No deliverables yet'}
                  </p>
                </div>
              </div>
              <p className="mb-6 text-sm text-gray-600">
                Click through existing deliverables to view work artifacts and manage progress.
              </p>
              {deliverables.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setViewMode('work-package')}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  View Work Package →
                </button>
              ) : (
                <div className="w-full rounded-lg bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-gray-500">
                  Create work page first
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deliverables List (Work Package View) */}
        {selectedContact && viewMode === 'work-package' && deliverables.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Work Package</h2>
              <button
                type="button"
                onClick={() => setViewMode('fork')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to options
              </button>
            </div>
            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <button
                  key={deliverable.id}
                  type="button"
                  onClick={() => router.push(`/client-operations/deliverables/${deliverable.id}`)}
                  className="w-full rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
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
                        {deliverable.type && (
                          <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
                            {deliverable.type}
                          </span>
                        )}
                      </div>
                      {deliverable.description && (
                        <p className="text-gray-600 mb-2">{deliverable.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
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
                    <div className="ml-4 text-gray-400">
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State - No Contact Selected */}
        {!selectedContact && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Select a Contact
            </h3>
            <p className="text-gray-600 mb-6">
              Select a contact above to create or view their work package.
            </p>
          </div>
        )}

        {/* Empty State - No Deliverables (but contact selected) */}
        {selectedContact && viewMode === 'work-package' && deliverables.length === 0 && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Deliverables Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create a work page first to set up deliverables for {selectedContact.firstName} {selectedContact.lastName}.
            </p>
            <button
              type="button"
              onClick={() => setViewMode('fork')}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              ← Back to Create Work Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

