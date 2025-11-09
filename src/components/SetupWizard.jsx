'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

export default function SetupWizard({ companyHQ, hasContacts = false, onComplete }) {
  const router = useRouter();
  
  // Check what's been completed
  const hasCompany = companyHQ && companyHQ.id;
  const hasAssessment = false; // TODO: Check if assessment completed
  const hasOutreach = false; // TODO: Check if outreach setup
  
  const steps = [
    {
      id: 'company',
      title: 'Set Up Your Company',
      description: 'Company profile created',
      completed: hasCompany,
      route: '/company/create-or-choose',
      action: hasCompany ? 'View Profile' : 'Set Up Company'
    },
    {
      id: 'contacts',
      title: 'Add Your First Contacts',
      description: 'Start building your network',
      completed: hasContacts,
      route: '/contacts/upload', // Always route to upload page
      action: hasContacts ? 'Add More Contacts' : 'Add Contacts'
    },
    {
      id: 'assessment',
      title: 'Complete Growth Assessment',
      description: 'Understand your growth potential',
      completed: hasAssessment,
      route: '/assessment',
      action: 'Start Assessment'
    },
    {
      id: 'outreach',
      title: 'Set Up Outreach',
      description: 'Start nurturing relationships',
      completed: hasOutreach,
      route: '/outreach',
      action: 'Set Up Outreach'
    }
  ];
  
  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  
  // Hide wizard if all steps complete
  if (completedCount === totalSteps && onComplete) {
    return null;
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Getting Started</h2>
          <span className="text-xs text-gray-500">({completedCount}/{totalSteps})</span>
        </div>
        {/* Compact Progress Bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Compact Steps - Horizontal or Compact Vertical */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => router.push(step.route)}
            className={`relative flex items-center gap-2 p-2.5 rounded-md border transition-all text-left group ${
              step.completed
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : index === completedCount
                ? 'bg-blue-50 border-blue-300 hover:bg-blue-100 shadow-sm'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {/* Status Icon - Smaller */}
            <div className="flex-shrink-0">
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className={`h-4 w-4 ${index === completedCount ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
            </div>
            
            {/* Step Info - Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className={`text-xs font-medium truncate ${
                  step.completed ? 'text-green-900' : index === completedCount ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {step.title}
                </h3>
                {index === completedCount && !step.completed && (
                  <span className="px-1 py-0.5 bg-blue-200 text-blue-800 text-[10px] font-semibold rounded flex-shrink-0">
                    Next
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrow for next step */}
            {!step.completed && index === completedCount && (
              <ArrowRight className="h-3 w-3 text-blue-600 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      
      {/* Dismiss Button (if all complete) */}
      {completedCount === totalSteps && onComplete && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-center">
          <button
            onClick={onComplete}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Hide checklist
          </button>
        </div>
      )}
    </div>
  );
}

