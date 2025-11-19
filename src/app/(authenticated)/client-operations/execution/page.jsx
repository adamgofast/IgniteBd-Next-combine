'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContactSelector from '@/components/ContactSelector';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import {
  Target,
  FileText,
  Calendar,
  Package,
  Loader,
  Settings,
  ArrowRight,
  Check,
} from 'lucide-react';

/**
 * Execution/Manage Page
 * Owner execution hub for managing client work packages
 * 
 * Features:
 * 1. Set Priorities (update prioritySummary)
 * 2. Create Collateral (link to create-deliverables)
 * 3. Modify Timelines (manage phases)
 */

export default function ExecutionPage() {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState(null);
  const [workPackages, setWorkPackages] = useState([]);
  const [loadingWorkPackages, setLoadingWorkPackages] = useState(false);
  const [showPrioritiesModal, setShowPrioritiesModal] = useState(false);
  const [prioritySummary, setPrioritySummary] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);

  // Load workpackages when contact is selected
  useEffect(() => {
    if (selectedContact?.id) {
      loadWorkPackages(selectedContact.id);
    } else {
      setWorkPackages([]);
      setSelectedWorkPackage(null);
    }
  }, [selectedContact]);

  // Load prioritySummary when workPackage is selected
  useEffect(() => {
    if (selectedWorkPackage?.prioritySummary) {
      setPrioritySummary(selectedWorkPackage.prioritySummary);
    } else {
      setPrioritySummary('');
    }
  }, [selectedWorkPackage]);

  const loadWorkPackages = async (contactId) => {
    try {
      setLoadingWorkPackages(true);
      const response = await api.get(`/api/workpackages?contactId=${contactId}`);
      
      if (response.data?.success && response.data.workPackages) {
        setWorkPackages(response.data.workPackages);
        // Auto-select if only one workpackage
        if (response.data.workPackages.length === 1) {
          setSelectedWorkPackage(response.data.workPackages[0]);
        }
      } else {
        setWorkPackages([]);
      }
    } catch (error) {
      console.error('Error loading workpackages:', error);
      setWorkPackages([]);
    } finally {
      setLoadingWorkPackages(false);
    }
  };

  const handleSetPriorities = async () => {
    if (!selectedWorkPackage) {
      alert('Please select a work package first');
      return;
    }

    setSavingPriority(true);
    try {
      const response = await api.patch(`/api/workpackages/${selectedWorkPackage.id}`, {
        prioritySummary,
      });

      if (response.data?.success) {
        // Update local state
        setSelectedWorkPackage({
          ...selectedWorkPackage,
          prioritySummary,
        });
        setShowPrioritiesModal(false);
        alert('Priorities updated successfully!');
      } else {
        throw new Error(response.data?.error || 'Failed to update priorities');
      }
    } catch (error) {
      console.error('Error updating priorities:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update priorities');
    } finally {
      setSavingPriority(false);
    }
  };

  const handleCreateCollateral = () => {
    if (!selectedWorkPackage) {
      alert('Please select a work package first');
      return;
    }

    // Navigate to create-deliverables with pre-selected contact and workPackage
    router.push(`/client-operations/create-deliverables?contactId=${selectedContact.id}&workPackageId=${selectedWorkPackage.id}`);
  };

  const handleModifyTimelines = () => {
    if (!selectedWorkPackage) {
      alert('Please select a work package first');
      return;
    }

    // Navigate to timeline management (we'll create this view)
    router.push(`/client-operations/execution/timelines?workPackageId=${selectedWorkPackage.id}`);
  };

  const readyToManage = selectedContact && selectedWorkPackage;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Execution Hub"
          subtitle="Manage client work packages: set priorities, create collateral, and modify timelines"
          backTo="/client-operations"
          backLabel="Back to Client Operations"
        />

        <div className="mt-8 space-y-8">
          {/* Step 1: Select Contact */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Step 1: Select Contact</h2>
            <ContactSelector
              onContactChange={(contact) => {
                setSelectedContact(contact);
                setSelectedWorkPackage(null);
              }}
              selectedContact={selectedContact}
            />
          </div>

          {/* Step 2: Select Work Package */}
          {selectedContact && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Step 2: Select Work Package</h2>
              {loadingWorkPackages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading work packages...</span>
                </div>
              ) : workPackages.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    No work packages found for this contact. Please create a work package first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workPackages.map((wp) => (
                    <button
                      key={wp.id}
                      onClick={() => setSelectedWorkPackage(wp)}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                        selectedWorkPackage?.id === wp.id
                          ? 'border-red-600 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{wp.title || 'Untitled Work Package'}</h3>
                          {wp.description && (
                            <p className="mt-1 text-sm text-gray-600">{wp.description}</p>
                          )}
                          {wp.prioritySummary && (
                            <div className="mt-2 rounded bg-blue-50 px-2 py-1">
                              <p className="text-xs font-medium text-blue-800">Current Priorities</p>
                              <p className="text-xs text-blue-700">{wp.prioritySummary}</p>
                            </div>
                          )}
                        </div>
                        {selectedWorkPackage?.id === wp.id && (
                          <div className="ml-4 h-2 w-2 rounded-full bg-red-600"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Execution Nav Bar */}
          {readyToManage && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">Execution Actions</h2>
              
              {/* Action Buttons - Azure-style */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Set Priorities */}
                <button
                  onClick={() => setShowPrioritiesModal(true)}
                  className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-6 text-center transition-all hover:border-blue-500 hover:shadow-lg"
                >
                  <Target className="mb-3 h-10 w-10 text-blue-600" />
                  <span className="text-base font-semibold text-gray-900">Set Priorities</span>
                  <span className="mt-1 text-xs text-gray-500">Update weekly focus</span>
                  {selectedWorkPackage?.prioritySummary && (
                    <div className="absolute right-2 top-2">
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                </button>

                {/* Create Collateral */}
                <button
                  onClick={handleCreateCollateral}
                  className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-6 text-center transition-all hover:border-green-500 hover:shadow-lg"
                >
                  <FileText className="mb-3 h-10 w-10 text-green-600" />
                  <span className="text-base font-semibold text-gray-900">Create Collateral</span>
                  <span className="mt-1 text-xs text-gray-500">Build deliverables</span>
                  <ArrowRight className="absolute right-2 top-2 h-5 w-5 text-gray-400 group-hover:text-green-600" />
                </button>

                {/* Modify Timelines */}
                <button
                  onClick={handleModifyTimelines}
                  className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-6 text-center transition-all hover:border-purple-500 hover:shadow-lg"
                >
                  <Calendar className="mb-3 h-10 w-10 text-purple-600" />
                  <span className="text-base font-semibold text-gray-900">Modify Timelines</span>
                  <span className="mt-1 text-xs text-gray-500">Manage phases</span>
                  <ArrowRight className="absolute right-2 top-2 h-5 w-5 text-gray-400 group-hover:text-purple-600" />
                </button>
              </div>

              {/* Selected Info Summary */}
              <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Ready to Manage</h3>
                    <p className="text-sm text-green-700">
                      {selectedContact?.firstName} {selectedContact?.lastName} • {selectedWorkPackage.title}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Set Priorities Modal */}
      {showPrioritiesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-semibold text-gray-900">Set Priorities This Week</h3>
            <p className="mb-4 text-sm text-gray-600">
              Write a summary of key focuses and priorities for this work package. This will appear on the client dashboard.
            </p>
            
            <textarea
              value={prioritySummary}
              onChange={(e) => setPrioritySummary(e.target.value)}
              placeholder="E.g., Focus on persona research for Q2 campaign, complete blog drafts for approval, finalize presentation deck..."
              className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              rows={6}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPrioritiesModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPriorities}
                disabled={savingPriority}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingPriority ? (
                  <>
                    <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Priorities'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

