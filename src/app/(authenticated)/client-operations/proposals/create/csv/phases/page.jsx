'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Phase CSV Upload Page
 */
function PhaseCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file');
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
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const uploadResponse = await api.post('/api/csv/phases/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data?.success) {
        setSuccess(true);
        setUploadedCount(uploadResponse.data.count || 0);
        setFile(null);
        
        // Reset file input
        const fileInput = document.getElementById('file-upload');
        if (fileInput) fileInput.value = '';
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
          title="Upload Phase CSV"
          subtitle="Upload phases for your proposal templates"
          backTo="/client-operations/proposals/create/csv"
          backLabel="Back to CSV Upload"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>Successfully uploaded {uploadedCount} phase template(s)!</span>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">CSV Format</h2>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600 mb-3">Your CSV should include the following columns:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 text-sm">Phase Name</span>
                    <span className="text-xs text-gray-500">(required)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 text-sm">Description</span>
                    <span className="text-xs text-gray-500">(optional)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 text-sm">Duration (Days)</span>
                    <span className="text-xs text-gray-500">(optional)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 text-sm">Order</span>
                    <span className="text-xs text-gray-500">(required: 1, 2, 3...)</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Example:</p>
                  <pre className="text-xs text-gray-600">
{`Phase Name,Description,Duration (Days),Order
Foundation,Initial setup and configuration,5,1
Enrichment,Data import and enrichment,10,2
Launch,Final preparation and go-live,7,3`}
                  </pre>
                </div>
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
              disabled={!file || uploading}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Phase CSV'}
            </button>

            {success && (
              <button
                onClick={() => router.push('/templates/pantry')}
                className="w-full rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                View Templates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PhaseCSVUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PhaseCSVUploadContent />
    </Suspense>
  );
}
