'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { Save, X, User, FileText, Calendar, Tag } from 'lucide-react';
import api from '@/lib/api';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const CATEGORY_OPTIONS = [
  'foundation',
  'integration',
  'enrichment',
  'strategy',
  'implementation',
  'training',
  'support',
  'other',
];

export default function CreateDeliverablePage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyHQId, setCompanyHQId] = useState('');
  
  const [formData, setFormData] = useState({
    contactId: '',
    title: '',
    description: '',
    category: '',
    proposalId: '',
    milestoneId: '',
    dueDate: '',
    status: 'pending',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedId);
    loadData(storedId);
  }, []);

  const loadData = async (tenantId) => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load contacts
      const contactsResponse = await api.get(`/api/contacts?companyHQId=${tenantId}`);
      const contactsData = contactsResponse.data?.contacts || [];
      setContacts(contactsData);

      // Load proposals
      const proposalsResponse = await api.get(`/api/proposals?companyHQId=${tenantId}`);
      const proposalsData = proposalsResponse.data?.proposals || [];
      setProposals(proposalsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load contacts and proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.contactId) {
      setError('Please select a contact');
      return;
    }

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        contactId: formData.contactId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category || null,
        proposalId: formData.proposalId || null,
        milestoneId: formData.milestoneId || null,
        dueDate: formData.dueDate || null,
        status: formData.status,
      };

      const response = await api.post('/api/deliverables', payload);
      
      if (response.data?.success) {
        router.push('/client-operations/deliverables');
      } else {
        throw new Error(response.data?.error || 'Failed to create deliverable');
      }
    } catch (err) {
      console.error('Error creating deliverable:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create deliverable');
    } finally {
      setSaving(false);
    }
  };

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === formData.contactId);
  }, [contacts, formData.contactId]);

  const filteredProposals = useMemo(() => {
    if (!formData.contactId) return proposals;
    // Filter proposals for the selected contact's company
    const contact = contacts.find((c) => c.id === formData.contactId);
    if (!contact?.contactCompanyId) return proposals;
    return proposals.filter((p) => p.companyId === contact.contactCompanyId);
  }, [proposals, formData.contactId, contacts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Deliverable"
          subtitle="Add a new deliverable for a client engagement"
          backTo="/client-operations/deliverables"
          backLabel="Back to Deliverables"
        />

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Contact Selection */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <User className="h-4 w-4" />
                Contact *
              </label>
              <select
                value={formData.contactId}
                onChange={(e) => handleChange('contactId', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                required
              >
                <option value="">Select a contact...</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName} {contact.email ? `(${contact.email})` : ''}
                    {contact.contactCompany ? ` - ${contact.contactCompany.companyName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="h-4 w-4" />
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., 3 Target Personas"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                placeholder="Describe what this deliverable includes..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {/* Category and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Tag className="h-4 w-4" />
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Select category...</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Proposal (Optional) */}
            {filteredProposals.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Link to Proposal (Optional)
                </label>
                <select
                  value={formData.proposalId}
                  onChange={(e) => handleChange('proposalId', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">No proposal link</option>
                  {filteredProposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.clientName} - {proposal.clientCompany} ({proposal.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Milestone ID */}
            {formData.proposalId && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Milestone ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.milestoneId}
                  onChange={(e) => handleChange('milestoneId', e.target.value)}
                  placeholder="e.g., week-1, milestone-1"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            )}

            {/* Due Date */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Calendar className="h-4 w-4" />
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => router.push('/client-operations/deliverables')}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Creating...' : 'Create Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

