'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, CheckCircle, X, AlertTriangle, Eye } from 'lucide-react';
import api from '@/lib/api';

/**
 * Phase CSV Upload Page with Validation and Preview
 */
function PhaseCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [validationData, setValidationData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setWarning('');
      setValidationData(null);
      setShowPreview(false);
      
      // Auto-validate the file
      await handleValidate(selectedFile);
    }
  };

  const handleValidate = async (fileToValidate) => {
    if (!fileToValidate) return;
    
    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setValidating(true);
    setError('');
    setWarning('');

    try {
      const formData = new FormData();
      formData.append('file', fileToValidate);
      formData.append('uploadType', 'phase');

      const validateResponse = await api.post('/api/csv/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (validateResponse.data?.success) {
        const data = validateResponse.data;
        
        // Check for validation errors
        if (!data.validation.isValid) {
          setError(
            `Missing required columns: ${data.validation.missingRequired.join(', ')}`
          );
          setValidationData(null);
          return;
        }

        // Check for warnings (extra columns)
        if (data.validation.warnings && data.validation.warnings.length > 0) {
          setWarning(data.validation.warnings.join(' '));
        }

        setValidationData(data);
        setShowPreview(true);
      } else {
        setError(validateResponse.data?.error || 'Failed to validate CSV');
        if (validateResponse.data?.validation) {
          setError(
            `Missing required columns: ${validateResponse.data.validation.missingRequired.join(', ')}`
          );
        }
      }
    } catch (err) {
      console.error('Error validating CSV:', err);
      setError(err.response?.data?.error || 'Failed to validate CSV');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file || !validationData) return;

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
      formData.append('companyHQId', companyHQId);

      const uploadResponse = await api.post('/api/csv/phases/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data?.success) {
        // Show success toast and redirect
        if (typeof window !== 'undefined') {
          // Store success message in sessionStorage for toast
          sessionStorage.setItem('csvImportSuccess', JSON.stringify({
            message: 'Templates imported successfully!',
            count: uploadResponse.data.count || 0,
            type: 'phase',
          }));
          
          // Redirect to Client Operations Templates with phase tab
          router.push('/templates/library?tab=phases');
        }
      } else {
        setError(uploadResponse.data?.error || 'Failed to upload CSV');
        setUploading(false);
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.response?.data?.error || 'Failed to upload CSV');
      setUploading(false);
    }
  };

  const handleCancel = () => {
    router.push('/templates/pantry?tab=phases');
  };

  const downloadTemplate = () => {
    const template = `Phase Name,Description,Duration (Days)
Collateral Generation,"Build content, messaging and core assets",21
Enrichment & Automation Prep,"Import contacts, enrich data, connect systems",21
Load for Launch,"Finalize automations, QA, prepare outbound",21`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phase_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Phase Templates"
          subtitle="Upload phase templates from a CSV file"
          backTo="/client-operations/proposals/create/csv"
          backLabel="Back to CSV Upload"
        />

        {/* Error Banner */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Validation Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Warning Banner */}
        {warning && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800">Warning</p>
              <p className="text-sm text-yellow-700 mt-1">{warning}</p>
            </div>
            <button
              onClick={() => setWarning('')}
              className="text-yellow-600 hover:text-yellow-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Preview Screen */}
        {showPreview && validationData ? (
          <div className="mt-8 rounded-2xl bg-white p-8 shadow">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Preview Import</h2>
              <p className="text-gray-600">
                Review the data before importing. This will create or update {validationData.totalRows} phase template(s).
              </p>
            </div>

            {/* Field Mapping */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Field Mapping</h3>
              <div className="space-y-2">
                {validationData.headers.map((header, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{header}</span>
                    <span className="text-gray-500">→</span>
                    <span className="font-medium text-green-600">
                      {header === 'Phase Name' ? 'name' : 
                       header === 'Description' ? 'description' : 
                       header === 'Duration (Days)' ? 'duration (reference)' : 
                       'mapped'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Preview (first {Math.min(5, validationData.previewRows.length)} rows)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {validationData.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validationData.previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {validationData.headers.map((header, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                          >
                            {row[header] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validationData.totalRows > 5 && (
                <p className="mt-2 text-xs text-gray-500">
                  ... and {validationData.totalRows - 5} more row(s)
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="flex-1 rounded-lg bg-gray-100 px-6 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={uploading}
                className="flex-1 rounded-lg bg-red-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        ) : (
          /* Upload Screen */
          <div className="mt-8 rounded-2xl bg-white p-8 shadow">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Phase Templates</h2>
              <p className="text-gray-600">
                Upload phase templates that define what phases exist for your proposals.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-6 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <FileText className="h-5 w-5" />
                Download CSV Template
              </button>

              <div className="relative">
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={validating}
                />
                <label
                  htmlFor="file-upload"
                  className={`w-full flex items-center justify-center gap-2 rounded-lg px-6 py-4 text-base font-semibold transition cursor-pointer ${
                    validating
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  {validating
                    ? 'Validating...'
                    : file
                      ? `Selected: ${file.name}`
                      : 'Upload CSV File'}
                </label>
              </div>
            </div>
          </div>
        )}
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
