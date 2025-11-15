'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package, CheckCircle2, Circle, Eye } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { getItemTypeLabel } from '@/lib/config/workPackageConfig';

/**
 * WorkPackage Detail Page
 * Shows work package with phases, items, and collateral
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressForItem = (item) => {
    const completed = item.collateral?.length || 0;
    const total = item.quantity;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Work Package</h1>
            {workPackage.contact && (
              <p className="mt-1 text-gray-600">
                Client: {workPackage.contact.firstName} {workPackage.contact.lastName}
              </p>
            )}
          </div>
          <Link
            href={`/workpackages/bulk-upload?contactId=${workPackage.contactId}`}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Add Items
          </Link>
        </div>

        {/* Phases */}
        {workPackage.phases && workPackage.phases.length > 0 ? (
          <div className="space-y-6">
            {workPackage.phases.map((phase) => (
              <div key={phase.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{phase.name}</h2>
                    {phase.timeline && (
                      <p className="mt-1 text-sm text-gray-600">{phase.timeline}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    Position {phase.position}
                  </span>
                </div>

                {/* Items in Phase */}
                {phase.items && phase.items.length > 0 ? (
                  <div className="space-y-3">
                    {phase.items.map((item) => {
                      const progress = getProgressForItem(item);
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-gray-900">{item.itemLabel}</h3>
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                  {getItemTypeLabel(item.itemType)}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                              {item.itemDescription && (
                                <p className="mt-1 text-sm text-gray-600">{item.itemDescription}</p>
                              )}
                              <div className="mt-2 flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                  Quantity: {item.quantity}
                                </span>
                                <span className="text-sm text-gray-600">
                                  Progress: {progress.completed} / {progress.total} ({progress.percentage}%)
                                </span>
                              </div>
                              {progress.completed > 0 && (
                                <div className="mt-2">
                                  <div className="h-2 w-full rounded-full bg-gray-200">
                                    <div
                                      className="h-2 rounded-full bg-green-600"
                                      style={{ width: `${progress.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <Link
                              href={`/workpackages/${workPackageId}/items/${item.id}`}
                              className="ml-4 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-4 w-4" />
                              View Work
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No items in this phase</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-semibold text-gray-800">No phases yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Use bulk upload to add phases and items
            </p>
            <Link
              href={`/workpackages/bulk-upload?contactId=${workPackage.contactId}`}
              className="mt-6 inline-flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Items
            </Link>
          </div>
        )}

        {/* Items without phase */}
        {workPackage.items && workPackage.items.filter(item => !item.workPackagePhaseId).length > 0 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Items (No Phase)</h2>
            <div className="space-y-3">
              {workPackage.items
                .filter(item => !item.workPackagePhaseId)
                .map((item) => {
                  const progress = getProgressForItem(item);
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">{item.itemLabel}</h3>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                              {getItemTypeLabel(item.itemType)}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          {item.itemDescription && (
                            <p className="mt-1 text-sm text-gray-600">{item.itemDescription}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                              Quantity: {item.quantity}
                            </span>
                            <span className="text-sm text-gray-600">
                              Progress: {progress.completed} / {progress.total} ({progress.percentage}%)
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/workpackages/${workPackageId}/items/${item.id}`}
                          className="ml-4 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4" />
                          View Work
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
