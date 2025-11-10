'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, User, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

export default function ContactUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
          <div className="text-gray-600">Preparing contact upload</div>
        </div>
      </div>
    );
  }

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (
      selectedFile.type !== 'text/csv' &&
      !selectedFile.name.toLowerCase().endsWith('.csv')
    ) {
      alert('Please select a CSV file.');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a CSV file first.');
      return;
    }

    setUploading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      alert(`✅ Successfully queued ${file.name} for upload (placeholder).`);
      setFile(null);
      router.push('/contacts');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    if (typeof window === 'undefined') return;
    const template = 'First Name,Last Name,Email,Phone,Company,Title';
    const blob = new Blob([template], { type: 'text/csv' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'contacts_template.csv';
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="📥 Upload Contacts"
          subtitle="Upload a CSV to add people to your Ignite workspace"
          backTo="/contacts"
          backLabel="Back to People Hub"
        />

        <div className="mb-8">
          <button
            onClick={() => router.push('/contacts/manual')}
            className="group w-full rounded-xl border-2 border-blue-200 p-6 text-left transition hover:border-blue-400 hover:bg-blue-50"
            type="button"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 transition group-hover:bg-blue-500">
                <User className="h-8 w-8 text-blue-600 transition group-hover:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  ➕ Add Manually
                </h3>
                <p className="text-sm text-gray-600">
                  Enter single contacts without using a CSV import.
                </p>
              </div>
              <svg
                className="h-6 w-6 text-gray-400 transition group-hover:text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Upload CSV</h2>
              <p className="text-gray-600">
                Required columns: First Name, Last Name, Email, Phone, Company, Title.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
            >
              📥 Download CSV Template
            </button>
          </div>

          <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center transition-colors hover:border-gray-400">
            {!file ? (
              <>
                <Upload className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                <p className="mb-2 text-gray-600">Click to upload or drag and drop</p>
                <p className="mb-4 text-xs text-gray-500">CSV files only</p>
                <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  Select CSV File
                </label>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <FileSpreadsheet className="h-12 w-12 text-green-600" />
                <div className="text-center sm:text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-600">
                    Size: {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-full p-2 text-gray-400 transition hover:text-red-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {file && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setFile(null)}
                className="flex-1 rounded-lg bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : 'Upload Contacts'}
              </button>
            </div>
          )}

          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <strong className="font-semibold">Tip:</strong> Map your CSV headers to contact fields
            (Name, Email, Phone, Company, Title) for best results. Advanced mapping and validation will
            be available soon.
          </div>
        </div>
      </div>
    </div>
  );
}
