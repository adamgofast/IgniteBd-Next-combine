'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * CSV Upload Handler for Proposal Creation
 */
function CSVUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contactId');
  const companyId = searchParams.get('companyId');

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !contactId || !companyId) {
      setError('Please select a CSV file and ensure contact/company are selected');
      return;
    }

    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contactId', contactId);
      formData.append('companyHQId', companyHQId);
      formData.append('companyId', companyId);

      // Upload and parse CSV, then create proposal
      const uploadResponse = await api.post('/api/proposals/assemble/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data?.success) {
        // Navigate to proposal builder with parsed data
        router.push(`/client-operations/proposals/${uploadResponse.data.proposal.id}`);
      } else {
        setError(uploadResponse.data?.error || 'Failed to upload CSV');
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Proposal from CSV"
          subtitle="Upload a CSV file with phases and deliverables"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Create Proposal"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">CSV Format</h2>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600 mb-2">Your CSV should include the following columns:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li><code className="bg-white px-1 rounded">phaseName</code> - Name of the phase</li>
                  <li><code className="bg-white px-1 rounded">position</code> - Phase order (1, 2, 3...)</li>
                  <li><code className="bg-white px-1 rounded">deliverableType</code> - Type of deliverable (persona, blog, deck, etc.)</li>
                  <li><code className="bg-white px-1 rounded">itemLabel</code> - Human-readable label</li>
                  <li><code className="bg-white px-1 rounded">quantity</code> - Number of items</li>
                  <li><code className="bg-white px-1 rounded">duration</code> - Duration value (optional)</li>
                  <li><code className="bg-white px-1 rounded">unitOfMeasure</code> - Unit (day, week, month) (optional)</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-red-400 transition">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".csv"
                        className="sr-only"
                        onChange={handleFileSelect}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">CSV up to 10MB</p>
                  {file && (
                    <p className="text-sm text-gray-900 mt-2">
                      Selected: <span className="font-semibold">{file.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading || !contactId || !companyId}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload & Create Proposal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CSVUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CSVUploadContent />
    </Suspense>
  );
}
