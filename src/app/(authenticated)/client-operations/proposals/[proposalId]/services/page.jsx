'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, X, Save, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function ProposalServicesPage({ params }) {
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/proposals/${params.proposalId}`);
        if (!isMounted) return;
        if (response.data?.proposal) {
          const proposalData = response.data.proposal;
          setProposal(proposalData);
          const parsedServices = parseJson(proposalData.serviceInstances) || [];
          setServices(parsedServices);
        }
      } catch (err) {
        console.error('Error loading proposal:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [params.proposalId]);

  const parseJson = (json) => {
    if (!json) return null;
    if (typeof json === 'string') {
      try {
        return JSON.parse(json);
      } catch {
        return json;
      }
    }
    return json;
  };

  const handleSave = async () => {
    if (!proposal) return;

    setSaving(true);
    try {
      const response = await api.put(`/api/proposals/${params.proposalId}`, {
        serviceInstances: services,
      });
      if (response.data?.proposal) {
        setProposal(response.data.proposal);
        setEditingIndex(null);
        setShowAddForm(false);
        alert('Services saved successfully!');
      }
    } catch (err) {
      console.error('Error saving services:', err);
      alert('Failed to save services. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = () => {
    setServices([
      ...services,
      {
        name: '',
        description: '',
        price: 0,
        category: 'general',
      },
    ]);
    setEditingIndex(services.length);
    setShowAddForm(true);
  };

  const handleUpdateService = (index, field, value) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const handleDeleteService = (index) => {
    if (!confirm('Delete this service?')) return;
    const updated = services.filter((_, i) => i !== index);
    setServices(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
      setShowAddForm(false);
    }
  };

  const calculateTotal = () => {
    return services.reduce((sum, service) => sum + (parseFloat(service.price) || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading services…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">Proposal not found.</p>
            <button
              onClick={() => router.push('/client-operations/proposals')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Proposals
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Manage Services"
          subtitle={`Services for ${proposal.clientName} • ${proposal.clientCompany}`}
          backTo={`/client-operations/proposals/${params.proposalId}`}
          backLabel="Back to Proposal"
        />

        <div className="mt-8 space-y-6">
          {/* Total Price Summary */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Proposal Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${calculateTotal().toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>

          {/* Services List */}
          <div className="space-y-4">
            {services.map((service, index) => (
              <div
                key={index}
                className="rounded-2xl bg-white p-6 shadow hover:shadow-md transition"
              >
                {editingIndex === index ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Service Name *
                      </label>
                      <input
                        type="text"
                        value={service.name || ''}
                        onChange={(e) =>
                          handleUpdateService(index, 'name', e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="e.g., Strategy Consulting"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={service.description || ''}
                        onChange={(e) =>
                          handleUpdateService(index, 'description', e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        rows={3}
                        placeholder="Describe what this service includes..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Price *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                          <input
                            type="number"
                            value={service.price || 0}
                            onChange={(e) =>
                              handleUpdateService(
                                index,
                                'price',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={service.category || 'general'}
                          onChange={(e) =>
                            handleUpdateService(index, 'category', e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                        >
                          <option value="general">General</option>
                          <option value="strategy">Strategy</option>
                          <option value="implementation">Implementation</option>
                          <option value="support">Support</option>
                          <option value="training">Training</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setShowAddForm(false);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {service.name || `Service ${index + 1}`}
                        </h3>
                        {service.category && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                            {service.category}
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                      )}
                      <p className="text-xl font-bold text-red-600">
                        ${(parseFloat(service.price) || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingIndex(index)}
                        className="rounded-lg bg-gray-100 p-2 text-gray-700 transition hover:bg-gray-200"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(index)}
                        className="rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add New Service Button */}
            {!showAddForm && (
              <button
                onClick={handleAddService}
                className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center transition hover:border-red-400 hover:bg-red-50"
              >
                <div className="flex flex-col items-center gap-2">
                  <Plus className="h-8 w-8 text-gray-400" />
                  <span className="font-semibold text-gray-700">Add New Service</span>
                  <span className="text-sm text-gray-500">
                    Add services to build your proposal
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Save Button Footer */}
          {services.length > 0 && (
            <div className="sticky bottom-0 rounded-2xl bg-white p-6 shadow-lg border-t-4 border-red-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Proposal Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${calculateTotal().toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/client-operations/proposals/${params.proposalId}`)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    <ArrowLeft className="h-4 w-4 inline mr-2" />
                    Back to Proposal
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

