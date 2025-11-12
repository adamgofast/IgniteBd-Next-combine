'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import Image from 'next/image';

export default function ClientPortalWelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser) {
      router.replace('/client-portal/login');
      return;
    }

    // Check if user has proposal access
    // For now, we'll check via proposalId in URL or localStorage
    // In future, we can check via API if user email matches proposal contact
    const checkAccess = async () => {
      try {
        // Check if there's a proposalId in localStorage or URL params
        const urlParams = new URLSearchParams(window.location.search);
        const proposalId = urlParams.get('proposalId') || localStorage.getItem('clientPortalProposalId');
        
        if (proposalId) {
          localStorage.setItem('clientPortalProposalId', proposalId);
          setHasAccess(true);
          setLoading(false);
        } else {
          // No proposal ID - redirect to login or show access denied
          setLoading(false);
          // For now, allow access - we'll add proper proposal lookup later
          setHasAccess(true);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  const handleContinue = () => {
    router.push('/client-portal/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Required</h1>
          <p className="text-gray-600 mb-6">
            You need a valid proposal link to access the client portal.
          </p>
          <button
            onClick={() => router.push('/client-portal/login')}
            className="rounded-lg bg-red-600 px-6 py-2 text-white font-semibold hover:bg-red-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
        <Image
          src="/logo.png"
          alt="Ignite Strategies"
          width={80}
          height={80}
          className="mx-auto mb-6 h-20 w-20 object-contain"
          priority
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Your Client Portal
        </h1>
        <p className="text-gray-600 mb-8">
          View your proposals, track deliverables, and manage your engagement with Ignite Strategies.
        </p>
        <button
          onClick={handleContinue}
          className="w-full rounded-lg bg-red-600 px-6 py-3 text-white font-semibold hover:bg-red-700 transition shadow-lg"
        >
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
}

