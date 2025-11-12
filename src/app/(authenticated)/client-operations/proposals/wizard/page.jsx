'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '../layout';
import { Plus, X, Package, Calendar, CheckCircle, RefreshCw, Search, Mail, User } from 'lucide-react';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

export default function ProposalWizardPage() {
  const router = useRouter();
  const { addProposal, companyHQId } = useProposals();
  const [registry] = useState(() => getContactsRegistry());

  const [step, setStep] = useState(1); // 1: Contact, 2: Business, 3: Proposal Details, 4: Services, 5: Phases
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyConfirmed, setCompanyConfirmed] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  
  // Proposal fields
  const [proposalName, setProposalName] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  
  // Services
  const [savedServices, setSavedServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]); // { serviceId, quantity, price }
  const [loadingServices, setLoadingServices] = useState(false);
  
  // Phases
  const [phases, setPhases] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Load contacts from registry on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!registry.hydrated) {
      registry.loadFromCache();
    }
  }, [registry]);

  // Fetch contacts from API and hydrate registry
  const fetchContactsFromAPI = useCallback(async () => {
    if (!companyHQId) {
      console.warn('No companyHQId available');
      return;
    }

    setLoadingContacts(true);
    setError('');
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data.contacts) {
        const fetched = response.data.contacts;
        registry.hydrate(fetched);
        registry.saveToCache();
      } else {
        console.warn('API response missing contacts:', response.data);
        registry.clear();
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setLoadingContacts(false);
    }
  }, [companyHQId, registry]);

  // Refresh from cache
  const refreshContacts = useCallback(() => {
    registry.loadFromCache();
  }, [registry]);

  // Get available contacts using registry search (client-side only)
  const availableContacts = useMemo(() => {
    if (typeof window === 'undefined') return [];
    // If no search term, show all contacts
    if (!contactSearch || !contactSearch.trim()) {
      return registry.getAll().slice(0, 20);
    }
    // Otherwise search
    return registry.search(contactSearch).slice(0, 20);
  }, [contactSearch, registry]);

  // Load products from API
  useEffect(() => {
    if (companyHQId && step >= 4) {
      loadSavedServices();
    }
  }, [companyHQId, step]);

  // Auto-generate proposal name when company/contact selected
  useEffect(() => {
    if (selectedContact && selectedCompany) {
      const contactName = `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email;
      setProposalName(`Proposal for ${selectedCompany.companyName} ${contactName}`);
    }
  }, [selectedContact, selectedCompany]);

  const loadSavedServices = async () => {
    if (!companyHQId) return;
    setLoadingServices(true);
    try {
      // Load products from API
      const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
      const products = response.data || [];
      setSavedServices(products);
    } catch (err) {
      console.error('Error loading products:', err);
      // Fallback to localStorage if API fails
      try {
        const saved = typeof window !== 'undefined' 
          ? JSON.parse(localStorage.getItem('savedServices') || '[]')
          : [];
        setSavedServices(saved);
      } catch (parseErr) {
        setSavedServices([]);
      }
    } finally {
      setLoadingServices(false);
    }
  };


  // Handle contact selection - move to company confirmation
  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    setError('');
    
    // Pre-fill company name if contact has one, but don't auto-confirm
    if (contact.contactCompany) {
      setCompanyNameInput(contact.contactCompany.companyName);
      // Don't auto-set selectedCompany - user needs to confirm
    } else {
      // No company - clear input
      setCompanyNameInput('');
    }
    setCompanyConfirmed(false);
    setSelectedCompany(null);
    setStep(2); // Move to business confirmation step
  };

  // Handle company confirmation/creation
  const handleCompanyConfirm = async () => {
    if (!companyHQId || !selectedContact) return;
    if (!companyNameInput.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoadingCompany(true);
    setError('');

    try {
      // Upsert Company (scoped to companyHQId)
      const createResponse = await api.post('/api/companies', {
        companyHQId,
        companyName: companyNameInput.trim(),
      });

      const company = createResponse.data?.company;
      if (!company) {
        throw new Error('Failed to create or find company');
      }

      // Link contact to company
      await api.put(`/api/contacts/${selectedContact.id}`, {
        contactCompanyId: company.id,
      });

      // Refresh registry to get updated contact data
      await fetchContactsFromAPI();
      
      // Get updated contact from registry
      const updatedContact = registry.getById(selectedContact.id);

      if (updatedContact?.contactCompany) {
        setSelectedCompany(updatedContact.contactCompany);
        setSelectedContact(updatedContact);
        setCompanyNameInput(updatedContact.contactCompany.companyName);
      } else {
        setSelectedCompany(company);
        setCompanyNameInput(company.companyName);
        // Update registry with new company link
        registry.updateContact(selectedContact.id, { contactCompany: company });
      }
      
      setCompanyConfirmed(true);
      setStep(3); // Move to proposal details step
    } catch (err) {
      console.error('Error confirming company:', err);
      setError('Failed to confirm company. Please try again.');
    } finally {
      setLoadingCompany(false);
    }
  };

  // Handle service selection
  const handleSelectService = (service) => {
    const existing = selectedServices.find(s => s.serviceId === service.id);
    if (existing) {
      // Update quantity
      setSelectedServices(selectedServices.map(s => 
        s.serviceId === service.id 
          ? { ...s, quantity: s.quantity + 1, price: s.unitPrice * (s.quantity + 1) }
          : s
      ));
    } else {
      // Add new service
      const unitPrice = service.price || 0;
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          name: service.name,
          description: service.description || service.valueProp || '',
          type: service.category || 'general',
          unitPrice: unitPrice,
          quantity: 1,
          price: unitPrice, // Total = unitPrice * quantity
        }
      ]);
    }
  };

  const handleUpdateServiceQuantity = (serviceId, quantity) => {
    setSelectedServices(selectedServices.map(s => {
      if (s.serviceId === serviceId) {
        const newQuantity = Math.max(1, quantity);
        return {
          ...s,
          quantity: newQuantity,
          price: s.unitPrice * newQuantity,
        };
      }
      return s;
    }));
  };

  const handleRemoveService = (serviceId) => {
    setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
  };

  // Calculate total price
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedServices]);

  // Add phase
  const handleAddPhase = () => {
    setPhases([
      ...phases,
      {
        id: `phase-${Date.now()}`,
        name: '',
        weeks: '',
        color: phases.length === 0 ? 'red' : phases.length === 1 ? 'yellow' : 'purple',
        goal: '',
        deliverables: [],
        coreWork: [],
        outcome: '',
      }
    ]);
  };

  // Update phase
  const handleUpdatePhase = (phaseId, updates) => {
    setPhases(phases.map(p => p.id === phaseId ? { ...p, ...updates } : p));
  };

  // Add deliverable to phase
  const handleAddDeliverableToPhase = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          deliverables: [...(p.deliverables || []), ''],
        };
      }
      return p;
    }));
  };

  // Update deliverable in phase
  const handleUpdateDeliverableInPhase = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const deliverables = [...(p.deliverables || [])];
        deliverables[index] = value;
        return { ...p, deliverables };
      }
      return p;
    }));
  };

  // Add core work to phase
  const handleAddCoreWorkToPhase = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          coreWork: [...(p.coreWork || []), ''],
        };
      }
      return p;
    }));
  };

  // Update core work in phase
  const handleUpdateCoreWorkInPhase = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const coreWork = [...(p.coreWork || [])];
        coreWork[index] = value;
        return { ...p, coreWork };
      }
      return p;
    }));
  };

  // Submit proposal
  const handleSubmit = async () => {
    if (!companyHQId || !selectedContact) {
      setError('Please select a contact');
      return;
    }

    if (!companyConfirmed || !selectedCompany) {
      setError('Please confirm the business');
      return;
    }

    if (!proposalName.trim()) {
      setError('Please enter a proposal name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Build serviceInstances from selected services
      const serviceInstances = selectedServices.map(s => ({
        name: s.name,
        description: s.description,
        type: s.type,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        price: s.price,
      }));

      // Build milestones from phases
      const milestones = [];
      phases.forEach((phase, phaseIndex) => {
        phase.deliverables?.forEach((deliverable, delIndex) => {
          milestones.push({
            week: phaseIndex * 3 + delIndex + 1,
            phase: phase.name,
            phaseColor: phase.color,
            milestone: deliverable,
            phaseId: phase.id,
          });
        });
      });

      // Build compensation
      const compensation = {
        total: totalPrice,
        currency: 'USD',
        paymentStructure: phases.length > 0 
          ? `${phases.length} payments of $${Math.round(totalPrice / phases.length)}`
          : `$${totalPrice.toLocaleString()}`,
      };

      const payload = {
        companyHQId,
        clientName: `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email,
        clientCompany: selectedCompany.companyName,
        companyId: selectedCompany.id,
        purpose: proposalDescription, // Using description as purpose for now
        proposalName, // Store in purpose field or add new field
        totalPrice,
        expectedDeliveryDate: expectedDeliveryDate || null,
        status: 'draft',
        serviceInstances,
        phases,
        milestones,
        compensation,
        preparedBy: typeof window !== 'undefined' ? window.localStorage.getItem('ownerId') : null,
        dateIssued: new Date(),
      };

      const response = await api.post('/api/proposals', payload);
      const proposal = response.data?.proposal;

      if (!proposal) {
        throw new Error('Proposal response missing payload');
      }

      // Add to context
      addProposal(proposal);

      // Navigate to proposal detail
      router.push(`/client-operations/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Unable to save proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          subtitle="Step-by-step proposal creation"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((stepNum) => (
            <div key={stepNum} className="flex items-center flex-1">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  step >= stepNum
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > stepNum ? <CheckCircle className="h-5 w-5" /> : stepNum}
              </div>
              {stepNum < 5 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    step > stepNum ? 'bg-red-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Contact Selection */}
        {step === 1 && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              1. Find Contact
            </h2>

            {/* Search and Refresh */}
            <div className="mb-6 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type to search contacts by name, email, or company..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
                {contactSearch && (
                  <button
                    onClick={() => setContactSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                onClick={refreshContacts}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                title="Refresh from cache"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              {companyHQId && (
                <button
                  onClick={fetchContactsFromAPI}
                  disabled={loadingContacts}
                  className="px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-blue-600"
                  title="Fetch from API"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingContacts ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Selected Contact Display */}
            {selectedContact && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </p>
                      {selectedContact.email && (
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{selectedContact.email}</p>
                        </div>
                      )}
                      {selectedContact.contactCompany?.companyName && (
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedContact.contactCompany.companyName}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setSelectedCompany(null);
                      setCompanyNameInput('');
                      setCompanyConfirmed(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {/* Contacts List */}
            {!selectedContact && (
              <>
                {loadingContacts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2" />
                    <p className="text-gray-500">Loading contacts...</p>
                  </div>
                ) : registry.getCount() === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No contacts found in cache.
                    </p>
                    {companyHQId && (
                      <button
                        onClick={fetchContactsFromAPI}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                      >
                        Load Contacts from API
                      </button>
                    )}
                  </div>
                ) : availableContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {contactSearch
                        ? `No contacts found matching "${contactSearch}"`
                        : 'No contacts available'}
                    </p>
                    {contactSearch && (
                      <button
                        onClick={() => setContactSearch('')}
                        className="mt-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Clear search to see all contacts
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {contactSearch && (
                      <p className="text-xs text-gray-500 mb-2 px-2">
                        Showing {availableContacts.length} of {registry.getCount()} contacts
                      </p>
                    )}
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                          selectedContact?.id === contact.id
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                          {selectedContact?.id === contact.id && (
                            <CheckCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Continue Button */}
            {selectedContact && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  Continue to Confirm Company
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Business Confirmation */}
        {step === 2 && selectedContact && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              2. Confirm Business
            </h2>
            {companyConfirmed && selectedCompany ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-gray-600 mb-1">Company</p>
                <p className="font-semibold text-gray-900">{selectedCompany.companyName}</p>
                <button
                  onClick={() => {
                    setCompanyConfirmed(false);
                    setSelectedCompany(null);
                    setCompanyNameInput(selectedCompany.companyName);
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Change Company
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-gray-600">
                  Enter the company name for this proposal:
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={companyNameInput}
                    onChange={(e) => setCompanyNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && companyNameInput.trim()) {
                        handleCompanyConfirm();
                      }
                    }}
                    placeholder="Company name"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    disabled={loadingCompany}
                  />
                  <button
                    onClick={handleCompanyConfirm}
                    disabled={loadingCompany || !companyNameInput.trim()}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingCompany ? 'Confirming...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
            {companyConfirmed && (
              <button
                onClick={() => setStep(3)}
                className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Continue to Proposal Details
              </button>
            )}
          </div>
        )}

        {/* Step 3: Proposal Title & Description (Internal Only) */}
        {step === 3 && companyConfirmed && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              3. Proposal Title & Description
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              <strong>Internal use only</strong> - This helps you organize and track proposals internally.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={proposalName}
                  onChange={(e) => setProposalName(e.target.value)}
                  placeholder="Proposal for Company Contact Name"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Suggested: Proposal for {selectedCompany?.companyName} - {selectedContact?.firstName} {selectedContact?.lastName}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Description <span className="text-gray-500 font-normal">(Internal Use Only)</span>
                </label>
                <textarea
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  rows={4}
                  placeholder="Internal notes about what this proposal covers, context, or special considerations..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This description is for your internal reference only and won't be shown to the client
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!proposalName.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Continue to Services
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Choose or Add Services */}
        {step === 4 && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                4. Choose or Add Services/Deliverables
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/products/builder')}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4" />
                  Create Product
                </button>
                <button
                  onClick={loadSavedServices}
                  disabled={loadingServices}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingServices ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            
            {loadingServices ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading services...</p>
            ) : savedServices.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-600 mb-4">No saved services yet.</p>
                <button
                  onClick={() => router.push('/products/builder')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Create Your First Product
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedServices.map((service) => {
                  const selected = selectedServices.find(s => s.serviceId === service.id);
                  return (
                    <div
                      key={service.id}
                      className={`rounded-lg border p-4 ${
                        selected
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{service.name}</h3>
                            {service.type && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                {service.type}
                              </span>
                            )}
                          </div>
                          {service.description && (
                            <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                          )}
                          <p className="text-sm font-semibold text-gray-900">
                            ${(service.price || 0).toLocaleString()} per unit
                          </p>
                        </div>
                        {selected ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateServiceQuantity(service.id, selected.quantity - 1)}
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={selected.quantity}
                                onChange={(e) => handleUpdateServiceQuantity(service.id, parseInt(e.target.value) || 1)}
                                className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                                min="1"
                              />
                              <button
                                onClick={() => handleUpdateServiceQuantity(service.id, selected.quantity + 1)}
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                              >
                                +
                              </button>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                              ${selected.price.toLocaleString()}
                            </p>
                            <button
                              onClick={() => handleRemoveService(service.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSelectService(service)}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className="mt-6 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total Price:</span>
                  <span className="text-2xl font-bold text-red-600">
                    ${totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Continue to Phases
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Phases (Optional) */}
        {step === 5 && (
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              5. Phases (Optional)
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Define phases with goals, deliverables, core work, and outcomes. This helps structure the engagement.
            </p>

            <div className="space-y-6">
              {phases.map((phase, index) => {
                const colorClasses = {
                  red: 'border-red-200 bg-red-50',
                  yellow: 'border-yellow-200 bg-yellow-50',
                  purple: 'border-purple-200 bg-purple-50',
                };
                return (
                  <div
                    key={phase.id}
                    className={`rounded-lg border p-6 ${colorClasses[phase.color] || colorClasses.red}`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Phase {index + 1}
                      </h3>
                      <button
                        onClick={() => setPhases(phases.filter(p => p.id !== phase.id))}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Phase Name
                          </label>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                            placeholder="e.g., Foundation"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Weeks
                          </label>
                          <input
                            type="text"
                            value={phase.weeks}
                            onChange={(e) => handleUpdatePhase(phase.id, { weeks: e.target.value })}
                            placeholder="e.g., 1-3"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                          Goal
                        </label>
                        <textarea
                          value={phase.goal}
                          onChange={(e) => handleUpdatePhase(phase.id, { goal: e.target.value })}
                          placeholder="e.g., Stand up the IgniteBD environment and core strategy"
                          rows={2}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-700">
                          Deliverables
                        </label>
                        <div className="space-y-2">
                          {phase.deliverables?.map((deliverable, delIndex) => (
                            <input
                              key={delIndex}
                              type="text"
                              value={deliverable}
                              onChange={(e) => handleUpdateDeliverableInPhase(phase.id, delIndex, e.target.value)}
                              placeholder="e.g., 3 Target Personas"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          ))}
                          <button
                            onClick={() => handleAddDeliverableToPhase(phase.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            + Add Deliverable
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-700">
                          Core Work
                        </label>
                        <div className="space-y-2">
                          {phase.coreWork?.map((work, workIndex) => (
                            <input
                              key={workIndex}
                              type="text"
                              value={work}
                              onChange={(e) => handleUpdateCoreWorkInPhase(phase.id, workIndex, e.target.value)}
                              placeholder="e.g., Configure IgniteBD CRM + domain layer"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          ))}
                          <button
                            onClick={() => handleAddCoreWorkToPhase(phase.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            + Add Core Work Item
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                          Outcome
                        </label>
                        <textarea
                          value={phase.outcome}
                          onChange={(e) => handleUpdatePhase(phase.id, { outcome: e.target.value })}
                          placeholder="e.g., A structured IgniteBD workspace — branded, wired, and ready"
                          rows={2}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={handleAddPhase}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-red-500 hover:bg-red-50"
              >
                + Add Phase
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !proposalName.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
