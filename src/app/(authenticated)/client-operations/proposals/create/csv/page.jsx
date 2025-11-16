'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * CSV Upload Selection Page
 * Choose between Phase CSV or Deliverable CSV upload
 */
function CSVUploadSelectionContent() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(null);

  const handleSelectType = (type) => {
    setSelectedType(type);
    if (type === 'phases') {
      router.push('/client-operations/proposals/create/csv/phases');
    } else if (type === 'deliverables') {
      router.push('/client-operations/proposals/create/csv/deliverables');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Templates from CSV"
          subtitle="Choose which type of template to upload"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Create Proposal"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase CSV Option */}
          <div
            onClick={() => handleSelectType('phases')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Phase CSV
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload phases for your proposal templates
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Required columns:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Phase Name</li>
                    <li>• Description (optional)</li>
                    <li>• Duration (Days) (optional)</li>
                    <li>• Order</li>
                  </ul>
                </div>
              </div>
            </div>
            <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              Upload Phase CSV
            </button>
          </div>

          {/* Deliverable CSV Option */}
          <div
            onClick={() => handleSelectType('deliverables')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Deliverable CSV
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload deliverables for your proposal templates
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Required columns:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Phase Name</li>
                    <li>• Deliverable Name</li>
                    <li>• Description (optional)</li>
                    <li>• Quantity</li>
                    <li>• Unit (optional)</li>
                    <li>• Duration (optional)</li>
                  </ul>
                </div>
              </div>
            </div>
            <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              Upload Deliverable CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CSVUploadSelectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CSVUploadSelectionContent />
    </Suspense>
  );
}