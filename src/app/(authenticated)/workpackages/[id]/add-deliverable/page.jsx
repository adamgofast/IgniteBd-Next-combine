'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package, FileText, CheckSquare, Square } from 'lucide-react';
import api from '@/lib/api';
import { 
  WORK_PACKAGE_CONFIG, 
  mapConfigTypeToWorkItemType, 
  getDefaultQuantity,
  getConfigItemByType
} from '@/lib/config/workPackageConfig';

/**
 * Add Deliverable to Work Package
 * Option 1: From Proposal (load deliverables from approved proposal)
 * Option 2: From Standard List (select from config with quantities)
 */
export default function AddDeliverablePage() {
  const params = useParams();
  const router = useRouter();
  const workPackageId = params.id;

  const [mode, setMode] = useState(null); // 'proposal' | 'standard'
  const [workPackage, setWorkPackage] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedItems, setSelectedItems] = useState({}); // { type: { selected: bool, quantity: number, label: string } }
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load work package to get contactId
  useEffect(() => {
    loadWorkPackage();
  }, [workPackageId]);

  // Load proposals when mode is 'proposal'
  useEffect(() => {
    if (mode === 'proposal' && workPackage?.companyHQId) {
      loadProposals();
    }
  }, [mode, workPackage?.companyHQId]);

  const loadWorkPackage = async () => {
    try {
      const response = await api.get(`/api/workpackages?id=${workPackageId}`);
      if (response.data?.success) {
        setWorkPackage(response.data.workPackage);
      }
    } catch (err) {
      console.error('Error loading work package:', err);
      setError('Failed to load work package');
    }
  };

  const loadProposals = async () => {
    try {
      // Proposals API requires companyHQId and optionally contactId
      const params = new URLSearchParams({
        companyHQId: workPackage.companyHQId,
      });
      if (workPackage.contactId) {
        params.append('contactId', workPackage.contactId);
      }
      
      const response = await api.get(`/api/proposals?${params.toString()}`);
      if (response.data?.success) {
        // Filter to approved/active proposals
        const activeProposals = response.data.proposals.filter(
          (p) => p.status === 'approved' || p.status === 'active'
        );
        setProposals(activeProposals);
      }
    } catch (err) {
      console.error('Error loading proposals:', err);
      setError('Failed to load proposals');
    }
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    const newSelected = {};
    if (newSelectAll) {
      WORK_PACKAGE_CONFIG.forEach((item) => {
        newSelected[item.id] = {
          selected: true,
          quantity: getDefaultQuantity(item.type),
          label: item.label,
          workItemType: mapConfigTypeToWorkItemType(item.type),
        };
      });
    }
    setSelectedItems(newSelected);
  };

  const handleToggleItem = (itemId, label, configType) => {
    setSelectedItems((prev) => {
      const newItems = { ...prev };
      if (newItems[itemId]?.selected) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = {
          selected: true,
          quantity: getDefaultQuantity(configType),
          label: label,
          workItemType: mapConfigTypeToWorkItemType(configType),
        };
      }
      // Update selectAll if all items are selected/deselected
      const allSelected = WORK_PACKAGE_CONFIG.every(
        (item) => newItems[item.id]?.selected
      );
      setSelectAll(allSelected);
      return newItems;
    });
  };

  const handleQuantityChange = (itemId, quantity) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: parseInt(quantity) || 1,
      },
    }));
  };

  const handleAddFromStandard = async () => {
    const selected = Object.entries(selectedItems).filter(([_, item]) => item.selected);
    if (selected.length === 0) {
      setError('Please select at least one deliverable');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Batch create all selected items
      const promises = selected.map(([_, item]) =>
        api.post('/api/workpackages/items', {
          workPackageId,
          type: item.workItemType,
          label: item.label,
          quantity: item.quantity,
        })
      );

      await Promise.all(promises);
      
      // Update work package in localStorage (hydration pattern)
      if (typeof window !== 'undefined') {
        try {
          const response = await api.get(`/api/workpackages/${workPackageId}`);
          if (response.data?.success) {
            const updated = response.data.workPackage;
            const cached = window.localStorage.getItem('workPackages');
            const existing = cached ? JSON.parse(cached) : [];
            const updatedList = existing.map(wp => 
              wp.id === workPackageId ? updated : wp
            );
            window.localStorage.setItem('workPackages', JSON.stringify(updatedList));
          }
        } catch (err) {
          console.warn('Failed to update work package in localStorage', err);
        }
      }
      
      router.push(`/workpackages/${workPackageId}`);
    } catch (err) {
      console.error('Error adding deliverables:', err);
      setError(err.response?.data?.error || 'Failed to add deliverables');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromProposal = async () => {
    if (!selectedProposalId) {
      setError('Please select a proposal');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Get proposal and extract deliverables
      const proposalResponse = await api.get(`/api/proposals/${selectedProposalId}`);
      if (!proposalResponse.data?.success) {
        setError('Failed to load proposal');
        return;
      }

      const proposal = proposalResponse.data.proposal;
      // Extract deliverables from proposal phases
      const deliverables = [];
      if (proposal.phases && Array.isArray(proposal.phases)) {
        proposal.phases.forEach((phase) => {
          if (phase.deliverables && Array.isArray(phase.deliverables)) {
            phase.deliverables.forEach((deliverable) => {
              // Map deliverable to WorkPackageItem
              const type = mapDeliverableTypeToWorkItemType(deliverable.type);
              if (type) {
                deliverables.push({
                  type,
                  label: deliverable.title || deliverable.label || deliverable.name,
                  quantity: deliverable.quantity || 1,
                });
              }
            });
          }
        });
      }

      if (deliverables.length === 0) {
        setError('No deliverables found in this proposal');
        return;
      }

      // Batch create all deliverables
      const promises = deliverables.map((item) =>
        api.post('/api/workpackages/items', {
          workPackageId,
          type: item.type,
          label: item.label,
          quantity: item.quantity,
        })
      );

      await Promise.all(promises);
      
      // Update work package in localStorage (hydration pattern)
      if (typeof window !== 'undefined') {
        try {
          const response = await api.get(`/api/workpackages/${workPackageId}`);
          if (response.data?.success) {
            const updated = response.data.workPackage;
            const cached = window.localStorage.getItem('workPackages');
            const existing = cached ? JSON.parse(cached) : [];
            const updatedList = existing.map(wp => 
              wp.id === workPackageId ? updated : wp
            );
            window.localStorage.setItem('workPackages', JSON.stringify(updatedList));
          }
        } catch (err) {
          console.warn('Failed to update work package in localStorage', err);
        }
      }
      
      router.push(`/workpackages/${workPackageId}`);
    } catch (err) {
      console.error('Error adding deliverables from proposal:', err);
      setError(err.response?.data?.error || 'Failed to add deliverables from proposal');
    } finally {
      setLoading(false);
    }
  };

  const mapDeliverableTypeToWorkItemType = (deliverableType) => {
    // Normalize the deliverable type (handle variations)
    const normalized = deliverableType?.toLowerCase().replace(/[-_]/g, '_');
    
    // First try to find in config by type
    const configItem = getConfigItemByType(normalized) || 
                       getConfigItemByType(deliverableType?.toLowerCase());
    
    if (configItem) {
      return mapConfigTypeToWorkItemType(configItem.type);
    }
    
    // Fallback: direct mapping for legacy/alternative formats
    const fallbackMapping = {
      'outreach-template': 'OUTREACH_TEMPLATE',
      'event-plan': 'CLE_DECK', // EVENT_CLE_PLAN deprecated
      'cle-deck': 'CLE_DECK',
      'presentation-deck': 'PRESENTATION_DECK',
      'landing-page': 'LANDING_PAGE',
    };
    
    return fallbackMapping[deliverableType?.toLowerCase()] || 
           mapConfigTypeToWorkItemType(normalized) || 
           null;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push(`/workpackages/${workPackageId}`)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add Deliverables</h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose how you want to add deliverables to this work package
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Mode Selection */}
        {!mode && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('proposal')}
              className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-gray-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">From Proposal</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Load deliverables from an approved proposal
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('standard')}
              className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50"
            >
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-gray-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">From Standard List</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Select from our standard deliverables catalog
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* From Proposal Mode */}
        {mode === 'proposal' && (
          <div className="space-y-6">
            <button
              onClick={() => setMode(null)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to selection
            </button>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Select Proposal</h2>
              {proposals.length === 0 ? (
                <p className="text-sm text-gray-500">No approved proposals found for this contact</p>
              ) : (
                <select
                  value={selectedProposalId}
                  onChange={(e) => setSelectedProposalId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Select a proposal...</option>
                  {proposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.title || proposal.clientName} - {proposal.status}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={handleAddFromProposal}
                disabled={loading || !selectedProposalId}
                className="mt-4 w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Deliverables from Proposal'}
              </button>
            </div>
          </div>
        )}

        {/* From Standard List Mode */}
        {mode === 'standard' && (
          <div className="space-y-6">
            <button
              onClick={() => setMode(null)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to selection
            </button>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Standard Deliverables</h2>
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                >
                  {selectAll ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      Select All
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {WORK_PACKAGE_CONFIG.map((item) => {
                  const isSelected = selectedItems[item.id]?.selected || false;
                  const quantity = selectedItems[item.id]?.quantity || getDefaultQuantity(item.type);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border-2 p-4 transition-all ${
                        isSelected
                          ? 'border-red-600 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleItem(item.id, item.label, item.type)}
                          className="mt-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-red-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.label}</h3>
                          {isSelected && (
                            <div className="mt-3">
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, e.target.value)
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-200"
                            />
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleAddFromStandard}
                disabled={loading || Object.keys(selectedItems).length === 0}
                className="mt-6 w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Adding...'
                  : `Add ${Object.keys(selectedItems).length} Deliverable${Object.keys(selectedItems).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

