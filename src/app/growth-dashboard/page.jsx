'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Map,
  Plus,
  Mail,
  Filter,
} from 'lucide-react';
import SetupWizard from '@/components/SetupWizard';
import api from '@/lib/api';

function HeaderSummary({
  targetRevenue,
  currentRevenue,
  timeHorizon,
  onRoadmapClick,
  hasCompany,
  companyName,
}) {
  const progressPercent =
    targetRevenue > 0 ? (currentRevenue / targetRevenue) * 100 : 0;
  const remaining = Math.max(0, targetRevenue - currentRevenue);

  const progressColor =
    progressPercent >= 75
      ? 'from-green-500 to-green-600'
      : progressPercent >= 50
        ? 'from-yellow-500 to-yellow-600'
        : 'from-red-500 to-red-600';

  return (
    <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            {hasCompany ? `${companyName} Growth Dashboard` : 'Growth Dashboard'}
          </h1>
          <p className="text-gray-600">
            {hasCompany
              ? `Your command center for ${companyName}`
              : 'Your command center for business development'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {progressPercent.toFixed(1)}% to goal
            </div>
            <div className="text-sm text-gray-500">
              ${remaining.toLocaleString()} remaining
            </div>
          </div>
          {onRoadmapClick && (
            <button
              onClick={onRoadmapClick}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-md transition hover:bg-indigo-700"
            >
              <Map className="h-4 w-4" />
              BD Roadmap
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm text-gray-600">
          <span>Current: ${currentRevenue.toLocaleString()}</span>
          <span>Target: ${targetRevenue.toLocaleString()}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${progressColor}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Target: ${targetRevenue.toLocaleString()} in {timeHorizon} months
      </div>
    </div>
  );
}

function StackCard({ name, metrics, insight, icon, color, route }) {
  const router = useRouter();

  const hoverColors = useMemo(
    () => ({
      'bg-blue-500': 'hover:border-blue-400 hover:bg-blue-50 hover:shadow-lg',
      'bg-orange-500':
        'hover:border-orange-400 hover:bg-orange-50 hover:shadow-lg',
      'bg-purple-500':
        'hover:border-purple-400 hover:bg-purple-50 hover:shadow-lg',
    }),
    [],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(route)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          router.push(route);
        }
      }}
      className={`cursor-pointer rounded-xl border-2 border-gray-200 bg-white shadow-md transition-all duration-300 ${hoverColors[color]}`}
    >
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${color} shadow-sm transition-transform group-hover:scale-110`}
          >
            {icon}
          </div>
          <h3 className="text-xl font-bold text-gray-900">{name}</h3>
        </div>

        <div className="mb-5 space-y-2.5">
          {metrics.map((metric) => (
            <div
              key={`${name}-${metric.label}`}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm font-medium text-gray-600">
                {metric.label}
              </span>
              <span className="text-base font-bold text-gray-900">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        <div className="-mx-6 rounded-b-xl bg-gray-50 px-6 pb-6 pt-4 text-sm italic text-gray-600">
          “{insight}”
        </div>
      </div>
    </div>
  );
}

export default function GrowthDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companyHQ, setCompanyHQ] = useState(null);
  const [companyHQId, setCompanyHQId] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState({
    contactCount: 0,
    prospectCount: 0,
    clientCount: 0,
    eventsThisMonth: 0,
    meetingsScheduled: 0,
    campaignsActive: 0,
    newslettersSent: 0,
    responseRate: 0,
  });

  const hasCompany = useMemo(() => {
    if (!companyHQ || !companyHQId) return false;
    return companyHQ?.id === companyHQId;
  }, [companyHQ, companyHQId]);

  const companyName = companyHQ?.companyName ?? 'Your Company';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedHQ = localStorage.getItem('companyHQ');
      const storedHQId = localStorage.getItem('companyHQId');

      if (storedHQ) {
        setCompanyHQ(JSON.parse(storedHQ));
      }
      if (storedHQId) {
        setCompanyHQId(storedHQId);
      }
    } catch (error) {
      console.warn('Failed to read onboarding cache:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!companyHQId) return;

      setLoading(true);

      try {
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        const contacts = response.data?.contacts ?? [];

        const prospectCount = contacts.filter(
          (contact) => contact.pipeline?.pipeline === 'prospect',
        ).length;
        const clientCount = contacts.filter(
          (contact) => contact.pipeline?.pipeline === 'client',
        ).length;

        setDashboardMetrics((prev) => ({
          ...prev,
          contactCount: contacts.length,
          prospectCount,
          clientCount,
        }));
      } catch (error) {
        console.warn('Contacts API unavailable, using fallback data:', error);

        if (companyHQ?.contacts && Array.isArray(companyHQ.contacts)) {
          setDashboardMetrics((prev) => ({
            ...prev,
            contactCount: companyHQ.contacts.length,
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    if (hasCompany) {
      fetchDashboardData();
    }
  }, [companyHQ, companyHQId, hasCompany]);

  const dashboardData = {
    targetRevenue: 1_000_000,
    currentRevenue: 0,
    timeHorizon: 12,
  };

  const stackCards = [
    {
      name: 'Attract',
      metrics: hasCompany
        ? [
            { label: 'Upcoming Events', value: '0' },
            { label: 'Ads & SEO Active', value: '0' },
            { label: 'Content Posts', value: '0' },
          ]
        : [
            { label: 'Upcoming Events', value: '—' },
            { label: 'Ads & SEO Active', value: '—' },
            { label: 'Content Posts', value: '—' },
          ],
      insight: hasCompany
        ? 'Start building your acquisition channels'
        : 'Set up your company to get started',
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      color: 'bg-blue-500',
      route: '/attract',
    },
    {
      name: 'Engage',
      metrics: hasCompany
        ? [
            {
              label: 'Contacts',
              value: loading ? '...' : dashboardMetrics.contactCount.toString(),
            },
            {
              label: 'Events This Month',
              value: loading
                ? '...'
                : dashboardMetrics.eventsThisMonth.toString(),
            },
            {
              label: 'Meetings Scheduled',
              value: loading
                ? '...'
                : dashboardMetrics.meetingsScheduled.toString(),
            },
          ]
        : [
            { label: 'Contacts', value: '—' },
            { label: 'Events This Month', value: '—' },
            { label: 'Meetings Scheduled', value: '—' },
          ],
      insight: hasCompany
        ? dashboardMetrics.contactCount > 0
          ? 'Building relationships with your network'
          : 'Start adding contacts and building relationships'
        : 'Set up your company to get started',
      icon: <Users className="h-6 w-6 text-white" />,
      color: 'bg-orange-500',
      route: '/contacts',
    },
    {
      name: 'Nurture',
      metrics: hasCompany
        ? [
            {
              label: 'Campaigns Active',
              value: loading
                ? '...'
                : dashboardMetrics.campaignsActive.toString(),
            },
            {
              label: 'Newsletters Sent',
              value: loading
                ? '...'
                : dashboardMetrics.newslettersSent.toString(),
            },
            {
              label: 'Response Rate',
              value: loading ? '...' : `${dashboardMetrics.responseRate}%`,
            },
          ]
        : [
            { label: 'Campaigns Active', value: '—' },
            { label: 'Newsletters Sent', value: '—' },
            { label: 'Response Rate', value: '—' },
          ],
      insight: hasCompany
        ? dashboardMetrics.campaignsActive > 0
          ? 'Nurturing relationships with your network'
          : 'Start nurturing your relationships'
        : 'Set up your company to get started',
      icon: <MessageSquare className="h-6 w-6 text-white" />,
      color: 'bg-purple-500',
      route: '/outreach',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {hasCompany && (
        <SetupWizard
          companyHQ={companyHQ}
          hasContacts={dashboardMetrics.contactCount > 0}
        />
      )}

      {!hasCompany && (
        <div className="mb-8 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-yellow-900">
            Welcome to Ignite Strategies!
          </h2>
          <p className="mb-4 text-yellow-800">
            Set up your company profile to start building customer relationships
            and maximizing growth.
          </p>
          <button
            onClick={() => router.push('/company/create-or-choose')}
            className="rounded-lg bg-yellow-600 px-4 py-2 font-semibold text-white transition hover:bg-yellow-700"
          >
            Set Up Company →
          </button>
        </div>
      )}

      <HeaderSummary
        targetRevenue={dashboardData.targetRevenue}
        currentRevenue={dashboardData.currentRevenue}
        timeHorizon={dashboardData.timeHorizon}
        onRoadmapClick={() => router.push('/roadmap')}
        hasCompany={hasCompany}
        companyName={companyName}
      />

      <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() =>
              router.push(
                hasCompany && dashboardMetrics.contactCount > 0
                  ? '/contacts'
                  : '/contacts/upload',
              )
            }
            className="group flex items-center gap-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 transition-transform group-hover:scale-110">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Add Contact</div>
              <div className="text-sm text-gray-600">
                {hasCompany && dashboardMetrics.contactCount > 0
                  ? 'View and manage your contacts'
                  : 'Add your first contact'}
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/contacts/view')}
            className="group flex items-center gap-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-4 text-left transition hover:border-purple-300 hover:bg-purple-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 transition-transform group-hover:scale-110">
              <Filter className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">View Contacts</div>
              <div className="text-sm text-gray-600">
                View and manage your contact pipeline
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/outreach')}
            className="group flex items-center gap-4 rounded-lg border-2 border-green-200 bg-green-50 p-4 text-left transition hover:border-green-300 hover:bg-green-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500 transition-transform group-hover:scale-110">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Send Email</div>
              <div className="text-sm text-gray-600">
                Send an email to your contacts
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="mb-8 flex flex-col items-center">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Growth Drivers
        </h2>
        <p className="max-w-2xl text-center text-xs text-gray-400">
          Attract (Ads, SEO, Content) • Engage (Connect, Events) • Nurture
          (Email Marketing)
        </p>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stackCards.map((card) => (
          <StackCard key={card.name} {...card} />
        ))}
      </div>
    </div>
  );
}
