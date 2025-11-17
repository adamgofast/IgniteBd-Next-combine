'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Eye } from 'lucide-react';

/**
 * Work Packages Fork Page
 * Choose between Create or View
 */
function WorkPackagesForkContent() {
  const router = useRouter();

  const OPTIONS = [
    {
      id: 'create',
      title: 'Create Work Package',
      description: 'Build a new work package from CSV, templates, previous packages, or start from scratch.',
      icon: Plus,
      buttonText: 'Create New',
      route: '/workpackages/create',
    },
    {
      id: 'view',
      title: 'View Work Packages',
      description: 'Browse, manage, and delete existing work packages.',
      icon: Eye,
      buttonText: 'View All',
      route: '/workpackages/view',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Work Packages"
          subtitle="Create new work packages or manage existing ones"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                onClick={() => router.push(option.route)}
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

export default function WorkPackagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorkPackagesForkContent />
    </Suspense>
  );
}
