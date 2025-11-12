'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mail, User, CheckCircle, Copy, Send, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

export default function InviteProspectPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [inviteCredentials, setInviteCredentials] = useState(null);
  const [error, setError] = useState('');

  const [companyHQId, setCompanyHQId] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [registry] = useState(() => getContactsRegistry());

  // Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  // Load contacts from registry on mount
  useEffect(() => {
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

  // Get available contacts using registry search - shows all with email when search is empty
  const availableContacts = useMemo(() => {
    // If no search term, show all contacts with email
    if (!searchTerm || !searchTerm.trim()) {
      return registry.getWithEmail();
    }
    // Otherwise search and filter by email
    return registry.searchWithEmail(searchTerm);
  }, [searchTerm, registry]);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setInviteCredentials(null);
    setError('');
  };

  const handleGenerateInvite = async () => {
    if (!selectedContact) {
      setError('Please select a contact first');
      return;
    }

    if (!selectedContact.id || !selectedContact.email) {
      console.error('Selected contact missing id or email:', selectedContact);
      setError('Contact ID and email are required. Please try selecting the contact again.');
      return;
    }

    setGenerating(true);
    setError('');
    setInviteCredentials(null);

    try {
      console.log('Generating invite for contact:', selectedContact.id, selectedContact.email);
      const response = await api.post('/api/invite/send', {
        contactId: selectedContact.id,
        email: selectedContact.email,
      });

      if (response.data?.success && response.data.invite) {
        setInviteCredentials(response.data.invite);
      } else {
        setError(response.data?.error || 'Failed to generate invite');
      }
    } catch (err) {
      console.error('Error generating invite:', err);
      setError(err.response?.data?.error || 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyActivationLink = () => {
    if (inviteCredentials?.activationLink) {
      navigator.clipboard.writeText(inviteCredentials.activationLink);
      alert('Activation link copied to clipboard!');
    }
  };

  const handleEmailInvite = () => {
    if (inviteCredentials && selectedContact?.email) {
      const subject = 'Client Portal Access - Ignite Strategies';
      const body = `Hello ${selectedContact.firstName || ''},\n\nYou've been invited to access the Ignite Client Portal.\n\nClick the link below to activate your account and set your password:\n\n${inviteCredentials.activationLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nIgnite Strategies`;
      window.location.href = `mailto:${selectedContact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Invite Your Prospect"
          subtitle="Your client will get your proposals and other client information in a secure portal. Select your prospect and it will generate a login for him/her to get started. Once there, your proposal and other client info will be waiting."
          backTo="/client-operations"
          backLabel="Back to Client Operations"
        />

        <div className="mt-8 space-y-6">
          {/* Contact Selection */}
          {!inviteCredentials && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Your Prospect
              </h2>

              {/* Search and Refresh */}
              <div className="mb-6 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type to search contacts by name, email, or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
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

              {/* Contacts List */}
              {loadingContacts ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
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
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Load Contacts from API
                    </button>
                  )}
                </div>
              ) : availableContacts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {searchTerm
                      ? `No contacts found matching "${searchTerm}"`
                      : 'No contacts with email addresses available'}
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Clear search to see all contacts
                    </button>
                  )}
                  {!searchTerm && registry.getCount() > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Found {registry.getCount()} total contacts, but none have email addresses.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchTerm && (
                    <p className="text-xs text-gray-500 mb-2 px-2">
                      Showing {availableContacts.length} of {registry.getWithEmail().length} contacts with email
                    </p>
                  )}
                  {availableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition ${
                        selectedContact?.id === contact.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-600">{contact.email}</p>
                            </div>
                            {contact.contactCompany?.companyName && (
                              <p className="text-xs text-gray-500 mt-1">
                                {contact.contactCompany.companyName}
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedContact?.id === contact.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Generate Button */}
              {selectedContact && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generating}
                    className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Generating Invite...
                      </>
                    ) : (
                      <>
                        Generate Portal Access
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Success - Show Activation Link */}
          {inviteCredentials && selectedContact && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    ✅ Portal Access Created!
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Send this activation link to <strong>{selectedContact.firstName} {selectedContact.lastName}</strong> ({selectedContact.email})
                  </p>
                  <div className="mt-2 text-xs text-green-600 space-y-1">
                    <p>• Firebase User: {inviteCredentials.firebaseUserStatus === 'created' ? '✅ Created' : '✅ Existing'}</p>
                    <p>• Invite Token: ✅ Generated ({inviteCredentials.token?.substring(0, 8)}...)</p>
                    <p>• Contact Linked: ✅ Firebase UID stored</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-green-200 p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Activation Link
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-700 font-mono flex-1 break-all">
                    {inviteCredentials.activationLink}
                  </p>
                  <button
                    onClick={handleCopyActivationLink}
                    className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                    title="Copy Link"
                  >
                    <Copy className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Expires: {new Date(inviteCredentials.expiresAt).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEmailInvite}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Email Invite
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedContact(null);
                  setInviteCredentials(null);
                  setError('');
                }}
                className="mt-4 w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Invite Another Contact
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

