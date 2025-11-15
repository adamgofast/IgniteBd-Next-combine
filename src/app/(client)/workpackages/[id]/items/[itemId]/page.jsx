'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

/**
 * Client WorkPackageItem Detail Page (Read-Only)
 * Shows only published artifacts
 */
export default function ClientWorkPackageItemPage() {
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
      const response = await api.get(`/api/workpackages/client/${workPackageId}`);
      if (response.data?.success) {
        const packages = response.data.workPackages || [];
        const found = packages.find((wp) => wp.id === workPackageId);
        if (found) {
          setWorkPackage(found);
          const foundItem = found.items.find((i) => i.id === itemId);
          setItem(foundItem);
          if (!foundItem) {
            setError('Item not found');
          }
        } else {
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

  const getArtifactPath = (type, artifactId) => {
    const paths = {
      BLOG: `/artifacts/blog/${artifactId}`,
      PERSONA: `/artifacts/persona/${artifactId}`,
      OUTREACH_TEMPLATE: `/artifacts/template/${artifactId}`,
      EVENT_CLE_PLAN: `/artifacts/event/${artifactId}`,
      CLE_DECK: `/artifacts/cledeck/${artifactId}`,
      LANDING_PAGE: `/artifacts/landingpage/${artifactId}`,
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

        {/* Published Artifacts Only */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Available Artifacts</h2>
          {item.artifacts && item.artifacts.length > 0 ? (
            <div className="space-y-3">
              {item.artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={getArtifactPath(item.type, artifact.id)}
                  className="block rounded border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
                >
                  <h3 className="font-semibold text-gray-900">
                    {artifact.title || artifact.name || artifact.eventName || 'Untitled'}
                  </h3>
                  {artifact.description && (
                    <p className="mt-1 text-sm text-gray-600">{artifact.description}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No published artifacts available yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

