'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Upload, Plus, Trash2, FileText, Package, CheckCircle, X, RefreshCw } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import api from '@/lib/api';

/**
 * Client Operations Templates Page
 * Manage Phase Templates, Deliverable Templates, and (soon) Proposal Templates
 */
function TemplateLibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { phaseTemplates, deliverableTemplates, syncing, error: syncError, sync } = useTemplates();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('phases'); // 'phases' | 'deliverables' | 'proposals' | 'make-templates' | 'create-phase' | 'create-deliverable' | 'create-proposal'
  const [selectedTemplateType, setSelectedTemplateType] = useState(null); // 'phase' | 'deliverable' | 'proposal'

  // Initialize - load from localStorage via hook (no auto-fetch, sync is backup only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Read tab from query params
    const tab = searchParams.get('tab');
    if (tab === 'phases' || tab === 'deliverables' || tab === 'proposals' || tab === 'make-templates') {
      setActiveTab(tab);
    }

    // Check for success message from CSV import
    const successData = sessionStorage.getItem('csvImportSuccess');
    if (successData) {
      try {
        const data = JSON.parse(successData);
        setSuccessMessage(data);
        sessionStorage.removeItem('csvImportSuccess');
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);
      } catch (e) {
        console.error('Error parsing success data:', e);
      }
    }

    // Templates are loaded from localStorage by useTemplates hook
    // No auto-hydration - sync button is backup only
    setLoading(false);
  }, [searchParams]);

  const handlePhaseCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      // Get companyHQId from localStorage
      const companyHQId = typeof window !== 'undefined' 
        ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') 
        : null;
      
      if (!companyHQId) {
        setError('CompanyHQ ID not found');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const response = await api.post('/api/import/phases', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        // Sync templates from backend after CSV upload
        await sync();
        alert(`Imported ${response.data.count} phase templates`);
      } else {
        setError(response.data?.error || 'Failed to import phases');
      }
    } catch (err) {
      console.error('Error importing phases:', err);
      setError(err.response?.data?.error || 'Failed to import phases');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeliverableCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      // Get companyHQId from localStorage
      const companyHQId = typeof window !== 'undefined' 
        ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') 
        : null;
      
      if (!companyHQId) {
        setError('CompanyHQ ID not found');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const response = await api.post('/api/import/deliverables', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        // Sync templates from backend after CSV upload
        await sync();
        alert(`Imported ${response.data.count} deliverable templates`);
      } else {
        setError(response.data?.error || 'Failed to import deliverables');
      }
    } catch (err) {
      console.error('Error importing deliverables:', err);
      setError(err.response?.data?.error || 'Failed to import deliverables');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Client Operations Templates</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage reusable phase and deliverable templates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/client-operations/proposals/create?from=templates')}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add to Proposal</span>
            </button>
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">{successMessage.message}</p>
              <p className="text-sm text-green-700 mt-1">
                {successMessage.count} template(s) imported successfully.
              </p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {(error || syncError) && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error || syncError}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('phases')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'phases'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Phase Templates ({phaseTemplates.length})
            </button>
            <button
              onClick={() => setActiveTab('deliverables')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'deliverables'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Deliverable Templates ({deliverableTemplates.length})
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'proposals'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Proposal Templates
            </button>
          </nav>
        </div>

        {/* Phase Templates */}
        {activeTab === 'phases' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Phase Templates</h2>
              <a
                href="/client-operations/proposals/create/csv"
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add More</span>
              </a>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {phaseTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{template.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{template.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {phaseTemplates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                        No phase templates. <a href="/client-operations/proposals/create/csv" className="text-red-600 hover:text-red-700">Add templates</a> to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deliverable Templates */}
        {activeTab === 'deliverables' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Deliverable Templates</h2>
              <a
                href="/client-operations/proposals/create/csv"
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add More</span>
              </a>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliverableTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{template.deliverableType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-900">{template.deliverableLabel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {template.defaultDuration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {template.defaultUnitOfMeasure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {deliverableTemplates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                        No deliverable templates. <a href="/client-operations/proposals/create/csv" className="text-red-600 hover:text-red-700">Add templates</a> to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Proposal Templates */}
        {activeTab === 'proposals' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Proposal Templates</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* See Templates Option */}
                <div
                  onClick={() => {
                    // Show phase and deliverable templates tabs
                    setActiveTab('phases');
                  }}
                  className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        See Templates
                      </h3>
                      <p className="text-sm text-gray-600">
                        View and use your existing phase and deliverable templates to build proposals.
                      </p>
                    </div>
                  </div>
                  <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                    View Templates
                  </button>
                </div>

                {/* Make Templates Option */}
                <div
                  onClick={() => setActiveTab('make-templates')}
                  className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Make Templates
                      </h3>
                      <p className="text-sm text-gray-600">
                        Create new phase, deliverable, or proposal templates from scratch or CSV.
                      </p>
                    </div>
                  </div>
                  <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                    Create Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Make Templates - Template Type Selection */}
        {activeTab === 'make-templates' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setActiveTab('proposals')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Create Templates</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Phase Templates */}
              <div
                onClick={() => {
                  setSelectedTemplateType('phase');
                  setActiveTab('create-phase');
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Phase Templates
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create reusable phase templates for your proposals.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Create Phase Template
                </button>
              </div>

              {/* Deliverable Templates */}
              <div
                onClick={() => {
                  setSelectedTemplateType('deliverable');
                  setActiveTab('create-deliverable');
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Deliverable Templates
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create reusable deliverable templates for your proposals.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Create Deliverable Template
                </button>
              </div>

              {/* Proposal Templates */}
              <div
                onClick={() => {
                  setSelectedTemplateType('proposal');
                  setActiveTab('create-proposal');
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Proposal Templates
                    </h3>
                    <p className="text-sm text-gray-600">
                      Bundle phases and deliverables into reusable proposal packages.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Create Proposal Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Template Type Chooser - Shows after selecting Phase/Deliverable/Proposal */}
        {(activeTab === 'create-phase' || activeTab === 'create-deliverable' || activeTab === 'create-proposal') && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setActiveTab('make-templates')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                Create {selectedTemplateType === 'phase' ? 'Phase' : selectedTemplateType === 'deliverable' ? 'Deliverable' : 'Proposal'} Template
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Make from CSV */}
              <div
                onClick={() => {
                  if (selectedTemplateType === 'phase') {
                    router.push('/client-operations/proposals/create/csv/phases');
                  } else if (selectedTemplateType === 'deliverable') {
                    router.push('/client-operations/proposals/create/csv/deliverables');
                  } else {
                    // TODO: Proposal template CSV upload
                    alert('Proposal template CSV upload coming soon');
                  }
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Make from CSV
                    </h3>
                    <p className="text-sm text-gray-600">
                      Upload a CSV file to bulk create templates.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Upload CSV
                </button>
              </div>

              {/* Previous */}
              <div
                onClick={() => {
                  // TODO: Show previous templates to clone
                  alert('Clone from previous template coming soon');
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Copy className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Previous
                    </h3>
                    <p className="text-sm text-gray-600">
                      Clone an existing template as your starting point.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Use Previous
                </button>
              </div>

              {/* Start Scratch */}
              <div
                onClick={() => {
                  // TODO: Route to blank template creation form
                  alert('Start from scratch template creation coming soon');
                }}
                className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer hover:border-red-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Start Scratch
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create a new template from scratch with a form.
                    </p>
                  </div>
                </div>
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                  Create Blank
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplateLibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TemplateLibraryContent />
    </Suspense>
  );
}

