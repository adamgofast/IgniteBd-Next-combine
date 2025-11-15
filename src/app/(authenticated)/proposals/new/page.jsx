'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Calendar, Save, Send, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { getContactsRegistry } from '@/lib/services/contactsRegistry';
import { formatPhaseDate } from '@/lib/services/ProposalTimelineService';

/**
 * Full-page Proposal Builder
 * Supports reusable phase & deliverable templates with custom overrides
 */
export default function NewProposalPage() {
  const router = useRouter();
  const [registry] = useState(() => getContactsRegistry());

  // CompanyHQ ID (from localStorage or context)
  const [companyHQId, setCompanyHQId] = useState('');
  
  // Proposal Details
  const [title, setTitle] = useState('');
  const [estimatedStart, setEstimatedStart] = useState('');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [purpose, setPurpose] = useState('');

  // Templates (hydrated on load)
  const [phaseTemplates, setPhaseTemplates] = useState([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Proposal Phases
  const [phases, setPhases] = useState([]);

  // Contact/Company Search
  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');

  // Preview State
  const [previewTimeline, setPreviewTimeline] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Submission
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load companyHQId and templates on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hqId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      setCompanyHQId(hqId);
      
      if (hqId) {
        loadTemplates(hqId);
        registry.loadFromCache();
      }
    }
  }, []);

  const loadTemplates = async (hqId) => {
    try {
      setLoadingTemplates(true);
      const response = await api.get(`/api/proposal-templates?companyHQId=${hqId}`);
      if (response.data?.success) {
        setPhaseTemplates(response.data.phases || []);
        setDeliverableTemplates(response.data.deliverables || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const availableContacts = useMemo(() => {
    if (!contactSearch || !contactSearch.trim()) {
      return registry.getAll().slice(0, 20);
    }
    return registry.search(contactSearch).slice(0, 20);
  }, [contactSearch, registry]);

  const handleAddPhase = () => {
    const newPhase = {
      id: `phase-${Date.now()}`,
      phaseTemplateId: null,
      name: '',
      description: '',
      durationWeeks: 3,
      order: phases.length + 1,
      deliverables: [],
    };
    setPhases([...phases, newPhase]);
  };

  const handleUpdatePhase = (phaseId, updates) => {
    setPhases(phases.map(p => 
      p.id === phaseId ? { ...p, ...updates } : p
    ));
  };

  const handleSelectPhaseTemplate = (phaseId, templateId) => {
    const template = phaseTemplates.find(t => t.id === templateId);
    if (!template) return;

    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    // Hydrate phase from template
    handleUpdatePhase(phaseId, {
      phaseTemplateId: templateId,
      name: template.name,
      description: template.description || '',
      durationWeeks: template.defaultDurationWeeks || 3,
      // Hydrate deliverables from template
      deliverables: template.phaseDeliverables?.map((pd, index) => ({
        id: `deliverable-${Date.now()}-${index}`,
        deliverableTemplateId: pd.deliverableTemplateId,
        name: pd.deliverableTemplate.name,
        description: pd.deliverableTemplate.description || '',
        quantity: pd.defaultQuantity || 1,
        order: index,
      })) || [],
    });
  };

  const handleAddDeliverable = (phaseId) => {
    const newDeliverable = {
      id: `deliverable-${Date.now()}`,
      deliverableTemplateId: null,
      name: '',
      description: '',
      quantity: 1,
      order: phases.find(p => p.id === phaseId)?.deliverables.length || 0,
    };
    
    setPhases(phases.map(p => 
      p.id === phaseId 
        ? { ...p, deliverables: [...(p.deliverables || []), newDeliverable] }
        : p
    ));
  };

  const handleUpdateDeliverable = (phaseId, deliverableId, updates) => {
    setPhases(phases.map(p => 
      p.id === phaseId
        ? {
            ...p,
            deliverables: p.deliverables.map(d =>
              d.id === deliverableId ? { ...d, ...updates } : d
            ),
          }
        : p
    ));
  };

  const handleSelectDeliverableTemplate = (phaseId, deliverableId, templateId) => {
    const template = deliverableTemplates.find(t => t.id === templateId);
    if (!template) return;

    handleUpdateDeliverable(phaseId, deliverableId, {
      deliverableTemplateId: templateId,
      name: template.name,
      description: template.description || '',
      quantity: template.defaultQuantity || 1,
    });
  };

  const handleRemovePhase = (phaseId) => {
    setPhases(phases.filter(p => p.id !== phaseId).map((p, index) => ({
      ...p,
      order: index + 1,
    })));
  };

  const handleRemoveDeliverable = (phaseId, deliverableId) => {
    setPhases(phases.map(p =>
      p.id === phaseId
        ? {
            ...p,
            deliverables: p.deliverables.filter(d => d.id !== deliverableId),
          }
        : p
    ));
  };

  const handlePreview = async () => {
    if (!estimatedStart) {
      setError('Please set an estimated start date');
      return;
    }

    if (phases.length === 0) {
      setError('Please add at least one phase');
      return;
    }

    try {
      setLoadingPreview(true);
      setError('');
      
      const response = await api.post('/api/proposals/new/preview', {
        estimatedStart,
        phases: phases.map(p => ({
          id: p.id,
          name: p.name,
          durationWeeks: p.durationWeeks,
        })),
      });

      if (response.data?.success) {
        setPreviewTimeline(response.data.timeline || []);
        setShowPreview(true);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to calculate timeline preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!title || !contactId || !companyId || !estimatedStart) {
      setError('Please fill in all required fields');
      return;
    }

    if (phases.length === 0) {
      setError('Please add at least one phase');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const response = await api.post('/api/proposals', {
        companyHQId,
        title,
        contactId,
        companyId,
        estimatedStart,
        purpose,
        phases: phases.map(p => ({
          phaseTemplateId: p.phaseTemplateId,
          name: p.name,
          description: p.description,
          durationWeeks: p.durationWeeks,
          order: p.order,
          deliverables: p.deliverables.map(d => ({
            deliverableTemplateId: d.deliverableTemplateId,
            name: d.name,
            description: d.description,
            quantity: d.quantity,
            order: d.order,
          })),
        })),
      });

      if (response.data?.success) {
        const newProposal = response.data.proposal;
        
        // Immediately save to localStorage (hydration pattern)
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('proposals');
          const existing = cached ? JSON.parse(cached) : [];
          const updated = [...existing, newProposal];
          window.localStorage.setItem('proposals', JSON.stringify(updated));
        }
        
        router.push(`/client-operations/proposals/${newProposal.id}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || 'Failed to save proposal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Proposal</h1>
          <p className="mt-2 text-gray-600">Build a proposal with reusable phases and deliverables</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Proposal Details */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Proposal Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Proposal Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Business Development Platform Proposal"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Estimated Start Date *
              </label>
              <input
                type="date"
                value={estimatedStart}
                onChange={(e) => setEstimatedStart(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Contact *
            </label>
            <div className="relative">
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
              {contactSearch && availableContacts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                  {availableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => {
                        setContactId(contact.id);
                        setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email);
                        if (contact.contactCompany) {
                          setCompanyId(contact.contactCompany.id);
                        }
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      {contact.firstName} {contact.lastName} {contact.email && `(${contact.email})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Purpose / Description
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the purpose of this proposal..."
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        {/* Phases */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Phases</h2>
            <button
              onClick={handleAddPhase}
              className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Phase
            </button>
          </div>

          {phases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              phaseNumber={index + 1}
              phaseTemplates={phaseTemplates}
              deliverableTemplates={deliverableTemplates}
              onUpdate={(updates) => handleUpdatePhase(phase.id, updates)}
              onSelectTemplate={(templateId) => handleSelectPhaseTemplate(phase.id, templateId)}
              onAddDeliverable={() => handleAddDeliverable(phase.id)}
              onUpdateDeliverable={(deliverableId, updates) =>
                handleUpdateDeliverable(phase.id, deliverableId, updates)
              }
              onSelectDeliverableTemplate={(deliverableId, templateId) =>
                handleSelectDeliverableTemplate(phase.id, deliverableId, templateId)
              }
              onRemoveDeliverable={(deliverableId) =>
                handleRemoveDeliverable(phase.id, deliverableId)
              }
              onRemove={() => handleRemovePhase(phase.id)}
            />
          ))}

          {phases.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No phases added yet</p>
              <button
                onClick={handleAddPhase}
                className="mt-4 text-red-600 hover:text-red-700"
              >
                + Add Your First Phase
              </button>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {showPreview && previewTimeline.length > 0 && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Timeline Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {previewTimeline.map((phase, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900">
                    Phase {index + 1}: {phase.name}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Start: {formatPhaseDate(phase.startDate)} → End: {formatPhaseDate(phase.endDate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePreview}
            disabled={loadingPreview || !estimatedStart || phases.length === 0}
            className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            Preview Timeline
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || !title || !contactId || !companyId || !estimatedStart}
            className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Phase Card Component
 */
function PhaseCard({
  phase,
  phaseNumber,
  phaseTemplates,
  deliverableTemplates,
  onUpdate,
  onSelectTemplate,
  onAddDeliverable,
  onUpdateDeliverable,
  onSelectDeliverableTemplate,
  onRemoveDeliverable,
  onRemove,
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <h3 className="text-lg font-semibold text-gray-900">Phase {phaseNumber}</h3>
        </div>
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* Phase Template Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Choose Phase Template (or create new)
            </label>
            <select
              value={phase.phaseTemplateId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectTemplate(e.target.value);
                } else {
                  onUpdate({ phaseTemplateId: null });
                }
              }}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">Create New Phase</option>
              {phaseTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Phase Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phase Name *
            </label>
            <input
              type="text"
              value={phase.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., Foundation, Enrichment, Integration"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Phase Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={phase.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Phase description..."
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Duration (Weeks) *
            </label>
            <input
              type="number"
              min="1"
              value={phase.durationWeeks}
              onChange={(e) => onUpdate({ durationWeeks: parseInt(e.target.value) || 3 })}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Deliverables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Deliverables
              </label>
              <button
                onClick={onAddDeliverable}
                className="text-sm text-red-600 hover:text-red-700"
              >
                + Add Deliverable
              </button>
            </div>

            <div className="space-y-3">
              {phase.deliverables?.map((deliverable) => (
                <DeliverableCard
                  key={deliverable.id}
                  deliverable={deliverable}
                  deliverableTemplates={deliverableTemplates}
                  onUpdate={(updates) => onUpdateDeliverable(deliverable.id, updates)}
                  onSelectTemplate={(templateId) =>
                    onSelectDeliverableTemplate(deliverable.id, templateId)
                  }
                  onRemove={() => onRemoveDeliverable(deliverable.id)}
                />
              ))}

              {(!phase.deliverables || phase.deliverables.length === 0) && (
                <p className="text-sm text-gray-500">No deliverables added yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Deliverable Card Component
 */
function DeliverableCard({
  deliverable,
  deliverableTemplates,
  onUpdate,
  onSelectTemplate,
  onRemove,
}) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-3">
          {/* Deliverable Template Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Choose Deliverable Template
            </label>
            <select
              value={deliverable.deliverableTemplateId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectTemplate(e.target.value);
                } else {
                  onUpdate({ deliverableTemplateId: null });
                }
              }}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Create New Deliverable</option>
              {deliverableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deliverable Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={deliverable.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., 3 Target Personas"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={deliverable.quantity}
                onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 1 })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="ml-3 text-red-600 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

