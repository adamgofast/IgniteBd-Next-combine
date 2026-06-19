'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * Error component shown when companyHQId is missing
 * Replaces auto-redirects with user-friendly error message
 */
export default function CompanyKeyMissingError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Company Keys Missing
          </h2>
          <p className="text-gray-600">
            Looks like we lost some of your company keys. Let's get you set up properly.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => router.push('/welcome')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Welcome
          </button>
          <button
            onClick={() => router.push('/company/create-or-choose')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Set Up Company
          </button>
        </div>
      </div>
    </div>
  );
}

