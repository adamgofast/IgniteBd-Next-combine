'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Filter,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import api from '@/lib/api';

export default function ContactsViewPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  const refreshContactsFromAPI = useCallback(
    async (showLoading = true) => {
      if (!companyHQId) return;

      try {
        if (showLoading) setLoading(true);
        const params = new URLSearchParams({ companyHQId });
        if (pipelineFilter) {
          params.append('pipeline', pipelineFilter);
        }
        const response = await api.get(`/api/contacts?${params.toString()}`);

        if (response.data?.success && response.data.contacts) {
          const fetchedContacts = response.data.contacts;
          setContacts(fetchedContacts);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              'contacts',
              JSON.stringify(fetchedContacts),
            );
          }
        } else {
          setContacts([]);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        if (showLoading) setContacts([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [companyHQId, pipelineFilter],
  );

  const loadContacts = useCallback(async () => {
    if (!companyHQId) {
      setLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const cachedContacts = window.localStorage.getItem('contacts');
      if (cachedContacts) {
        try {
          const parsed = JSON.parse(cachedContacts);
          setContacts(parsed);
          setLoading(false);
          refreshContactsFromAPI(false);
          return;
        } catch (error) {
          console.warn('Unable to parse cached contacts', error);
        }
      }
    }

    await refreshContactsFromAPI(true);
  }, [companyHQId, refreshContactsFromAPI]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSelectContact = (contactId) => {
    setSelectedContacts((prev) => {
      const updated = new Set(prev);
      if (updated.has(contactId)) {
        updated.delete(contactId);
      } else {
        updated.add(contactId);
      }
      return updated;
    });
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (
        pipelineFilter &&
        contact.pipeline?.pipeline !== pipelineFilter
      ) {
        return false;
      }

      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const name = `${contact.firstName || ''} ${
        contact.lastName || ''
      }`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (
        contact.contactCompany?.companyName || ''
      ).toLowerCase();
      return (
        name.includes(search) ||
        email.includes(search) ||
        company.includes(search)
      );
    });
  }, [contacts, pipelineFilter, searchTerm]);

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    const count = selectedContacts.size;
    if (
      !window.confirm(
        `Are you sure you want to delete ${count} contact${
          count !== 1 ? 's' : ''
        }?`,
      )
    ) {
      return;
    }

    try {
      setBulkDeleting(true);
      await Promise.all(
        Array.from(selectedContacts).map((contactId) =>
          api.delete(`/api/contacts/${contactId}`),
        ),
      );

      const updatedContacts = contacts.filter(
        (contact) => !selectedContacts.has(contact.id),
      );
      setContacts(updatedContacts);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'contacts',
          JSON.stringify(updatedContacts),
        );
      }
      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Error bulk deleting contacts:', error);
      alert('Failed to delete some contacts. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDelete = async (contactId, event) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setDeletingId(contactId);
      await api.delete(`/api/contacts/${contactId}`);
      const updatedContacts = contacts.filter((c) => c.id !== contactId);
      setContacts(updatedContacts);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'contacts',
          JSON.stringify(updatedContacts),
        );
      }
      setSelectedContacts((prev) => {
        const updated = new Set(prev);
        updated.delete(contactId);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatLabel = (value) =>
    value
      ? value
          .split(/[-_]/)
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(' ')
      : '';

  const getPipelineBadge = (pipeline) => {
    if (!pipeline) return null;
    const colors = {
      prospect: 'bg-blue-100 text-blue-800',
      client: 'bg-green-100 text-green-800',
      collaborator: 'bg-purple-100 text-purple-800',
      institution: 'bg-orange-100 text-orange-800',
    };
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-semibold ${
          colors[pipeline.pipeline] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {formatLabel(pipeline.pipeline)}
      </span>
    );
  };

  const getStageBadge = (pipeline) => {
    if (!pipeline?.stage) return null;
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {formatLabel(pipeline.stage)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">
            Loading Contacts…
          </div>
          <div className="text-gray-600">Fetching your contacts…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👥 All Contacts</h1>
              <p className="mt-2 text-gray-600">
                {filteredContacts.length} contact
                {filteredContacts.length !== 1 ? 's' : ''} • {contacts.length}{' '}
                total
              </p>
            </div>
            <div className="flex gap-3">
              {selectedContacts.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                    bulkDeleting
                      ? 'cursor-not-allowed bg-gray-400 text-white'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="h-5 w-5" />
                  Delete {selectedContacts.size}
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push('/contacts')}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white transition hover:bg-gray-700"
              >
                ← Back to People Hub
              </button>
              <button
                type="button"
                onClick={() => router.push('/contacts/manual')}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                Add Contact
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts by name, email, or company…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <select
                  value={pipelineFilter}
                  onChange={(event) => setPipelineFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Pipelines</option>
                  <option value="prospect">Prospect</option>
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              No contacts found
            </h3>
            <p className="mb-6 text-gray-600">
              {searchTerm || pipelineFilter
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first contact.'}
            </p>
            {!searchTerm && !pipelineFilter && (
              <button
                type="button"
                onClick={() => router.push('/contacts/manual')}
                className="rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
              >
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900">
                Contacts ({filteredContacts.length})
              </h2>
              {selectedContacts.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedContacts.size} selected
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          filteredContacts.length > 0 &&
                          selectedContacts.size === filteredContacts.length
                        }
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pipeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/contacts/${contact.id}`)}
                    >
                      <td
                        className="px-6 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <span className="hover:text-blue-600 hover:underline">
                          {contact.goesBy ||
                            `${contact.firstName || ''} ${
                              contact.lastName || ''
                            }`.trim() ||
                            'Unnamed Contact'}
                        </span>
                        {contact.title && (
                          <div className="mt-1 text-xs text-gray-400">
                            {contact.title}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {contact.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {contact.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {contact.contactCompany?.companyName || 'N/A'}
                      </td>
                      <td className="px-6 py-4">{getPipelineBadge(contact.pipeline)}</td>
                      <td className="px-6 py-4">{getStageBadge(contact.pipeline)}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={(event) => handleDelete(contact.id, event)}
                          disabled={deletingId === contact.id}
                          className={`rounded-lg p-2 transition ${
                            deletingId === contact.id
                              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                          title="Delete contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

