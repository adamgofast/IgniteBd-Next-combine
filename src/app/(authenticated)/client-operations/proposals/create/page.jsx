'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useProposals } from '../layout';
import { Plus, X, Package, Calendar, RefreshCw, Search, Mail, User, Save, DollarSign, FileText } from 'lucide-react';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

export default function CreateProposalPage() {
  const router = useRouter();
  const { addProposal, companyHQId } = useProposals();
  const [registry] = useState(() => getContactsRegistry());

  // Contact & Company
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Proposal
  const [proposalTitle, setProposalTitle] = useState('');
  const [purpose, setPurpose] = useState('');

  // Services
  const [savedServices, setSavedServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Phases
  const [phases, setPhases] = useState([]);

  // Compensation
  const [totalPrice, setTotalPrice] = useState(0);
  const [paymentStructure, setPaymentStructure] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!registry.hydrated) {
      registry.loadFromCache();
    }
    if (companyHQId) {
      loadServices();
    }
  }, [companyHQId]);

  const fetchContacts = useCallback(async () => {
    if (!companyHQId) return;
    setLoadingContacts(true);
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data.contacts) {
        registry.hydrate(response.data.contacts);
        registry.saveToCache();
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [companyHQId, registry]);

  const loadServices = async () => {
    if (!companyHQId) return;
    setLoadingServices(true);
    try {
      const response = await api.get(`/api/products?companyHQId=${companyHQId}`);
      setSavedServices(response.data || []);
    } catch (err) {
      console.error('Error loading services:', err);
      setSavedServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const availableContacts = useMemo(() => {
    if (typeof window === 'undefined') return [];
    if (!contactSearch || !contactSearch.trim()) {
      return registry.getAll().slice(0, 20);
    }
    return registry.search(contactSearch).slice(0, 20);
  }, [contactSearch, registry]);

  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    if (contact.contactCompany) {
      setCompanyNameInput(contact.contactCompany.companyName);
      setSelectedCompany(contact.contactCompany);
    } else {
      setCompanyNameInput('');
      setSelectedCompany(null);
    }
  };

  const handleCompanyConfirm = async () => {
    if (!companyNameInput.trim() || !selectedContact) return;
    setLoadingCompany(true);
    try {
      const upsertResponse = await api.post('/api/companies', {
        companyName: companyNameInput.trim(),
        companyHQId,
      });
      const company = upsertResponse.data?.company;
      if (!company) throw new Error('Failed to create company');

      await api.put(`/api/contacts/${selectedContact.id}`, {
        contactCompanyId: company.id,
      });

      await fetchContacts();
      const updatedContact = registry.getById(selectedContact.id);
      if (updatedContact?.contactCompany) {
        setSelectedCompany(updatedContact.contactCompany);
        setSelectedContact(updatedContact);
      } else {
        setSelectedCompany(company);
      }
    } catch (err) {
      console.error('Error confirming company:', err);
      setError('Failed to confirm company');
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleAddService = (service) => {
    const existing = selectedServices.find(s => s.serviceId === service.id);
    if (existing) {
      setSelectedServices(selectedServices.map(s =>
        s.serviceId === service.id
          ? { ...s, quantity: s.quantity + 1, price: s.unitPrice * (s.quantity + 1) }
          : s
      ));
    } else {
      const unitPrice = service.price || 0;
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          name: service.name,
          description: service.description || '',
          unitPrice: unitPrice,
          quantity: 1,
          price: unitPrice,
        }
      ]);
    }
    // Update total price
    const newTotal = selectedServices.reduce((sum, s) => {
      if (s.serviceId === service.id) {
        return sum + (s.unitPrice * (s.quantity + 1));
      }
      return sum + s.price;
    }, service.price || 0);
    setTotalPrice(newTotal);
  };

  const handleUpdateServiceQuantity = (serviceId, quantity) => {
    const newQuantity = Math.max(1, quantity);
    setSelectedServices(selectedServices.map(s => {
      if (s.serviceId === serviceId) {
        return { ...s, quantity: newQuantity, price: s.unitPrice * newQuantity };
      }
      return s;
    }));
    // Recalculate total
    const newTotal = selectedServices.reduce((sum, s) => {
      if (s.serviceId === serviceId) {
        return sum + (s.unitPrice * newQuantity);
      }
      return sum + s.price;
    }, 0);
    setTotalPrice(newTotal);
  };

  const handleRemoveService = (serviceId) => {
    const removed = selectedServices.find(s => s.serviceId === serviceId);
    setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
    setTotalPrice(totalPrice - (removed?.price || 0));
  };

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

  const handleUpdatePhase = (phaseId, updates) => {
    setPhases(phases.map(p => p.id === phaseId ? { ...p, ...updates } : p));
  };

  const handleAddDeliverable = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return { ...p, deliverables: [...(p.deliverables || []), ''] };
      }
      return p;
    }));
  };

  const handleUpdateDeliverable = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const deliverables = [...(p.deliverables || [])];
        deliverables[index] = value;
        return { ...p, deliverables };
      }
      return p;
    }));
  };

  const handleAddCoreWork = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return { ...p, coreWork: [...(p.coreWork || []), ''] };
      }
      return p;
    }));
  };

  const handleUpdateCoreWork = (phaseId, index, value) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        const coreWork = [...(p.coreWork || [])];
        coreWork[index] = value;
        return { ...p, coreWork };
      }
      return p;
    }));
  };

  const handleSubmit = async () => {
    if (!proposalTitle.trim()) {
      setError('Proposal title is required');
      return;
    }
    if (!selectedContact || !selectedCompany) {
      setError('Please select a contact and company');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const serviceInstances = selectedServices.map(s => ({
        name: s.name,
        description: s.description,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        price: s.price,
      }));

      const compensation = {
        total: totalPrice,
        currency: 'USD',
        paymentStructure: paymentStructure || `$${totalPrice.toLocaleString()}`,
      };

      const payload = {
        companyHQId,
        clientName: `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email,
        clientCompany: selectedCompany.companyName,
        companyId: selectedCompany.id,
        purpose: purpose || proposalTitle,
        status: 'draft',
        serviceInstances: serviceInstances.length > 0 ? serviceInstances : null,
        phases: phases.length > 0 ? phases : null,
        milestones: [],
        compensation,
        totalPrice,
      };

      const response = await api.post('/api/proposals', payload);
      const proposal = response.data?.proposal;

      if (!proposal) {
        throw new Error('Failed to create proposal');
      }

      addProposal(proposal);
      router.push(`/client-operations/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Contact & Company */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-red-600" />
              Contact & Company
            </h2>

            {/* Selected Contact Display */}
            {selectedContact && selectedCompany && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedContact.firstName} {selectedContact.lastName}
                      </p>
                      {selectedContact.email && (
                        <p className="text-sm text-gray-600">{selectedContact.email}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedCompany.companyName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setSelectedCompany(null);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {/* Contact Search */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts by name, email, or company..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <button
                  onClick={() => registry.loadFromCache()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {companyHQId && (
                  <button
                    onClick={fetchContacts}
                    disabled={loadingContacts}
                    className="px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 text-blue-600"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingContacts ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Contact List */}
              {availableContacts.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleContactSelect(contact)}
                      className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.email && (
                            <p className="text-sm text-gray-600">{contact.email}</p>
                          )}
                          {contact.contactCompany?.companyName && (
                            <p className="text-xs text-gray-500">{contact.contactCompany.companyName}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Company Confirmation */}
              {selectedContact && !selectedCompany && (
                <div className="pt-4 border-t">
                  <p className="mb-2 text-sm text-gray-600">Confirm company name:</p>
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
                      className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {loadingCompany ? 'Confirming...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Proposal Title & Purpose */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Proposal Title & Purpose
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="e.g., Proposal for Growth Services for BusinessPoint Law"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Purpose / Description
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={6}
                  placeholder="Describe the purpose and goals of this proposal..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </section>

          {/* Services */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-red-600" />
                Services
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
                  onClick={loadServices}
                  disabled={loadingServices}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingServices ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {savedServices.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-600 mb-4">No services available</p>
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
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                          )}
                          <p className="text-sm font-semibold text-gray-900 mt-2">
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
                            onClick={() => handleAddService(service)}
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
          </section>

          {/* Phases */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-600" />
                Phases
              </h2>
              <button
                onClick={handleAddPhase}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Add Phase
              </button>
            </div>

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
                      <h3 className="text-lg font-semibold text-gray-900">Phase {index + 1}</h3>
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
                          <label className="mb-1 block text-xs font-semibold text-gray-700">Phase Name</label>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                            placeholder="e.g., Foundation"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-700">Weeks</label>
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
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Goal</label>
                        <textarea
                          value={phase.goal}
                          onChange={(e) => handleUpdatePhase(phase.id, { goal: e.target.value })}
                          placeholder="Phase goal..."
                          rows={2}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="block text-xs font-semibold text-gray-700">Deliverables</label>
                          <button
                            onClick={() => handleAddDeliverable(phase.id)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(phase.deliverables || []).map((deliverable, delIndex) => (
                            <input
                              key={delIndex}
                              type="text"
                              value={deliverable}
                              onChange={(e) => handleUpdateDeliverable(phase.id, delIndex, e.target.value)}
                              placeholder="e.g., 3 Target Personas"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="block text-xs font-semibold text-gray-700">Core Work</label>
                          <button
                            onClick={() => handleAddCoreWork(phase.id)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(phase.coreWork || []).map((work, workIndex) => (
                            <input
                              key={workIndex}
                              type="text"
                              value={work}
                              onChange={(e) => handleUpdateCoreWork(phase.id, workIndex, e.target.value)}
                              placeholder="e.g., Configure IgniteBD CRM + domain layer"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Outcome</label>
                        <textarea
                          value={phase.outcome}
                          onChange={(e) => handleUpdatePhase(phase.id, { outcome: e.target.value })}
                          placeholder="Expected outcome..."
                          rows={2}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Compensation */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-red-600" />
              Compensation
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Total Price *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    value={totalPrice || ''}
                    onChange={(e) => setTotalPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Payment Structure
                </label>
                <input
                  type="text"
                  value={paymentStructure}
                  onChange={(e) => setPaymentStructure(e.target.value)}
                  placeholder="e.g., 3 payments of $500 at beginning, middle, and on delivery"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </section>

          {/* Submit */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proposal Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalPrice.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !proposalTitle.trim() || !selectedContact || !selectedCompany}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {submitting ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

