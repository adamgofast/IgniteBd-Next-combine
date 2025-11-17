'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Work Package CSV Upload Page
 * Upload a CSV to create a work package with phases and items directly
 */
function WorkPackageCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [step, setStep] = useState('upload'); // 'upload' | 'validate' | 'preview' | 'success'
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);

  // Parse CSV file (handles quoted fields)
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
    
    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim());
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

  // Validate mapped data after mapping
  const validateWorkPackageData = (rows) => {
    const errors = [];
    const warnings = [];
    let validRows = 0;
    let invalidRows = 0;

    if (rows.length === 0) {
      return {
        isValid: false,
        errors: ['CSV file contains no data rows'],
        warnings: [],
        validRows: 0,
        invalidRows: 0,
      };
    }

    // Validate each row
    rows.forEach((row, index) => {
      const rowErrors = [];
      const rowNum = index + 2; // +2 because row 1 is headers

      // Required fields
      if (!row.phasename || !row.phasename.trim()) {
        rowErrors.push(`Row ${rowNum}: Missing phaseName`);
      }
      if (!row.phaseposition || isNaN(parseInt(row.phaseposition, 10))) {
        rowErrors.push(`Row ${rowNum}: Invalid or missing phasePosition`);
      }
      if (!row.deliverablelabel || !row.deliverablelabel.trim()) {
        rowErrors.push(`Row ${rowNum}: Missing deliverableLabel`);
      }
      if (!row.deliverabletype || !row.deliverabletype.trim()) {
        rowErrors.push(`Row ${rowNum}: Missing deliverableType`);
      }
      if (!row.quantity || isNaN(parseInt(row.quantity, 10)) || parseInt(row.quantity, 10) < 1) {
        rowErrors.push(`Row ${rowNum}: Invalid or missing quantity`);
      }
      if (!row.estimatedhourseach || isNaN(parseInt(row.estimatedhourseach, 10)) || parseInt(row.estimatedhourseach, 10) < 0) {
        rowErrors.push(`Row ${rowNum}: Invalid or missing estimatedHoursEach`);
      }
      if (!row.status || !row.status.trim()) {
        rowErrors.push(`Row ${rowNum}: Missing status`);
      }

      // Optional but recommended
      if (!row.proposaldescription || !row.proposaldescription.trim()) {
        warnings.push(`Row ${rowNum}: Missing proposalDescription (recommended)`);
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        invalidRows++;
      } else {
        validRows++;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validRows,
      invalidRows,
      totalRows: rows.length,
    };
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

      // Validate mapped data (after mapping, before preview)
      const validationResults = validateWorkPackageData(rows);
      setValidation(validationResults);
      
      if (!validationResults.isValid) {
        setError(`Validation failed: ${validationResults.errors.join(', ')}`);
        setFile(null);
        return;
      }

      if (validationResults.warnings && validationResults.warnings.length > 0) {
        setWarning(validationResults.warnings.join(' '));
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
        allRows: rows, // Store all rows for submission
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

    if (!preview || !preview.allRows || preview.allRows.length === 0) {
      setError('No data to create work package');
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

  // Download CSV template
  const handleDownloadTemplate = () => {
    const template = `proposalDescription,proposalTotalCost,proposalNotes,phaseName,phasePosition,phaseDescription,deliverableLabel,deliverableType,deliverableDescription,quantity,unitOfMeasure,estimatedHoursEach,status
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","Approved via email.","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Target Personas",PERSONA,"Develop 3 persona profiles defining ideal BD targets.",3,persona,4,not_started
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","Approved via email.","BD Strategic Setup",1,"Establish the strategic foundation for your BD system by defining targets, events, and opportunity landscape.","Event Selection",EVENT,"Identify 6 key industry events most likely to generate BD opportunities.",6,event,1,not_started
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","Approved via email.","Initial Collateral",2,"Develop the core collateral assets needed to execute BD outreach.","Outreach Templates",TEMPLATE,"Draft 6 outreach templates tailored for warm, cold, and follow-up scenarios.",6,template,1,not_started
"IgniteBD Starter Build-Out focusing on strategic foundation, collateral, CRM setup, and campaign readiness.","1500","Approved via email.","Initial Collateral",2,"Develop the core collateral assets needed to execute BD outreach.","Blog Posts",BLOG,"Write 5 SEO-optimized blog posts to increase visibility and demonstrate thought leadership.",5,post,6,not_started`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'work-package-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Work Package Created Successfully!</h2>
            <p className="text-gray-600">Redirecting to your work package...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Preview Work Package"
            subtitle="Review your CSV data before creating the work package"
            backTo="/workpackages"
            backLabel="Back to Work Packages"
          />

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Contact/Company Selection */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Contact</h3>
            <div className="max-w-md">
              <ContactSelector
                onContactSelect={(contact, company) => {
                  setSelectedContact(contact);
                  setContactId(contact.id);
                  setCompanyId(company?.id || '');
                }}
                selectedContact={selectedContact}
              />
            </div>
            {selectedContact && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                  {selectedContact.contactCompany?.companyName && (
                    <span> • {selectedContact.contactCompany.companyName}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CSV Preview</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Showing first 5 of {preview.totalRows} rows
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliverable Label</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours Each</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.phaseName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.deliverableLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.deliverableType}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.quantity || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.estimatedHoursEach || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-4">
            <button
              onClick={() => {
                setStep('upload');
                setPreview(null);
                setFile(null);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !contactId || !companyId}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Work Package'}
            </button>
            {(!contactId || !companyId) && (
              <p className="text-xs text-gray-500 mt-2">
                Please select a contact to continue
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload From CSV"
          subtitle="Upload a CSV file to create a work package with phases and deliverables"
          backTo="/workpackages"
          backLabel="Back to Work Packages"
        />

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Contact Selection */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Contact</h3>
            <div className="max-w-md">
              <ContactSelector
                onContactSelect={(contact, company) => {
                  setSelectedContact(contact);
                  setContactId(contact.id);
                  setCompanyId(company?.id || '');
                }}
                selectedContact={selectedContact}
              />
            </div>
            {selectedContact && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                  {selectedContact.contactCompany?.companyName && (
                    <span> • {selectedContact.contactCompany.companyName}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="rounded-xl border-2 border-gray-200 bg-white p-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Work Package from CSV</h2>
              <p className="text-gray-600 mb-6">
                Upload a CSV file with phases and deliverables to automatically generate your work package.
              </p>

              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  onClick={handleDownloadTemplate}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Download CSV Template
                </button>
                <label className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload CSV File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {file && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-800">
                    <strong>Selected:</strong> {file.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
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
