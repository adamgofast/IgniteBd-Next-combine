'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { FileText, Plus } from 'lucide-react';

/**
 * Template Chooser Page
 * Landing page for Proposal Templates - choose to see or make templates
 */
function TemplateChooserContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Proposal Templates"
          subtitle="Manage and create reusable templates for your proposals"
          backTo="/client-operations/proposals"
          backLabel="Back to Proposals"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* See Templates Option */}
          <div
            onClick={() => router.push('/templates/library?tab=phases')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  See Templates
                </h3>
                <p className="text-sm text-gray-600">
                  View and use your existing phase and deliverable templates to build proposals.
                </p>
              </div>
            </div>
            <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              View Templates
            </button>
          </div>

          {/* Make Templates Option */}
          <div
            onClick={() => router.push('/templates/library?tab=make-templates')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Plus className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Make Templates
                </h3>
                <p className="text-sm text-gray-600">
                  Create new phase, deliverable, or proposal templates from scratch or CSV.
                </p>
              </div>
            </div>
            <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              Create Templates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplateChooserPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TemplateChooserContent />
    </Suspense>
  );
}

