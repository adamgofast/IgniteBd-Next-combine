import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAIClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function runEcosystemOrgInference(raw: {
  name: string;
  website?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const prompt = `
You are an expert at analyzing ecosystem organizations for business development and industry mapping.

Given raw organization data:

Name: ${raw.name}
Website: ${raw.website || "N/A"}
City: ${raw.city || "N/A"}
State: ${raw.state || "N/A"}

Infer the following fields.
Return ONLY valid JSON.

{
  "name": "",
  "website": "",
  "city": "",
  "state": "",
  "archetype": "",               // ASSOCIATION | TRADE_GROUP | GUILD | NONPROFIT | GOVERNMENT | OTHER

  "whatTheyDo": "",
  "annualRevenue": null,
  "duesInfo": "",
  "memberCount": null,

  "memberDescription": "",
  "memberSeniority": "",
  "memberIndustries": [],
  "memberReasonForAffiliation": "",
  "memberAffiliationStrength": "",

  "orgRelevanceToCompanyHQ": "",
  "bdCompanyHQAffiliationScore": null,

  "targetPersonaAlignment": null
}
`;

  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}
