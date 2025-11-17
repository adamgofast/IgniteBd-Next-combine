'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import ContactSelector from '@/components/ContactSelector.jsx';
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

/**
 * Work Package Assembler - Templates Flow
 * Choose phases and deliverables from templates
 */
function WorkPackageAssemblerTemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactIdFromParams = searchParams.get('contactId');

  const [phaseTemplates, setPhaseTemplates] = useState([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState([]);
  const [selectedPhases, setSelectedPhases] = useState([]); // [{ phaseTemplateId, position, deliverables: [{ deliverableType, itemLabel, quantity, duration, unitOfMeasure }] }]
  const [contactId, setContactId] = useState(contactIdFromParams || '');
  const [companyId, setCompanyId] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (contactIdFromParams) {
      setContactId(contactIdFromParams);
    }
  }, [contactIdFromParams]);

  useEffect(() => {
    if (contactId) {
      loadTemplates();
    }
  }, [contactId]);

  const loadTemplates = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      
      // Get companyHQId from localStorage
      const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
      
      if (!companyHQId) {
        setError('CompanyHQ ID not found');
        return;
      }
      
      const [phasesRes, deliverablesRes] = await Promise.all([
        api.get(`/api/templates/phases?companyHQId=${companyHQId}`),
        api.get(`/api/templates/deliverables?companyHQId=${companyHQId}`),
      ]);

      if (phasesRes.data?.success) {
        setPhaseTemplates(phasesRes.data.phaseTemplates || []);
      }
      if (deliverablesRes.data?.success) {
        setDeliverableTemplates(deliverablesRes.data.deliverableTemplates || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhase = (phaseTemplate) => {
    const newPhase = {
      phaseTemplateId: phaseTemplate.id,
      position: selectedPhases.length + 1,
      name: phaseTemplate.name,
      deliverables: [],
    };
    setSelectedPhases([...selectedPhases, newPhase]);
  };

  const handleRemovePhase = (index) => {
    const updated = selectedPhases.filter((_, i) => i !== index);
    // Reorder positions
    updated.forEach((phase, i) => {
      phase.position = i + 1;
    });
    setSelectedPhases(updated);
  };

  const handleMovePhase = (index, direction) => {
    const updated = [...selectedPhases];
    if (direction === 'up' && index > 0) {
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    } else if (direction === 'down' && index < updated.length - 1) {
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    }
    // Reorder positions
    updated.forEach((phase, i) => {
      phase.position = i + 1;
    });
    setSelectedPhases(updated);
  };

  const handleAddDeliverable = (phaseIndex, deliverableTemplate) => {
    const updated = [...selectedPhases];
    updated[phaseIndex].deliverables.push({
      deliverableType: deliverableTemplate.deliverableType,
      deliverableTemplateId: deliverableTemplate.id, // Store template ID for reference
      itemLabel: deliverableTemplate.deliverableLabel,
      quantity: 1,
      unitOfMeasure: deliverableTemplate.defaultUnitOfMeasure,
      duration: deliverableTemplate.defaultDuration,
    });
    setSelectedPhases(updated);
  };

  const handleRemoveDeliverable = (phaseIndex, deliverableIndex) => {
    const updated = [...selectedPhases];
    updated[phaseIndex].deliverables = updated[phaseIndex].deliverables.filter(
      (_, i) => i !== deliverableIndex
    );
    setSelectedPhases(updated);
  };

  const handleUpdateDeliverable = (phaseIndex, deliverableIndex, field, value) => {
    const updated = [...selectedPhases];
    updated[phaseIndex].deliverables[deliverableIndex][field] = value;
    setSelectedPhases(updated);
  };

  const handleSave = async () => {
    if (selectedPhases.length === 0) {
      setError('Please add at least one phase');
      return;
    }

    if (!contactId) {
      setError('Please select a contact');
      return;
    }

    if (typeof window === 'undefined') {
      setError('Cannot save in server environment');
      return;
    }
    
    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // TODO: Create work package API endpoint for templates
      // For now, redirect to blank creation with contact pre-selected
      router.push(`/workpackages/blank?contactId=${contactId}&companyId=${companyId}`);
      
      // Future: When work package assemble API exists:
      // const response = await api.post('/api/workpackages/assemble', {
      //   contactId,
      //   companyHQId,
      //   companyId,
      //   title: prompt('Enter work package title:') || 'New Work Package',
      //   description: null,
      //   totalCost: null,
      //   assemblyType: 'templates',
      //   data: {
      //     phases: selectedPhases,
      //   },
      // });
      // if (response.data?.success) {
      //   router.push(`/workpackages/${response.data.workPackage.id}`);
      // }
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setSaving(false);
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
        <PageHeader
          title="Build Work Package from Templates"
          subtitle="Choose phases and add deliverables"
          backTo="/workpackages"
          backLabel="Back to Work Packages"
        />

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Contact Selection */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Contact</h3>
          <div className="max-w-md">
            <ContactSelector
              onContactSelect={(contact, company) => {
                setSelectedContact(contact);
                setContactId(contact.id);
                setCompanyId(company?.id || '');
              }}
              selectedContact={selectedContact}
            />
          </div>
          {selectedContact && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-800">
                <strong>Selected:</strong> {selectedContact.firstName} {selectedContact.lastName}
                {selectedContact.contactCompany?.companyName && (
                  <span> • {selectedContact.contactCompany.companyName}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {!contactId && (
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">Please select a contact to continue</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Available Templates */}
          <div className="col-span-1 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Phase Templates</h2>
              <div className="space-y-2">
                {phaseTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleAddPhase(template)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-left hover:border-red-600 hover:bg-red-50 transition"
                  >
                    <p className="font-medium text-gray-900">{template.name}</p>
                    {template.description && (
                      <p className="mt-1 text-xs text-gray-600">{template.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Deliverable Templates</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {deliverableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <p className="font-medium text-gray-900">{template.deliverableLabel}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {template.defaultDuration} {template.defaultUnitOfMeasure}(s)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Phases */}
          <div className="col-span-2 space-y-4">
            {selectedPhases.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-gray-600">Add phases from the left to get started</p>
              </div>
            ) : (
              selectedPhases.map((phase, phaseIndex) => (
                <div key={phaseIndex} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                        Phase {phase.position}
                      </span>
                      <h3 className="text-xl font-semibold text-gray-900">{phase.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMovePhase(phaseIndex, 'up')}
                        disabled={phaseIndex === 0}
                        className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMovePhase(phaseIndex, 'down')}
                        disabled={phaseIndex === selectedPhases.length - 1}
                        className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemovePhase(phaseIndex)}
                        className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add Deliverables */}
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-gray-700">Add Deliverables:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {deliverableTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleAddDeliverable(phaseIndex, template)}
                          className="rounded border border-gray-300 bg-white p-2 text-left text-sm hover:border-red-600 hover:bg-red-50"
                        >
                          {template.deliverableLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Deliverables */}
                  {phase.deliverables.length > 0 && (
                    <div className="space-y-3">
                      {phase.deliverables.map((deliverable, delIndex) => (
                        <div key={delIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h5 className="font-medium text-gray-900">{deliverable.itemLabel}</h5>
                            <button
                              onClick={() => handleRemoveDeliverable(phaseIndex, delIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={deliverable.quantity}
                                onChange={(e) => handleUpdateDeliverable(phaseIndex, delIndex, 'quantity', parseInt(e.target.value))}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700">Duration</label>
                              <input
                                type="number"
                                min="1"
                                value={deliverable.duration}
                                onChange={(e) => handleUpdateDeliverable(phaseIndex, delIndex, 'duration', parseInt(e.target.value))}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700">Unit</label>
                              <select
                                value={deliverable.unitOfMeasure}
                                onChange={(e) => handleUpdateDeliverable(phaseIndex, delIndex, 'unitOfMeasure', e.target.value)}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              >
                                <option value="day">Day</option>
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            <button
              onClick={handleSave}
              disabled={saving || selectedPhases.length === 0 || !contactId}
              className="w-full rounded-lg bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Work Package'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkPackageAssemblerTemplatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <WorkPackageAssemblerTemplatesContent />
    </Suspense>
  );
}

