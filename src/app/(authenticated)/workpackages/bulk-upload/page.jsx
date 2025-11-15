'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Plus, Trash2, Save, FileText, Table } from 'lucide-react';
import api from '@/lib/api';
import { WORK_PACKAGE_ITEM_TYPES, getDefaultQuantity } from '@/lib/config/workPackageConfig';

/**
 * Bulk Upload Work Package Page
 * Supports CSV upload and multi-row form
 */
export default function BulkUploadWorkPackagePage() {
  const router = useRouter();
  const [contactId, setContactId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [uploadMode, setUploadMode] = useState(null); // 'csv' | 'form' | null
  const [csvFile, setCsvFile] = useState(null);
  const [formRows, setFormRows] = useState([]);
  const [phases, setPhases] = useState([]); // Available phases for dropdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const handleAddRow = () => {
    setFormRows([
      ...formRows,
      {
        id: Date.now().toString(),
        phaseName: '',
        phasePosition: phases.length + 1,
        phaseTimeline: '',
        itemType: 'blog',
        itemLabel: '',
        itemDescription: '',
        quantity: 1,
      },
    ]);
  };

  const handleRemoveRow = (rowId) => {
    setFormRows(formRows.filter(row => row.id !== rowId));
  };

  const handleRowChange = (rowId, field, value) => {
    setFormRows(
      formRows.map((row) => {
        if (row.id === rowId) {
          const updated = { ...row, [field]: value };
          // Auto-update quantity if itemType changes
          if (field === 'itemType') {
            updated.quantity = getDefaultQuantity(value);
          }
          return updated;
        }
        return row;
      })
    );
  };

  const handleAddPhase = () => {
    const phaseName = prompt('Enter phase name:');
    if (phaseName) {
      const newPhase = {
        name: phaseName,
        position: phases.length + 1,
      };
      setPhases([...phases, newPhase]);
    }
  };

  const handleCSVUpload = async () => {
    if (!contactId) {
      setError('Please select a contact');
      return;
    }

    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('contactId', contactId);

      const response = await api.post('/api/workpackages/bulk-upload/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        const workPackage = response.data.workPackage;
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('workPackages');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, workPackage];
          window.localStorage.setItem('workPackages', JSON.stringify(updated));
        }
        
        router.push(`/workpackages/${workPackage.id}`);
      } else {
        setError(response.data?.error || 'Failed to upload CSV');
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async () => {
    if (!contactId) {
      setError('Please select a contact');
      return;
    }

    if (formRows.length === 0) {
      setError('Please add at least one row');
      return;
    }

    // Validate rows
    const invalidRows = formRows.filter(
      (row) => !row.phaseName || !row.itemType || !row.itemLabel || !row.quantity
    );

    if (invalidRows.length > 0) {
      setError('Please fill in all required fields (Phase, Item Type, Label, Quantity)');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/api/workpackages/bulk-upload', {
        contactId,
        rows: formRows.map((row) => ({
          phaseName: row.phaseName,
          phasePosition: row.phasePosition,
          phaseTimeline: row.phaseTimeline || null,
          itemType: row.itemType,
          itemLabel: row.itemLabel,
          itemDescription: row.itemDescription || null,
          quantity: row.quantity,
        })),
      });

      if (response.data?.success) {
        const workPackage = response.data.workPackage;
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('workPackages');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, workPackage];
          window.localStorage.setItem('workPackages', JSON.stringify(updated));
        }
        
        router.push(`/workpackages/${workPackage.id}`);
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

  const availableContacts = contacts.filter((contact) => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower);
  }).slice(0, 20);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Upload Work Package</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create work package with phases and items in one go
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Contact Selection */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Client Contact <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          />
          {contactSearch && availableContacts.length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {availableContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    setContactId(contact.id);
                    setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    contactId === contact.id ? 'bg-red-50' : ''
                  }`}
                >
                  {contact.firstName} {contact.lastName} - {contact.email}
                </button>
              ))}
            </div>
          )}
          {contactId && (
            <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3">
              <p className="font-semibold text-gray-900">
                {contacts.find(c => c.id === contactId)?.firstName} {contacts.find(c => c.id === contactId)?.lastName}
              </p>
            </div>
          )}
        </div>

        {/* Upload Mode Selection */}
        {!uploadMode && (
          <div className="space-y-4">
            <button
              onClick={() => setUploadMode('csv')}
              className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-gray-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">CSV Upload</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Upload a CSV file with columns: phaseName, phasePosition, phaseTimeline, itemType, itemLabel, itemDescription, quantity
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setUploadMode('form')}
              className="w-full rounded-lg border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-red-600 hover:bg-red-50"
            >
              <div className="flex items-center gap-4">
                <Table className="h-8 w-8 text-gray-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Multi-Row Form</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Add multiple rows with phase, item type, label, and quantity
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* CSV Upload Mode */}
        {uploadMode === 'csv' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">CSV Upload</h2>
              <button
                onClick={() => setUploadMode(null)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Change
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
                {csvFile && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {csvFile.name}</p>
                )}
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">CSV Format:</p>
                <p className="text-xs text-gray-600">
                  Required columns: phaseName, phasePosition, itemType, itemLabel, quantity<br />
                  Optional columns: phaseTimeline, itemDescription
                </p>
              </div>

              <button
                onClick={handleCSVUpload}
                disabled={loading || !csvFile || !contactId}
                className="w-full rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload CSV'}
              </button>
            </div>
          </div>
        )}

        {/* Multi-Row Form Mode */}
        {uploadMode === 'form' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Multi-Row Form</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddPhase}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  + Add Phase
                </button>
                <button
                  onClick={() => setUploadMode(null)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Change
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Phase</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Position</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Timeline</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Item Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Label</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Quantity</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.phaseName}
                            onChange={(e) => handleRowChange(row.id, 'phaseName', e.target.value)}
                            placeholder="Phase name"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={row.phasePosition}
                            onChange={(e) => handleRowChange(row.id, 'phasePosition', e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.phaseTimeline}
                            onChange={(e) => handleRowChange(row.id, 'phaseTimeline', e.target.value)}
                            placeholder="Weeks 1-3"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.itemType}
                            onChange={(e) => handleRowChange(row.id, 'itemType', e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            {WORK_PACKAGE_ITEM_TYPES.map((type) => (
                              <option key={type.type} value={type.type}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.itemLabel}
                            onChange={(e) => handleRowChange(row.id, 'itemLabel', e.target.value)}
                            placeholder="Item label"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.itemDescription}
                            onChange={(e) => handleRowChange(row.id, 'itemDescription', e.target.value)}
                            placeholder="Optional"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.id, 'quantity', e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleAddRow}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>

              <button
                onClick={handleFormSubmit}
                disabled={loading || formRows.length === 0 || !contactId}
                className="w-full rounded-lg bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Generate Work Package'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

