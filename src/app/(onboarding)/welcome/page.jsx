'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useOwner } from '@/hooks/useOwner';

export default function WelcomePage() {
  const router = useRouter();
  const { ownerId, owner, companyHQId, loading, hydrated, error, refresh } = useOwner();
  const [nextRoute, setNextRoute] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Wait for Firebase auth to initialize and check auth state
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        // Check if we have ownerId in localStorage (might be from previous session)
        const storedOwnerId = localStorage.getItem('ownerId') || localStorage.getItem('adminId');
        if (!storedOwnerId) {
          router.replace('/signup');
          return;
        }
      }
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  // Refresh from API if not hydrated and auth is checked
  useEffect(() => {
    if (authChecked && !hydrated && !loading) {
      const timer = setTimeout(() => {
        refresh();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authChecked, hydrated, loading, refresh]);

  // Determine next route based on hydration
  useEffect(() => {
    if (!authChecked || !hydrated || loading) return;

    // Check if owner has a company
    const hasCompany = companyHQId || owner?.companyHQId || owner?.ownedCompanies?.length > 0;
    
    if (!hasCompany) {
      setNextRoute('/profilesetup');
    } else {
      setNextRoute('/growth-dashboard');
    }
  }, [authChecked, hydrated, loading, companyHQId, owner]);

  const handleContinue = () => {
    if (nextRoute) {
      router.push(nextRoute);
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <p className="text-red-600 text-lg mb-4">{error}</p>
            <button
              onClick={() => refresh()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hydrated || !nextRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-white text-xl">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome{owner?.name ? `, ${owner.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-gray-600 mb-6">
            {owner?.companyHQ?.companyName
              ? `Ready to manage ${owner.companyHQ.companyName}?`
              : 'Ready to get started?'}
          </p>

          <button
            onClick={handleContinue}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors shadow-lg"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

