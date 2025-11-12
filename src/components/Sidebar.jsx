'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  Map,
  Settings,
  UserCircle,
  FileCheck,
  Brain,
  Package,
  BarChart,
  Palette,
  Rocket,
} from 'lucide-react';

// Home link - Growth Dashboard
const homeLink = {
  name: 'Growth Dashboard',
  path: '/growth-dashboard',
  icon: TrendingUp,
};

const navigationGroups = [
  {
    name: 'Growth Ops',
    items: [
      { name: 'BD Roadmap', path: '/pipelines/roadmap', icon: Map },
      { name: 'Personas', path: '/personas', icon: UserCircle },
      { name: 'Products', path: '/products', icon: Package },
      { name: 'BD Intelligence', path: '/bd-intelligence', icon: Brain },
    ],
  },
  {
    name: 'Attract',
    items: [
      { name: 'Ads & SEO', path: '/ads', icon: BarChart },
      { name: 'Content', path: '/content', icon: FileText },
      { name: 'Branding Hub', path: '/branding-hub', icon: Palette },
    ],
  },
  {
    name: 'Engage',
    items: [
      { name: 'Engage Hub', path: '/outreach', icon: MessageSquare },
    ],
  },
  {
    name: 'Nurture',
    items: [
      { name: 'People Hub', path: '/contacts', icon: Users },
    ],
  },
  {
    name: 'Client Operations',
    items: [
      { name: 'Initiate Client Journey', path: '/client-operations', icon: Rocket },
      { name: 'Proposals', path: '/client-operations/proposals', icon: FileCheck },
      { name: 'Deliverables', path: '/client-operations/deliverables', icon: FileText },
    ],
  },
  {
    name: 'Settings',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();

  const isActive = (path) => pathname.startsWith(path);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-3.5rem)] fixed left-0 top-14 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <Link href="/growth-dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
        {/* Home Link - Growth Dashboard */}
        <div>
          <ul className="space-y-1">
            <li>
              {(() => {
                const HomeIcon = homeLink.icon;
                const active = isActive(homeLink.path);
                return (
                  <Link
                    href={homeLink.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border border-red-200 bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <HomeIcon className="h-5 w-5" />
                    <span>{homeLink.name}</span>
                  </Link>
                );
              })()}
            </li>
          </ul>
        </div>

        {/* Navigation Groups */}
        {navigationGroups.map((group) => (
          <div key={group.name}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {group.name}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
