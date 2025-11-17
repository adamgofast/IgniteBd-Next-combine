'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { Plus, X } from 'lucide-react';
import api from '@/lib/api';

/**
 * Create Blank Work Package Page
 * Start with an empty work package and manually add phases/items
 */
function BlankWorkPackageContent() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    totalCost: '',
  });
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!contactId) {
      setError('Please select a contact');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/api/workpackages', {
        contactId,
        companyId: companyId || null,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        totalCost: formData.totalCost ? parseFloat(formData.totalCost) : null,
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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Blank Work Package"
          subtitle="Start with an empty work package and add phases and items manually"
          backTo="/workpackages/create"
          backLabel="Back to Options"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Contact Selection */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <ContactSelector
              onContactSelect={(contact, company) => {
                setContactId(contact.id);
                setCompanyId(company?.id || '');
                setSelectedContact(contact);
              }}
              selectedContact={selectedContact}
            />
          </div>

          {/* Work Package Details */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Work Package Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Q1 Content Package"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the work package..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalCost}
                  onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !contactId}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Work Package'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BlankWorkPackagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BlankWorkPackageContent />
    </Suspense>
  );
}

