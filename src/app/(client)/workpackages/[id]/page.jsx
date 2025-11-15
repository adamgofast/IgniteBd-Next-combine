'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

/**
 * WorkPackage Client Portal Page (Read-Only)
 * Shows only published artifacts
 */
export default function ClientWorkPackagePage() {
  const params = useParams();
  const router = useRouter();
  const workPackageId = params.id;

  const [workPackage, setWorkPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workPackageId) {
      loadWorkPackage();
    }
  }, [workPackageId]);

  const loadWorkPackage = async () => {
    try {
      setLoading(true);
      // Client portal endpoint filters to published artifacts
      const response = await api.get(`/api/workpackages/client/${workPackageId}`);
      if (response.data?.success) {
        const packages = response.data.workPackages || [];
        const found = packages.find((wp) => wp.id === workPackageId);
        setWorkPackage(found);
        if (!found) {
          setError('Work package not found');
        }
      } else {
        setError('Failed to load work package');
      }
    } catch (err) {
      console.error('Error loading work package:', err);
      setError('Failed to load work package');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading work package...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !workPackage) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-red-600">{error || 'Work package not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workPackage.title}</h1>
            {workPackage.description && (
              <p className="mt-1 text-gray-600">{workPackage.description}</p>
            )}
          </div>
        </div>

        {/* Items (Read-Only) */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Your Deliverables</h2>
          {workPackage.items.map((item) => (
            <ClientWorkPackageItemCard key={item.id} item={item} workPackageId={workPackageId} />
          ))}
        </div>

        {workPackage.items.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No deliverables available</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Client WorkPackageItem Card (Read-Only)
 */
function ClientWorkPackageItemCard({ item, workPackageId }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{item.deliverableName}</h3>
        <p className="text-sm text-gray-500">
          {item.completedCount} of {item.quantity} complete
        </p>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-red-600 transition-all"
            style={{ width: `${item.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Published Artifacts Only */}
      {item.artifacts && item.artifacts.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-700">Available Artifacts:</h4>
          <div className="space-y-2">
            {item.artifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/artifacts/${getArtifactType(item.type)}/${artifact.id}`}
                className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3 hover:bg-gray-100"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-900">
                  {artifact.title || artifact.name || artifact.eventName || 'Untitled'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No published artifacts yet</p>
      )}
    </div>
  );
}

function getArtifactType(type) {
  const types = {
    BLOG: 'blog',
    PERSONA: 'persona',
    OUTREACH_TEMPLATE: 'template',
    EVENT_CLE_PLAN: 'event',
    CLE_DECK: 'cledeck',
    LANDING_PAGE: 'landingpage',
  };
  return types[type] || 'artifact';
}

