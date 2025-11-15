'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Search, User, Mail, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader';

/**
 * Create New Work Package Page
 * Uses localStorage for companyHQId (no hydration)
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

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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

      const response = await api.post('/api/workpackages', {
        contactId: contactId || null,
        companyHQId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: 'ACTIVE',
      });

      if (response.data?.success) {
        const newWorkPackage = response.data.workPackage;
        
        // Immediately save to localStorage (hydration pattern)
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('workPackages');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, newWorkPackage];
          window.localStorage.setItem('workPackages', JSON.stringify(updated));
        }
        
        router.push(`/workpackages/${newWorkPackage.id}`);
      } else {
        setError(response.data?.error || 'Failed to create work package');
      }
    } catch (err) {
      console.error('Error creating work package:', err);
      setError(err.response?.data?.error || 'Failed to create work package');
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
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
                <Save className="h-4 w-4" />
                {loading ? 'Creating...' : 'Create Work Package'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

