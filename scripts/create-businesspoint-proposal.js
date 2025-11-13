/**
 * Script to create a test proposal for BusinessPoint Law
 * Run with: node scripts/create-businesspoint-proposal.js
 */

const BUSINESSPOINT_PROPOSAL = {
  clientName: "BusinessPoint Law Contact",
  clientCompany: "BusinessPoint Law",
  purpose: "To onboard BusinessPoint Law into the IgniteBD platform, establishing a complete business-development foundation centered on investor managers and deal teams who require NDA and contract support. This setup engagement builds the infrastructure, data enrichment, and automation workflows that power future outreach and visibility campaigns (including CLE).",
  phases: [
    {
      id: "phase-1",
      name: "Foundation",
      weeks: "1-3",
      color: "red",
      goal: "Stand up the IgniteBD environment and core strategy with key mapping.",
      deliverables: [
        "3 Target Personas (investor manager / corporate counsel / deal advisor)",
        "6 Outreach Templates (NDA & contract themes)",
        "6 Event / CLE Plans (through Summer 2026)",
        "5 SEO Blog Posts (\"NDAs & Contracts\" series)",
        "25-Slide CLE Deck NDAs Demystified",
        "CLE Landing Page + Lead-Gen Form for NDA inquiries"
      ],
      coreWork: [
        "Configure IgniteBD CRM + domain layer",
        "Build persona + contact architecture",
        "Develop messaging and content framework",
        "Launch SEO and blog scaffolding",
        "Integrate CLE and NDA funnels into one platform"
      ],
      outcome: "A structured IgniteBD workspace — branded, wired, and ready for data enrichment."
    },
    {
      id: "phase-2",
      name: "Enrichment & Automation Prep",
      weeks: "4-6",
      color: "yellow",
      goal: "Import, clean, and enrich contacts + connect automation with contacts and already drafted/approved content items.",
      deliverables: [],
      coreWork: [
        "Import contacts (LinkedIn, Outlook, client lists)",
        "Enrich records with titles, firm type, persona tags",
        "Segment lists by persona and funnel type",
        "Configure drip / nurture workflows + email templates",
        "Connect analytics dashboards and QA data flows"
      ],
      outcome: "An enriched contact ecosystem, fully connected inside IgniteBD."
    },
    {
      id: "phase-3",
      name: "Load & Launch Readiness",
      weeks: "7-9",
      color: "purple",
      goal: "Finalize the platform, load content + contacts, and ensure it's campaign-ready.",
      deliverables: [],
      coreWork: [
        "Upload all final templates, content, and personas",
        "Import final contact segments and verify automations",
        "QA email flows, dashboards, and lead routing",
        "Document handoff and train on workflow management"
      ],
      outcome: "A complete IgniteBD instance — fully loaded, automated, and ready for live engagement."
    }
  ],
  milestones: [
    {
      week: 1,
      phase: "Foundation",
      phaseColor: "red",
      milestone: "Kickoff & Setup",
      deliverable: "IgniteBD environment configured"
    },
    {
      week: 3,
      phase: "Foundation",
      phaseColor: "red",
      milestone: "Foundation Complete",
      deliverable: "All personas, templates, and content framework ready"
    },
    {
      week: 4,
      phase: "Enrichment & Automation Prep",
      phaseColor: "yellow",
      milestone: "Contact Import",
      deliverable: "Contacts imported and enriched"
    },
    {
      week: 6,
      phase: "Enrichment & Automation Prep",
      phaseColor: "yellow",
      milestone: "Automation Connected",
      deliverable: "Workflows and templates configured"
    },
    {
      week: 7,
      phase: "Load & Launch Readiness",
      phaseColor: "purple",
      milestone: "Content Loaded",
      deliverable: "All templates and content uploaded"
    },
    {
      week: 9,
      phase: "Load & Launch Readiness",
      phaseColor: "purple",
      milestone: "Launch Ready",
      deliverable: "Platform fully loaded and ready for engagement"
    }
  ],
  compensation: {
    total: 1500,
    currency: "USD",
    paymentStructure: "3 payments of $500 at beginning, middle, and on delivery",
    payments: [
      {
        id: "payment-1",
        amount: 500,
        trigger: "Beginning (Week 1)",
        status: "pending"
      },
      {
        id: "payment-2",
        amount: 500,
        trigger: "Middle (Week 5)",
        status: "pending"
      },
      {
        id: "payment-3",
        amount: 500,
        trigger: "On Delivery (Week 9)",
        status: "pending"
      }
    ]
  },
  totalPrice: 1500
};

console.log("BusinessPoint Law Proposal Data:");
console.log(JSON.stringify(BUSINESSPOINT_PROPOSAL, null, 2));
console.log("\n✅ Use this data structure when creating a proposal through the wizard or API");

