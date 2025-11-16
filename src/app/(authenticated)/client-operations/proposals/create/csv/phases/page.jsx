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
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setSuccess(false);
      setShowPreview(false);
      setPreviewData(null);
      
      // Auto-preview the file
      await handlePreview(selectedFile);
    }
  };

  const handlePreview = async (fileToPreview) => {
    if (!fileToPreview) return;
    
    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setPreviewing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', fileToPreview);
      formData.append('uploadType', 'phase');

      const previewResponse = await api.post('/api/csv/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (previewResponse.data?.success) {
        setPreviewData(previewResponse.data);
        setShowPreview(true);
      } else {
        setError(previewResponse.data?.error || 'Failed to preview CSV');
      }
    } catch (err) {
      console.error('Error previewing CSV:', err);
      setError(err.response?.data?.error || 'Failed to preview CSV');
    } finally {
      setPreviewing(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Phase Name,Description,Duration (Days),Order
Foundation,Initial setup and configuration,5,1
Enrichment,Data import and enrichment,10,2
Launch,Final preparation and go-live,7,3`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phase_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">CSV Format</h2>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <FileText className="h-4 w-4" />
                  Download Template
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600 mb-3">Your CSV should include the following columns:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 text-sm">Phase Name</span>
                    <span className="text-xs text-gray-500">(recommended)</span>
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
                    <span className="text-xs text-gray-500">(optional: 1, 2, 3...)</span>
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

            {/* Preview Section */}
            {showPreview && previewData && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Field Mapping Preview</h3>
                <div className="space-y-2 mb-4">
                  {previewData.fieldMappings.map((mapping, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{mapping.csvHeader}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">→</span>
                        <span className={`font-medium ${
                          mapping.mappedField === 'unmapped' 
                            ? 'text-orange-600' 
                            : mapping.isRequired 
                              ? 'text-red-600' 
                              : 'text-green-600'
                        }`}>
                          {mapping.mappedField === 'unmapped' ? 'Unmapped' : mapping.mappedField}
                        </span>
                        {mapping.isRequired && (
                          <span className="text-xs text-red-600">(recommended)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {previewData.warnings && previewData.warnings.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Warnings:</p>
                    <ul className="text-xs text-yellow-700 list-disc list-inside">
                      {previewData.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {previewData.sampleData && previewData.sampleData.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Sample Data (first {previewData.sampleData.length} rows):</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            {previewData.headers.map((header, idx) => (
                              <th key={idx} className="px-2 py-1 text-left border-b">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.sampleData.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {previewData.headers.map((header, colIdx) => (
                                <td key={colIdx} className="px-2 py-1 border-b">{row[header] || ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {file && !showPreview && (
                <button
                  onClick={() => handlePreview(file)}
                  disabled={previewing}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {previewing ? 'Previewing...' : 'Preview Mapping'}
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`${showPreview ? 'w-full' : 'flex-1'} rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {uploading ? 'Uploading...' : 'Upload Phase CSV'}
              </button>
            </div>

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
