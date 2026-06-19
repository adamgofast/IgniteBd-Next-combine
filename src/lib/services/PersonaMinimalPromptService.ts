/**
 * PersonaMinimalPromptService
 * 
 * Builds the actual AI prompt for minimal persona generation
 * Matches the pattern used in TemplateAIGeneratorService:
 * - Explicit system prompt with strict JSON requirements
 * - Detailed user prompt with context
 * - Clear output format specification
 * - Validation-ready structure
 */

import { PreparedData } from './PersonaPromptPrepService';

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export class PersonaMinimalPromptService {
  /**
   * Build prompts for minimal persona generation
   * Follows the template service pattern for consistency
   */
  static buildPrompts(data: PreparedData, description?: string): PromptResult {
    const { contact, contactCompany, companyHQ } = data;

    // Validate required data
    if (!companyHQ) {
      throw new Error('companyHQ is required for persona generation');
    }

    // System prompt: Persona inference, not data mapping
    const systemPrompt = `You are a business persona inference engine. Your task is to infer a REUSABLE PERSONA MODEL from input signals. You are NOT preserving CRM data or mapping fields. You are creating an archetypal model that represents "who we are selling to" - not "who is in our database". Return only valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.`;

    // Build input signals section (these are WEAK SIGNALS for inference, not outputs)
    let inputSignals = '';
    if (contact) {
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      const contactCompanyName = contactCompany?.companyName || contact.companyName || 'Not specified';
      const contactIndustry = contactCompany?.industry || contact.companyIndustry || 'Not specified';
      
      inputSignals = `=== INPUT SIGNALS (for inference only) ===
Contact Name: ${fullName || 'Not specified'}
Contact Title: ${contact.title || 'Not specified'}
Contact Company: ${contactCompanyName}
Contact Industry: ${contactIndustry}`;
    } else if (description) {
      inputSignals = `=== INPUT SIGNAL (for inference only) ===
Description: ${description}`;
    }

    // Company context (also a signal, not output)
    const companyHQName = companyHQ.companyName || 'Not specified';
    const companyHQIndustry = companyHQ.companyIndustry || 'Not specified';
    const companyHQWhatYouDo = companyHQ.whatYouDo || 'Not specified';

    // User prompt: Persona inference philosophy
    const userPrompt = `You are inferring a REUSABLE PERSONA MODEL. This is NOT CRM hydration and NOT data preservation.

=== AUTHORITATIVE CONCEPT ===

We are inferring a REUSABLE PERSONA MODEL.

The persona should still make sense if:
- the person changes jobs
- the company name changes  
- the specific contact disappears

If the output resembles a real individual or exact employer, the persona is WRONG.

=== INPUT SIGNALS (for inference only) ===

CRM Context:
Company: ${companyHQName}
Industry: ${companyHQIndustry}
What We Do: ${companyHQWhatYouDo}

${inputSignals ? `${inputSignals}\n` : ''}

=== RULES (NON-NEGOTIABLE) ===

1. Contact name, exact title, and exact company name are NEVER the goal.
   These fields exist ONLY to infer:
   - role archetype
   - company TYPE
   - industry
   - goals
   - pain points
   - product needs

2. Literal reuse is allowed ONLY if it is already archetypal. Otherwise, GENERALIZE.

   Examples of generalization:
   - "Group Chief Compliance Officer" → "Chief Compliance Officer"
   - "Gemcorp Capital" → "Global Asset Management Firm"
   - "VP, Legal & Compliance" → "Compliance Leader"
   - "John Smith" → NEVER use real names
   - "Acme Corp" → "Mid-size B2B SaaS Company"

3. OUTPUT IS A MODEL, NOT A RECORD

   This output should feel like:
   "Who we are selling to"
   
   NOT
   "Who is in our database"

4. THINKING MODE

   Treat LinkedIn titles, company info, and CRM fields as WEAK SIGNALS.
   Infer intent, responsibility, pressure, and incentives.
   
   If the output looks like it belongs on LinkedIn or in Salesforce, you FAILED.
   If it looks like a slide titled "Target Persona: Compliance Leader at Asset Managers", you SUCCEEDED.

=== OUTPUT FORMAT ===

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "personName": "string",          // role archetype (never a real title string, never a person's name)
  "title": "string",               // simplified / generalized role (NOT literal title)
  "companyType": "string",         // abstracted company description (NOT literal company name)
  "companySize": "string",        // company size range (e.g., "1-10", "11-50", "51-200", "200-1000", "1000+")
  "industry": "string",            // broad industry classification
  "coreGoal": "string",            // one sentence, maximum ~25 words
  "painPoints": ["string"],        // 3–5 inferred pains (array of strings)
  "whatProductNeeds": "string"    // one sentence describing what product/service they need
}

=== FIELD REQUIREMENTS ===

1. **personName**: Role archetype label. NEVER a real person's name. NEVER a literal job title. 
   Examples: "Compliance Leader", "Operations Director", "Sales Executive", "Legal Counsel"
   BAD: "John Smith", "Deputy Counsel", "VP of Sales at Acme"

2. **title**: Simplified/generalized role. Generalize from input signals. Remove company-specific details.
   Examples: "Chief Compliance Officer", "Operations Director", "Sales Leader"
   BAD: "Group Chief Compliance Officer at Gemcorp Capital", "VP of Sales at Acme Corp"

3. **companyType**: Abstracted company description. NEVER use literal company names.
   Examples: "Global Asset Management Firm", "Mid-size B2B SaaS Company", "Enterprise Software Provider"
   BAD: "Gemcorp Capital", "Acme Corp", "TechCorp"

4. **companySize**: Company size range. Infer from input signals or use standard ranges.
   Examples: "1-10", "11-50", "51-200", "200-1000", "1000+", "Enterprise (1000+)"
   Use ranges, not specific numbers. Infer from company type and industry context.

5. **industry**: Broad industry classification. Use standard industry categories.
   Examples: "Asset Management", "Enterprise Software", "Financial Services", "Healthcare Technology"

6. **coreGoal**: One sentence describing their primary objective. Maximum ~25 words. NO bullet points, NO semicolons.

7. **painPoints**: Array of 3–5 inferred pain points. Each should be a complete sentence or phrase.
   Infer from role, industry, and company type - not from literal contact data.

8. **whatProductNeeds**: One sentence describing what product/service they need based on their role and pain points.

=== EXAMPLES ===

Example 1: Input signal is "John Smith, Group Chief Compliance Officer at Gemcorp Capital"
{
  "personName": "Compliance Leader",
  "title": "Chief Compliance Officer",
  "companyType": "Global Asset Management Firm",
  "companySize": "200-1000",
  "industry": "Asset Management",
  "coreGoal": "Ensure regulatory compliance across all investment activities while minimizing operational risk and maintaining investor trust.",
  "painPoints": [
    "Managing complex regulatory requirements across multiple jurisdictions",
    "Balancing compliance costs with operational efficiency",
    "Keeping up with evolving regulatory landscape",
    "Ensuring consistent compliance across distributed teams"
  ],
  "whatProductNeeds": "Compliance management platform that automates regulatory reporting and provides real-time risk monitoring."
}

Example 2: Input signal is "Jane Doe, VP of Sales at Acme Corp (B2B SaaS)"
{
  "personName": "Sales Leader",
  "title": "Sales Executive",
  "companyType": "Mid-size B2B SaaS Company",
  "companySize": "51-200",
  "industry": "Enterprise Software",
  "coreGoal": "Drive predictable revenue growth through strategic account management and sales team enablement.",
  "painPoints": [
    "Forecasting accuracy and pipeline visibility",
    "Sales team productivity and quota attainment",
    "Competitive differentiation in crowded market",
    "Customer acquisition cost optimization"
  ],
  "whatProductNeeds": "Sales enablement tools that improve pipeline management and accelerate deal cycles."
}

Example 3: Input signal is "Sarah Johnson, Operations Director at TechCorp"
{
  "personName": "Operations Director",
  "title": "Operations Leader",
  "companyType": "Technology Services Company",
  "companySize": "11-50",
  "industry": "Technology Services",
  "coreGoal": "Optimize operational efficiency while scaling business processes to support growth.",
  "painPoints": [
    "Process standardization across growing organization",
    "Resource allocation and capacity planning",
    "Operational cost management",
    "Maintaining quality standards during rapid scaling"
  ],
  "whatProductNeeds": "Operations management platform that provides process automation and performance analytics."
}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.`;

    return { systemPrompt, userPrompt };
  }
}

