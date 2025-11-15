'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Search, User, Mail, CheckCircle, FileText, Package, CheckSquare, Square, Eye, Edit } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { 
  WORK_PACKAGE_CONFIG, 
  mapConfigTypeToWorkItemType, 
  getDefaultQuantity,
  getConfigItemByType
} from '@/lib/config/workPackageConfig';

/**
 * Create New Work Package Page
 * Inline deliverable selection with preview before save
 */
export default function NewWorkPackagePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [contactId, setContactId] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  
  // Deliverable selection
  const [deliverableMode, setDeliverableMode] = useState(null); // 'proposal' | 'standard' | null
  const [proposals, setProposals] = useState([]);
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [proposal, setProposal] = useState(null);
  const [selectedDeliverables, setSelectedDeliverables] = useState({}); // { deliverableId: { selected: bool, quantity: number, label: string, type: string } }
  const [selectedItems, setSelectedItems] = useState({}); // { id: { selected: bool, quantity: number, label: string, workItemType: string } }
  const [selectAll, setSelectAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get companyHQId and contacts from localStorage (dashboard pattern - no hydration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompanyHQId =
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyId') ||
        '';
      setCompanyHQId(storedCompanyHQId);

      // Get contactId from localStorage if available
      const storedContactId = window.localStorage.getItem('contactId') || '';
      if (storedContactId) {
        setContactId(storedContactId);
        // Set search to show selected contact
        const cachedContacts = window.localStorage.getItem('contacts');
        if (cachedContacts) {
          try {
            const parsed = JSON.parse(cachedContacts);
            const found = parsed.find(c => c.id === storedContactId);
            if (found) {
              setContactSearch(`${found.firstName || ''} ${found.lastName || ''}`.trim() || found.email || '');
            }
          } catch (error) {
            console.warn('Failed to parse cached contacts', error);
          }
        }
      }

      // Load contacts from localStorage (dashboard pattern - no API call)
      const cachedContacts = window.localStorage.getItem('contacts');
      if (cachedContacts) {
        try {
          const parsed = JSON.parse(cachedContacts);
          if (Array.isArray(parsed)) {
            setContacts(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse cached contacts', error);
        }
      }
    }
  }, []);

  // Load proposals when contact changes and mode is proposal
  useEffect(() => {
    if (contactId && companyHQId && deliverableMode === 'proposal') {
      loadProposals(companyHQId);
    }
  }, [contactId, companyHQId, deliverableMode]);

  // Hydrate proposal when selected
  useEffect(() => {
    if (selectedProposalId && deliverableMode === 'proposal') {
      loadProposal(selectedProposalId);
    }
  }, [selectedProposalId, deliverableMode]);

  const loadProposals = async (hqId) => {
    try {
      const params = new URLSearchParams({
        companyHQId: hqId,
      });
      if (contactId) {
        params.append('contactId', contactId);
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
    }
  };

  const loadProposal = async (proposalId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/proposals/${proposalId}`);
      if (response.data?.success) {
        const proposalData = response.data.proposal;
        setProposal(proposalData);
        
        // Initialize selected deliverables from proposal
        const initialSelected = {};
        if (proposalData.proposalPhases && Array.isArray(proposalData.proposalPhases)) {
          proposalData.proposalPhases.forEach((phase) => {
            if (phase.deliverables && Array.isArray(phase.deliverables)) {
              phase.deliverables.forEach((deliverable) => {
                const type = mapDeliverableTypeToWorkItemType(deliverable.type || deliverable.name);
                if (type) {
                  initialSelected[deliverable.id] = {
                    selected: false,
                    quantity: deliverable.quantity || 1,
                    label: deliverable.name || deliverable.title || deliverable.label,
                    type: type,
                    phaseName: phase.name,
                  };
                }
              });
            }
          });
        }
        setSelectedDeliverables(initialSelected);
      }
    } catch (err) {
      console.error('Error loading proposal:', err);
      setError('Failed to load proposal');
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts based on search
  const availableContacts = useMemo(() => {
    if (!contactSearch || !contactSearch.trim()) {
      return contacts.slice(0, 20);
    }
    const searchLower = contactSearch.toLowerCase();
    return contacts.filter(contact => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (contact.contactCompany?.companyName || '').toLowerCase();
      return name.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
    }).slice(0, 20);
  }, [contactSearch, contacts]);

  // Deliverable selection handlers
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
      const allSelected = WORK_PACKAGE_CONFIG.every(
        (item) => newItems[item.id]?.selected
      );
      setSelectAll(allSelected);
      return newItems;
    });
  };

  const handleToggleDeliverable = (deliverableId) => {
    setSelectedDeliverables((prev) => {
      const newItems = { ...prev };
      if (newItems[deliverableId]) {
        newItems[deliverableId] = {
          ...newItems[deliverableId],
          selected: !newItems[deliverableId].selected,
        };
      }
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

  const handleDeliverableQuantityChange = (deliverableId, quantity) => {
    setSelectedDeliverables((prev) => ({
      ...prev,
      [deliverableId]: {
        ...prev[deliverableId],
        quantity: parseInt(quantity) || 1,
      },
    }));
  };

  const mapDeliverableTypeToWorkItemType = (deliverableType) => {
    if (!deliverableType) return null;
    const normalized = deliverableType?.toLowerCase().replace(/[-_]/g, '_');
    const configItem = getConfigItemByType(normalized) || 
                       getConfigItemByType(deliverableType?.toLowerCase());
    
    if (configItem) {
      return mapConfigTypeToWorkItemType(configItem.type);
    }
    
    const fallbackMapping = {
      'outreach-template': 'OUTREACH_TEMPLATE',
      'event-plan': 'CLE_DECK',
      'cle-deck': 'CLE_DECK',
      'presentation-deck': 'PRESENTATION_DECK',
      'deck': 'PRESENTATION_DECK',
      'landing-page': 'LANDING_PAGE',
      'persona': 'PERSONA',
      'blog': 'BLOG',
      'template': 'OUTREACH_TEMPLATE',
    };
    
    return fallbackMapping[deliverableType?.toLowerCase()] || 
           mapConfigTypeToWorkItemType(normalized) || 
           null;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  // Get preview deliverables
  const previewDeliverables = useMemo(() => {
    if (deliverableMode === 'proposal') {
      return Object.entries(selectedDeliverables)
        .filter(([_, item]) => item.selected)
        .map(([_, item]) => ({
          type: item.type,
          label: item.label,
          quantity: item.quantity,
        }));
    } else if (deliverableMode === 'standard') {
      return Object.entries(selectedItems)
        .filter(([_, item]) => item.selected)
        .map(([_, item]) => ({
          type: item.workItemType,
          label: item.label,
          quantity: item.quantity,
        }));
    }
    return [];
  }, [deliverableMode, selectedDeliverables, selectedItems]);

  const handlePreview = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!contactId) {
      setError('Please select a client contact');
      return;
    }
    if (previewDeliverables.length === 0 && deliverableMode) {
      setError('Please select at least one deliverable');
      return;
    }
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!contactId) {
      setError('Please select a client contact');
      return;
    }

    if (!companyHQId) {
      setError('CompanyHQ ID not found. Please ensure you have selected a company.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Create work package
      const response = await api.post('/api/workpackages', {
        contactId: contactId || null,
        companyHQId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: 'ACTIVE',
      });

      if (!response.data?.success) {
        setError(response.data?.error || 'Failed to create work package');
        return;
      }

      const newWorkPackage = response.data.workPackage;
      const workPackageId = newWorkPackage.id;

      // Add deliverables if any
      if (previewDeliverables.length > 0) {
        await Promise.all(
          previewDeliverables.map((item) =>
            api.post('/api/workpackages/items', {
              workPackageId,
              type: item.type,
              label: item.label,
              quantity: item.quantity,
            })
          )
        );
        
        // Refresh work package to get items
        const refreshed = await api.get(`/api/workpackages/${workPackageId}`);
        if (refreshed.data?.success) {
          newWorkPackage.items = refreshed.data.workPackage.items;
        }
      }
      
      // Immediately save to localStorage (hydration pattern)
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem('workPackages');
        const existing = cached ? JSON.parse(cached) : [];
        const updated = [...existing, newWorkPackage];
        window.localStorage.setItem('workPackages', JSON.stringify(updated));
      }
      
      router.push(`/workpackages/${workPackageId}`);
    } catch (err) {
      console.error('Error creating work package:', err);
      setError(err.response?.data?.error || 'Failed to create work package');
    } finally {
      setLoading(false);
    }
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Preview Work Package</h1>
              <p className="mt-1 text-sm text-gray-600">
                Review your work package before creating
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Client</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {contacts.find(c => c.id === contactId)?.firstName} {contacts.find(c => c.id === contactId)?.lastName}
                </p>
                {contacts.find(c => c.id === contactId)?.email && (
                  <p className="text-sm text-gray-600">{contacts.find(c => c.id === contactId)?.email}</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Title</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">{formData.title}</p>
              </div>

              {formData.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Description</h3>
                  <p className="mt-1 text-gray-700">{formData.description}</p>
                </div>
              )}

              {previewDeliverables.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Deliverables ({previewDeliverables.length})</h3>
                  <div className="space-y-2">
                    {previewDeliverables.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{item.label}</span>
                          <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Creating...' : 'Create Work Package'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Work Package</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create a new work package to track client deliverables
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handlePreview(); }} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Client Contact <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts by name, email, or company..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  />
                  {contactSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setContactSearch('');
                        setContactId('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {contactSearch && availableContacts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setContactId(contact.id);
                          setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
                          if (error) setError('');
                          // Store in localStorage
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('contactId', contact.id);
                          }
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                          contactId === contact.id ? 'bg-red-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-red-600" />
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {contact.firstName} {contact.lastName}
                              </p>
                              {contact.email && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                  <p className="text-sm text-gray-600">{contact.email}</p>
                                </div>
                              )}
                              {contact.contactCompany?.companyName && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {contact.contactCompany.companyName}
                                </p>
                              )}
                            </div>
                          </div>
                          {contactId === contact.id && (
                            <CheckCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {contactId && (
                <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {contacts.find(c => c.id === contactId)?.firstName} {contacts.find(c => c.id === contactId)?.lastName}
                        </p>
                        {contacts.find(c => c.id === contactId)?.email && (
                          <p className="text-sm text-gray-600">{contacts.find(c => c.id === contactId)?.email}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setContactId('');
                        setContactSearch('');
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
              
              {contacts.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  No contacts found in cache. Create a contact first or refresh from dashboard.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Title <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Q1 2025 Client Deliverables"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Optional description of this work package"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
              />
            </div>

            {/* Deliverable Selection */}
            <div className="pt-6 border-t border-gray-200">
              <label className="mb-4 block text-sm font-medium text-gray-700">
                Add Deliverables (Optional)
              </label>
              
              {/* Mode Selection */}
              {!deliverableMode && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliverableMode('proposal');
                      if (contactId && companyHQId) {
                        loadProposals(companyHQId);
                      }
                    }}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-red-600 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-gray-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">From Proposal</h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Load deliverables from an approved proposal
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliverableMode('standard')}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-red-600 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-6 w-6 text-gray-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">From Standard List</h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Select from our standard deliverables catalog
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* From Proposal Mode */}
              {deliverableMode === 'proposal' && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Select Proposal</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliverableMode(null);
                        setSelectedProposalId('');
                        setProposal(null);
                        setSelectedDeliverables({});
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Change
                    </button>
                  </div>
                  
                  {proposals.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {contactId 
                        ? 'No approved proposals found for this contact'
                        : 'Select a contact first to see proposals'}
                    </p>
                  ) : (
                    <>
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

                      {proposal && proposal.proposalPhases && (
                        <div className="mt-4 space-y-4">
                          <h4 className="text-sm font-semibold text-gray-700">Select Deliverables:</h4>
                          {proposal.proposalPhases.map((phase) => (
                            <div key={phase.id} className="rounded-lg border border-gray-200 bg-white p-3">
                              <h5 className="font-medium text-gray-900 mb-2">{phase.name}</h5>
                              {phase.deliverables && phase.deliverables.length > 0 ? (
                                <div className="space-y-2">
                                  {phase.deliverables.map((deliverable) => {
                                    const item = selectedDeliverables[deliverable.id];
                                    if (!item) return null;
                                    return (
                                      <div
                                        key={deliverable.id}
                                        className={`rounded-lg border-2 p-2 transition-all ${
                                          item.selected
                                            ? 'border-red-600 bg-red-50'
                                            : 'border-gray-200 bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleDeliverable(deliverable.id)}
                                            className="mt-0.5"
                                          >
                                            {item.selected ? (
                                              <CheckSquare className="h-5 w-5 text-red-600" />
                                            ) : (
                                              <Square className="h-5 w-5 text-gray-400" />
                                            )}
                                          </button>
                                          <div className="flex-1">
                                            <h6 className="font-medium text-gray-900 text-sm">{item.label}</h6>
                                            {item.selected && (
                                              <div className="mt-2">
                                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                                  Quantity
                                                </label>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={item.quantity}
                                                  onChange={(e) =>
                                                    handleDeliverableQuantityChange(deliverable.id, e.target.value)
                                                  }
                                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-200"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No deliverables in this phase</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* From Standard List Mode */}
              {deliverableMode === 'standard' && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Standard Deliverables</h3>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
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
                      <button
                        type="button"
                        onClick={() => {
                          setDeliverableMode(null);
                          setSelectedItems({});
                          setSelectAll(false);
                        }}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        ← Change
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {WORK_PACKAGE_CONFIG.map((item) => {
                      const isSelected = selectedItems[item.id]?.selected || false;
                      const quantity = selectedItems[item.id]?.quantity || getDefaultQuantity(item.type);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-lg border-2 p-3 transition-all ${
                            isSelected
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleItem(item.id, item.label, item.type)}
                              className="mt-0.5"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-red-600" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">{item.label}</h4>
                              {isSelected && (
                                <div className="mt-2">
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
                                    className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-200"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title.trim()}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
