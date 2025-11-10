'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  FileText,
  Map,
  Settings,
  Building2,
  Mail,
  UserCircle,
  Lightbulb,
  FileCheck,
  Brain,
  Package,
} from 'lucide-react';

const navigationGroups = [
  {
    name: 'Overview',
    items: [
      { name: 'Growth Dashboard', path: '/growth-dashboard', icon: TrendingUp },
      { name: 'BD Roadmap', path: '/pipelines/roadmap', icon: Map },
      { name: 'BD Intelligence', path: '/bd-intelligence', icon: Brain },
      { name: 'Insights', path: '/insights', icon: Lightbulb },
    ],
  },
  {
    name: 'People',
    items: [
      { name: 'People Hub', path: '/contacts', icon: Users },
      { name: 'Deal Pipelines', path: '/contacts/deal-pipelines', icon: Building2 },
      { name: 'Personas', path: '/personas', icon: UserCircle },
      { name: 'Products & Services', path: '/products', icon: Package },
      { name: 'Proposals', path: '/proposals', icon: FileCheck },
    ],
  },
  {
    name: 'Engage',
    items: [
      { name: 'Outreach', path: '/outreach', icon: MessageSquare },
      { name: 'Campaigns', path: '/outreach/campaigns', icon: Mail },
      { name: 'Meetings', path: '/meetings', icon: Calendar },
      { name: 'Events', path: '/events', icon: Calendar },
    ],
  },
  {
    name: 'Attract',
    items: [
      { name: 'Ads & SEO', path: '/ads', icon: Mail },
      { name: 'Content', path: '/content', icon: FileText },
      { name: 'Branding Hub', path: '/branding-hub', icon: UserCircle },
    ],
  },
  {
    name: 'Settings',
    items: [
      { name: 'Workspace Settings', path: '/settings', icon: Settings },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();

  const isActive = (path) => pathname.startsWith(path);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <Link href="/growth-dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-semibold text-gray-900">
            Ignite BD
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-6">
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
