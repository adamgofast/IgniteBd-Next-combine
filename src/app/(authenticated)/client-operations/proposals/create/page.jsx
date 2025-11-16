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

  // CompanyHQ ID for loading proposals
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
  }, []);

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
    // Just route to the appropriate page - each page handles its own contact selection
    switch (option) {
      case 'csv': {
        router.push('/client-operations/proposals/create/csv');
        break;
      }
      case 'templates': {
        // Route to template pantry first to manage/upload templates
        router.push('/templates/library');
        break;
      }
      case 'previous': {
        // Show modal with proposal list, then route to clone flow
        await loadPreviousProposals();
        setShowProposalsModal(true);
        break;
      }
      case 'blank': {
        router.push('/client-operations/proposals/create/blank');
        break;
      }
    }
  };

  const handleCloneProposal = async (proposalId) => {
    try {
      setLoadingProposals(true);
      // Clone will handle contact selection on the next page
      router.push(`/client-operations/proposals/create/clone?sourceProposalId=${proposalId}`);
    } catch (err) {
      console.error('Error loading proposal:', err);
      setError('Failed to load proposal');
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
      description: 'Manage and upload templates, then build proposals from your template library.',
      icon: FileText,
      buttonText: 'Manage Templates',
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
          {/* Proposal Creation Options - SHOW FIRST */}
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