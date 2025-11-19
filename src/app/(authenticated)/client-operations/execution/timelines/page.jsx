'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import { Loader, Calendar, Package, ArrowLeft, Edit2, Check, X } from 'lucide-react';

/**
 * Modify Timelines Page
 * Manage phases and timeline for a work package
 */

export default function ModifyTimelinesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workPackageId = searchParams.get('workPackageId');

  const [workPackage, setWorkPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPhase, setEditingPhase] = useState(null);
  const [phaseName, setPhaseName] = useState('');
  const [phaseDescription, setPhaseDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workPackageId) {
      loadWorkPackage();
    } else {
      router.push('/client-operations/execution');
    }
  }, [workPackageId]);

  const loadWorkPackage = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/workpackages/${workPackageId}`);
      
      if (response.data?.success && response.data.workPackage) {
        setWorkPackage(response.data.workPackage);
      } else {
        alert('Work package not found');
        router.push('/client-operations/execution');
      }
    } catch (error) {
      console.error('Error loading work package:', error);
      alert('Failed to load work package');
      router.push('/client-operations/execution');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPhase = (phase) => {
    setEditingPhase(phase);
    setPhaseName(phase.name);
    setPhaseDescription(phase.description || '');
  };

  const handleCancelEdit = () => {
    setEditingPhase(null);
    setPhaseName('');
    setPhaseDescription('');
  };

  const handleSavePhase = async () => {
    if (!editingPhase || !phaseName.trim()) return;

    setSaving(true);
    try {
      // Update phase via API (you may need to create this endpoint)
      // For now, just reload to see if changes persist
      await loadWorkPackage();
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving phase:', error);
      alert('Failed to save phase changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 animate-spin text-gray-400" />
          <p className="mt-4 text-gray-600">Loading work package...</p>
        </div>
      </div>
    );
  }

  if (!workPackage) {
    return null;
  }

  const phases = workPackage.phases || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Modify Timelines"
          subtitle={`Manage phases for: ${workPackage.title}`}
          backTo={`/client-operations/execution?contactId=${workPackage.contactId}&workPackageId=${workPackageId}`}
          backLabel="Back to Execution Hub"
        />

        {/* Work Package Info */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{workPackage.title}</h2>
              {workPackage.description && (
                <p className="text-sm text-gray-600">{workPackage.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Phases List */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Phases</h2>

          {phases.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-600">No phases defined yet</p>
              <p className="mt-2 text-xs text-gray-500">
                Create phases when importing work packages or adding deliverables
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {phases.map((phase, index) => (
                <div
                  key={phase.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-gray-300"
                >
                  {editingPhase?.id === phase.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={phaseName}
                        onChange={(e) => setPhaseName(e.target.value)}
                        placeholder="Phase name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={phaseDescription}
                        onChange={(e) => setPhaseDescription(e.target.value)}
                        placeholder="Phase description"
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X className="mr-1 inline h-4 w-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePhase}
                          disabled={saving || !phaseName.trim()}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <Loader className="mr-1 inline h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="mr-1 inline h-4 w-4" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                            {phase.position || index + 1}
                          </span>
                          <h3 className="text-base font-semibold text-gray-900">
                            {phase.name}
                          </h3>
                        </div>
                        {phase.description && (
                          <p className="ml-11 mt-1 text-sm text-gray-600">{phase.description}</p>
                        )}
                        {phase.items && phase.items.length > 0 && (
                          <div className="ml-11 mt-2 text-xs text-gray-500">
                            {phase.items.length} deliverable{phase.items.length !== 1 ? 's' : ''}
                          </div>
                        )}
                        {phase.totalEstimatedHours && (
                          <div className="ml-11 mt-1 text-xs text-gray-500">
                            {phase.totalEstimatedHours} estimated hours
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditPhase(phase)}
                        className="ml-4 rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> To add or remove phases, modify work package items. Phases are automatically created based on deliverable assignments.
          </p>
        </div>
      </div>
    </div>
  );
}

