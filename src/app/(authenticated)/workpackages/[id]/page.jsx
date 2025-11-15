'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package, CheckCircle2, Circle } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

/**
 * WorkPackage Admin Page
 * Shows work package with items, progress, and artifacts
 */
export default function WorkPackagePage() {
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
      const response = await api.get(`/api/workpackages/${workPackageId}`);
      if (response.data?.success) {
        setWorkPackage(response.data.workPackage);
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

        {/* Status Badge */}
        <div className="mb-6">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              workPackage.status === 'ACTIVE'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {workPackage.status}
          </span>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Deliverables</h2>
          {workPackage.items.map((item) => (
            <WorkPackageItemCard key={item.id} item={item} workPackageId={workPackageId} />
          ))}
        </div>

        {workPackage.items.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No deliverables added yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WorkPackageItem Card Component
 */
function WorkPackageItemCard({ item, workPackageId }) {
  const router = useRouter();

  const getTypeLabel = (type) => {
    const labels = {
      BLOG: 'Blog Posts',
      PERSONA: 'Personas',
      OUTREACH_TEMPLATE: 'Templates',
      EVENT_CLE_PLAN: 'Event Plans',
      CLE_DECK: 'CLE Decks',
      LANDING_PAGE: 'Landing Pages',
    };
    return labels[type] || type;
  };

  const getBuilderPath = (type, artifactId) => {
    const paths = {
      BLOG: `/builder/blog/${artifactId}`,
      PERSONA: `/builder/persona/${artifactId}`,
      OUTREACH_TEMPLATE: `/builder/template/${artifactId}`,
      EVENT_CLE_PLAN: `/builder/event/${artifactId}`,
      CLE_DECK: `/builder/cledeck/${artifactId}`,
      LANDING_PAGE: `/builder/landingpage/${artifactId}`,
    };
    return paths[type] || '#';
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{item.deliverableName}</h3>
          <p className="text-sm text-gray-500">{getTypeLabel(item.type)}</p>
        </div>
        <Link
          href={`/workpackages/${workPackageId}/items/${item.id}`}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Open Item →
        </Link>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {item.completedCount} of {item.quantity} complete
          </span>
          <span className="font-semibold text-gray-900">
            {item.progressPercentage}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-red-600 transition-all"
            style={{ width: `${item.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Artifacts List */}
      {item.artifacts && item.artifacts.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">Artifacts:</h4>
          <div className="space-y-2">
            {item.artifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={getBuilderPath(item.type, artifact.id)}
                className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100"
              >
                {artifact.published ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-900">
                  {artifact.title || artifact.name || artifact.eventName || 'Untitled'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

