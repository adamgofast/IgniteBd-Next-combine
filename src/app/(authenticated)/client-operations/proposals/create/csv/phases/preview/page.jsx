'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, ArrowLeft, CheckCircle, AlertCircle, X } from 'lucide-react';
import { parseCSV } from '@/lib/services/csvMappers';
import { getFieldMappingSuggestions, validateMappedRecord } from '@/lib/services/universalCsvFieldMapperService';
import api from '@/lib/api';

/**
 * Phase CSV Preview Page
 * Shows field mapping and sample data before upload
 */
function PhaseCSVPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileContent = searchParams.get('content');

  const [parsedRows, setParsedRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMappings, setFieldMappings] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fileContent) {
      router.push('/client-operations/proposals/create/csv/phases');
      return;
    }

    try {
      // Parse CSV
      const rows = parseCSV(fileContent);
      if (rows.length === 0) {
        setError('No data found in CSV');
        return;
      }

      setParsedRows(rows);
      setHeaders(Object.keys(rows[0]));

      // Get field mapping suggestions
      const mappings = getFieldMappingSuggestions(Object.keys(rows[0]), 'phase');
      setFieldMappings(mappings);

      // Validate each row
      const validations = rows.map((row, index) => {
        const mapped = {};
        mappings.forEach(mapping => {
          if (mapping.suggestedField !== 'unmapped') {
            mapped[mapping.suggestedField] = row[mapping.csvHeader];
          }
        });
        return {
          rowIndex: index + 1,
          ...validateMappedRecord(mapped, 'phase'),
          sampleData: row,
        };
      });
      setValidationResults(validations);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError(`Failed to parse CSV: ${err.message}`);
    }
  }, [fileContent, router]);

  const handleUpload = async () => {
    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Re-create file from content
      const blob = new Blob([fileContent], { type: 'text/csv' });
      const file = new File([blob], 'phases.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const uploadResponse = await api.post('/api/csv/phases/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data?.success) {
        router.push(`/templates/pantry?uploaded=${uploadResponse.data.count}`);
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

  const validRows = validationResults.filter(v => v.isValid).length;
  const invalidRows = validationResults.filter(v => !v.isValid).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Preview Phase CSV Upload"
          subtitle="Review field mappings and sample data"
          backTo="/client-operations/proposals/create/csv/phases"
          backLabel="Back to Upload"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Field Mapping Preview */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Field Mapping</h2>
            <p className="text-sm text-gray-600 mb-4">
              Here's how your CSV columns map to our system:
            </p>
            <div className="space-y-2">
              {fieldMappings.map((mapping, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    mapping.isSupported
                      ? 'border-green-200 bg-green-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{mapping.csvHeader}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`font-medium ${
                      mapping.isSupported ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {mapping.suggestedField === 'unmapped' ? 'Unmapped (will be ignored)' : mapping.suggestedField}
                    </span>
                  </div>
                  {mapping.isSupported ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Validation Summary */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Validation Summary</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900">{parsedRows.length}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700">Valid Rows</p>
                <p className="text-2xl font-bold text-green-700">{validRows}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">Rows with Errors</p>
                <p className="text-2xl font-bold text-red-700">{invalidRows}</p>
              </div>
            </div>

            {invalidRows > 0 && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <h3 className="font-semibold text-red-900 mb-2">Rows with Errors:</h3>
                <div className="space-y-2">
                  {validationResults
                    .filter(v => !v.isValid)
                    .map((validation) => (
                      <div key={validation.rowIndex} className="text-sm text-red-700">
                        <strong>Row {validation.rowIndex}:</strong> {validation.errors.join(', ')}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* Sample Data Preview */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sample Data (First 5 Rows)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedRows.slice(0, 5).map((row, rowIdx) => {
                    const validation = validationResults[rowIdx];
                    return (
                      <tr
                        key={rowIdx}
                        className={validation && !validation.isValid ? 'bg-red-50' : ''}
                      >
                        {headers.map((header) => (
                          <td
                            key={header}
                            className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                          >
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 5 && (
              <p className="mt-2 text-sm text-gray-600">
                Showing first 5 of {parsedRows.length} rows
              </p>
            )}
          </section>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              Go Back
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || invalidRows > 0}
              className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : `Upload ${validRows} Phase Template(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PhaseCSVPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PhaseCSVPreviewContent />
    </Suspense>
  );
}
