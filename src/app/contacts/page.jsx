'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Users,
  List,
  Building2,
  Filter,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';

const CORE_ACTIONS = [
  {
    id: 'upload',
    title: 'Contact Upload',
    description: 'Add contacts manually or via CSV',
    route: '/contacts/upload',
    icon: Upload,
    containerClasses:
      'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    iconClasses: 'bg-blue-500 text-white',
  },
  {
    id: 'view',
    title: 'View Contacts',
    description: 'See all your contacts in a searchable table',
    route: '/contacts/view',
    icon: Users,
    containerClasses:
      'from-indigo-50 to-indigo-100 border-indigo-200 hover:border-indigo-400',
    iconClasses: 'bg-indigo-500 text-white',
  },
  {
    id: 'lists-manage',
    title: 'Manage Contact Lists',
    description: 'Create and organize lists for campaigns',
    route: '/contacts/list-manager',
    icon: List,
    containerClasses:
      'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
    iconClasses: 'bg-purple-500 text-white',
  },
  {
    id: 'lists-build',
    title: 'Build New List',
    description: 'Start a targeted list from filters',
    route: '/contacts/list-builder',
    icon: Sparkles,
    containerClasses:
      'from-pink-50 to-pink-100 border-pink-200 hover:border-pink-400',
    iconClasses: 'bg-pink-500 text-white',
  },
  {
    id: 'business',
    title: 'Add Business',
    description: 'Manage prospect/client companies',
    route: '/contacts/companies',
    icon: Building2,
    containerClasses:
      'from-green-50 to-green-100 border-green-200 hover:border-green-400',
    iconClasses: 'bg-green-500 text-white',
  },
  {
    id: 'pipeline',
    title: 'See Deal Pipeline',
    description: 'Visual pipeline management',
    route: '/contacts/deal-pipelines',
    icon: Filter,
    containerClasses:
      'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-400',
    iconClasses: 'bg-orange-500 text-white',
  },
];

export default function ContactsHubPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [contactCount, setContactCount] = useState(0);

  const refreshContacts = useCallback(async (tenantId) => {
    if (!tenantId) return;
    try {
      setHydrating(true);
      const response = await api.get(`/api/contacts?companyHQId=${tenantId}`);

      if (response.data?.success && response.data.contacts) {
        const contacts = response.data.contacts;
        setContactCount(contacts.length);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify(contacts));
        }
      } else {
        setContactCount(0);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('contacts', JSON.stringify([]));
        }
      }
      setHydrated(true);
    } catch (error) {
      console.error('Error hydrating contacts:', error);
      setHydrated(true);
    } finally {
      setHydrating(false);
    }
  }, []);

  const hydrateContacts = useCallback(
    async (tenantId) => {
      if (!tenantId) return;

      if (typeof window !== 'undefined') {
        const cachedContacts = window.localStorage.getItem('contacts');
        if (cachedContacts) {
          try {
            const contacts = JSON.parse(cachedContacts);
            setContactCount(contacts.length);
            setHydrated(true);
            refreshContacts(tenantId);
            return;
          } catch (error) {
            console.warn('Failed to parse cached contacts', error);
          }
        }
      }

      await refreshContacts(tenantId);
    },
    [refreshContacts],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  useEffect(() => {
    if (companyHQId) {
      hydrateContacts(companyHQId);
    }
  }, [companyHQId, hydrateContacts]);

  const handleRefresh = async () => {
    if (companyHQId) {
      await refreshContacts(companyHQId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/growth-dashboard')}
            className="mb-4 flex items-center text-gray-600 transition hover:text-gray-900"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Growth Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                👥 People Hub
              </h1>
              <p className="text-lg text-gray-600">
                Manage your contacts, lists, companies, and pipelines.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {hydrated && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">Contacts Loaded</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {contactCount}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={hydrating}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                  hydrating
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <RefreshCw className={hydrating ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
                {hydrating ? 'Hydrating…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CORE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => router.push(action.route)}
                className={`group rounded-xl border-2 bg-gradient-to-br p-6 text-left transition ${action.containerClasses}`}
              >
                <div className="mb-4 flex items-center">
                  <div
                    className={`mr-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${action.iconClasses}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {action.title}
                    </h3>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-500 opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="text-sm text-gray-700">{action.description}</p>
                {action.note && (
                  <p className="mt-2 text-xs italic text-gray-500">
                    {action.note}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            💡 Quick Guide
          </h3>
          <div className="grid gap-4 text-sm text-gray-600 md:grid-cols-2">
            <div>
              <strong className="text-gray-900">Contact Upload:</strong> Add
              contacts one-by-one or in bulk via CSV.
            </div>
            <div>
              <strong className="text-gray-900">View Contacts:</strong> Search
              and filter all people in your workspace.
            </div>
            <div>
              <strong className="text-gray-900">
                Manage Contact Lists:
              </strong>{' '}
              Organize contacts for campaigns and outreach.
            </div>
            <div>
              <strong className="text-gray-900">Build New List:</strong> Use
              filters and tags to craft targeted segments.
            </div>
            <div>
              <strong className="text-gray-900">Add Business:</strong> Track and
              manage prospect or client companies.
            </div>
            <div>
              <strong className="text-gray-900">Deal Pipeline:</strong> Visual
              kanban view of contacts by stage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

