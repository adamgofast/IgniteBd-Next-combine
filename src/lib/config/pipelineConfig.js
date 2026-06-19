/**
 * PIPELINE CONFIGURATION FOR IGNITEBD
 * Single source of truth for Contact pipelines and stages
 * Based on Contact-First Architecture with Pipeline model
 *
 * Pipeline Types: unassigned, connector, prospect, client, collaborator, institution, friend
 * friend = "just a dude" — e.g. awaiting next job, navigating; when they get a job → connector
 */

// OFFICIAL PIPELINE TYPES
export const OFFICIAL_PIPELINES = [
  'unassigned',   // Default — not yet categorized; created but no role assigned
  'no-role',      // Intentional — in the ecosystem but no active buyer path (e.g. referred you out, gatekeeper)
  'connector',    // Warm intro to a buyer: said they'd forward, or intro made
  'prospect',
  'client',
  'collaborator',
  'institution',
  'friend',       // Not a buyer; e.g. awaiting next job, navigating → when they get a job, move to connector
];

// ALL POSSIBLE STAGES
export const ALL_STAGES = [
  // Prospect stages
  'need-to-engage',  // Contact in CRM but hasn't been emailed yet
  'not-now',         // Prospect but not now (e.g. said not now, try later)
  'engaged-awaiting-response',  // Outreach sent, waiting for response (action taken)
  'interest',
  'meeting',
  'proposal',
  'contract',
  'contract-signed',  // Conversion point → becomes client
  // Client stages
  'kickoff',
  'work-started',
  'work-delivered',
  'sustainment',
  'renewal',
  'terminated-contract',
  // Collaborator stages
  'interest',
  'meeting',
  'moa',
  'agreement',
  // Institution stages
  'interest',
  'meeting',
  'moa',
  'agreement',
  // Connector stages (warm intro / forward path)
  'forwarded',                 // Said they'd forward or pass along
  'forwarded-not-interested',  // Forwarded but not interested
  'introduction-made',         // Introduction to the buyer has been made
  // Friend pipeline
  'awaiting_next_job',
  'navigating',
];

// PIPELINE-SPECIFIC STAGES
// Each pipeline type has its own stages
export const PIPELINE_STAGES = {
  'unassigned': [],     // Default — no stages (not yet categorized)
  'no-role': [],        // Intentional — no stages (in ecosystem, no active pipeline path)
  'connector': [
    'forwarded',                 // Said they'd forward / pass along (e.g. to internal counsel)
    'forwarded-not-interested',   // Forwarded but not interested
    'introduction-made'          // Introduction to the buyer has been made
  ],
  'prospect': [
    'need-to-engage',    // Contact in CRM but hasn't been emailed yet
    'not-now',           // Prospect but not now (e.g. said not now, try later)
    'engaged-awaiting-response',  // Outreach sent, waiting for response (action taken)
    'interest',          // Initial interest expressed
    'meeting',           // Meeting scheduled (on calendar)
    'proposal',          // Proposal sent
    'contract',          // Contract in progress
    'contract-signed'    // Contract signed → CONVERTS TO CLIENT
  ],
  'client': [
    'kickoff',           // Project kickoff
    'work-started',      // Work has started
    'work-delivered',    // Work delivered
    'sustainment',       // Sustainment phase
    'renewal',           // Renewal (upsell - starting new work)
    'terminated-contract' // Contract terminated
  ],
  'collaborator': [
    'interest',         // Initial interest
    'meeting',          // Meeting scheduled
    'moa',              // Memorandum of Agreement
    'agreement'         // Formal agreement
  ],
  'institution': [
    'interest',         // Initial interest
    'meeting',          // Meeting scheduled
    'moa',              // Memorandum of Agreement
    'agreement'         // Formal agreement
  ],
  'friend': [
    'awaiting_next_job',  // Between jobs; keep warm until they land
    'navigating',         // In transition; when they get a job → move to connector
  ],
};

// Validate pipeline type
export const isValidPipeline = (pipeline) => {
  return OFFICIAL_PIPELINES.includes(pipeline);
};

// Get stages for specific pipeline
export const getStagesForPipeline = (pipeline) => {
  return PIPELINE_STAGES[pipeline] || [];
};

// Validate stage for pipeline
export const isValidStageForPipeline = (stage, pipeline) => {
  // Unassigned and no-role pipelines don't use stages
  if (pipeline === 'unassigned' || pipeline === 'no-role') {
    return !stage || stage === null || stage === '';
  }
  const pipelineStages = getStagesForPipeline(pipeline);
  return pipelineStages.includes(stage);
};

// Get pipeline config for API response
export const getPipelineConfig = () => {
  return {
    pipelines: PIPELINE_STAGES,
    officialPipelines: OFFICIAL_PIPELINES,
    allStages: ALL_STAGES
  };
};

