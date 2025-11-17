'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, Copy, Plus } from 'lucide-react';

/**
 * Work Packages Creation Landing Page
 * 4-option landing page for creating work packages
 */
function WorkPackagesCreateContent() {
  const router = useRouter();

  const handleOptionSelect = async (option) => {
    switch (option) {
      case 'csv': {
        router.push('/workpackages/csv');
        break;
      }
      case 'templates': {
        router.push('/workpackages/assemble/templates');
        break;
      }
      case 'previous': {
        router.push('/workpackages/clone');
        break;
      }
      case 'blank': {
        router.push('/workpackages/blank');
        break;
      }
    }
  };

  const OPTIONS = [
    {
      id: 'csv',
      title: 'Upload From CSV',
      description: 'Upload a CSV containing phases and deliverables. IgniteBD will auto-generate the work package.',
      icon: Upload,
      buttonText: 'Upload CSV',
    },
    {
      id: 'templates',
      title: 'Use Company Templates',
      description: 'Load phases and deliverables from your template library.',
      icon: FileText,
      buttonText: 'Use Templates',
    },
    {
      id: 'previous',
      title: 'Use a Previous Work Package',
      description: 'Copy an existing work package as your starting point.',
      icon: Copy,
      buttonText: 'Copy Existing',
    },
    {
      id: 'blank',
      title: 'Start Blank',
      description: 'Create a work package from scratch.',
      icon: Plus,
      buttonText: 'Build From Scratch',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Work Package"
          subtitle="Choose how you want to build your work package"
          backTo="/workpackages"
          backLabel="Back to Work Packages"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                onClick={() => handleOptionSelect(option.id)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {option.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  {option.buttonText}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WorkPackagesCreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorkPackagesCreateContent />
    </Suspense>
  );
}
