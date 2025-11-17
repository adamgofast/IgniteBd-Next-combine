'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { Upload, FileText, CheckCircle, X, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Work Package CSV Upload Page
 * Upload a CSV to create a work package with phases and items directly
 */
function WorkPackageCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'success'
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Handle quoted fields
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line).map(v => v.replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v)); // Remove empty rows
    
    return { headers, rows };
  };

  // Validate CSV headers
  const validateHeaders = (headers) => {
    const required = [
      'proposaldescription',
      'proposaltotalcost',
      'proposalnotes',
      'phasename',
      'phaseposition',
      'phasedescription',
      'deliverablelabel',
      'deliverabletype',
      'deliverabledescription',
      'quantity',
      'unitofmeasure',
      'estimatedhourseach',
      'status'
    ];
    const missing = required.filter(req => !headers.includes(req));
    
    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing required columns: ${missing.join(', ')}`,
      };
    }
    
    return { valid: true };
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCSV(text);
      
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        setError(validation.error);
        setFile(null);
        return;
      }

      // Map CSV rows to preview format
      const previewData = rows.slice(0, 5).map(row => ({
        proposalDescription: row.proposaldescription || '',
        proposalTotalCost: row.proposaltotalcost || '',
        proposalNotes: row.proposalnotes || '',
        phaseName: row.phasename || '',
        phasePosition: row.phaseposition || '',
        phaseDescription: row.phasedescription || '',
        deliverableLabel: row.deliverablelabel || '',
        deliverableType: row.deliverabletype || '',
        deliverableDescription: row.deliverabledescription || '',
        quantity: row.quantity || '',
        unitOfMeasure: row.unitofmeasure || '',
        estimatedHoursEach: row.estimatedhourseach || '',
        status: row.status || '',
      }));

      setPreview({
        headers,
        rows: previewData,
        totalRows: rows.length,
      });
      setStep('preview');
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format.');
      setFile(null);
    }
  };

  // Handle CSV upload
  const handleUpload = async () => {
    if (!file || !contactId) {
      setError('Please select a file and contact');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('contactId', contactId);
      if (companyId) {
        formData.append('companyId', companyId);
      }

      const response = await api.post('/api/workpackages/import/one-shot', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        setStep('success');
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push(`/workpackages/${response.data.workPackage.id}`);
        }, 2000);
      } else {
        setError(response.data?.error || 'Failed to import work package');
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Work Package from CSV"
          subtitle="Import a complete work package with phases and deliverables"
          backTo="/workpackages/create"
          backLabel="Back to Options"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="mt-8 space-y-6">
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

            {/* File Upload */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload CSV File
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <span className="text-red-600 hover:text-red-700 font-semibold">
                    Choose CSV File
                  </span>
                </label>
                {file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {file.name}
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                CSV must include: proposalDescription, proposalTotalCost, proposalNotes, phaseName, phasePosition, phaseDescription, deliverableLabel, deliverableType, deliverableDescription, quantity, unitOfMeasure, estimatedHoursEach, status
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Preview ({preview.totalRows} rows total)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Phase
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Deliverable
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Hours Each
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.phaseName}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {row.deliverableLabel}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {row.quantity}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {row.estimatedHoursEach}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleUpload}
                  disabled={!contactId || loading}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Work Package'}
                </button>
                <button
                  onClick={() => {
                    setStep('upload');
                    setPreview(null);
                    setFile(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Work Package Created Successfully!
            </h3>
            <p className="text-sm text-gray-600">
              Redirecting to work package...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkPackageCSVUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorkPackageCSVUploadContent />
    </Suspense>
  );
}

