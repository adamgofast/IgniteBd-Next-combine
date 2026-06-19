'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

/**
 * Universal hook: resolve companyHQId from URL, sync from localStorage when missing.
 *
 * If the page has no ?companyHQId= in the URL but localStorage has it,
 * redirects to add the param (preserves path + other params).
 *
 * @returns {{ companyHQId: string, missing: boolean }}
 */
export function useCompanyHQId() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const storedCompanyHQId =
    typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '')
      : '';
  const companyHQId = urlCompanyHQId || storedCompanyHQId;
  const missing = !companyHQId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlCompanyHQId) return; // Already in URL, nothing to do
    if (!storedCompanyHQId) return; // Nothing to sync

    // URL missing companyHQId but we have it in localStorage → add it
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('companyHQId', storedCompanyHQId);
    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl);
  }, [pathname, searchParams, router, urlCompanyHQId, storedCompanyHQId]);

  return { companyHQId, missing };
}
