'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const ROUTES_WITH_SIDEBAR = [
  '/growth-dashboard',
  '/companydashboard',
  '/proposals',
  '/close-deals',
  '/assessment',
  '/assessment-intro',
  '/assessment-results',
  '/revenue',
  '/revenue-total-outlook',
  '/human-capital',
  '/human-capital-total-outlook',
  '/target-acquisition',
  '/bd-assessment-total-outlook',
  '/setup/ecosystem',
  '/persona',
  '/personas',
  '/bdpipeline',
  '/ads',
  '/attract',
  '/seo',
  '/content',
  '/branding-hub',
  '/events',
  '/outreach',
  '/meetings',
  '/growth-cost-outlook',
  '/revenue-target-outlook',
  '/bd-baseline-assessment',
  '/bd-baseline-results',
  '/settings',
  '/roadmap',
  '/insights',
  '/contacts',
  '/relationship',
  '/nurture',
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {showSidebar && (
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      )}
      <div className="flex-1 lg:ml-64">
        {children}
      </div>
    </div>
  );
}

