'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  DollarSign,
  Users,
  Calendar,
  Edit2,
  Save,
  X,
  CheckCircle,
  Clock,
  Package,
  ArrowRight,
  Plus,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function ProposalDetailPage({ params }) {
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // Track what's being edited
  const [saving, setSaving] = useState(false);
  const [localData, setLocalData] = useState(null);

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
          setLocalData({
            purpose: proposalData.purpose || '',
            phases: proposalData.phases || [],
            milestones: proposalData.milestones || [],
            compensation: proposalData.compensation || null,
            status: proposalData.status || 'draft',
          });
        } else {
          setError('Proposal not found.');
        }
      } catch (err) {
        if (!isMounted) return;
        setError('Unable to load proposal details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [params.proposalId]);

  const handleSave = async (field, value) => {
    if (!proposal) return;

    setSaving(true);
    try {
      const updateData = { [field]: value };
      const response = await api.put(`/api/proposals/${params.proposalId}`, updateData);
      if (response.data?.proposal) {
        setProposal(response.data.proposal);
        setLocalData((prev) => ({ ...prev, [field]: value }));
        setEditing(null);
      }
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this proposal? This will convert it to deliverables.')) return;

    setSaving(true);
    try {
      const response = await api.post(`/api/proposals/${params.proposalId}/approve`);
      if (response.data?.success) {
        setProposal((prev) => ({ ...prev, status: 'approved' }));
        setLocalData((prev) => ({ ...prev, status: 'approved' }));
        alert('Proposal approved! Deliverables have been created.');
      }
    } catch (err) {
      console.error('Error approving:', err);
      alert('Failed to approve proposal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

  const phases = useMemo(() => parseJson(proposal?.phases) || [], [proposal]);
  const milestones = useMemo(() => parseJson(proposal?.milestones) || [], [proposal]);
  const compensation = useMemo(() => parseJson(proposal?.compensation), [proposal]);
  const serviceInstances = useMemo(() => parseJson(proposal?.serviceInstances) || [], [proposal]);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading proposal…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">{error || 'Proposal not found.'}</p>
            <button
              type="button"
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-red-600 via-amber-500 to-purple-600 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Proposal for {proposal.clientName}
              </h1>
              <p className="text-xl text-white/90">{proposal.clientCompany}</p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span>
                  {proposal.dateIssued
                    ? new Date(proposal.dateIssued).toLocaleDateString()
                    : 'Not issued'}
                </span>
                <span>•</span>
                <span>
                  {milestones.length > 0
                    ? `${milestones.length} weeks`
                    : 'Duration TBD'}
                </span>
                <span>•</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    statusColors[proposal.status] || statusColors.draft
                  }`}
                >
                  {proposal.status}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              {proposal.status === 'draft' && (
                <button
                  onClick={async () => {
                    try {
                      setSaving(true);
                      const response = await api.put(`/api/proposals/${params.proposalId}`, {
                        status: 'active',
                      });
                      if (response.data?.proposal) {
                        setProposal(response.data.proposal);
                        setLocalData((prev) => ({ ...prev, status: 'active' }));
                      }
                    } catch (err) {
                      console.error('Error updating status:', err);
                      alert('Failed to update status. Please try again.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" />
                  Mark Active
                </button>
              )}
              {proposal.status !== 'approved' && (
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Proposal
                </button>
              )}
              <button
                onClick={() => router.push('/client-operations/proposals')}
                className="rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
              >
                Back to Proposals
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Single Page Vertical Scroll - All Sections Visible */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Purpose Section - Always Visible, Inline Editable */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="h-6 w-6 text-red-600" />
            Purpose
          </h2>
          {editing === 'purpose' ? (
            <div className="space-y-3">
              <textarea
                value={localData?.purpose || ''}
                onChange={(e) =>
                  setLocalData((prev) => ({ ...prev, purpose: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                rows={6}
                placeholder="Define the purpose and goals of this proposal..."
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleSave('purpose', localData?.purpose)}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(null);
                    setLocalData((prev) => ({ ...prev, purpose: proposal.purpose || '' }));
                  }}
                  className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => proposal.status !== 'approved' && setEditing('purpose')}
              className={`group cursor-pointer rounded-lg border-2 border-dashed border-transparent p-4 transition hover:border-gray-300 ${proposal.status === 'approved' ? 'cursor-default' : ''}`}
            >
              <p className="text-gray-700 leading-relaxed min-h-[60px]">
                {proposal.purpose || 'Click to add purpose...'}
              </p>
              {proposal.status !== 'approved' && (
                <button className="mt-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition">
                  <Edit2 className="h-3 w-3 inline mr-1" />
                  Click to edit
                </button>
              )}
            </div>
          )}
        </section>

        {/* Services Section - Always Visible */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Package className="h-6 w-6 text-red-600" />
            Services
          </h2>
          {editing === 'services' ? (
            <ServicesInlineEditor
              services={serviceInstances}
              onSave={async (updatedServices) => {
                try {
                  setSaving(true);
                  const response = await api.put(`/api/proposals/${params.proposalId}`, {
                    serviceInstances: updatedServices,
                  });
                  if (response.data?.proposal) {
                    setProposal(response.data.proposal);
                    setLocalData((prev) => ({ ...prev, serviceInstances: updatedServices }));
                    setEditing(null);
                  }
                } catch (err) {
                  console.error('Error saving services:', err);
                  alert('Failed to save services. Please try again.');
                } finally {
                  setSaving(false);
                }
              }}
              onCancel={() => {
                setEditing(null);
              }}
              saving={saving}
            />
          ) : (
            <div 
              onClick={() => proposal.status !== 'approved' && setEditing('services')}
              className={`group ${proposal.status !== 'approved' ? 'cursor-pointer' : ''}`}
            >
              {serviceInstances.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {serviceInstances.map((service, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-200 p-4 hover:border-red-300 transition"
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {service.name || service.title || `Service ${index + 1}`}
                      </h3>
                      {service.description && (
                        <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                      )}
                      {service.price && (
                        <p className="text-lg font-bold text-red-600">
                          ${service.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg group-hover:border-red-300 transition">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No services added yet.</p>
                  {proposal.status !== 'approved' && (
                    <p className="text-xs mt-2 text-gray-400">Click to add services</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Scope of Work - Phases */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-red-600" />
            Scope of Work
          </h2>
          {editing === 'phases' ? (
            <PhasesInlineEditor
              phases={phases}
              onSave={async (updatedPhases) => {
                try {
                  setSaving(true);
                  const response = await api.put(`/api/proposals/${params.proposalId}`, {
                    phases: updatedPhases,
                  });
                  if (response.data?.proposal) {
                    setProposal(response.data.proposal);
                    setLocalData((prev) => ({ ...prev, phases: updatedPhases }));
                    setEditing(null);
                  }
                } catch (err) {
                  console.error('Error saving phases:', err);
                  alert('Failed to save phases. Please try again.');
                } finally {
                  setSaving(false);
                }
              }}
              onCancel={() => {
                setEditing(null);
                setLocalData((prev) => ({ ...prev, phases: phases }));
              }}
              saving={saving}
            />
          ) : (
            <div 
              onClick={() => proposal.status !== 'approved' && setEditing('phases')}
              className={`group ${proposal.status !== 'approved' ? 'cursor-pointer' : ''}`}
            >
              {phases.length > 0 ? (
                <div className="space-y-4">
                  {phases.map((phase, index) => {
                    const colorClasses = {
                      red: 'border-red-200 bg-red-50',
                      yellow: 'border-yellow-200 bg-yellow-50',
                      purple: 'border-purple-200 bg-purple-50',
                    };
                    const colorClass =
                      colorClasses[phase.color] || colorClasses.red;
                    return (
                      <div
                        key={phase.id || index}
                        className={`rounded-lg border p-6 ${colorClass}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">
                              {phase.name || `Phase ${index + 1}`}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {phase.weeks || 'Duration TBD'}
                            </p>
                          </div>
                        </div>
                        {phase.goal && (
                          <p className="text-gray-700 mb-3">
                            <strong>Goal:</strong> {phase.goal}
                          </p>
                        )}
                        {phase.deliverables && Array.isArray(phase.deliverables) && phase.deliverables.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              Deliverables:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                              {phase.deliverables.map((deliverable, delIndex) => (
                                <li key={delIndex}>
                                  {typeof deliverable === 'string'
                                    ? deliverable
                                    : deliverable.title || deliverable}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {phase.coreWork && Array.isArray(phase.coreWork) && phase.coreWork.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              Core Work:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                              {phase.coreWork.map((work, workIndex) => (
                                <li key={workIndex}>
                                  {typeof work === 'string' ? work : work.title || work}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {phase.outcome && (
                          <p className="text-sm text-gray-600">
                            <strong>Outcome:</strong> {phase.outcome}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg group-hover:border-red-300 transition">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No phases defined yet.</p>
                  <p className="text-sm mt-2">
                    Phases define the scope of work and deliverables.
                  </p>
                  {proposal.status !== 'approved' && (
                    <p className="text-xs mt-2 text-gray-400">Click to add phases</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Compensation Section */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-red-600" />
            Compensation
          </h2>
          {editing === 'compensation' ? (
            <CompensationEditor
              compensation={compensation}
              totalPrice={proposal.totalPrice}
              onSave={async (updatedCompensation) => {
                try {
                  setSaving(true);
                  const response = await api.put(`/api/proposals/${params.proposalId}`, {
                    compensation: updatedCompensation,
                    totalPrice: updatedCompensation.total,
                  });
                  if (response.data?.proposal) {
                    setProposal(response.data.proposal);
                    setLocalData((prev) => ({ ...prev, compensation: updatedCompensation }));
                    setEditing(null);
                  }
                } catch (err) {
                  console.error('Error saving compensation:', err);
                  alert('Failed to save compensation. Please try again.');
                } finally {
                  setSaving(false);
                }
              }}
              onCancel={() => {
                setEditing(null);
                setLocalData((prev) => ({ ...prev, compensation: compensation }));
              }}
              saving={saving}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {proposal.totalPrice
                    ? `$${proposal.totalPrice.toLocaleString()}`
                    : 'Price TBD'}
                </span>
                {compensation?.currency && (
                  <span className="text-gray-600">{compensation.currency}</span>
                )}
              </div>
              {compensation?.paymentStructure && (
                <p className="text-gray-700">{compensation.paymentStructure}</p>
              )}
              {compensation?.payments && Array.isArray(compensation.payments) && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-semibold text-gray-900">Payment Schedule</h3>
                  {compensation.payments.map((payment, index) => (
                    <div
                      key={payment.id || index}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          ${payment.amount?.toLocaleString() || '0'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {payment.trigger || payment.description || `Payment ${index + 1}`}
                        </p>
                        {payment.dueDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {new Date(payment.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {payment.status || 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Timeline - Milestones */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            Timeline & Milestones
          </h2>
          {editing === 'milestones' ? (
            <MilestonesInlineEditor
              milestones={milestones}
              phases={phases}
              onSave={async (updatedMilestones) => {
                try {
                  setSaving(true);
                  const response = await api.put(`/api/proposals/${params.proposalId}`, {
                    milestones: updatedMilestones,
                  });
                  if (response.data?.proposal) {
                    setProposal(response.data.proposal);
                    setLocalData((prev) => ({ ...prev, milestones: updatedMilestones }));
                    setEditing(null);
                  }
                } catch (err) {
                  console.error('Error saving milestones:', err);
                  alert('Failed to save milestones. Please try again.');
                } finally {
                  setSaving(false);
                }
              }}
              onCancel={() => {
                setEditing(null);
                setLocalData((prev) => ({ ...prev, milestones: milestones }));
              }}
              saving={saving}
            />
          ) : (
            <div 
              onClick={() => proposal.status !== 'approved' && setEditing('milestones')}
              className={`group ${proposal.status !== 'approved' ? 'cursor-pointer' : ''}`}
            >
              {milestones.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-6">
                    {milestones.map((milestone, index) => {
                      const phaseColors = {
                        red: 'bg-red-500',
                        yellow: 'bg-yellow-500',
                        purple: 'bg-purple-500',
                      };
                      const dotColor =
                        phaseColors[milestone.phaseColor] || phaseColors.red;
                      return (
                        <div key={milestone.week || index} className="relative flex gap-6">
                          {/* Timeline dot */}
                          <div
                            className={`relative z-10 h-4 w-4 rounded-full ${dotColor} mt-1`}
                          ></div>
                          <div className="flex-1 pb-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="font-semibold text-gray-900">
                                    Week {milestone.week || index + 1}
                                  </span>
                                  {milestone.phase && (
                                    <span className="text-sm text-gray-600">
                                      • {milestone.phase}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {milestone.milestone || `Milestone ${index + 1}`}
                                </h3>
                                {milestone.deliverable && (
                                  <p className="text-gray-600">{milestone.deliverable}</p>
                                )}
                              </div>
                              {milestone.completed && (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg group-hover:border-red-300 transition">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No milestones defined yet.</p>
                  <p className="text-sm mt-2">
                    Milestones help track progress through the engagement.
                  </p>
                  {proposal.status !== 'approved' && (
                    <p className="text-xs mt-2 text-gray-400">Click to add milestones</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Client Details */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Users className="h-6 w-6 text-red-600" />
            Client Details
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-semibold text-gray-700 mb-1">Client Name</dt>
              <dd className="text-gray-600">{proposal.clientName || 'TBD'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700 mb-1">Company</dt>
              <dd className="text-gray-600">{proposal.clientCompany || 'TBD'}</dd>
            </div>
            {proposal.preparedBy && (
              <div>
                <dt className="font-semibold text-gray-700 mb-1">Prepared By</dt>
                <dd className="text-gray-600">{proposal.preparedBy}</dd>
              </div>
            )}
            {proposal.dateIssued && (
              <div>
                <dt className="font-semibold text-gray-700 mb-1">Date Issued</dt>
                <dd className="text-gray-600">
                  {new Date(proposal.dateIssued).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}

// Services Inline Editor Component
function ServicesInlineEditor({ services, onSave, onCancel, saving }) {
  const [localServices, setLocalServices] = useState(services || []);
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddService = () => {
    const newService = {
      name: '',
      description: '',
      price: 0,
      category: 'general',
    };
    setLocalServices([...localServices, newService]);
    setEditingIndex(localServices.length);
  };

  const handleUpdateService = (index, field, value) => {
    const updated = [...localServices];
    updated[index] = { ...updated[index], [field]: value };
    setLocalServices(updated);
  };

  const handleDeleteService = (index) => {
    if (!confirm('Delete this service?')) return;
    setLocalServices(localServices.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const calculateTotal = () => {
    return localServices.reduce((sum, service) => sum + (parseFloat(service.price) || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {localServices.length} {localServices.length === 1 ? 'service' : 'services'} • Total: ${calculateTotal().toLocaleString()}
        </p>
        <button
          onClick={handleAddService}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      <div className="space-y-4">
        {localServices.map((service, index) => (
          <div key={index} className="rounded-lg border border-gray-200 p-4">
            {editingIndex === index ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={service.name || ''}
                    onChange={(e) => handleUpdateService(index, 'name', e.target.value)}
                    placeholder="e.g., Strategy Consulting"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={service.description || ''}
                    onChange={(e) => handleUpdateService(index, 'description', e.target.value)}
                    placeholder="Describe what this service includes..."
                    rows={3}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">Price *</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-xs text-gray-500">$</span>
                      <input
                        type="number"
                        value={service.price || 0}
                        onChange={(e) =>
                          handleUpdateService(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Category
                    </label>
                    <select
                      value={service.category || 'general'}
                      onChange={(e) => handleUpdateService(index, 'category', e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="general">General</option>
                      <option value="strategy">Strategy</option>
                      <option value="implementation">Implementation</option>
                      <option value="support">Support</option>
                      <option value="training">Training</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    <X className="h-3 w-3" />
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {service.name || `Service ${index + 1}`}
                    </h3>
                    {service.category && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {service.category}
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  )}
                  <p className="text-lg font-bold text-red-600">
                    ${(parseFloat(service.price) || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingIndex(index)}
                    className="rounded-lg bg-gray-100 p-1.5 text-gray-700 transition hover:bg-gray-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteService(index)}
                    className="rounded-lg bg-red-100 p-1.5 text-red-700 transition hover:bg-red-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {localServices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No services added yet.</p>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => onSave(localServices)}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save All
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// Phases Inline Editor Component
function PhasesInlineEditor({ phases, onSave, onCancel, saving }) {
  const [localPhases, setLocalPhases] = useState(phases || []);

  const handleAddPhase = () => {
    setLocalPhases([
      ...localPhases,
      {
        id: `phase-${Date.now()}`,
        name: '',
        weeks: '',
        color: localPhases.length === 0 ? 'red' : localPhases.length === 1 ? 'yellow' : 'purple',
        goal: '',
        deliverables: [],
        coreWork: [],
        outcome: '',
      },
    ]);
  };

  const handleUpdatePhase = (phaseId, updates) => {
    setLocalPhases(localPhases.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)));
  };

  const handleDeletePhase = (phaseId) => {
    if (!confirm('Delete this phase?')) return;
    setLocalPhases(localPhases.filter((p) => p.id !== phaseId));
  };

  const handleAddDeliverable = (phaseId) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          return {
            ...p,
            deliverables: [...(p.deliverables || []), ''],
          };
        }
        return p;
      }),
    );
  };

  const handleUpdateDeliverable = (phaseId, index, value) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          const deliverables = [...(p.deliverables || [])];
          deliverables[index] = value;
          return { ...p, deliverables };
        }
        return p;
      }),
    );
  };

  const handleRemoveDeliverable = (phaseId, index) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          const deliverables = [...(p.deliverables || [])];
          deliverables.splice(index, 1);
          return { ...p, deliverables };
        }
        return p;
      }),
    );
  };

  const handleAddCoreWork = (phaseId) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          return {
            ...p,
            coreWork: [...(p.coreWork || []), ''],
          };
        }
        return p;
      }),
    );
  };

  const handleUpdateCoreWork = (phaseId, index, value) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          const coreWork = [...(p.coreWork || [])];
          coreWork[index] = value;
          return { ...p, coreWork };
        }
        return p;
      }),
    );
  };

  const handleRemoveCoreWork = (phaseId, index) => {
    setLocalPhases(
      localPhases.map((p) => {
        if (p.id === phaseId) {
          const coreWork = [...(p.coreWork || [])];
          coreWork.splice(index, 1);
          return { ...p, coreWork };
        }
        return p;
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {localPhases.length} {localPhases.length === 1 ? 'phase' : 'phases'}
        </p>
        <button
          onClick={handleAddPhase}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Add Phase
        </button>
      </div>

      <div className="space-y-4">
        {localPhases.map((phase, index) => {
          const colorClasses = {
            red: 'border-red-200 bg-red-50',
            yellow: 'border-yellow-200 bg-yellow-50',
            purple: 'border-purple-200 bg-purple-50',
          };
          const colorClass = colorClasses[phase.color] || colorClasses.red;
          return (
            <div key={phase.id || index} className={`rounded-lg border p-6 ${colorClass}`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Phase {index + 1}</h3>
                <button
                  onClick={() => handleDeletePhase(phase.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Phase Name
                    </label>
                    <input
                      type="text"
                      value={phase.name || ''}
                      onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                      placeholder="e.g., Foundation"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Weeks
                    </label>
                    <input
                      type="text"
                      value={phase.weeks || ''}
                      onChange={(e) => handleUpdatePhase(phase.id, { weeks: e.target.value })}
                      placeholder="e.g., 1-3"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Goal</label>
                  <textarea
                    value={phase.goal || ''}
                    onChange={(e) => handleUpdatePhase(phase.id, { goal: e.target.value })}
                    placeholder="Phase goal..."
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">
                      Deliverables
                    </label>
                    <button
                      onClick={() => handleAddDeliverable(phase.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(phase.deliverables || []).map((deliverable, delIndex) => (
                      <div key={delIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={deliverable}
                          onChange={(e) =>
                            handleUpdateDeliverable(phase.id, delIndex, e.target.value)
                          }
                          placeholder="e.g., 3 Target Personas"
                          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => handleRemoveDeliverable(phase.id, delIndex)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">
                      Core Work
                    </label>
                    <button
                      onClick={() => handleAddCoreWork(phase.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(phase.coreWork || []).map((work, workIndex) => (
                      <div key={workIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={work}
                          onChange={(e) =>
                            handleUpdateCoreWork(phase.id, workIndex, e.target.value)
                          }
                          placeholder="e.g., Configure IgniteBD CRM + domain layer"
                          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => handleRemoveCoreWork(phase.id, workIndex)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Outcome
                  </label>
                  <textarea
                    value={phase.outcome || ''}
                    onChange={(e) => handleUpdatePhase(phase.id, { outcome: e.target.value })}
                    placeholder="Expected outcome..."
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => onSave(localPhases)}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save All
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// Milestones Inline Editor Component
function MilestonesInlineEditor({ milestones, phases, onSave, onCancel, saving }) {
  const [localMilestones, setLocalMilestones] = useState(milestones || []);

  const handleAddMilestone = () => {
    const nextWeek = localMilestones.length > 0 
      ? Math.max(...localMilestones.map(m => m.week || 0)) + 1
      : 1;
    setLocalMilestones([
      ...localMilestones,
      {
        week: nextWeek,
        phase: phases[0]?.name || '',
        phaseColor: phases[0]?.color || 'red',
        milestone: '',
        deliverable: '',
        completed: false,
      },
    ]);
  };

  const handleUpdateMilestone = (index, updates) => {
    const updated = [...localMilestones];
    updated[index] = { ...updated[index], ...updates };
    setLocalMilestones(updated);
  };

  const handleDeleteMilestone = (index) => {
    if (!confirm('Delete this milestone?')) return;
    setLocalMilestones(localMilestones.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {localMilestones.length} {localMilestones.length === 1 ? 'milestone' : 'milestones'}
        </p>
        <button
          onClick={handleAddMilestone}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </button>
      </div>

      <div className="space-y-4">
        {localMilestones.map((milestone, index) => (
          <div key={index} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Milestone {index + 1}</h3>
              <button
                onClick={() => handleDeleteMilestone(index)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Week</label>
                  <input
                    type="number"
                    value={milestone.week || index + 1}
                    onChange={(e) =>
                      handleUpdateMilestone(index, { week: parseInt(e.target.value) || index + 1 })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Phase Color
                  </label>
                  <select
                    value={milestone.phaseColor || 'red'}
                    onChange={(e) => handleUpdateMilestone(index, { phaseColor: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="red">Red</option>
                    <option value="yellow">Yellow</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Phase</label>
                <input
                  type="text"
                  value={milestone.phase || ''}
                  onChange={(e) => handleUpdateMilestone(index, { phase: e.target.value })}
                  placeholder="Phase name"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Milestone Name
                </label>
                <input
                  type="text"
                  value={milestone.milestone || ''}
                  onChange={(e) => handleUpdateMilestone(index, { milestone: e.target.value })}
                  placeholder="e.g., Kickoff Meeting"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Deliverable
                </label>
                <textarea
                  value={milestone.deliverable || ''}
                  onChange={(e) => handleUpdateMilestone(index, { deliverable: e.target.value })}
                  placeholder="What will be delivered..."
                  rows={2}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => onSave(localMilestones)}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save All
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// Compensation Editor Component
function CompensationEditor({ compensation, totalPrice, onSave, onCancel, saving }) {
  const [currency, setCurrency] = useState(compensation?.currency || 'USD');
  const [total, setTotal] = useState(totalPrice || compensation?.total || 0);
  const [paymentStructure, setPaymentStructure] = useState(compensation?.paymentStructure || '');
  const [payments, setPayments] = useState(
    compensation?.payments || [
      { id: '1', amount: totalPrice || 0, trigger: 'Kickoff', status: 'pending' },
    ]
  );

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      {
        id: `payment-${Date.now()}`,
        amount: 0,
        trigger: '',
        description: '',
        status: 'pending',
      },
    ]);
  };

  const handleUpdatePayment = (index, field, value) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };
    setPayments(updated);
  };

  const handleRemovePayment = (index) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    onSave({
      total: totalAmount || total,
      currency,
      paymentStructure: paymentStructure || `${payments.length} × $${Math.round((totalAmount || total) / payments.length)}`,
      payments,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Total Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Payment Structure Description
        </label>
        <input
          type="text"
          value={paymentStructure}
          onChange={(e) => setPaymentStructure(e.target.value)}
          placeholder="e.g., 3 × $500 payments"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Payment Schedule</h3>
          <button
            onClick={handleAddPayment}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            <Plus className="h-3 w-3" />
            Add Payment
          </button>
        </div>
        <div className="space-y-3">
          {payments.map((payment, index) => (
            <div
              key={payment.id || index}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      value={payment.amount || 0}
                      onChange={(e) =>
                        handleUpdatePayment(index, 'amount', parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded border border-gray-300 pl-6 pr-2 py-1.5 text-sm"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Trigger/Description
                  </label>
                  <input
                    type="text"
                    value={payment.trigger || payment.description || ''}
                    onChange={(e) =>
                      handleUpdatePayment(index, 'trigger', e.target.value)
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="e.g., Kickoff, Milestone 1"
                  />
                </div>
              </div>
              {payments.length > 1 && (
                <button
                  onClick={() => handleRemovePayment(index)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove Payment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

