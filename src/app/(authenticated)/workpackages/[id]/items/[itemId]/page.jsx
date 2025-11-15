'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

/**
 * WorkPackageItem Detail Page
 * Shows all artifacts for an item + "Add Artifact" button
 */
export default function WorkPackageItemPage() {
  const params = useParams();
  const router = useRouter();
  const { id: workPackageId, itemId } = params;

  const [workPackage, setWorkPackage] = useState(null);
  const [item, setItem] = useState(null);
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
        const foundItem = response.data.workPackage.items.find((i) => i.id === itemId);
        setItem(foundItem);
        if (!foundItem) {
          setError('Item not found');
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

  const handleAddArtifact = async (type) => {
    // Navigate to artifact builder
    const builderPaths = {
      BLOG: `/builder/blog/new?workPackageId=${workPackageId}&itemId=${itemId}`,
      PERSONA: `/builder/persona/new?workPackageId=${workPackageId}&itemId=${itemId}`,
      OUTREACH_TEMPLATE: `/builder/template/new?workPackageId=${workPackageId}&itemId=${itemId}`,
      EVENT_CLE_PLAN: `/builder/event/new?workPackageId=${workPackageId}&itemId=${itemId}`,
      CLE_DECK: `/builder/cledeck/new?workPackageId=${workPackageId}&itemId=${itemId}`,
      LANDING_PAGE: `/builder/landingpage/new?workPackageId=${workPackageId}&itemId=${itemId}`,
    };

    router.push(builderPaths[type] || '/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-red-600">{error || 'Item not found'}</p>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push(`/workpackages/${workPackageId}`)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{item.deliverableName}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {item.completedCount} of {item.quantity} complete
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">{item.progressPercentage}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${item.progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Add Artifact Button */}
        <div className="mb-6">
          <button
            onClick={() => handleAddArtifact(item.type)}
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Add {item.type.replace('_', ' ')}
          </button>
        </div>

        {/* Artifacts List */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Artifacts</h2>
          {item.artifacts && item.artifacts.length > 0 ? (
            <div className="space-y-3">
              {item.artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={getBuilderPath(item.type, artifact.id)}
                  className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {artifact.title || artifact.name || artifact.eventName || 'Untitled'}
                    </h3>
                    {artifact.description && (
                      <p className="mt-1 text-sm text-gray-600">{artifact.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {artifact.published ? 'Published' : 'Draft'}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No artifacts added yet</p>
              <button
                onClick={() => handleAddArtifact(item.type)}
                className="mt-4 text-red-600 hover:text-red-700"
              >
                + Add Your First Artifact
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

