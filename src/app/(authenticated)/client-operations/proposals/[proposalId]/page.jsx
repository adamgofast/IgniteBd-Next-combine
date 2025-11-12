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
              {proposal.status !== 'approved' && (
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-gray-100 disabled:opacity-50"
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

      {/* Single Page Scroll Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Purpose Section */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-6 w-6 text-red-600" />
              Purpose
            </h2>
            {editing !== 'purpose' && (
              <button
                onClick={() => setEditing('purpose')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            )}
          </div>
          {editing === 'purpose' ? (
            <div className="space-y-3">
              <textarea
                value={localData?.purpose || ''}
                onChange={(e) =>
                  setLocalData((prev) => ({ ...prev, purpose: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                rows={4}
                placeholder="Define the purpose and goals of this proposal..."
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
            <p className="text-gray-700 leading-relaxed">
              {proposal.purpose || 'No purpose defined. Click Edit to add one.'}
            </p>
          )}
        </section>

        {/* Services Section */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-6 w-6 text-red-600" />
              Services
            </h2>
            <button
              onClick={() =>
                router.push(
                  `/client-operations/proposals/${params.proposalId}/services`,
                )
              }
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Manage Services
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
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
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No services added yet.</p>
              <button
                onClick={() =>
                  router.push(
                    `/client-operations/proposals/${params.proposalId}/services`,
                  )
                }
                className="mt-4 text-red-600 hover:text-red-700 font-semibold"
              >
                Add Services →
              </button>
            </div>
          )}
        </section>

        {/* Scope of Work - Phases */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-red-600" />
              Scope of Work
            </h2>
            {editing !== 'phases' && (
              <button
                onClick={() => setEditing('phases')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            )}
          </div>
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
                    {phase.deliverables && Array.isArray(phase.deliverables) && (
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
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No phases defined yet.</p>
              <p className="text-sm mt-2">
                Phases define the scope of work and deliverables.
              </p>
            </div>
          )}
        </section>

        {/* Compensation Section */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-red-600" />
              Compensation
            </h2>
            {editing !== 'compensation' && (
              <button
                onClick={() => setEditing('compensation')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            )}
          </div>
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
        </section>

        {/* Timeline - Milestones */}
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-6 w-6 text-red-600" />
              Timeline & Milestones
            </h2>
            {editing !== 'milestones' && (
              <button
                onClick={() => setEditing('milestones')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            )}
          </div>
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
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No milestones defined yet.</p>
              <p className="text-sm mt-2">
                Milestones help track progress through the engagement.
              </p>
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

