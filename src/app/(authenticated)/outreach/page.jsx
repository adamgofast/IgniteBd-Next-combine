'use client';

import { useMemo, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Plus,
  Send,
  Users,
  FileText,
  BarChart3,
  Target,
  CheckCircle,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useOutreachContext } from './layout.jsx';
import api from '@/lib/api';

// Component that uses useSearchParams - needs to be separate for Suspense
function TargetBanner({ targetContact, targetProduct, router }) {
  if (!targetContact && !targetProduct) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <Target className="h-5 w-5 mt-0.5 text-blue-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Targeting from BD Intelligence
          </h3>
          <div className="space-y-1 text-sm text-gray-700">
            {targetContact && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  <strong>Contact:</strong>{' '}
                  {targetContact.goesBy ||
                    [targetContact.firstName, targetContact.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    targetContact.email ||
                    'Unknown'}
                  {targetContact.title && ` - ${targetContact.title}`}
                </span>
              </div>
            )}
            {targetProduct && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  <strong>Product:</strong> {targetProduct.name}
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Create a campaign to start targeting with hunter.io integration
          </p>
        </div>
      </div>
    </div>
  );
}

// Component that handles search params
function OutreachContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { campaigns, hydrating } = useOutreachContext();
  const [targetContact, setTargetContact] = useState(null);
  const [targetProduct, setTargetProduct] = useState(null);
  
  // Check if we came from BD Intelligence with targeting info
  useEffect(() => {
    const contactId = searchParams.get('contactId');
    const productId = searchParams.get('productId');
    
    if (contactId || productId) {
      // Fetch contact and product details if provided
      const fetchTargets = async () => {
        try {
          if (contactId) {
            try {
              const contactRes = await api.get(`/api/contacts/${contactId}`);
              if (contactRes.data?.contact) {
                setTargetContact(contactRes.data.contact);
              }
            } catch (err) {
              console.warn('Failed to fetch contact:', err);
            }
          }
          if (productId) {
            try {
              const companyHQId = typeof window !== 'undefined' 
                ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyHQId') || ''
                : '';
              const productRes = await api.get(`/api/products${companyHQId ? `?companyHQId=${companyHQId}` : ''}`);
              const products = Array.isArray(productRes.data) ? productRes.data : [];
              const product = products.find(p => p.id === productId);
              if (product) {
                setTargetProduct(product);
              }
            } catch (err) {
              console.warn('Failed to fetch product:', err);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch target details:', err);
        }
      };
      
      fetchTargets();
    }
  }, [searchParams]);

  const metrics = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(
      (campaign) => ['active', 'sending', 'scheduled'].includes(campaign.status),
    ).length;
    const totalRecipients = campaigns.reduce(
      (total, campaign) => total + (campaign.contactList?.totalContacts ?? 0),
      0,
    );
    return {
      totalCampaigns,
      activeCampaigns,
      totalRecipients,
      responseRate: campaigns.length > 0 ? 18.5 : 0,
    };
  }, [campaigns]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Outreach Dashboard"
          subtitle="Launch nurture campaigns and track engagement performance."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
          actions={
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (targetContact?.id) params.set('contactId', targetContact.id);
                if (targetProduct?.id) params.set('productId', targetProduct.id);
                router.push(`/outreach/campaigns/create?${params.toString()}`);
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          }
        />

        {/* Target Info Banner */}
        <TargetBanner 
          targetContact={targetContact}
          targetProduct={targetProduct}
          router={router}
        />

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <MetricCard
            icon={<Mail className="h-6 w-6 text-blue-600" />}
            value={metrics.totalCampaigns}
            label="Total Campaigns"
            onClick={() => router.push('/outreach/campaigns')}
          />
          <MetricCard
            icon={<Send className="h-6 w-6 text-green-600" />}
            value={metrics.activeCampaigns}
            label="Active Campaigns"
            onClick={() => router.push('/outreach/campaigns')}
          />
          <MetricCard
            icon={<Users className="h-6 w-6 text-purple-600" />}
            value={metrics.totalRecipients}
            label="Recipients"
          />
          <MetricCard
            icon={<BarChart3 className="h-6 w-6 text-orange-600" />}
            value={`${metrics.responseRate}%`}
            label="Avg. Response"
          />
        </div>

        <div className="mb-8 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-sm transition hover:border-indigo-400">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-500 text-white">
                <Plus className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Set Up Your Next Campaign
                </h2>
                <p className="text-sm text-gray-600">
                  Craft targeted outreach, add templates, and schedule multi-touch sequences.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns/create')}
              className="self-start rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Launch Builder →
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Campaigns</h3>
              <p className="text-sm text-gray-500">
                {hydrating ? 'Refreshing campaigns…' : 'Latest emails and nurture flows.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/outreach/campaigns')}
              className="text-sm font-semibold text-red-600 transition hover:text-red-700"
            >
              View all campaigns
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
              No campaigns yet. Create your first nurture email to kick things off.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.slice(0, 6).map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-xl border border-gray-200 p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-900">
                      {campaign.name || 'Untitled Campaign'}
                    </h4>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                      {campaign.status || 'draft'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {campaign.subject || 'No email subject assigned yet.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      List: {campaign.contactList?.name || 'Unassigned'} (
                      {campaign.contactList?.totalContacts ?? 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(`/outreach/campaigns/${campaign.id}`)}
                      className="font-semibold text-red-600 transition hover:text-red-700"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main page component wrapped in Suspense
export default function OutreachDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Outreach Dashboard"
            subtitle="Launch nurture campaigns and track engagement performance."
          />
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    }>
      <OutreachContent />
    </Suspense>
  );
}

function MetricCard({ icon, value, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </button>
  );
}
