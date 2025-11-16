'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Plus, Save, X } from 'lucide-react';
import api from '@/lib/api';

/**
 * Blank Proposal Builder
 * Create proposal from scratch with manual phase/deliverable entry
 */
function BlankProposalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contactId');
  const companyId = searchParams.get('companyId');

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [phases, setPhases] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddPhase = () => {
    setPhases([
      ...phases,
      {
        id: `phase-${Date.now()}`,
        name: '',
        position: phases.length + 1,
        durationWeeks: 3,
        description: '',
      },
    ]);
  };

  const handleUpdatePhase = (id, updates) => {
    setPhases(phases.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleRemovePhase = (id) => {
    setPhases(phases.filter(p => p.id !== id).map((p, i) => ({ ...p, position: i + 1 })));
  };

  const handleAddDeliverable = () => {
    setDeliverables([
      ...deliverables,
      {
        id: `deliverable-${Date.now()}`,
        name: '',
        description: '',
        quantity: 1,
        unitPrice: null,
        totalPrice: null,
        notes: '',
      },
    ]);
  };

  const handleUpdateDeliverable = (id, updates) => {
    setDeliverables(deliverables.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updates };
        // Auto-calculate totalPrice if unitPrice and quantity are set
        if (updated.unitPrice && updated.quantity) {
          updated.totalPrice = updated.unitPrice * updated.quantity;
        }
        return updated;
      }
      return d;
    }));
  };

  const handleRemoveDeliverable = (id) => {
    setDeliverables(deliverables.filter(d => d.id !== id));
  };

  const handleSave = async () => {
    if (!title.trim() || !contactId || !companyId) {
      setError('Please fill in all required fields');
      return;
    }

    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.post('/api/proposals/assemble', {
        contactId,
        companyHQId,
        companyId,
        title: title.trim(),
        estimatedStart: new Date().toISOString(),
        purpose: purpose.trim() || null,
        totalPrice: deliverables.reduce((sum, d) => sum + (d.totalPrice || 0), 0) || null,
        assemblyType: 'blank',
        data: {
          phases: phases.map(p => ({
            name: p.name || 'Unnamed Phase',
            position: p.position,
            durationWeeks: p.durationWeeks || 3,
            description: p.description || null,
          })),
          deliverables: deliverables.map(d => ({
            name: d.name || 'Untitled Deliverable',
            description: d.description || null,
            quantity: d.quantity || 1,
            unitPrice: d.unitPrice || null,
            totalPrice: d.totalPrice || null,
            notes: d.notes || null,
          })),
        },
      });

      if (response.data?.success) {
        const proposal = response.data.proposal;
        
        // Save to localStorage
        const cached = window.localStorage.getItem('proposals');
        const existing = cached ? JSON.parse(cached) : [];
        const updated = [...existing, proposal];
        window.localStorage.setItem('proposals', JSON.stringify(updated));
        
        router.push(`/client-operations/proposals/${proposal.id}`);
      } else {
        setError(response.data?.error || 'Failed to create proposal');
      }
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Blank Proposal"
          subtitle="Build a proposal from scratch"
          backTo="/client-operations/proposals/create"
          backLabel="Back to Create Proposal"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Proposal Details */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Proposal Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Proposal Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Growth Services Proposal for ABC Corp"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Purpose / Description
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={4}
                  placeholder="Describe the purpose and goals of this proposal..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>
          </section>

          {/* Phases */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Phases</h2>
              <button
                onClick={handleAddPhase}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Add Phase
              </button>
            </div>

            <div className="space-y-4">
              {phases.map((phase) => (
                <div key={phase.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Phase {phase.position}</h3>
                    <button
                      onClick={() => handleRemovePhase(phase.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                        placeholder="e.g., Foundation"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Duration (weeks)</label>
                      <input
                        type="number"
                        value={phase.durationWeeks}
                        onChange={(e) => handleUpdatePhase(phase.id, { durationWeeks: parseInt(e.target.value) || 3 })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                    <textarea
                      value={phase.description}
                      onChange={(e) => handleUpdatePhase(phase.id, { description: e.target.value })}
                      placeholder="Phase description..."
                      rows={2}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ))}
              {phases.length === 0 && (
                <p className="text-sm text-gray-600 text-center py-8">
                  No phases added yet. Click "Add Phase" to get started.
                </p>
              )}
            </div>
          </section>

          {/* Deliverables */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Deliverables</h2>
              <button
                onClick={handleAddDeliverable}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Add Deliverable
              </button>
            </div>

            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <div key={deliverable.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Deliverable</h3>
                    <button
                      onClick={() => handleRemoveDeliverable(deliverable.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={deliverable.name}
                        onChange={(e) => handleUpdateDeliverable(deliverable.id, { name: e.target.value })}
                        placeholder="e.g., Target Persona"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={deliverable.quantity}
                        onChange={(e) => handleUpdateDeliverable(deliverable.id, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Price ($)</label>
                      <input
                        type="number"
                        value={deliverable.unitPrice || ''}
                        onChange={(e) => handleUpdateDeliverable(deliverable.id, { unitPrice: parseFloat(e.target.value) || null })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Total Price ($)</label>
                      <input
                        type="number"
                        value={deliverable.totalPrice || ''}
                        onChange={(e) => handleUpdateDeliverable(deliverable.id, { totalPrice: parseFloat(e.target.value) || null })}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                    <textarea
                      value={deliverable.description}
                      onChange={(e) => handleUpdateDeliverable(deliverable.id, { description: e.target.value })}
                      placeholder="Deliverable description..."
                      rows={2}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={deliverable.notes}
                      onChange={(e) => handleUpdateDeliverable(deliverable.id, { notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={2}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ))}
              {deliverables.length === 0 && (
                <p className="text-sm text-gray-600 text-center py-8">
                  No deliverables added yet. Click "Add Deliverable" to get started.
                </p>
              )}
            </div>
          </section>

          {/* Save Button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proposal Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${deliverables.reduce((sum, d) => sum + (d.totalPrice || 0), 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !companyId}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlankProposalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BlankProposalContent />
    </Suspense>
  );
}
