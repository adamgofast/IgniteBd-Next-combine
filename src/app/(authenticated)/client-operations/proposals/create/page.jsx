'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, Copy, Plus, User, Search, RefreshCw, CheckCircle, X } from 'lucide-react';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

/**
 * Proposal Start Landing Page
 * 4-option screen after contact selection
 */
function ProposalStartContent() {
  const router = useRouter();
  const [registry] = useState(() => getContactsRegistry());

  // Contact & Company
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');

  // Previous Proposals Modal
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [previousProposals, setPreviousProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hqId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') || '';
    setCompanyHQId(hqId);
    
    if (!registry.hydrated) {
      registry.loadFromCache();
    }
    if (hqId) {
      fetchContacts();
    }
  }, []);

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

  const loadPreviousProposals = async () => {
    if (!companyHQId) return;
    setLoadingProposals(true);
    try {
      const response = await api.get(`/api/proposals?companyHQId=${companyHQId}`);
      if (response.data?.success && response.data.proposals) {
        setPreviousProposals(response.data.proposals || []);
      }
    } catch (err) {
      console.error('Error loading proposals:', err);
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleOptionSelect = async (option) => {
    if (!selectedContact || !selectedCompany) {
      setError('Please select a contact and company first');
      return;
    }

    const contactId = selectedContact.id;
    const companyId = selectedCompany.id;

    switch (option) {
      case 'csv': {
        router.push(`/client-operations/proposals/create/csv?contactId=${contactId}&companyId=${companyId}`);
        break;
      }
      case 'templates': {
        router.push(`/workpackages/assemble/templates?contactId=${contactId}`);
        break;
      }
      case 'previous': {
        await loadPreviousProposals();
        setShowProposalsModal(true);
        break;
      }
      case 'blank': {
        router.push(`/client-operations/proposals/create/blank?contactId=${contactId}&companyId=${companyId}`);
        break;
      }
    }
  };

  const handleCloneProposal = async (proposalId) => {
    if (!selectedContact || !selectedCompany) return;
    
    try {
      setLoadingProposals(true);
      const response = await api.post('/api/proposals/assemble', {
        contactId: selectedContact.id,
        companyHQId,
        companyId: selectedCompany.id,
        title: 'Copy of Proposal',
        estimatedStart: new Date().toISOString(),
        assemblyType: 'clone',
        data: {
          sourceProposalId: proposalId,
        },
      });

      if (response.data?.success) {
        const proposal = response.data.proposal;
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('proposals');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, proposal];
          window.localStorage.setItem('proposals', JSON.stringify(updated));
        }
        
        router.push(`/client-operations/proposals/${proposal.id}`);
      }
    } catch (err) {
      console.error('Error cloning proposal:', err);
      setError('Failed to clone proposal');
    } finally {
      setLoadingProposals(false);
      setShowProposalsModal(false);
    }
  };

  const OPTIONS = [
    {
      id: 'csv',
      title: 'Upload From CSV',
      description: 'Upload a CSV containing phases and deliverables. IgniteBD will auto-generate the proposal.',
      icon: Upload,
      buttonText: 'Upload CSV',
    },
    {
      id: 'templates',
      title: 'Use Company Templates',
      description: 'Load the default phases and deliverables defined for this company.',
      icon: FileText,
      buttonText: 'Start From Templates',
    },
    {
      id: 'previous',
      title: 'Use a Previous Proposal',
      description: 'Copy an existing proposal as your starting point.',
      icon: Copy,
      buttonText: 'Copy Existing Proposal',
    },
    {
      id: 'blank',
      title: 'Start Blank',
      description: 'Create a proposal from scratch.',
      icon: Plus,
      buttonText: 'Build From Scratch',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Proposal"
          subtitle="Choose how you'd like to build your proposal"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Contact & Company Selection */}
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
                      <CheckCircle className="h-5 w-5 text-green-600" />
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
            {(!selectedContact || !selectedCompany) && (
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
                    title="Refresh from cache"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {companyHQId && (
                    <button
                      onClick={fetchContacts}
                      disabled={loadingContacts}
                      className="px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 text-blue-600"
                      title="Fetch from API"
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
                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                          selectedContact?.id === contact.id
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
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
                          {selectedContact?.id === contact.id && (
                            <CheckCircle className="h-5 w-5 text-red-600 ml-auto" />
                          )}
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
            )}
          </section>

          {/* Proposal Creation Options */}
          {selectedContact && selectedCompany && (
            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Choose Your Starting Point
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.id}
                      className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                      onClick={() => handleOptionSelect(option.id)}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {option.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <button
                        className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                      >
                        {option.buttonText}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Previous Proposals Modal */}
      {showProposalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Select a Proposal to Copy</h3>
              <button
                onClick={() => setShowProposalsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingProposals ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Loading proposals...</p>
                </div>
              ) : previousProposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-600">No previous proposals found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previousProposals.map((proposal) => (
                    <button
                      key={proposal.id}
                      onClick={() => handleCloneProposal(proposal.id)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{proposal.title}</h4>
                          {proposal.purpose && (
                            <p className="text-sm text-gray-600 mt-1">{proposal.purpose}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              {proposal.contact?.firstName} {proposal.contact?.lastName}
                            </span>
                            {proposal.totalPrice && (
                              <span className="text-xs font-semibold text-gray-900">
                                ${proposal.totalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Copy className="h-5 w-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProposalStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ProposalStartContent />
    </Suspense>
  );
}