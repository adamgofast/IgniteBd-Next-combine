'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ContactSelector from '@/components/ContactSelector';
import { WORK_PACKAGE_ITEM_TYPES } from '@/lib/config/workPackageConfig';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import {
  FileText,
  UserCircle,
  Globe,
  Presentation,
  Target,
  FileCheck,
  Package,
  Loader,
} from 'lucide-react';

/**
 * Create Deliverables Page
 * 
 * UX Flow:
 * 1. Choose contact
 * 2. Choose workpackage (from that contact)
 * 3. Show Azure-style button grid of deliverable types
 * 4. Route to appropriate builder with workpackage context
 */

// Map deliverable types to icons and builder routes
const DELIVERABLE_TYPE_CONFIG = {
  persona: {
    label: 'Persona',
    icon: UserCircle,
    builderPath: '/builder/persona',
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  blog: {
    label: 'Blog',
    icon: FileText,
    builderPath: '/builder/blog',
    color: 'bg-green-600 hover:bg-green-700',
  },
  page: {
    label: 'Ecosystem',
    icon: Globe,
    builderPath: '/builder/landingpage',
    color: 'bg-purple-600 hover:bg-purple-700',
  },
  deck: {
    label: 'Presentation Deck',
    icon: Presentation,
    builderPath: '/builder/cledeck',
    color: 'bg-orange-600 hover:bg-orange-700',
  },
  template: {
    label: 'Outreach Template',
    icon: FileCheck,
    builderPath: '/builder/template',
    color: 'bg-indigo-600 hover:bg-indigo-700',
  },
  event_targets: {
    label: 'Event Targets',
    icon: Target,
    builderPath: '/builder/event',
    color: 'bg-pink-600 hover:bg-pink-700',
  },
};

export default function CreateDeliverablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState(null);
  const [workPackages, setWorkPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingWorkPackages, setLoadingWorkPackages] = useState(false);

  // Initialize from query params if provided
  useEffect(() => {
    const contactId = searchParams.get('contactId');
    const workPackageId = searchParams.get('workPackageId');

    if (contactId) {
      // Load contact and work packages
      loadContactAndWorkPackages(contactId, workPackageId);
    }
  }, [searchParams]);

  // Load workpackages when contact is selected
  useEffect(() => {
    if (selectedContact?.id) {
      loadWorkPackages(selectedContact.id);
    } else {
      setWorkPackages([]);
      setSelectedWorkPackage(null);
    }
  }, [selectedContact]);

  const loadContactAndWorkPackages = async (contactId, workPackageId) => {
    try {
      // Load contact
      const contactResponse = await api.get(`/api/contacts/${contactId}`);
      if (contactResponse.data?.success && contactResponse.data.contact) {
        setSelectedContact(contactResponse.data.contact);
      }

      // Load work packages
      const wpResponse = await api.get(`/api/workpackages?contactId=${contactId}`);
      if (wpResponse.data?.success && wpResponse.data.workPackages) {
        setWorkPackages(wpResponse.data.workPackages);
        
        // Pre-select work package if provided
        if (workPackageId) {
          const wp = wpResponse.data.workPackages.find((wp) => wp.id === workPackageId);
          if (wp) {
            setSelectedWorkPackage(wp);
          }
        } else if (wpResponse.data.workPackages.length === 1) {
          setSelectedWorkPackage(wpResponse.data.workPackages[0]);
        }
      }
    } catch (error) {
      console.error('Error loading contact/work packages:', error);
    }
  };

  const loadWorkPackages = async (contactId) => {
    try {
      setLoadingWorkPackages(true);
      const response = await api.get(`/api/workpackages?contactId=${contactId}`);
      
      if (response.data?.success && response.data.workPackages) {
        setWorkPackages(response.data.workPackages);
        // Auto-select if only one workpackage
        if (response.data.workPackages.length === 1) {
          setSelectedWorkPackage(response.data.workPackages[0]);
        }
      } else {
        setWorkPackages([]);
      }
    } catch (error) {
      console.error('Error loading workpackages:', error);
      setWorkPackages([]);
    } finally {
      setLoadingWorkPackages(false);
    }
  };

  const handleDeliverableClick = async (deliverableType) => {
    if (!selectedWorkPackage) {
      alert('Please select a work package first');
      return;
    }

    setLoading(true);

    try {
      // Find or create workpackage item for this deliverable type
      const workPackage = selectedWorkPackage;
      
      // Get the first phase (or create one if none exists)
      let phaseId = null;
      if (workPackage.phases && workPackage.phases.length > 0) {
        phaseId = workPackage.phases[0].id;
      } else {
        // Need to create a phase - we'll use the hydration service via API
        // For now, we'll need to reload workpackage to get the phase
        // Alternative: create phase via API if endpoint exists, or just use first phase requirement
        throw new Error('Work package must have at least one phase. Please add a phase to the work package first.');
      }

      if (!phaseId) {
        throw new Error('Failed to get phase');
      }

      // Check if item already exists for this type in this phase
      const config = DELIVERABLE_TYPE_CONFIG[deliverableType];
      const deliverableLabel = config.label;
      
      // Reload workpackage to get latest phases/items
      const workPackageResponse = await api.get(`/api/workpackages?id=${workPackage.id}`);
      const latestWorkPackage = workPackageResponse.data?.success ? workPackageResponse.data.workPackage : workPackage;
      
      // Try to find existing item
      let itemId = null;
      const phases = latestWorkPackage?.phases || [];
      for (const phase of phases) {
        if (phase.id === phaseId) {
          const item = phase.items?.find(
            (i) => (i.deliverableType === deliverableType || i.deliverableType === deliverableType.toUpperCase() ||
                    i.itemType === deliverableType || i.itemType === deliverableType.toUpperCase()) &&
                   (i.deliverableLabel === deliverableLabel || i.itemLabel === deliverableLabel)
          );
          if (item) {
            itemId = item.id;
            break;
          }
        }
      }

      // If no existing item, create one using legacy API format
      if (!itemId) {
        const itemResponse = await api.post('/api/workpackages/items', {
          workPackageId: workPackage.id,
          workPackagePhaseId: phaseId,
          itemType: deliverableType, // Legacy field
          itemLabel: deliverableLabel, // Legacy field
          quantity: 1,
          unitOfMeasure: deliverableType === 'persona' ? 'persona' : 'unit',
          duration: 2,
          status: 'todo',
        });

        if (itemResponse.data?.success) {
          itemId = itemResponse.data.item.id;
        } else {
          throw new Error(itemResponse.data?.error || 'Failed to create workpackage item');
        }
      }

      // Route to builder with context
      const builderConfig = DELIVERABLE_TYPE_CONFIG[deliverableType];
      const builderUrl = `${builderConfig.builderPath}/new?workPackageId=${workPackage.id}&itemId=${itemId}`;
      router.push(builderUrl);
    } catch (error) {
      console.error('Error creating deliverable:', error);
      alert(error.response?.data?.error || error.message || 'Failed to create deliverable');
      setLoading(false);
    }
  };

  const readyToBuild = selectedContact && selectedWorkPackage && !loading;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Deliverables"
          subtitle="Select a contact and work package, then choose what to build"
          backTo="/client-operations"
          backLabel="Back to Client Operations"
        />

        <div className="mt-8 space-y-8">
          {/* Step 1: Select Contact */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Step 1: Select Contact</h2>
            <ContactSelector
              onContactChange={(contact) => {
                setSelectedContact(contact);
                setSelectedWorkPackage(null);
              }}
              selectedContact={selectedContact}
            />
          </div>

          {/* Step 2: Select Work Package */}
          {selectedContact && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Step 2: Select Work Package</h2>
              {loadingWorkPackages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading work packages...</span>
                </div>
              ) : workPackages.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    No work packages found for this contact. Please create a work package first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workPackages.map((wp) => (
                    <button
                      key={wp.id}
                      onClick={() => setSelectedWorkPackage(wp)}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                        selectedWorkPackage?.id === wp.id
                          ? 'border-red-600 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{wp.title || 'Untitled Work Package'}</h3>
                          {wp.description && (
                            <p className="mt-1 text-sm text-gray-600">{wp.description}</p>
                          )}
                        </div>
                        {selectedWorkPackage?.id === wp.id && (
                          <div className="h-2 w-2 rounded-full bg-red-600"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Choose Deliverable Type */}
          {readyToBuild && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-6 text-lg font-semibold text-gray-900">Step 3: Choose What to Build</h2>
              
              {/* Azure-style button grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {WORK_PACKAGE_ITEM_TYPES.map((item) => {
                  const config = DELIVERABLE_TYPE_CONFIG[item.type];
                  if (!config) return null;

                  const Icon = config.icon;

                  return (
                    <button
                      key={item.type}
                      onClick={() => handleDeliverableClick(item.type)}
                      disabled={loading}
                      className={`group relative flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 p-8 text-center transition-all hover:border-gray-400 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        config.color || 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="mb-4 h-12 w-12 text-white" />
                      <span className="text-lg font-semibold text-white">{config.label}</span>
                      {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                          <Loader className="h-6 w-6 animate-spin text-gray-600" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Clicking a deliverable type will create or find the corresponding work package item and take you to the builder.
                  Artifacts will be automatically linked to the work package when you save.
                </p>
              </div>
            </div>
          )}

          {/* Selected Info Summary */}
          {selectedWorkPackage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Build</h3>
                  <p className="text-sm text-green-700">
                    {selectedContact?.firstName} {selectedContact?.lastName} • {selectedWorkPackage.title}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

