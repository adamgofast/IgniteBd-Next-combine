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
  Mail,
  Calendar,
  Share2,
  List,
  GitBranch,
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
    hubPath: '/branding-hub',
    items: [
      { name: 'Ads & SEO', path: '/ads', icon: BarChart },
      { name: 'Content', path: '/content', icon: FileText },
    ],
  },
  {
    name: 'Engage',
    hubPath: '/contacts',
    items: [
      { name: 'Manage Contacts', path: '/contacts/view', icon: Users },
      { name: 'Contact Lists', path: '/contacts/list-manager', icon: List },
      { name: 'Deal Pipelines', path: '/contacts/deal-pipelines', icon: GitBranch },
      { name: 'Outreach', path: '/outreach', icon: MessageSquare },
      { name: 'Meetings', path: '/meetings', icon: Calendar },
    ],
  },
  {
    name: 'Nurture',
    disabled: true,
    items: [
      { name: 'Email Marketing', path: '#', icon: Mail, disabled: true },
      { name: 'Social Media', path: '#', icon: Share2, disabled: true },
    ],
  },
  {
    name: 'Client Operations',
    items: [
      { name: 'Proposals', path: '/client-operations/proposals', icon: FileCheck },
      { name: 'Deliverables', path: '/client-operations/deliverables', icon: FileText },
      { name: 'Initiate Client Journey', path: '/client-operations', icon: Rocket },
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
        {navigationGroups.map((group) => {
          const hubActive = group.hubPath ? isActive(group.hubPath) : false;
          return (
            <div key={group.name}>
              {group.disabled ? (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 opacity-50">
                  {group.name}
                </h3>
              ) : group.hubPath ? (
                <Link
                  href={group.hubPath}
                  className={`mb-3 block text-xs font-semibold uppercase tracking-wider transition-colors ${
                    hubActive
                      ? 'text-red-600 hover:text-red-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {group.name}
                </Link>
              ) : (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group.name}
                </h3>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  const disabled = item.disabled;
                  return (
                    <li key={item.path}>
                      {disabled ? (
                        <div
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 opacity-50 cursor-not-allowed"
                          title="Coming soon"
                        >
                          <Icon className="h-5 w-5" />
                          <span>{item.name}</span>
                        </div>
                      ) : (
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
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default Sidebar;
