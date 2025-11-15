'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
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
  const [loadingContacts, setLoadingContacts] = useState(false);
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
        router.push(`/workpackages/${response.data.workPackage.id}`);
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
              {loadingContacts ? (
                <div className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-50">
                  <p className="text-sm text-gray-500">Loading contacts...</p>
                </div>
              ) : (
                <select
                  value={contactId}
                  onChange={(e) => {
                    setContactId(e.target.value);
                    if (error) setError('');
                    // Store in localStorage
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('contactId', e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  required
                >
                  <option value="">Select a client contact...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName} {contact.email ? `(${contact.email})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {contacts.length === 0 && !loadingContacts && (
                <p className="mt-1 text-xs text-gray-500">
                  No contacts found. Create a contact first.
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

