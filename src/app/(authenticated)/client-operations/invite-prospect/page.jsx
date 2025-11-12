'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mail, User, CheckCircle, Copy, Send, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';

export default function InviteProspectPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [error, setError] = useState('');

  const [companyHQId, setCompanyHQId] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  // Load contacts from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cachedContacts = window.localStorage.getItem('contacts');
    if (cachedContacts) {
      try {
        const parsed = JSON.parse(cachedContacts);
        if (Array.isArray(parsed)) {
          setContacts(parsed);
        }
      } catch (err) {
        console.warn('Failed to parse cached contacts', err);
        setContacts([]);
      }
    }
  }, []);

  // Fetch contacts from API if needed
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
        console.log('Fetched contacts from API:', fetched.length);
        setContacts(fetched);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(fetched));
        }
      } else {
        console.warn('API response missing contacts:', response.data);
        setContacts([]);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setLoadingContacts(false);
    }
  }, [companyHQId]);

  // Refresh from localStorage
  const refreshContacts = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const cachedContacts = window.localStorage.getItem('contacts');
    if (cachedContacts) {
      try {
        const parsed = JSON.parse(cachedContacts);
        if (Array.isArray(parsed)) {
          setContacts(parsed);
        }
      } catch (err) {
        console.warn('Failed to parse cached contacts', err);
      }
    }
  }, []);

  // Filter contacts by search term and ensure they have email
  const availableContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const hasEmail = contact.email && contact.email.trim() !== '';
      const matchesSearch =
        !searchTerm ||
        contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.contactCompany?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
      return hasEmail && matchesSearch;
    });
  }, [contacts, searchTerm]);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setInviteLink(null);
    setError('');
  };

  const handleGenerateInvite = async () => {
    if (!selectedContact) return;

    setGenerating(true);
    setError('');
    setInviteLink(null);

    try {
      const response = await api.post(
        `/api/contacts/${selectedContact.id}/generate-portal-access`
      );

      if (response.data?.success && response.data.invite) {
        setInviteLink(response.data.invite.passwordResetLink);
      } else {
        setError(response.data?.error || 'Failed to generate portal access');
      }
    } catch (err) {
      console.error('Error generating invite:', err);
      setError(err.response?.data?.error || 'Failed to generate portal access');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Link copied to clipboard!');
    }
  };

  const handleEmailLink = () => {
    if (inviteLink && selectedContact?.email) {
      const subject = 'Client Portal Access - Ignite Strategies';
      const body = `Hello ${selectedContact.firstName || ''},\n\nYou've been invited to access the Ignite Client Portal. Click the link below to set up your password and get started:\n\n${inviteLink}\n\nOnce you set your password, you'll be able to view your proposals and other client information.\n\nBest regards,\nIgnite Strategies`;
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
          {!inviteLink && (
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
                    placeholder="Search contacts by name, email, or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
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
              ) : contacts.length === 0 ? (
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
                      ? 'No contacts found matching your search'
                      : 'No contacts with email addresses available'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Found {contacts.length} total contacts, but none have email addresses.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
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

          {/* Success - Show Invite Link */}
          {inviteLink && selectedContact && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    Portal Access Generated!
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Send this link to <strong>{selectedContact.firstName} {selectedContact.lastName}</strong> ({selectedContact.email})
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-green-200 p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Password Reset Link
                </p>
                <p className="text-sm text-gray-700 break-all font-mono">
                  {inviteLink}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 rounded-lg bg-white border border-green-600 px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-green-50 flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
                <button
                  onClick={handleEmailLink}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Email Link
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedContact(null);
                  setInviteLink(null);
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

