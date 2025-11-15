'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Search, RefreshCw, Sparkles, User, Mail, X } from 'lucide-react';

export default function ExistingEnrich() {
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [contact, setContact] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored =
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyId') ||
        '';
      setCompanyHQId(stored);
    }
  }, []);

  async function handleSearch() {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    if (!companyHQId) {
      alert('Company context is required');
      return;
    }

    setSearching(true);
    setContact(null);

    try {
      const r = await api.get(`/api/contacts/by-email?email=${encodeURIComponent(email)}`);
      if (r.data?.success && r.data.contact) {
        setContact(r.data.contact);
      } else {
        alert('Contact not found in CRM');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        alert('Contact not found in CRM');
      } else {
        alert(err.response?.data?.details || err.message || 'Search failed');
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleEnrich() {
    if (!contact?.id) {
      alert('Contact ID is required');
      return;
    }

    setEnriching(true);
    try {
      const r = await api.post('/api/contacts/enrich', {
        contactId: contact.id,
        email: contact.email,
        linkedinUrl: contact.linkedinUrl,
      });

      if (r.data?.success) {
        alert('Contact enriched successfully!');
        setContact(r.data.contact);
      } else {
        alert(r.data?.error || 'Enrichment failed');
      }
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="text-3xl font-bold mb-6">👤 Enrich Existing CRM Contact</h1>

        {/* Search */}
        <div className="bg-white p-6 rounded-lg shadow border mb-6">
          <label className="block mb-2 font-semibold">Search by Email</label>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="contact@example.com"
              className="flex-1 border px-4 py-2 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && email && !searching) {
                  handleSearch();
                }
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !email}
              className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
        </div>

        {/* Contact Found */}
        {contact && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">Contact Found</h2>
              <button onClick={() => setContact(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              {contact.firstName || contact.lastName ? (
                <div>
                  <span className="text-sm text-gray-600">Name:</span>
                  <p className="font-semibold">
                    {contact.firstName} {contact.lastName}
                  </p>
                </div>
              ) : null}

              {contact.email && (
                <div>
                  <span className="text-sm text-gray-600">Email:</span>
                  <p>{contact.email}</p>
                </div>
              )}

              {contact.title && (
                <div>
                  <span className="text-sm text-gray-600">Title:</span>
                  <p>{contact.title}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="mt-4 bg-orange-600 text-white px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Enriching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enrich This Contact
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

