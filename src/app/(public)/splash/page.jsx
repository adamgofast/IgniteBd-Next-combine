'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribe;
    const timer = setTimeout(() => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace('/welcome');
        } else {
          router.replace('/signup');
        }
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-8 flex justify-center">
          <svg
            className="h-32 w-32 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
            />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">
          IgniteGrowth Engine
        </h1>
        <p className="text-xl text-white/80 mb-4">
          by Ignite Strategies
        </p>
        <p className="text-lg text-white/60">
          Fuel your business growth
        </p>
      </div>
    </div>
  );
}

