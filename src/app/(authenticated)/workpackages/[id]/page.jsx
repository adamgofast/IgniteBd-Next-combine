'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package, Eye, EyeOff, Mail, Edit, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { getItemTypeLabel } from '@/lib/config/workPackageConfig';

/**
 * WorkPackage Detail Page
 * Supports Owner View (default) and Client View Preview
 */
export default function WorkPackagePage() {
  const params = useParams();
  const router = useRouter();
  const workPackageId = params.id;
  
  const [workPackage, setWorkPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('owner'); // 'owner' | 'client'
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const handleSendToClient = async () => {
    if (!workPackage?.contact?.email) {
      alert('Client email not found');
      return;
    }

    if (!confirm(`Send work package to ${workPackage.contact.firstName} ${workPackage.contact.lastName}?`)) {
      return;
    }

    try {
      setSendingEmail(true);
      
      // Generate client portal link (you'll need to implement this route)
      const clientPortalUrl = `${window.location.origin}/client/workpackages/${workPackageId}`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Your Work Package</h2>
          <p>Hi ${workPackage.contact.firstName},</p>
          <p>We've prepared your work package. You can view the details and track progress here:</p>
          <p style="margin: 20px 0;">
            <a href="${clientPortalUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Work Package
            </a>
          </p>
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br>IgniteBD Team</p>
        </div>
      `;

      const response = await api.post('/api/email/send', {
        to: workPackage.contact.email,
        toName: `${workPackage.contact.firstName} ${workPackage.contact.lastName}`,
        subject: `Your Work Package: ${workPackage.title || 'Work Package'}`,
        html: emailHtml,
      });

      if (response.data?.success) {
        alert('Work package sent to client successfully!');
        // TODO: Log activity to database
      } else {
        alert('Failed to send email: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingEmail(false);
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

  // Calculate total estimated hours
  const totalEstimatedHours = workPackage.phases?.reduce((sum, phase) => {
    return sum + (phase.totalEstimatedHours || 0);
  }, 0) || 0;

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
            <h1 className="text-3xl font-bold text-gray-900">
              {workPackage.title || 'Work Package'}
            </h1>
            {workPackage.contact && (
              <p className="mt-1 text-gray-600">
                Client: {workPackage.contact.firstName} {workPackage.contact.lastName}
                {workPackage.contact.contactCompany?.companyName && (
                  <span> • {workPackage.contact.contactCompany.companyName}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'owner' ? (
              <>
                <button
                  onClick={() => setViewMode('client')}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  View as Client
                </button>
                <button
                  onClick={handleSendToClient}
                  disabled={sendingEmail || !workPackage.contact?.email}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="h-4 w-4" />
                  {sendingEmail ? 'Sending...' : 'Send to Client'}
                </button>
                <Link
                  href={`/workpackages/bulk-upload?contactId=${workPackage.contactId}`}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Items
                </Link>
              </>
            ) : (
              <button
                onClick={() => setViewMode('owner')}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <EyeOff className="h-4 w-4" />
                Back to Owner View
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'owner' ? (
          <OwnerView workPackage={workPackage} workPackageId={workPackageId} />
        ) : (
          <ClientViewPreview workPackage={workPackage} />
        )}
      </div>
    </div>
  );
}

/**
 * Owner View - Full editing mode with all internal fields
 */
function OwnerView({ workPackage, workPackageId }) {
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

  // Calculate total estimated hours for this view
  const totalEstimatedHours = workPackage.phases?.reduce((sum, phase) => {
    return sum + (phase.totalEstimatedHours || 0);
  }, 0) || 0;

  return (
    <>
      {/* Work Package Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {workPackage.description && (
              <p className="text-gray-600 mb-4">{workPackage.description}</p>
            )}
            <div className="flex items-center gap-6 text-sm">
              {workPackage.totalCost && (
                <div>
                  <span className="text-gray-500">Total Cost: </span>
                  <span className="font-semibold text-gray-900">
                    ${workPackage.totalCost.toLocaleString()}
                  </span>
                </div>
              )}
              {totalEstimatedHours > 0 && (
                <div>
                  <span className="text-gray-500">Total Hours: </span>
                  <span className="font-semibold text-gray-900">
                    {totalEstimatedHours}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phases - Hierarchical View */}
      {workPackage.phases && workPackage.phases.length > 0 ? (
        <div className="space-y-6">
          {workPackage.phases.map((phase) => (
            <div key={phase.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{phase.name}</h2>
                  {phase.description && (
                    <p className="mt-1 text-sm text-gray-600">{phase.description}</p>
                  )}
                  {phase.totalEstimatedHours && (
                    <p className="mt-1 text-xs text-gray-500">
                      Estimated Hours: {phase.totalEstimatedHours}
                    </p>
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
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-semibold text-gray-900">
                                {item.deliverableLabel || item.itemLabel}
                              </h3>
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                {getItemTypeLabel(item.deliverableType || item.itemType)}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </div>
                            
                            {/* Internal Fields (Owner Only) */}
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                              <span>Type: {item.deliverableType || item.itemType}</span>
                              {item.estimatedHoursEach && (
                                <span>Hours Each: {item.estimatedHoursEach}</span>
                              )}
                              <span>Unit: {item.unitOfMeasure}</span>
                            </div>

                            {(item.deliverableDescription || item.itemDescription) && (
                              <p className="mt-2 text-sm text-gray-600">
                                {item.deliverableDescription || item.itemDescription}
                              </p>
                            )}
                            
                            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                              <span>Quantity: {item.quantity}</span>
                              <span>
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
                          <div className="ml-4 flex items-center gap-2">
                            <Link
                              href={`/workpackages/${workPackageId}/items/${item.id}`}
                              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                            <button
                              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                          </div>
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
                          <h3 className="font-semibold text-gray-900">
                            {item.deliverableLabel || item.itemLabel}
                          </h3>
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            {getItemTypeLabel(item.deliverableType || item.itemType)}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>Type: {item.deliverableType || item.itemType}</span>
                          {item.estimatedHoursEach && (
                            <span>Hours Each: {item.estimatedHoursEach}</span>
                          )}
                          <span>Unit: {item.unitOfMeasure}</span>
                        </div>
                        {(item.deliverableDescription || item.itemDescription) && (
                          <p className="mt-2 text-sm text-gray-600">
                            {item.deliverableDescription || item.itemDescription}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                          <span>Quantity: {item.quantity}</span>
                          <span>
                            Progress: {progress.completed} / {progress.total} ({progress.percentage}%)
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/workpackages/${workPackageId}/items/${item.id}`}
                        className="ml-4 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Client View Preview - Clean, read-only display
 */
function ClientViewPreview({ workPackage }) {
  const getProgressForItem = (item) => {
    const completed = item.collateral?.length || 0;
    const total = item.quantity;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Complete';
      case 'in_progress':
        return 'In Progress';
      case 'not_started':
        return 'Not Started';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Work Package Overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {workPackage.title || 'Work Package'}
        </h2>
        {workPackage.description && (
          <p className="text-gray-600">{workPackage.description}</p>
        )}
      </div>

      {/* Phases */}
      {workPackage.phases && workPackage.phases.length > 0 ? (
        <div className="space-y-6">
          {workPackage.phases.map((phase) => (
            <div key={phase.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{phase.name}</h2>
                {phase.description && (
                  <p className="mt-2 text-gray-600">{phase.description}</p>
                )}
              </div>

              {/* Items in Phase */}
              {phase.items && phase.items.length > 0 ? (
                <div className="space-y-4">
                  {phase.items.map((item) => {
                    const progress = getProgressForItem(item);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {item.deliverableLabel || item.itemLabel}
                            </h3>
                            
                            {item.deliverableDescription && (
                              <p className="mt-2 text-gray-600">
                                {item.deliverableDescription}
                              </p>
                            )}
                            
                            <div className="mt-4 flex items-center gap-6">
                              <div>
                                <span className="text-sm text-gray-500">Quantity: </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {item.quantity}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm text-gray-500">Progress: </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {progress.completed} of {progress.total} complete
                                </span>
                              </div>
                              <div>
                                <span className={`text-sm font-semibold ${progress.percentage === 100 ? 'text-green-600' : progress.percentage > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                                  {getStatusLabel(item.status)}
                                </span>
                              </div>
                            </div>
                            
                            {progress.total > 0 && (
                              <div className="mt-3">
                                <div className="h-2 w-full rounded-full bg-gray-200">
                                  <div
                                    className={`h-2 rounded-full ${
                                      progress.percentage === 100 ? 'bg-green-600' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${progress.percentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
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
        </div>
      )}

      {/* Note: Items without phase are not shown in client view */}
    </div>
  );
}
